
const _EmbeddableDisplay_enable_html_shortcut = Ref{Bool}(true)

struct EmbeddableDisplay
    x
    script_id
end

function Base.show(io::IO, m::MIME"text/html", e::EmbeddableDisplay)
    body, mime = format_output_default(e.x, io)

    to_write = if mime === m && _EmbeddableDisplay_enable_html_shortcut[]
        # In this case, we can just embed the HTML content directly.
        body
    else
        script_id = sprint(show, e.script_id; context=io)
        body_js = sprint(core_published_to_js, body; context=io)
        
        s = """<pluto-display></pluto-display><script id=$(script_id)>

        // see https://plutocon2021-demos.netlify.app/fonsp%20%E2%80%94%20javascript%20inside%20pluto to learn about the techniques used in this script
        
        const body = $(body_js);
        const mime = "$(string(mime))";
        
        const create_new = this == null || this._mime !== mime;
        
        const display = create_new ? currentScript.previousElementSibling : this;
        
        display.persist_js_state = true;
        display.sanitize_html = false;
        display.body = body;
        if(create_new) {
            // only set the mime if necessary, it triggers a second preact update
            display.mime = mime;
            // add it also as unwatched property to prevent interference from Preact
            display._mime = mime;
        }
        return display;

        </script>"""
        
        # Remove comments
        replace(replace(s, r"//.+" => ""), "\n" => "")
    end
    write(io, to_write)
end



# if an embedded display is being rendered _directly by Pluto's viewer_, then rendered the embedded object directly. When interpolating an embedded display into HTML, the user code will render the embedded display to HTML using the HTML show method above, and this shortcut is not called.
# We add this short-circuit to increase performance for UI that uses an embedded display when it is not necessary.
format_output_default(@nospecialize(val::EmbeddableDisplay), @nospecialize(context=default_iocontext)) = format_output_default(val.x, context)

