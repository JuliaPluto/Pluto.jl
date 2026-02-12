
function http_router_for(session::ServerSession)
    router = HTTP.Router(default_404_response)
    security = session.options.security
    
    function create_serve_onefile(path)
        return request::HTTP.Request -> asset_response(normpath(path))
    end
    
    HTTP.register!(router, "GET", "/", create_serve_onefile(project_relative_path(frontend_directory(), "index.html")))
    HTTP.register!(router, "GET", "/edit", create_serve_onefile(project_relative_path(frontend_directory(), "editor.html")))

    HTTP.register!(router, "GET", "/ping", r -> HTTP.Response(200, "OK!"))
    HTTP.register!(router, "GET", "/auth-check", r -> HTTP.Response(200, "OK!"))
    HTTP.register!(router, "GET", "/possible_binder_token_please", r -> session.binder_token === nothing ? HTTP.Response(200,"") : HTTP.Response(200, session.binder_token))
    
    function try_launch_notebook_response(
        action::Function, path_or_url::AbstractString; 
        as_redirect=true,
        title="", advice="", home_url="./", 
        action_kwargs...
    )
        try
            nb = action(session, path_or_url; action_kwargs...)
            notebook_response(nb; home_url, as_redirect)
        catch e
            if e isa SessionActions.NotebookIsRunningException
                notebook_response(e.notebook; home_url, as_redirect)
            else
                error_response(500, title, advice, sprint(showerror, e, stacktrace(catch_backtrace())))
            end
        end
    end

    function serve_newfile(request::HTTP.Request)
        notebook_response(SessionActions.new(session); as_redirect=(request.method == "GET"))
    end
    HTTP.register!(router, "GET", "/new", serve_newfile)
    HTTP.register!(router, "POST", "/new", serve_newfile)

    # This is not in Dynamic.jl because of bookmarks, how HTML works,
    # real loading bars and the rest; Same for CustomLaunchEvent
    function serve_openfile(request::HTTP.Request)
        try
            uri = HTTP.URI(request.target)
            query = HTTP.queryparams(uri)
            as_sample = istruthyquery(query, "as_sample")
            execution_allowed = istruthyquery(query, "execution_allowed")
            if haskey(query, "path")
                path = tamepath(maybe_convert_path_to_wsl(query["path"]))
                if isfile(path)
                    return try_launch_notebook_response(
                        SessionActions.open, path; 
                        execution_allowed,
                        as_redirect=(request.method == "GET"), 
                        as_sample, 
                        risky_file_source=nothing,
                        title="Failed to load notebook", 
                        advice="The file <code>$(htmlesc(path))</code> could not be loaded. Please <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!",
                    )
                else
                    return error_response(404, "Can't find a file here", "Please check whether <code>$(htmlesc(path))</code> exists.")
                end
            elseif haskey(query, "url")
                url = query["url"]
                return try_launch_notebook_response(
                    SessionActions.open_url, url;
                    execution_allowed,
                    as_redirect=(request.method == "GET"), 
                    as_sample, 
                    risky_file_source=url,
                    title="Failed to load notebook", 
                    advice="The notebook from <code>$(htmlesc(url))</code> could not be loaded. Please <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!"
                )
            else
                # You can ask Pluto to handle CustomLaunch events
                # and do some magic with how you open files.
                # You are responsible to keep this up to date.
                # See Events.jl for types and explanation
                #
                maybe_notebook_response = try_event_call(session, CustomLaunchEvent(query, request, try_launch_notebook_response))
                isnothing(maybe_notebook_response) && return error("Empty request")
                return maybe_notebook_response
            end
        catch e
            return error_response(400, "Bad query", "Please <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!", sprint(showerror, e, stacktrace(catch_backtrace())))
        end
    end

    HTTP.register!(router, "GET", "/open", serve_openfile)
    HTTP.register!(router, "POST", "/open", serve_openfile)


    # normally shutdown is done through Dynamic.jl, with the exception of shutdowns made from the desktop app
    function serve_shutdown(request::HTTP.Request)
        notebook = notebook_from_uri(request)
        SessionActions.shutdown(session, notebook)
        return HTTP.Response(200)
    end

    HTTP.register!(router, "GET", "/shutdown", serve_shutdown)
    HTTP.register!(router, "POST", "/shutdown", serve_shutdown)


    # used in desktop app
    # looks like `/move?id=<notebook-id>&newpath=<new-notebook-path>``
    function serve_move(request::HTTP.Request)
        uri = HTTP.URI(request.target)        
        query = HTTP.queryparams(uri)

        notebook = notebook_from_uri(request)
        newpath = query["newpath"]
        
        try
            SessionActions.move(session, notebook, newpath)
            HTTP.Response(200, notebook.path)
        catch e
            error_response(400, "Bad query", "Please <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!", sprint(showerror, e, stacktrace(catch_backtrace())))
        end
    end

    HTTP.register!(router, "GET", "/move", serve_move)
    HTTP.register!(router, "POST", "/move", serve_move)


    function serve_notebooklist(request::HTTP.Request)
        return HTTP.Response(200, pack(Dict(k => v.path for (k, v) in session.notebooks)))
    end

    HTTP.register!(router, "GET", "/notebooklist", serve_notebooklist)

    
    function serve_sample(request::HTTP.Request)
        uri = HTTP.URI(request.target)
        sample_filename = split(HTTP.unescapeuri(uri.path), "sample/")[2]
        sample_path = project_relative_path("sample", sample_filename)
        
        try_launch_notebook_response(
            SessionActions.open, sample_path; 
            as_redirect=(request.method == "GET"), 
            home_url="../", 
            as_sample=true, 
            title="Failed to load sample", 
            advice="Please <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!"
        )
    end
    HTTP.register!(router, "GET", "/sample/*", serve_sample)
    HTTP.register!(router, "POST","/sample/*", serve_sample)

    function notebook_from_uri(request)
        uri = HTTP.URI(request.target)        
        query = HTTP.queryparams(uri)
        id = UUID(query["id"])
        session.notebooks[id]
    end
    function serve_notebookfile(request::HTTP.Request)
        try
            notebook = notebook_from_uri(request)
            response = HTTP.Response(200, sprint(save_notebook, notebook))
            HTTP.setheader(response, "Content-Type" => "text/julia; charset=utf-8")
            HTTP.setheader(response, "Content-Disposition" => "inline; filename=\"$(basename(notebook.path))\"")
            response
        catch e
            return error_response(400, "Bad query", "Please <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!", sprint(showerror, e, stacktrace(catch_backtrace())))
        end
    end
    HTTP.register!(router, "GET", "/notebookfile", serve_notebookfile)

    function serve_statefile(request::HTTP.Request)
        try
            notebook = notebook_from_uri(request)
            response = HTTP.Response(200, Pluto.pack(Pluto.notebook_to_js(notebook)))
            HTTP.setheader(response, "Content-Type" => "application/octet-stream")
            HTTP.setheader(response, "Content-Disposition" => "attachment; filename=\"$(without_pluto_file_extension(basename(notebook.path))).plutostate\"")
            response
        catch e
            return error_response(400, "Bad query", "Please <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!", sprint(showerror, e, stacktrace(catch_backtrace())))
        end
    end
    HTTP.register!(router, "GET", "/statefile", serve_statefile)

    function serve_notebookexport(request::HTTP.Request)
        try
            notebook = notebook_from_uri(request)
            offline_bundle = istruthyquery(request, "offline_bundle")
            response = HTTP.Response(200, generate_html(notebook; offline_bundle))
            HTTP.setheader(response, "Content-Type" => "text/html; charset=utf-8")
            HTTP.setheader(response, "Content-Disposition" => "attachment; filename=\"$(without_pluto_file_extension(basename(notebook.path))).html\"")
            response
        catch e
            return error_response(400, "Bad query", "Please <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!", sprint(showerror, e, stacktrace(catch_backtrace())))
        end
    end
    HTTP.register!(router, "GET", "/notebookexport", serve_notebookexport)
    
    function serve_notebookupload(request::HTTP.Request)
        uri = HTTP.URI(request.target)
        query = HTTP.queryparams(uri)
        
        save_path = SessionActions.save_upload(request.body; filename_base=get(query, "name", nothing))
        
        try_launch_notebook_response(
            SessionActions.open,
            save_path;
            as_redirect=false,
            as_sample=false,
            execution_allowed=istruthyquery(query, "execution_allowed"),
            clear_frontmatter=istruthyquery(query, "clear_frontmatter"),
            title="Failed to load notebook",
            advice="The contents could not be read as a Pluto notebook file. When copying contents from somewhere else, make sure that you copy the entire notebook file.  You can also <a href='https://github.com/JuliaPluto/Pluto.jl/issues'>report this error</a>!"
        )
    end
    HTTP.register!(router, "POST", "/notebookupload", serve_notebookupload)
    
    function serve_asset(request::HTTP.Request)
        uri = HTTP.URI(request.target)
        filepath = project_relative_path(frontend_directory(), relpath(HTTP.unescapeuri(uri.path), "/"))
        asset_response(filepath; cacheable=should_cache(filepath))
    end
    HTTP.register!(router, "GET", "/**", serve_asset)

    HTTP.register!(router, "GET", "/favicon.ico", create_serve_onefile(project_relative_path(frontend_directory(allow_bundled=false), "img", "favicon.ico")))

    return scoped_router(session.options.server.base_url, router)
end

function istruthyquery(query::Dict, key::String)
	val = get(query, key, nothing)
	if val === nothing
		false
	else
		lowercase(val) ∉ ("false", "0")
	end
end
istruthyquery(url::String, key::String) = istruthyquery(HTTP.queryparams(HTTP.URI(url)), key)
istruthyquery(request::HTTP.Request, key::String) = istruthyquery(request.target, key)


"""
    scoped_router(base_url::String, base_router::HTTP.Router)::HTTP.Router

Returns a new `HTTP.Router` which delegates all requests to `base_router` but with requests trimmed
so that they seem like they arrived at `/**` instead of `/\$base_url/**`.
"""
function scoped_router(base_url, base_router)
    base_url == "/" && return base_router

    @assert startswith(base_url, '/') "base_url \"$base_url\" should start with a '/'"
    @assert endswith(base_url, '/')  "base_url \"$base_url\" should end with a '/'"
    @assert !occursin('*', base_url) "'*' not allowed in base_url \"$base_url\" "

    function handler(request)
        request.target = request.target[length(base_url):end]
        return base_router(request)
    end

    router = HTTP.Router(base_router._404, base_router._405)
    HTTP.register!(router, base_url * "**", handler)
    HTTP.register!(router, base_url, handler)

    return router
end

