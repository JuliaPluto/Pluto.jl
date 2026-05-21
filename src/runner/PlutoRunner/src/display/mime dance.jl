import Markdown

const imagemimes = MIME[MIME"image/svg+xml"(), MIME"image/png"(), MIME"image/jpg"(), MIME"image/jpeg"(), MIME"image/bmp"(), MIME"image/gif"()]
# in descending order of coolness
# text/plain always matches - almost always
"""
The MIMEs that Pluto supports, in order of how much I like them.

`text/plain` should always match - the difference between `show(::IO, ::MIME"text/plain", x)` and `show(::IO, x)` is an unsolved mystery.
"""
const allmimes = MIME[MIME"application/vnd.pluto.table+object"(); MIME"application/vnd.pluto.reactdomelement+object"(); MIME"text/html"(); imagemimes; MIME"application/vnd.pluto.tree+object"(); MIME"text/latex"(); MIME"text/plain"()]


"Return a `(String, Any)` tuple containing function output as the second entry."
function show_richest_withreturned(context::IOContext, @nospecialize(args))
    buffer = IOBuffer(; sizehint=0)
    val = show_richest(IOContext(buffer, context), args)
    return (take!(buffer), val)
end

"Super important thing don't change."
struct 🥔 end
const struct_showmethod = which(show, (IO, 🥔))
const struct_showmethod_mime = which(show, (IO, MIME"text/plain", 🥔))

function use_tree_viewer_for_struct(@nospecialize(x::T))::Bool where T
    # types that have no specialized show methods (their fallback is text/plain) are displayed using Pluto's interactive tree viewer.
    # this is how we check whether this display method is appropriate:
    isstruct = try
        T isa DataType &&
        # there are two ways to override the plaintext show method:
        which(show, (IO, MIME"text/plain", T)) === struct_showmethod_mime &&
        which(show, (IO, T)) === struct_showmethod
    catch
        false
    end

    isstruct && let
        # from julia source code, dont know why
        nf = nfields(x)
        nb = sizeof(x)
        nf != 0 || nb == 0
    end
end

"""
    is_mime_enabled(::MIME) -> Bool

Return whether the argument's mimetype is enabled.
This defaults to `true`, but additional dispatches can be set to `false` by downstream packages.
"""
is_mime_enabled(::MIME) = true

"Return the first mimetype in `allmimes` which can show `x`."
function mimetype(x)
    # ugly code to fix an ugly performance problem
    for m in allmimes
        if pluto_showable(m, x) && is_mime_enabled(m)
            return m
        end
    end
end

"""
Like two-argument `Base.show`, except:
1. the richest MIME type available to Pluto will be used
2. the used MIME type is returned as second element
3. if the first returned element is `nothing`, then we wrote our data to `io`. If it is something else (a Dict), then that object will be the cell's output, instead of the buffered io stream. This allows us to output rich objects to the frontend that are not necessarily strings or byte streams
"""
function show_richest(io::IO, @nospecialize(x))::Tuple{<:Any,MIME}
    mime = mimetype(x)

    if mime isa MIME"text/plain" && is_mime_enabled(MIME"application/vnd.pluto.tree+object"()) && use_tree_viewer_for_struct(x)
        tree_data(x, io), MIME"application/vnd.pluto.tree+object"()
    elseif mime isa MIME"application/vnd.pluto.tree+object"
        try
            tree_data(x, IOContext(io, :compact => true)), mime
        catch
            show(io, MIME"text/plain"(), x)
            nothing, MIME"text/plain"()
        end
    elseif mime isa MIME"application/vnd.pluto.table+object"
        try
            table_data(x, IOContext(io, :compact => true)), mime
        catch
            show(io, MIME"text/plain"(), x)
            nothing, MIME"text/plain"()
        end
    elseif mime isa MIME"application/vnd.pluto.reactdomelement+object"
        reactdom_data(x, io), mime
    elseif mime ∈ imagemimes
        show(io, mime, x)
        nothing, mime
    elseif mime isa MIME"text/latex"
        # Some reprs include $ at the start and end.
        # We strip those, since Markdown.LaTeX should contain the math content.
        # (It will be rendered by MathJax, which is math-first, not text-first.)
        texed = repr(mime, x)
        Markdown.html(io, Markdown.LaTeX(strip(texed, ('$', '\n', ' '))))
        nothing, MIME"text/html"()
    else
        # the classic:
        show(io, mime, x)
        nothing, mime
    end
end

# we write our own function instead of extending Base.showable with our new MIME because:
# we need the method Base.showable(::MIME"asdfasdf", ::Any) = Tables.rowaccess(x)
# but overload ::MIME{"asdf"}, ::Any will cause ambiguity errors in other packages that write a method like:
# Base.showable(m::MIME, x::Plots.Plot)
# because MIME is less specific than MIME"asdff", but Plots.PLot is more specific than Any.
pluto_showable(m::MIME, @nospecialize(x))::Bool = Base.invokelatest(showable, m, x)
