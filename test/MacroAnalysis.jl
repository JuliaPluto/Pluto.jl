using Test
import UUIDs
import Pluto: PlutoRunner, Notebook, WorkspaceManager, Cell, ServerSession, ClientSession, update_run!
import Memoize: @memoize

@testset "Macro analysis" begin
    🍭 = ServerSession()
    🍭.options.evaluation.workspace_use_distributed = false

    @testset "Base macro call" begin
        notebook = Notebook([
            Cell("@enum Fruit 🍎 🍐"),
            Cell("my_fruit = 🍎"),
            Cell("jam(fruit::Fruit) = cook(fruit)"),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror
        @test [:🍎, :🍐] ⊆ notebook.topology.nodes[cell(1)].definitions
        @test :Fruit ∈ notebook.topology.nodes[cell(1)].funcdefs_without_signatures
        @test Symbol("@enum") ∈ notebook.topology.nodes[cell(1)].references

        @test cell(2) |> noerror
        @test :🍎 ∈ notebook.topology.nodes[cell(2)].references

        @test cell(3) |> noerror
        @test :Fruit ∈ notebook.topology.nodes[cell(3)].references
        
        cleanup(🍭, notebook)
    end

    @testset "User defined macro 1" begin
        notebook = Notebook([
            Cell("""macro my_assign(sym, val)
              :(\$(esc(sym)) = \$(val))
            end"""),
            Cell("@my_assign x 1+1"),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test :x ∈ notebook.topology.nodes[cell(2)].definitions
        @test Symbol("@my_assign") ∈ notebook.topology.nodes[cell(2)].references

        update_run!(🍭, notebook, notebook.cells)

        # Works on second time because of old workspace
        @test :x ∈ notebook.topology.nodes[cell(2)].definitions
        @test Symbol("@my_assign") ∈ notebook.topology.nodes[cell(2)].references
        
        cleanup(🍭, notebook)
    end
    
    @testset "User defined macro 2" begin
        notebook = Notebook([
            Cell("@my_identity(f(123))"),
            Cell(""),
            Cell(""),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)
        
        setcode!(cell(2), """macro my_identity(expr)
            esc(expr)
        end""")
        update_run!(🍭, notebook, cell(2))
        
        setcode!(cell(3), "f(x) = x")
        update_run!(🍭, notebook, cell(3))
        
        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror
        @test cell(1).output.body == "123"
        
        update_run!(🍭, notebook, cell(1))
        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror
        
        cleanup(🍭, notebook)
    end

    @testset "User defined macro 3" begin
        notebook = Notebook([
            Cell("""
            macro mymap()
                quote
                    [1, 2, 3] .|> sqrt
                end
            end
            """),
            Cell("@mymap")
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror
        @test cell(2) |> noerror

        update_run!(🍭, notebook, cell(1))

        @test cell(2) |> noerror
        
        cleanup(🍭, notebook)
    end

    @testset "User defined macro 4" begin
        notebook = Notebook([
            Cell("""macro my_assign(ex)
                esc(ex)
            end"""),
            Cell("@macroexpand @my_assign 1+1"),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test Symbol("@my_assign") ∈ notebook.topology.nodes[cell(2)].references
        cleanup(🍭, notebook)
    end

    @testset "User defined macro 5" begin
        notebook = Notebook([
            Cell("""macro dynamic_values(ex)
                [:a, :b, :c]
            end"""),
            Cell("myarray = @dynamic_values()"),
        ])
        references(idx) = notebook.topology.nodes[notebook.cells[idx]].references

        update_run!(🍭, notebook, notebook.cells)

        @test :a ∉ references(2)
        @test :b ∉ references(2)
        @test :c ∉ references(2)
        cleanup(🍭, notebook)
    end

    @testset "User defined macro 6" begin
        notebook = Notebook([
            Cell("""macro my_macro()
                esc(:(y + x))
            end"""),
            Cell("""function my_function()
                @my_macro()
            end"""),
            Cell("my_function()"),
            Cell("x = 1"),
            Cell("y = 2"),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test [Symbol("@my_macro"), :x, :y] ⊆ notebook.topology.nodes[cell(2)].references
        @test cell(3).output.body == "3"
        cleanup(🍭, notebook)
    end

    @testset "Function docs" begin
        notebook = Notebook([
            Cell("""
                "my function doc"
                f(x) = 2x
            """),
            Cell("f"),
        ])
        cell(idx) = notebook.cells[idx]

        temp_topology = Pluto.updated_topology(notebook.topology, notebook, notebook.cells) |> Pluto.static_resolve_topology
        
        # @test :f ∈ temp_topology.nodes[cell(1)].funcdefs_without_signatures
        
        update_run!(🍭, notebook, notebook.cells)

        @test :f ∈ notebook.topology.nodes[cell(1)].funcdefs_without_signatures
        @test :f ∈ notebook.topology.nodes[cell(2)].references
        cleanup(🍭, notebook)
    end

    @testset "Expr sanitization" begin
        struct A; end
        f(x) = x
        unserializable_expr = :($(f)(A(), A[A(), A(), A()], PlutoRunner, PlutoRunner.sanitize_expr))

        get_expr_types(other) = typeof(other)
        get_expr_types(ex::Expr) = get_expr_types.(ex.args)

        flatten(x, acc=[]) = push!(acc, x)
        function flatten(arr::AbstractVector, acc=[]) foreach(x -> flatten(x, acc), arr); acc end

        sanitized_expr = PlutoRunner.sanitize_expr(unserializable_expr)
        types = sanitized_expr |> get_expr_types |> flatten |> Set

        # Checks that no fancy type is part of the serialized expression
        @test Set([Nothing, Symbol, QuoteNode]) == types
    end

    @testset "Macrodef cells not root of run" begin
        notebook = Notebook([
            Cell(""),
            Cell(""),
            Cell(""),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test all(noerror, notebook.cells)

        setcode!(cell(1), raw"""
            macro test(sym)
                esc(:($sym = true))
            end
        """)
        update_run!(🍭, notebook, cell(1))

        setcode!(cell(2), "x")
        setcode!(cell(3), "@test x")
        update_run!(🍭, notebook, notebook.cells[2:3])

        @test cell(2).output.body == "true"
        @test all(noerror, notebook.cells)
        cleanup(🍭, notebook)
    end

    @testset "Reverse order" begin
        notebook = Notebook([Cell() for _ in 1:3])
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        setcode!(cell(1), "x")
        update_run!(🍭, notebook, cell(1))

        @test cell(1).errored == true

        setcode!(cell(2), "@bar x")
        update_run!(🍭, notebook, cell(2))

        @test cell(1).errored == true
        @test cell(2).errored == true

        setcode!(cell(3), raw"""macro bar(sym)
            esc(:($sym = "yay"))
        end""")
        update_run!(🍭, notebook, cell(3))

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror
        @test cell(1).output.body == "\"yay\""
        cleanup(🍭, notebook)
    end

    @testset "@a defines @b" begin
        notebook = Notebook([Cell() for _ in 1:4])
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        setcode!(cell(1), "x")
        update_run!(🍭, notebook, cell(1))

        @test cell(1).errored == true

        setcode!(cell(3), "@a()")
        setcode!(cell(2), raw"""macro a()
            quote
                macro b(sym)
                    esc(:($sym = 42))
                end
            end |> esc
        end""")
        update_run!(🍭, notebook, notebook.cells[2:3])

        @test cell(1).errored == true
        @test cell(2) |> noerror
        @test cell(3) |> noerror

        setcode!(cell(4), "@b x")
        update_run!(🍭, notebook, cell(4))

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror
        @test cell(4) |> noerror
        @test cell(1).output.body == "42"
        cleanup(🍭, notebook)
    end

    @testset "Removing macros undefvar errors dependent cells" begin
        notebook = Notebook(Cell.([
            """macro m()
                :(1 + 1)
            end""",
            "@m()",
        ]))

        update_run!(🍭, notebook, notebook.cells)

        @test all(noerror, notebook.cells)

        setcode!(notebook.cells[begin], "") # remove definition of m
        update_run!(🍭, notebook, notebook.cells[begin])

        @test notebook.cells[begin] |> noerror
        @test notebook.cells[end].errored

        @test expecterror(UndefVarError(Symbol("@m")), notebook.cells[end]; strict=true)
        cleanup(🍭, notebook)
    end

    @testset "Redefines macro with new SymbolsState" begin
        notebook = Notebook(Cell.([
            "@b x",
            raw"""macro b(sym)
                esc(:($sym = 42))
            end""",
            "x",
            "y",
        ]))
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        @test cell(3).output.body == "42"
        @test cell(4).errored == true

        setcode!(cell(2), """macro b(_)
            esc(:(y = 42))
        end""")
        update_run!(🍭, notebook, cell(2))

        @test cell(4).output.body == "42"
        @test cell(3).errored == true

        notebook = Notebook(Cell.([
            "@b x",
            raw"""macro b(sym)
                esc(:($sym = 42))
            end""",
            "x",
            "y",
        ]))
        update_run!(🍭, notebook, notebook.cells)

        @test cell(3).output.body == "42"
        @test cell(4).errored == true

        setcode!(cell(2), """macro b(_)
            esc(:(y = 42))
        end""")
        update_run!(🍭, notebook, [cell(1), cell(2)])

        # Cell 4 is executed even because cell(1) is in the root
        # of the reactive run because the expansion is done with the new version
        # of the macro in the new workspace because of the current_roots parameter of `resolve_topology`.
        # See Run.jl#resolve_topology.
        @test cell(4).output.body == "42"
        @test cell(3).errored == true
        cleanup(🍭, notebook)
    end

    @testset "Reactive macro update does not invalidate the macro calls" begin
        notebook = Notebook(Cell.([
            raw"""macro b(sym)
                if z > 40
                    esc(:($sym = $z))
                else
                    esc(:(y = $z))
                end
            end""",
            "z = 42",
            "@b(x)",
            "x",
            "y",
        ]))
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror        
        @test cell(2) |> noerror        
        @test cell(3) |> noerror        
        @test cell(4) |> noerror        
        @test cell(5).errored == true

        setcode!(cell(2), "z = 39")

        # running only 2, running all cells here works however
        update_run!(🍭, notebook, cell(2))

        @test cell(1) |> noerror        
        @test cell(2) |> noerror        
        @test cell(3) |> noerror
        @test cell(4).output.body != "42"
        @test cell(4).errored == true
        @test cell(5) |> noerror
        cleanup(🍭, notebook)
    end

    @testset "Explicitely running macrocalls updates the reactive node" begin
        notebook = Notebook(Cell.([
            "@b()",
            "ref = Ref{Int}(0)",
            raw"""macro b()
                ex = if iseven(ref[])
                    :(x = 10)
                else
                    :(y = 10)
                end |> esc
                ref[] += 1
                ex
            end""",
            "x",
            "y",
        ]))
        cell(i) = notebook.cells[i]
        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror
        @test cell(4) |> noerror
        @test cell(5).errored == true

        update_run!(🍭, notebook, cell(1))

        @test cell(4).errored == true
        @test cell(5) |> noerror
        cleanup(🍭, notebook)
    end

    @testset "Implicitely running macrocalls updates the reactive node" begin
        notebook = Notebook(Cell.([
            "updater; @b()",
            "ref = Ref{Int}(0)",
            raw"""macro b()
                ex = if iseven(ref[])
                    :(x = 10)
                else
                    :(y = 10)
                end |> esc
                ref[] += 1
                ex
            end""",
            "x",
            "y",
            "updater = 1",
        ]))
        cell(i) = notebook.cells[i]
        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror
        @test cell(4) |> noerror
        output_1 = cell(4).output.body
        @test cell(5).errored == true
        @test cell(6) |> noerror

        setcode!(cell(6), "updater = 2")
        update_run!(🍭, notebook, cell(6))

        # the output of cell 4 has not changed since the underlying computer
        # has not been regenerated. To update the reactive node and macrocall
        # an explicit run of @b() must be done.
        @test cell(4).output.body == output_1
        @test cell(5).errored == true
        cleanup(🍭, notebook)
    end

    @testset "Weird behavior" begin
        # https://github.com/fonsp/Pluto.jl/issues/1591

        notebook = Notebook(Cell.([
            "macro huh(_) throw(\"Fail!\") end",
            "huh(e) = e",
            "@huh(z)",
            "z = 101010",
        ]))
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        @test cell(3).errored == true

        setcode!(cell(3), "huh(z)")
        update_run!(🍭, notebook, cell(3))

        @test cell(3) |> noerror
        @test cell(3).output.body == "101010"

        setcode!(cell(4), "z = 1234")
        update_run!(🍭, notebook, cell(4))

        @test cell(3) |> noerror
        @test cell(3).output.body == "1234"
        cleanup(🍭, notebook)
    end


    @testset "Cell failing first not re-run?" begin
        notebook = Notebook(Cell.([
            "x",
            "@b x",
            raw"macro b(sym) esc(:($sym = 42)) end",
        ]))
        update_run!(🍭, notebook, notebook.cells)

        # CELL 1 "x" was run first and failed because the definition
        # of x was not yet found. However, it was not run re-run when the definition of
        # x ("@b(x)") was run. Should it? Maybe set a higher precedence to cells that define
        # macros inside the notebook.
        @test_broken noerror(notebook.cells[1]; verbose=false)
        cleanup(🍭, notebook)
    end

    @testset "@a defines @b initial loading" begin
        notebook = Notebook(Cell.([
            "x",
            "@b x",
            "@a",
            raw"""macro a()
                quote
                    macro b(sym)
                        esc(:($sym = 42))
                    end
                end |> esc
            end"""
        ]))
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror
        @test cell(4) |> noerror
        @test cell(1).output.body == "42"
        cleanup(🍭, notebook)
    end

    @testset "Macro with long compile time gets function wrapped" begin
        ms = 1e-3
        ns = 1e-9
        sleep_time = 40ms

        notebook = Notebook(Cell.([
            "updater; @b()",
            """macro b()
                x = rand()
                sleep($sleep_time)
                :(1+\$x)
            end""",
            "updater = :slow",
        ]))
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        @test noerror(cell(1))
        runtime = cell(1).runtime*ns
        output_1 = cell(1).output.body
        @test sleep_time <= runtime

        setcode!(cell(3), "updater = :fast")
        update_run!(🍭, notebook, cell(3))

        @test noerror(cell(1))
        runtime = cell(1).runtime*ns
        @test runtime < sleep_time # no recompilation!

        # output is the same because no new compilation happens
        @test output_1 == cell(1).output.body

        # force recompilation by explicitely running the cell
        update_run!(🍭, notebook, cell(1))

        @test cell(1) |> noerror
        @test output_1 != cell(1).output.body
        output_3 = cell(1).output.body

        setcode!(cell(1), "@b()") # changing code generates a new 💻
        update_run!(🍭, notebook, cell(1))

        @test cell(1) |> noerror
        @test output_3 != cell(1).output.body
        cleanup(🍭, notebook)
    end

    @testset "Macro Prefix" begin
        🍭.options.evaluation.workspace_use_distributed = true

        notebook = Notebook(Cell.([
            "@sprintf \"answer = %d\" x",
            "x = y+1",
            raw"""
            macro def(sym)
                esc(:($sym=41))
            end
            """,
            "@def y",
            "import Printf: @sprintf",
        ]))
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, cell(1))

        @test cell(1).errored == true

        update_run!(🍭, notebook, cell(5))

        @test expecterror(UndefVarError(:x), cell(1))

        update_run!(🍭, notebook, cell(3))
        update_run!(🍭, notebook, cell(2))
        update_run!(🍭, notebook, cell(4))

        @test cell(1) |> noerror

        cleanup(🍭, notebook)
        🍭.options.evaluation.workspace_use_distributed = false
    end

    @testset "Package macro 1" begin
        notebook = Notebook([
            Cell("using Dates"),
            Cell("df = dateformat\"Y-m-d\""),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, cell(2))

        @test cell(2).errored == true
        @test expecterror(UndefVarError(Symbol("@dateformat_str")), cell(2); strict=true)

        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        
        notebook = Notebook([
            Cell("using Dates"),
            Cell("df = dateformat\"Y-m-d\""),
        ])
        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        cleanup(🍭, notebook)
    end

    @testset "Package macro 2" begin
        🍭.options.evaluation.workspace_use_distributed = true

        notebook = Notebook([
            Cell("z = x^2 + y"),
            Cell("@variables x y"),
            Cell("""
            begin
                import Pkg
                Pkg.activate(mktempdir())
                Pkg.add([
                    Pkg.PackageSpec(name="Symbolics", version="6.55"),
                ])
                import Symbolics: @variables
            end
            """),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells[1:2])

        @test cell(1).errored == true
        @test cell(2).errored == true

        update_run!(🍭, notebook, cell(3))

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror

        update_run!(🍭, notebook, notebook.cells)

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror

        update_run!(🍭, notebook, cell(2))

        @test cell(1) |> noerror
        @test cell(2) |> noerror

        setcode!(cell(2), "@variables 🐰 y")
        update_run!(🍭, notebook, cell(2))

        @test cell(1).errored
        @test cell(2) |> noerror

        setcode!(cell(1), "z = 🐰^2 + y")
        update_run!(🍭, notebook, cell(1))

        @test cell(1) |> noerror
        @test cell(2) |> noerror

        cleanup(🍭, notebook)
        
        🍭.options.evaluation.workspace_use_distributed = false
    end

    @testset "Previous workspace for unknowns" begin
        notebook = Notebook([
            Cell("""macro my_identity(expr)
              expr
            end"""),
            Cell("(@__MODULE__, (@my_identity 1 + 1))"),
            Cell("@__MODULE__"),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, cell(1))
        update_run!(🍭, notebook, notebook.cells[2:end])

        @test cell(1) |> noerror
        @test cell(2) |> noerror
        @test cell(3) |> noerror

        module_from_cell2 = cell(2).output.body[:elements][1][2][1]
        module_from_cell3 = cell(3).output.body

        @test module_from_cell2 == module_from_cell3
        cleanup(🍭, notebook)
    end

    @testset "Definitions" begin
        notebook = Notebook([
            Cell("""macro my_assign(sym, val)
                :(\$(esc(sym)) = \$(val))
            end"""),
            Cell("c = :hello"),
            Cell("@my_assign b c"),
            Cell("b"),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)
        update_run!(🍭, notebook, notebook.cells)

        @test ":hello" == cell(3).output.body
        @test ":hello" == cell(4).output.body
        @test :b ∈ notebook.topology.nodes[cell(3)].definitions
        @test [:c, Symbol("@my_assign")] ⊆ notebook.topology.nodes[cell(3)].references

        setcode!(notebook.cells[2], "c = :world")
        update_run!(🍭, notebook, cell(2))

        @test ":world" == cell(3).output.body
        @test ":world" == cell(4).output.body
        cleanup(🍭, notebook)
    end

    @testset "Is just text macros" begin
        notebook = Notebook(Cell.([
            """
            md"# Hello world!"
            """,
            """
            "no julia value here"
            """,
        ]))
        update_run!(🍭, notebook, notebook.cells)

        @test isempty(notebook.topology.unresolved_cells)
        cleanup(🍭, notebook)
    end

    @testset "Macros using import" begin
        notebook = Notebook(Cell.([
            """
            @option "option_a" struct OptionA
                option_value::option_type
            end
            """,
            "option_type = String",
            "import Configurations: @option",
        ]))
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test :option_type ∈ notebook.topology.nodes[cell(1)].references
        @test cell(1) |> noerror
        cleanup(🍭, notebook)
    end

    @testset "GlobalRefs in macros should be respected" begin
        notebook = Notebook(Cell.([
            """
            macro identity(expr)
                expr
            end
            """,
            """
            x = 20
            """,
            """
            let x = 10
                @identity(x)
            end
            """,
        ]))
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test all(cell.([1,2,3]) .|> noerror)
        @test cell(3).output.body == "20"
        cleanup(🍭, notebook)
    end

    @testset "GlobalRefs shouldn't break unreached undefined references" begin
        notebook = Notebook(Cell.([
            """
            macro get_x_but_actually_not()
                quote
                    if false
                        x
                    else
                        :this_should_be_returned
                    end
                end
            end
            """,
            """
            @get_x_but_actually_not()
            """,
        ]))
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)

        @test all(cell.([1,2]) .|> noerror)
        @test cell(2).output.body == ":this_should_be_returned"
        cleanup(🍭, notebook)
    end

    @testset "Doc strings" begin
        notebook = Notebook(Cell.([
            "x = 1",
            raw"""
            "::Bool"
            f(::Bool) = x
            """,
            raw"""
            "::Int"
            f(::Int) = 1
            """,
        ]))

        trigger, bool, int = notebook.cells

        workspace = WorkspaceManager.get_workspace((🍭, notebook))
        workspace_module = getproperty(Main, workspace.module_name)

        # Propose suggestions when no binding is found
        doc_content, status = PlutoRunner.doc_fetcher("filer", workspace_module)
        @test status == :👍
        @test occursin("Similar results:", doc_content)
        @test occursin("<b>f</b><b>i</b><b>l</b>t<b>e</b><b>r</b>", doc_content)

        update_run!(🍭, notebook, notebook.cells)
        @test all(noerror, notebook.cells)
        @test occursin("::Bool", bool.output.body)
        @test !occursin("::Int", bool.output.body)
        @test occursin("::Bool", int.output.body)
        @test occursin("::Int", int.output.body)

        setcode!(int, raw"""
        "::Int new docstring"
        f(::Int) = 1
        """)
        update_run!(🍭, notebook, int)

        @test occursin("::Bool", int.output.body)
        @test occursin("::Int new docstring", int.output.body)

        update_run!(🍭, notebook, trigger)

        @test occursin("::Bool", bool.output.body)
        @test occursin("::Int new docstring", bool.output.body)
        @test length(eachmatch(r"Bool", bool.output.body) |> collect) == 1
        @test length(eachmatch(r"Int", bool.output.body) |> collect) == 1

        update_run!(🍭, notebook, trigger)

        @test length(eachmatch(r"Bool", bool.output.body) |> collect) == 1

        setcode!(int, "")
        update_run!(🍭, notebook, [bool, int])
        @test !occursin("::Int", bool.output.body)

        setcode!(bool, """
        "An empty conjugate"
        Base.conj() = x
        """)

        update_run!(🍭, notebook, bool)
        @test noerror(bool)
        @test noerror(trigger)
        @test occursin("An empty conjugate", bool.output.body)
        @test occursin("complex conjugate", bool.output.body)

        setcode!(bool, "Docs.doc(conj)")
        update_run!(🍭, notebook, bool)
        @test !occursin("An empty conjugate", bool.output.body)
        @test occursin("complex conjugate", bool.output.body)
        cleanup(🍭, notebook)
    end

    @testset "Delete methods from macros" begin
        🍭 = ServerSession()
        🍭.options.evaluation.workspace_use_distributed = false

        notebook = Notebook([
            Cell("using Memoize"),
            Cell("""
                macro user_defined()
                    quote
                        struct ASD end
                        custom_func(::ASD) = "ASD"
                    end |> esc
                end
            """),
            Cell("@user_defined"),
            Cell("methods(custom_func)"),
            Cell("""
                @memoize function memoized_func(a)
                    println("Running")
                    2a
                end
            """),
            Cell("methods(memoized_func)"),
        ])
        cell(idx) = notebook.cells[idx]

        update_run!(🍭, notebook, notebook.cells)
        
        @test :custom_func ∈ notebook.topology.nodes[cell(3)].funcdefs_without_signatures
        @test cell(4) |> noerror
        @test :memoized_func ∈ notebook.topology.nodes[cell(5)].funcdefs_without_signatures
        @test cell(6) |> noerror

        cell(3).code = "#=$(cell(3).code)=#"
        cell(5).code = "#=$(cell(5).code)=#"
        
        update_run!(🍭, notebook, notebook.cells)
        
        @test :custom_func ∉ notebook.topology.nodes[cell(3)].funcdefs_without_signatures
        @test expecterror(UndefVarError(:custom_func), cell(4))
        @test :memoized_func ∉ notebook.topology.nodes[cell(5)].funcdefs_without_signatures
        @test expecterror(UndefVarError(:memoized_func), cell(6))
        cleanup(🍭, notebook)
    end
end
