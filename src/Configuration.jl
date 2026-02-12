"""
The full list of keyword arguments that can be passed to [`Pluto.run`](@ref) (or [`Pluto.Configuration.from_flat_kwargs`](@ref)) is divided into four categories. Take a look at the documentation for:

- [`Pluto.Configuration.CompilerOptions`](@ref) defines the command line arguments for notebook `julia` processes.
- [`Pluto.Configuration.ServerOptions`](@ref) configures the HTTP server.
- [`Pluto.Configuration.SecurityOptions`](@ref) configures the authentication options for Pluto's HTTP server. Change with caution.
- [`Pluto.Configuration.EvaluationOptions`](@ref) is used internally during Pluto's testing.

Note that Pluto is designed to be _zero-configuration_, and most users should not (have to) change these settings. Most 'customization' can be achieved using Julia's wide range of packages! That being said, the available settings are useful if you are using Pluto in a special environment, such as docker, mybinder, etc.
"""
module Configuration

using Configurations # https://github.com/Roger-luo/Configurations.jl

import ..Pluto: tamepath

safepwd() = try
    pwd()
catch e
    @warn "pwd() failure" exception=(e, catch_backtrace())
    homedir()
end


# Using a ref to avoid fixing the pwd() output during the compilation phase. We don't want this value to be baked into the sysimage, because it depends on the `pwd()`. We do want to cache it, because the pwd might change while Pluto is running.
const pwd_ref = Ref{String}()
function notebook_path_suggestion()
    pwd_val = if isassigned(pwd_ref)
        pwd_ref[]
    else
        safepwd()
    end
    preferred_dir = startswith(Sys.BINDIR, pwd_val) ? homedir() : pwd_val
    # so that it ends with / or \
    string(joinpath(preferred_dir, ""))
end

function __init__()
    pwd_ref[] = safepwd()
end


const ROOT_URL_DEFAULT = nothing
const BASE_URL_DEFAULT = "/"
const HOST_DEFAULT = "127.0.0.1"
const PORT_DEFAULT = nothing
const PORT_HINT_DEFAULT = 1234
const LAUNCH_BROWSER_DEFAULT = true
const DISMISS_UPDATE_NOTIFICATION_DEFAULT = false
const DISMISS_MOTIVATIONAL_QUOTES = false
const SHOW_FILE_SYSTEM_DEFAULT = true
const ENABLE_AI_EDITOR_FEATURES_DEFAULT = true
const DISABLE_WRITING_NOTEBOOK_FILES_DEFAULT = false
const AUTO_RELOAD_FROM_FILE_DEFAULT = false
const AUTO_RELOAD_FROM_FILE_COOLDOWN_DEFAULT = 0.4
const AUTO_RELOAD_FROM_FILE_IGNORE_PKG_DEFAULT = false
const NOTEBOOK_DEFAULT = nothing
const SIMULATED_LAG_DEFAULT = 0.0
const SIMULATED_PKG_LAG_DEFAULT = 0.0
const INJECTED_JAVASCRIPT_DATA_URL_DEFAULT = "data:text/javascript;base64,"
const ON_EVENT_DEFAULT = function(a) #= @info "$(typeof(a))" =# end

"""
    ServerOptions([; kwargs...])

The HTTP server options. See [`SecurityOptions`](@ref) for additional settings.

# Keyword arguments

- `host::String = "$HOST_DEFAULT"` Set to `"127.0.0.1"` (default) to run on *localhost*, which makes the server available to your computer and the local network (LAN). Set to `"0.0.0.0"` to make the server available to the entire network (internet).
- `port::Union{Nothing,Integer} = $PORT_DEFAULT` When specified, this port will be used for the server.
- `port_hint::Integer = $PORT_HINT_DEFAULT` If the other setting `port` is not specified, then this setting (`port_hint`) will be used as the starting point in finding an available port to run the server on. 
- `launch_browser::Bool = $LAUNCH_BROWSER_DEFAULT`
- `dismiss_update_notification::Bool = $DISMISS_UPDATE_NOTIFICATION_DEFAULT` If `false`, the Pluto frontend will check the Pluto.jl github releases for any new recommended updates, and show a notification if there are any. If `true`, this is disabled.
- `dismiss_motivational_quotes::Bool = $DISMISS_MOTIVATIONAL_QUOTES` If `true`, motivational quotes on error messages won't be shown.
- `show_file_system::Bool = $SHOW_FILE_SYSTEM_DEFAULT`
- `enable_ai_editor_features::Bool = $ENABLE_AI_EDITOR_FEATURES_DEFAULT` Enable or disable LLM-powered editor features
- `notebook_path_suggestion::String = notebook_path_suggestion()`
- `disable_writing_notebook_files::Bool = $DISABLE_WRITING_NOTEBOOK_FILES_DEFAULT`
- `auto_reload_from_file::Bool = $AUTO_RELOAD_FROM_FILE_DEFAULT` Watch notebook files for outside changes and update running notebook state automatically
- `auto_reload_from_file_cooldown::Real = $AUTO_RELOAD_FROM_FILE_COOLDOWN_DEFAULT` Experimental, will be removed
- `auto_reload_from_file_ignore_pkg::Bool = $AUTO_RELOAD_FROM_FILE_IGNORE_PKG_DEFAULT` Experimental flag, will be removed
- `notebook::Union{Nothing,String} = $NOTEBOOK_DEFAULT` Optional path of notebook to launch at start
- `simulated_lag::Real=$SIMULATED_LAG_DEFAULT` (internal) Extra lag to add to our server responses. Will be multiplied by `0.5 + rand()`.
- `simulated_pkg_lag::Real=$SIMULATED_PKG_LAG_DEFAULT` (internal) Extra lag to add to operations done by Pluto's package manager. Will be multiplied by `0.5 + rand()`.
- `injected_javascript_data_url::String = "$INJECTED_JAVASCRIPT_DATA_URL_DEFAULT"` (internal) Optional javascript injectables to the front-end. Can be used to customize the editor, but this API is not meant for general use yet.
- `on_event::Function = $ON_EVENT_DEFAULT`
- `root_url::Union{Nothing,String} = $ROOT_URL_DEFAULT` This setting is used to specify the root URL of the Pluto server, but this setting is *only* used to customize the launch message (*"Go to http://localhost:1234/ in your browser"*). You can probably ignore this and use `base_url` instead.
- `base_url::String = "$BASE_URL_DEFAULT"` This (advanced) setting is used to specify a subpath at which the Pluto server will run, it should be a path starting and ending with a '/'. E.g. with `base_url = "/hello/world/"`, the server will run at `http://localhost:1234/hello/world/`, and you edit a notebook at `http://localhost:1234/hello/world/edit?id=...`.
"""
@option mutable struct ServerOptions
    root_url::Union{Nothing,String} = ROOT_URL_DEFAULT
    base_url::String = BASE_URL_DEFAULT
    host::String = HOST_DEFAULT
    port::Union{Nothing,Integer} = PORT_DEFAULT
    port_hint::Integer = PORT_HINT_DEFAULT
    launch_browser::Bool = LAUNCH_BROWSER_DEFAULT
    dismiss_update_notification::Bool = DISMISS_UPDATE_NOTIFICATION_DEFAULT
    dismiss_motivational_quotes::Bool = DISMISS_MOTIVATIONAL_QUOTES
    show_file_system::Bool = SHOW_FILE_SYSTEM_DEFAULT
    enable_ai_editor_features::Bool = ENABLE_AI_EDITOR_FEATURES_DEFAULT
    notebook_path_suggestion::String = notebook_path_suggestion()
    disable_writing_notebook_files::Bool = DISABLE_WRITING_NOTEBOOK_FILES_DEFAULT
    auto_reload_from_file::Bool = AUTO_RELOAD_FROM_FILE_DEFAULT
    auto_reload_from_file_cooldown::Real = AUTO_RELOAD_FROM_FILE_COOLDOWN_DEFAULT
    auto_reload_from_file_ignore_pkg::Bool = AUTO_RELOAD_FROM_FILE_IGNORE_PKG_DEFAULT
    notebook::Union{Nothing,String,Vector{<:String}} = NOTEBOOK_DEFAULT
    simulated_lag::Real = SIMULATED_LAG_DEFAULT
    simulated_pkg_lag::Real = SIMULATED_PKG_LAG_DEFAULT
    injected_javascript_data_url::String = INJECTED_JAVASCRIPT_DATA_URL_DEFAULT
    on_event::Function = ON_EVENT_DEFAULT
end

const REQUIRE_SECRET_FOR_OPEN_LINKS_DEFAULT = true
const REQUIRE_SECRET_FOR_ACCESS_DEFAULT = true
const WARN_ABOUT_UNTRUSTED_CODE_DEFAULT = true

"""
    SecurityOptions([; kwargs...])

Security settings for the HTTP server. 

# Arguments

- `require_secret_for_open_links::Bool = $REQUIRE_SECRET_FOR_OPEN_LINKS_DEFAULT`

    Whether the links `http://localhost:1234/open?path=/a/b/c.jl`  and `http://localhost:1234/open?url=http://www.a.b/c.jl` should be protected. 

    Use `true` for almost every setup. Only use `false` if Pluto is running in a safe container (like mybinder.org), where arbitrary code execution is not a problem.

- `require_secret_for_access::Bool = $REQUIRE_SECRET_FOR_ACCESS_DEFAULT`

    If `false`, you do not need to use a `secret` in the URL to access Pluto: you will be authenticated by visiting `http://localhost:1234/` in your browser. An authentication cookie is still used for access (to prevent XSS and deceptive links or an img src to `http://localhost:1234/open?url=badpeople.org/script.jl`), and is set automatically, but this request to `/` is protected by cross-origin policy.

    Use `true` on a computer used by multiple people simultaneously. Only use `false` if necessary.

- `warn_about_untrusted_code::Bool = $WARN_ABOUT_UNTRUSTED_CODE_DEFAULT`

    Should the Pluto GUI show warning messages about executing code from an unknown source, e.g. when opening a notebook from a URL? When `false`, notebooks will still open in Safe mode, but there is no scary message when you run it.
        
**Leave these options on `true` for the most secure setup.**

Note that Pluto is quickly evolving software, maintained by designers, educators and enthusiasts — not security experts. If security is a serious concern for your application, then we recommend running Pluto inside a container and verifying the relevant security aspects of Pluto yourself.
"""
@option mutable struct SecurityOptions
    require_secret_for_open_links::Bool = REQUIRE_SECRET_FOR_OPEN_LINKS_DEFAULT
    require_secret_for_access::Bool = REQUIRE_SECRET_FOR_ACCESS_DEFAULT
    warn_about_untrusted_code::Bool = WARN_ABOUT_UNTRUSTED_CODE_DEFAULT
end

const RUN_NOTEBOOK_ON_LOAD_DEFAULT = true
const WORKSPACE_USE_DISTRIBUTED_DEFAULT = true
const WORKSPACE_USE_DISTRIBUTED_STDLIB_DEFAULT = nothing
const LAZY_WORKSPACE_CREATION_DEFAULT = false
const CAPTURE_STDOUT_DEFAULT = true
const WORKSPACE_CUSTOM_STARTUP_EXPR_DEFAULT = nothing

"""
    EvaluationOptions([; kwargs...])

Options to change Pluto's evaluation behaviour during internal testing and by downstream packages.
These options are not intended to be changed during normal use.

- `run_notebook_on_load::Bool = $RUN_NOTEBOOK_ON_LOAD_DEFAULT` When running a notebook (not in Safe mode), should all cells evaluate immediately? Warning: this is only for internal testing, and using it will lead to unexpected behaviour and hard-to-reproduce notebooks. It's not the Pluto way!
- `workspace_use_distributed::Bool = $WORKSPACE_USE_DISTRIBUTED_DEFAULT` Whether to start notebooks in a separate process. Setting this to `false` is only meant for very advanced users, many features will be broken or behave unexpectedly (inlcuding anything related to package loading or interrupts).
- `workspace_use_distributed_stdlib::Bool? = $WORKSPACE_USE_DISTRIBUTED_STDLIB_DEFAULT` Should we use the Distributed stdlib to run processes, instead of the new Malt.jl runner? You can use `true` to get the old behaviour. `nothing` means: determine automatically (which is currently `false`).
- `lazy_workspace_creation::Bool = $LAZY_WORKSPACE_CREATION_DEFAULT`
- `capture_stdout::Bool = $CAPTURE_STDOUT_DEFAULT`
- `workspace_custom_startup_expr::Union{Nothing,String} = $WORKSPACE_CUSTOM_STARTUP_EXPR_DEFAULT` An expression to be evaluated in the workspace process before running notebook code. Warning: this will mean that your notebooks are not reproducible.
"""
@option mutable struct EvaluationOptions
    run_notebook_on_load::Bool = RUN_NOTEBOOK_ON_LOAD_DEFAULT
    workspace_use_distributed::Bool = WORKSPACE_USE_DISTRIBUTED_DEFAULT
    workspace_use_distributed_stdlib::Union{Bool,Nothing} = WORKSPACE_USE_DISTRIBUTED_STDLIB_DEFAULT
    lazy_workspace_creation::Bool = LAZY_WORKSPACE_CREATION_DEFAULT
    capture_stdout::Bool = CAPTURE_STDOUT_DEFAULT
    workspace_custom_startup_expr::Union{Nothing,String} = WORKSPACE_CUSTOM_STARTUP_EXPR_DEFAULT
end

const COMPILE_DEFAULT = nothing
const PKGIMAGES_DEFAULT = nothing
const COMPILED_MODULES_DEFAULT = nothing
const SYSIMAGE_DEFAULT = nothing
const SYSIMAGE_NATIVE_CODE_DEFAULT = nothing
const BANNER_DEFAULT = nothing
const DEPWARN_DEFAULT = nothing
const OPTIMIZE_DEFAULT = nothing
const MIN_OPTLEVEL_DEFAULT = nothing
const INLINE_DEFAULT = nothing
const CHECK_BOUNDS_DEFAULT = nothing
const MATH_MODE_DEFAULT = nothing
const STARTUP_FILE_DEFAULT = "no"
const HISTORY_FILE_DEFAULT = "no"
const HEAP_SIZE_HINT_DEFAULT = nothing
const CPU_TARGET_DEFAULT = nothing

function roughly_the_number_of_physical_cpu_cores()
    # https://gist.github.com/fonsp/738fe244719cae820245aa479e7b4a8d
    threads = Sys.CPU_THREADS
    num_threads_is_maybe_doubled_for_marketing = Sys.ARCH === :x86_64
    
    if threads == 1
        1
    elseif threads == 2 || threads == 3
        2
    elseif num_threads_is_maybe_doubled_for_marketing
        # This includes:
        # - intel hyperthreading
        # - Apple ARM efficiency cores included in the count (when running the x86 executable)
        threads ÷ 2
    else
        threads
    end
end

function default_number_of_threads()
    env_value = get(ENV, "JULIA_NUM_THREADS", "")

    all(isspace, env_value) ?
        roughly_the_number_of_physical_cpu_cores() :
        env_value
end

"""
    CompilerOptions([; kwargs...])

These options will be passed as command line argument to newly launched processes. See [the Julia documentation on command-line options](https://docs.julialang.org/en/v1/manual/command-line-options/).

# Arguments
- `compile::Union{Nothing,String} = $COMPILE_DEFAULT`
- `pkgimages::Union{Nothing,String} = $PKGIMAGES_DEFAULT`
- `compiled_modules::Union{Nothing,String} = $COMPILED_MODULES_DEFAULT`
- `sysimage::Union{Nothing,String} = $SYSIMAGE_DEFAULT`
- `sysimage_native_code::Union{Nothing,String} = $SYSIMAGE_NATIVE_CODE_DEFAULT`
- `banner::Union{Nothing,String} = $BANNER_DEFAULT`
- `depwarn::Union{Nothing,String} = $DEPWARN_DEFAULT`
- `optimize::Union{Nothing,Int} = $OPTIMIZE_DEFAULT`
- `min_optlevel::Union{Nothing,Int} = $MIN_OPTLEVEL_DEFAULT`
- `inline::Union{Nothing,String} = $INLINE_DEFAULT`
- `check_bounds::Union{Nothing,String} = $CHECK_BOUNDS_DEFAULT`
- `math_mode::Union{Nothing,String} = $MATH_MODE_DEFAULT`
- `heap_size_hint::Union{Nothing,String} = $HEAP_SIZE_HINT_DEFAULT`
- `startup_file::Union{Nothing,String} = "$STARTUP_FILE_DEFAULT"` By default, the startup file isn't loaded in notebooks.
- `history_file::Union{Nothing,String} = "$HISTORY_FILE_DEFAULT"` By default, the history isn't loaded in notebooks.
- `threads::Union{Nothing,String,Int} = default_number_of_threads()`
- `cpu_target::Union{Nothing,String} = "$CPU_TARGET_DEFAULT"` By default, cpu_target is nothing which generates very specific (not portable) code.
"""
@option mutable struct CompilerOptions
    compile::Union{Nothing,String} = COMPILE_DEFAULT
    pkgimages::Union{Nothing,String} = PKGIMAGES_DEFAULT
    compiled_modules::Union{Nothing,String} = COMPILED_MODULES_DEFAULT

    sysimage::Union{Nothing,String} = SYSIMAGE_DEFAULT
    sysimage_native_code::Union{Nothing,String} = SYSIMAGE_NATIVE_CODE_DEFAULT

    banner::Union{Nothing,String} = BANNER_DEFAULT
    depwarn::Union{Nothing,String} = DEPWARN_DEFAULT

    optimize::Union{Nothing,Int} = OPTIMIZE_DEFAULT
    min_optlevel::Union{Nothing,Int} = MIN_OPTLEVEL_DEFAULT
    inline::Union{Nothing,String} = INLINE_DEFAULT
    check_bounds::Union{Nothing,String} = CHECK_BOUNDS_DEFAULT
    math_mode::Union{Nothing,String} = MATH_MODE_DEFAULT
    heap_size_hint::Union{Nothing,String} = HEAP_SIZE_HINT_DEFAULT

    # notebook specified options
    # the followings are different from
    # the default julia compiler options
    startup_file::Union{Nothing,String} = STARTUP_FILE_DEFAULT
    history_file::Union{Nothing,String} = HISTORY_FILE_DEFAULT

    threads::Union{Nothing,String,Int} = default_number_of_threads()
    cpu_target::Union{Nothing, String} = CPU_TARGET_DEFAULT
end

"""
Collection of all settings that configure a Pluto session. 

`ServerSession` contains a `Configuration`.
"""
@option struct Options
    server::ServerOptions = ServerOptions()
    security::SecurityOptions = SecurityOptions()
    evaluation::EvaluationOptions = EvaluationOptions()
    compiler::CompilerOptions = CompilerOptions()
end

function from_flat_kwargs(;
        root_url::Union{Nothing,String} = ROOT_URL_DEFAULT,
        base_url::String = BASE_URL_DEFAULT,
        host::String = HOST_DEFAULT,
        port::Union{Nothing,Integer} = PORT_DEFAULT,
        port_hint::Integer = PORT_HINT_DEFAULT,
        launch_browser::Bool = LAUNCH_BROWSER_DEFAULT,
        dismiss_update_notification::Bool = DISMISS_UPDATE_NOTIFICATION_DEFAULT,
        dismiss_motivational_quotes::Bool = DISMISS_MOTIVATIONAL_QUOTES,
        show_file_system::Bool = SHOW_FILE_SYSTEM_DEFAULT,
        enable_ai_editor_features::Bool = ENABLE_AI_EDITOR_FEATURES_DEFAULT,
        notebook_path_suggestion::String = notebook_path_suggestion(),
        disable_writing_notebook_files::Bool = DISABLE_WRITING_NOTEBOOK_FILES_DEFAULT,
        auto_reload_from_file::Bool = AUTO_RELOAD_FROM_FILE_DEFAULT,
        auto_reload_from_file_cooldown::Real = AUTO_RELOAD_FROM_FILE_COOLDOWN_DEFAULT,
        auto_reload_from_file_ignore_pkg::Bool = AUTO_RELOAD_FROM_FILE_IGNORE_PKG_DEFAULT,
        notebook::Union{Nothing,String,Vector{<:String}} = NOTEBOOK_DEFAULT,
        simulated_lag::Real = SIMULATED_LAG_DEFAULT,
        simulated_pkg_lag::Real = SIMULATED_PKG_LAG_DEFAULT,
        injected_javascript_data_url::String = INJECTED_JAVASCRIPT_DATA_URL_DEFAULT,
        on_event::Function = ON_EVENT_DEFAULT,

        require_secret_for_open_links::Bool = REQUIRE_SECRET_FOR_OPEN_LINKS_DEFAULT,
        require_secret_for_access::Bool = REQUIRE_SECRET_FOR_ACCESS_DEFAULT,
        warn_about_untrusted_code::Bool = WARN_ABOUT_UNTRUSTED_CODE_DEFAULT,

        run_notebook_on_load::Bool = RUN_NOTEBOOK_ON_LOAD_DEFAULT,
        workspace_use_distributed::Bool = WORKSPACE_USE_DISTRIBUTED_DEFAULT,
        workspace_use_distributed_stdlib::Union{Bool,Nothing} = WORKSPACE_USE_DISTRIBUTED_STDLIB_DEFAULT,
        lazy_workspace_creation::Bool = LAZY_WORKSPACE_CREATION_DEFAULT,
        capture_stdout::Bool = CAPTURE_STDOUT_DEFAULT,
        workspace_custom_startup_expr::Union{Nothing,String} = WORKSPACE_CUSTOM_STARTUP_EXPR_DEFAULT,

        compile::Union{Nothing,String} = COMPILE_DEFAULT,
        pkgimages::Union{Nothing,String} = PKGIMAGES_DEFAULT,
        compiled_modules::Union{Nothing,String} = COMPILED_MODULES_DEFAULT,
        sysimage::Union{Nothing,String} = SYSIMAGE_DEFAULT,
        sysimage_native_code::Union{Nothing,String} = SYSIMAGE_NATIVE_CODE_DEFAULT,
        banner::Union{Nothing,String} = BANNER_DEFAULT,
        depwarn::Union{Nothing,String} = DEPWARN_DEFAULT,
        optimize::Union{Nothing,Int} = OPTIMIZE_DEFAULT,
        min_optlevel::Union{Nothing,Int} = MIN_OPTLEVEL_DEFAULT,
        inline::Union{Nothing,String} = INLINE_DEFAULT,
        check_bounds::Union{Nothing,String} = CHECK_BOUNDS_DEFAULT,
        math_mode::Union{Nothing,String} = MATH_MODE_DEFAULT,
        heap_size_hint::Union{Nothing,String} = HEAP_SIZE_HINT_DEFAULT,
        startup_file::Union{Nothing,String} = STARTUP_FILE_DEFAULT,
        history_file::Union{Nothing,String} = HISTORY_FILE_DEFAULT,
        threads::Union{Nothing,String,Int} = default_number_of_threads(),
        cpu_target::Union{Nothing,String} = CPU_TARGET_DEFAULT,
    )
    server = ServerOptions(;
        root_url,
        base_url,
        host,
        port,
        port_hint,
        launch_browser,
        dismiss_update_notification,
        dismiss_motivational_quotes,
        show_file_system,
        enable_ai_editor_features,
        notebook_path_suggestion,
        disable_writing_notebook_files,
        auto_reload_from_file,
        auto_reload_from_file_cooldown,
        auto_reload_from_file_ignore_pkg,
        notebook,
        simulated_lag,
        simulated_pkg_lag,
        injected_javascript_data_url,
        on_event,
    )
    security = SecurityOptions(;
        require_secret_for_open_links,
        require_secret_for_access,
        warn_about_untrusted_code,
    )
    evaluation = EvaluationOptions(;
        run_notebook_on_load,
        workspace_use_distributed,
        workspace_use_distributed_stdlib,
        lazy_workspace_creation,
        capture_stdout,
        workspace_custom_startup_expr,
    )
    compiler = CompilerOptions(;
        compile,
        pkgimages,
        compiled_modules,
        sysimage,
        sysimage_native_code,
        banner,
        depwarn,
        optimize,
        min_optlevel,
        inline,
        check_bounds,
        math_mode,
        heap_size_hint,
        startup_file,
        history_file,
        threads,
        cpu_target,
    )
    return Options(; server, security, evaluation, compiler)
end

function _merge_notebook_compiler_options(notebook, options::CompilerOptions)::CompilerOptions
    if notebook.compiler_options === nothing
        return options
    end

    kwargs = Dict{Symbol,Any}()
    for each in fieldnames(CompilerOptions)
        # 1. not specified by notebook options
        # 2. general notebook specified options
        if getfield(notebook.compiler_options, each) === nothing
            kwargs[each] = getfield(options, each)
        else
            kwargs[each] = getfield(notebook.compiler_options, each)
        end
    end
    return CompilerOptions(; kwargs...)
end

function _convert_to_flags(options::CompilerOptions)::Vector{String}
    option_list = String[]

    for name in fieldnames(CompilerOptions)
        flagname = string("--", replace(String(name), "_" => "-"))
        value = getfield(options, name)
        if value !== nothing
            push!(option_list, string(flagname, "=", value))
        end
    end

    return option_list
end


end
