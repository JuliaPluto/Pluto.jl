
# because i like that
Base.IOContext(io::IOContext, ::Nothing) = io

"The `IOContext` used for converting arbitrary objects to pretty strings."
const default_iocontext = IOContext(devnull, 
    :color => true, 
    :limit => true, 
    :displaysize => (18, 88), 
    :is_pluto => true, 
    :pluto_supported_integration_features => supported_integration_features,
    :pluto_published_to_js => (io, x) -> core_published_to_js(io, x),
    :pluto_with_js_link => (io, callback, on_cancellation) -> core_with_js_link(io, callback, on_cancellation),
    :pluto_auto_id! => auto_id!,
    :pluto_embed_display => (io, x, script_id) -> EmbeddableDisplay(x, script_id),
)

# `stdout` mimics a TTY, the only relevant property is :color
const default_stdout_iocontext = IOContext(devnull, 
    :color => true,
    :is_pluto => false,
)

# `display` sees a richer context like in the REPL, see #2727
const default_display_iocontext = IOContext(devnull,
    :color => true,
    :limit => true,
    :displaysize => (18, 75),
    :is_pluto => false,
)