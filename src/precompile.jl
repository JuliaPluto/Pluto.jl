using PrecompileTools: PrecompileTools

PrecompileTools.@compile_workload begin
    nb = Pluto.Notebook([
        Pluto.Cell("""md"Hello *world*" """)
        Pluto.Cell("""[f(x)]""")
        Pluto.Cell("""x = 1""")
        Pluto.Cell(
            """
            function f(z::Integer)
                z / 123
            end
            """)
        Pluto.Cell(
            """
            "asdf"
            begin
                while false
                    local p = 123
                    try
                        [(x,a...) for x in (a for a in b)]
                        A.B.hello() do z
                            @gensym z
                            (z) -> z/:(z / z)
                        end
                    catch
                    end
                end
            end
            """
        )
    ])
    let
        topology = Pluto.updated_topology(nb.topology, nb, nb.cells)
        # Our reactive sorting algorithm.
        Pluto.topological_order(topology, topology.cell_order)
    end

    # let
    #     io = IOBuffer()
    #     # Notebook file format.
    #     Pluto.save_notebook(io, nb)
    #     seekstart(io)
    #     Pluto.load_notebook_nobackup(io, "whatever.jl")
    # end

    let
        state1 = Pluto.notebook_to_js(nb)
        state2 = Pluto.notebook_to_js(nb)
        # MsgPack
        Pluto.unpack(Pluto.pack(state1))
        # State diffing
        Pluto.Firebasey.diff(state1, state2)
    end

    s = Pluto.ServerSession(;
        options=Pluto.Configuration.from_flat_kwargs(
            disable_writing_notebook_files=true,
            workspace_use_distributed=false,
            auto_reload_from_file=false,
            run_notebook_on_load=false,
            lazy_workspace_creation=true,
            capture_stdout=false,
        )
    )
    
    finalize(s)
end

using PrecompileSignatures: @precompile_signatures
@precompile_signatures(Pluto)
