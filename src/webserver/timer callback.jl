import .TempDirInScratch

function timer_callback(session::ServerSession)
    try
        # Update TempDirInScratch
        for notebook in values(session.notebooks)
            ctx = notebook.nbpkg_ctx
            if ctx !== nothing
                d = PkgCompat.env_dir(ctx)
                TempDirInScratch.mark_as_current(d)
            end
        end
        TempDirInScratch.cleanup()
    catch e
        @warn "Error in async update loop" exception=(e, catch_backtrace())
    end    
end

