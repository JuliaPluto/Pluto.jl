import Logging

const original_stderr = Ref{IO}()

const old_logger = Ref{Union{Logging.AbstractLogger,Nothing}}(nothing)

struct PlutoCellLogger <: Logging.AbstractLogger
    stream # some packages expect this field to exist...
    log_channel::Channel{Any}
    cell_id::UUID
    workspace_count::Int # Used to invalidate previous logs
    message_limits::Dict{Any,Int}
end
function PlutoCellLogger(notebook_id, cell_id)
    notebook_log_channel = pluto_log_channels[notebook_id]
    PlutoCellLogger(nothing,
                    notebook_log_channel, cell_id,
                    moduleworkspace_count[],
                    Dict{Any,Int}())
end

struct CaptureLogger <: Logging.AbstractLogger
    stream
    logger::PlutoCellLogger
    logs::Vector{Any}
end

Logging.shouldlog(cl::CaptureLogger, args...) = Logging.shouldlog(cl.logger, args...)
Logging.min_enabled_level(cl::CaptureLogger) = Logging.min_enabled_level(cl.logger)
Logging.catch_exceptions(cl::CaptureLogger) = Logging.catch_exceptions(cl.logger)
function Logging.handle_message(cl::CaptureLogger, level, msg, _module, group, id, file, line; kwargs...)
    push!(cl.logs, (level, msg, _module, group, id, file, line, kwargs))
end


const pluto_cell_loggers = Dict{UUID,PlutoCellLogger}() # One logger per cell
const pluto_log_channels = Dict{UUID,Channel{Any}}() # One channel per notebook

function get_cell_logger(notebook_id, cell_id)
    logger = get!(() -> PlutoCellLogger(notebook_id, cell_id), pluto_cell_loggers, cell_id)
    if logger.workspace_count < moduleworkspace_count[]
        logger = pluto_cell_loggers[cell_id] = PlutoCellLogger(notebook_id, cell_id)
    end
    logger
end

function Logging.shouldlog(logger::PlutoCellLogger, level, _module, _...)
    # Accept logs
    # - Only if the logger is the latest for this cell using the increasing workspace_count tied to each logger
    # - From the user's workspace module
    # - Info level and above for other modules
    # - LogLevel(-1) because that's what ProgressLogging.jl uses for its messages
    current_logger = pluto_cell_loggers[logger.cell_id]
    if current_logger.workspace_count > logger.workspace_count
        return false
    end

    level = convert(Logging.LogLevel, level)
    (_module isa Module && is_pluto_workspace(_module)) ||
        level >= Logging.Info ||
        level == progress_log_level ||
        level == stdout_log_level
end

const BuiltinInts = @static isdefined(Core, :BuiltinInts) ? Core.BuiltinInts : Union{Bool, Int32, Int64, UInt32, UInt64, UInt8, Int128, Int16, Int8, UInt128, UInt16}

Logging.min_enabled_level(::PlutoCellLogger) = min(Logging.Debug, stdout_log_level)
Logging.catch_exceptions(::PlutoCellLogger) = false
function Logging.handle_message(pl::PlutoCellLogger, level, msg, _module, group, id, file, line; kwargs...)
    # println("receiving msg from ", _module, " ", group, " ", id, " ", msg, " ", level, " ", line, " ", file)
    # println("with types: ", "_module: ", typeof(_module), ", ", "msg: ", typeof(msg), ", ", "group: ", typeof(group), ", ", "id: ", typeof(id), ", ", "file: ", typeof(file), ", ", "line: ", typeof(line), ", ", "kwargs: ", typeof(kwargs)) # thanks Copilot

    # https://github.com/JuliaLang/julia/blob/eb2e9687d0ac694d0aa25434b30396ee2cfa5cd3/stdlib/Logging/src/ConsoleLogger.jl#L110-L115
    if get(kwargs, :maxlog, nothing) isa BuiltinInts
        maxlog = kwargs[:maxlog]
        remaining = get!(pl.message_limits, id, Int(maxlog)::Int)
        pl.message_limits[id] = remaining - 1
        if remaining <= 0
            return
        end
    end

    try
        yield()

        po() = get(cell_published_objects, pl.cell_id, Dict{String,Any}())
        before_published_object_keys = collect(keys(po()))

        # Render the log arguments:
        msg = preprocess_log_msg(msg)
        msg_formatted = format_output_default(msg isa AbstractString ? Text(msg) : msg)
        kwargs_formatted = Tuple{String,Any}[(string(k), format_log_value(v)) for (k, v) in kwargs if k != :maxlog]

        after_published_object_keys = collect(keys(po()))
        new_published_object_keys = setdiff(after_published_object_keys, before_published_object_keys)

        # (Running `put!(pl.log_channel, x)` will send `x` to the pluto server. See `start_relaying_logs` for the receiving end.)
        put!(pl.log_channel, Dict{String,Any}(
            "level" => string(level),
            "msg" => msg_formatted,
            # This is a dictionary containing all published objects that were published during the rendering of the log arguments (we cannot track which objects were published during the execution of the log statement itself i think...)
            "new_published_objects" => Dict{String,Any}(
                key => po()[key] for key in new_published_object_keys
            ),
            "group" => string(group),
            "id" => string(id),
            "file" => string(file),
            "cell_id" => pl.cell_id,
            "line" => line isa Union{Int32,Int64} ? line : nothing,
            "kwargs" => kwargs_formatted,
        ))

        yield()

    catch e
        Logging.with_logger(Logging.ConsoleLogger(original_stderr[])) do
            @error "Failed to relay log from PlutoRunner" exception=(e, catch_backtrace())
        end

        nothing
    end
end

# This can be used to customize how certain logs are displayed. Custom methods should directly return an `AbstractString`. Most logs are already AbstractStrings so they don't need custom method, but for example, since v1.6, ProgressLogging.jl returns a log msg that is not an AbstractString.
preprocess_log_msg(msg) = msg

format_log_value(v) = format_output_default(v)
format_log_value(v::Tuple{<:Exception,Vector{<:Any}}) = format_output(CapturedException(v...))


function with_logger_and_io_to_logs(f, logger; capture_stdout=true, stdio_loglevel=stdout_log_level)
    Logging.with_logger(logger) do
        with_io_to_logs(f; enabled=capture_stdout, loglevel=stdio_loglevel)
    end
end

function setup_plutologger(notebook_id::UUID, log_channel::Channel{Any})
    pluto_log_channels[notebook_id] = log_channel
end
