import .Throttled

"""
Return whether the `request` was authenticated in one of two ways:
1. the session's `secret` was included in the URL as a search parameter, or
2. the session's `secret` was included in a cookie.
"""
function is_authenticated(session::ServerSession, request::HTTP.Request)
    (
        secret_in_url = try
            uri = HTTP.URI(request.target)
            query = HTTP.queryparams(uri)
            get(query, "secret", "") == session.secret
        catch e
            @warn "Failed to authenticate request using URL" exception = (e, catch_backtrace())
            false
        end
    ) || (
        secret_in_cookie = try
            cookies = HTTP.cookies(request)
            any(cookies) do cookie
                cookie.name == "secret" && cookie.value == session.secret
            end
        catch e
            @warn "Failed to authenticate request using cookies" exception = (e, catch_backtrace())
            false
        end
    )
    # that ) || ( kind of looks like Krabs from spongebob
end

# Function to log the url with secret on the Julia CLI when a request comes to the server without the secret. Executes at most once every 5 seconds
const log_secret_throttled = Throttled.simple_leading_throttle(5) do session::ServerSession, request::HTTP.Request
    host = HTTP.header(request, "Host")
    target = request.target
    url = Text(string(HTTP.URI(HTTP.URI("http://$host/"); query=Dict("secret" => session.secret))))
    @info("No longer authenticated? Visit this URL to continue:", url)
end


function add_set_secret_cookie!(session::ServerSession, response::HTTP.Response)
    HTTP.setheader(response, "Set-Cookie" => "secret=$(session.secret); SameSite=Strict; HttpOnly")
    response
end

# too many layers i know
"""
Generate a middleware (i.e. a function `HTTP.Handler -> HTTP.Handler`) that stores the `session` in every `request`'s context.
"""
function create_session_context_middleware(session::ServerSession)
    function session_context_middleware(handler::Function)::Function
        function(request::HTTP.Request)
            request.context[:pluto_session] = session
            handler(request)
        end
    end
end


session_from_context(request::HTTP.Request) = request.context[:pluto_session]::ServerSession


function auth_required(session::ServerSession, request::HTTP.Request)
    path = HTTP.URI(request.target).path
    ext = splitext(path)[2]
    security = session.options.security

    if path ∈ ("/ping", "/possible_binder_token_please") || ext ∈ (".ico", ".js", ".css", ".png", ".gif", ".svg", ".ico", ".woff2", ".woff", ".ttf", ".eot", ".otf", ".json", ".map")
        false
    elseif path ∈ ("", "/")
        # / does not need security.require_secret_for_open_links, because this is how we handle the configuration where:
        #    require_secret_for_open_links == true
        #    require_secret_for_access == false
        # 
        # This means that access to all 'risky' endpoints is restricted to authenticated requests (to prevent CSRF), but we allow an unauthenticated request to visit the `/` page and acquire the cookie (see `add_set_secret_cookie!`).
        # 
        # (By default, `require_secret_for_access` (and `require_secret_for_open_links`) is `true`.)
        security.require_secret_for_access
    else
        security.require_secret_for_access || 
        security.require_secret_for_open_links
    end
end


"""
    auth_middleware(f::HTTP.Handler) -> HTTP.Handler

Returns an `HTTP.Handler` (i.e. a function `HTTP.Request → HTTP.Response`) which does three things:
1. Check whether the request is authenticated (by calling `is_authenticated`), if not, return a 403 error.
2. Call your `f(request)` to create the response message.
3. Add a `Set-Cookie` header to the response with the session's `secret`.

This is for HTTP requests, the authentication mechanism for WebSockets is separate.
"""
function auth_middleware(handler)
    return function (request::HTTP.Request)
        session = session_from_context(request)
        required = auth_required(session, request)
        
        if !required || is_authenticated(session, request)
            response = handler(request)
            if !required
                # setheader replaces any existing values for this key.
                HTTP.setheader(response, "Access-Control-Allow-Origin" => "*")
            end
            if required || HTTP.URI(request.target).path ∈ ("", "/")
                add_set_secret_cookie!(session, response)
            end
            response
        else
            log_secret_throttled(session, request)
            error_response(403, "Not yet authenticated", "<b>Open the link that was printed in the terminal where you launched Pluto.</b> It includes a <em>secret</em>, which is needed to access this server.<br><br>If you are running the server yourself and want to change this configuration, have a look at the keyword arguments to <em>Pluto.run</em>. <br><br>Please <a href='https://github.com/fonsp/Pluto.jl/issues'>report this error</a> if you did not expect it!")
        end
    end
end
