using Test
import Pluto: Configuration, Notebook, ServerSession, ClientSession, update_run!, Cell, WorkspaceManager
import Pluto.Configuration: Options, EvaluationOptions

### MORE TESTS ARE IN PLUTODEPENDENCYEXPLORER.jL
# The tests on the Pluto side are tests that rely more heavily on what Pluto implements on top of PlutoDependencyExplorer.
# The tests in PlutoDependencyExplorer are focus in *reactive ordering*.

@testset "Reactivity" begin
    🍭 = ServerSession()
    🍭.options.evaluation.workspace_use_distributed = false

    @testset "Basic $workertype" for workertype in [:Malt, :Distributed, :InProcess]
        🍭.options.evaluation.workspace_use_distributed = workertype !== :InProcess
        🍭.options.evaluation.workspace_use_distributed_stdlib = workertype === :Distributed
        
        
        notebook = Notebook([
            Cell("x = 1"),
            Cell("y = x"),
            Cell("f(x) = x + y"),
            Cell("f(4)"),

            Cell("""begin
                g(a) = x
                g(a,b) = y
            end"""),
            Cell("g(6) + g(6,6)"),

            Cell("""
            begin
                pushfirst!(LOAD_PATH, "@stdlib")
                import Distributed
                popfirst!(LOAD_PATH)
            end
            """),
            Cell("Distributed.myid()"),
        ])

        @test !haskey(WorkspaceManager.active_workspaces, notebook.notebook_id)

        update_run!(🍭, notebook, notebook.cells[1:2])
        @test notebook.cells[1].output.body == notebook.cells[2].output.body
        @test notebook.cells[1].output.rootassignee == :x
        @test notebook.cells[1].runtime !== nothing
        setcode!(notebook.cells[1], "x = 12")
        update_run!(🍭, notebook, notebook.cells[1])
        @test notebook.cells[1].output.body == notebook.cells[2].output.body
        @test notebook.cells[2].runtime !== nothing

        update_run!(🍭, notebook, notebook.cells[3])
        @test notebook.cells[3] |> noerror
        @test notebook.cells[3].output.rootassignee === nothing
    
        update_run!(🍭, notebook, notebook.cells[4])
        @test notebook.cells[4].output.body == "16"
        @test notebook.cells[4] |> noerror
        @test notebook.cells[4].output.rootassignee === nothing

        setcode!(notebook.cells[1], "x = 912")
        update_run!(🍭, notebook, notebook.cells[1])
        @test notebook.cells[4].output.body == "916"

        setcode!(notebook.cells[3], "f(x) = x")
        update_run!(🍭, notebook, notebook.cells[3])
        @test notebook.cells[4].output.body == "4"

        setcode!(notebook.cells[1], "x = 1")
        setcode!(notebook.cells[2], "y = 2")
        update_run!(🍭, notebook, notebook.cells[1:2])
        update_run!(🍭, notebook, notebook.cells[5:6])
        @test notebook.cells[5] |> noerror
        @test notebook.cells[6].output.body == "3"

        setcode!(notebook.cells[2], "y = 1")
        update_run!(🍭, notebook, notebook.cells[2])
        @test notebook.cells[6].output.body == "2"

        setcode!(notebook.cells[1], "x = 2")
        update_run!(🍭, notebook, notebook.cells[1])
        @test notebook.cells[6].output.body == "3"

        update_run!(🍭, notebook, notebook.cells[7:8])
        if workertype === :Distributed
            @test notebook.cells[8].output.body ∉ ("1", string(Distributed.myid()))
        elseif workertype === :Malt
            @test notebook.cells[8].output.body == "1"
        elseif workertype === :InProcess
            @test notebook.cells[8].output.body == string(Distributed.myid())
        else
            error()
        end

        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    
    end

    🍭.options.evaluation.workspace_use_distributed = false

    @testset "Simple insert cell" begin
        notebook = Notebook(Cell[])
        update_run!(🍭, notebook, notebook.cells)

        insert_cell!(notebook, Cell("a = 1"))
        update_run!(🍭, notebook, notebook.cells[begin])

        insert_cell!(notebook, Cell("b = 2"))
        update_run!(🍭, notebook, notebook.cells[begin+1])

        insert_cell!(notebook, Cell("c = 3"))
        update_run!(🍭, notebook, notebook.cells[begin+2])

        insert_cell!(notebook, Cell("a + b + c"))
        update_run!(🍭, notebook, notebook.cells[begin+3])

        @test notebook.cells[begin+3].output.body == "6"

        setcode!(notebook.cells[begin+1], "b = 10")
        update_run!(🍭, notebook, notebook.cells[begin+1])

        @test notebook.cells[begin+3].output.body == "14"
    end

    @testset "Simple delete cell" begin
        notebook = Notebook(Cell.([
            "x = 42",
            "x",
        ]))
        update_run!(🍭, notebook, notebook.cells)

        @test all(noerror, notebook.cells)

        delete_cell!(🍭, notebook, notebook.cells[begin])
        @test length(notebook.cells) == 1

        @test expecterror(UndefVarError(:x), notebook.cells[begin])
    end

    @testset ".. as an identifier" begin
        notebook = Notebook(Cell.([
           ".. = 1",
           "..",
        ]))
        update_run!(🍭, notebook, notebook.cells)

        @test all(noerror, notebook.cells)
        @test notebook.cells[end].output.body == "1"
    end

    @testset "Cleanup of workspace variable" begin
        notebook = Notebook([
            Cell("x = 10000"),
        ])

        update_run!(🍭, notebook, notebook.cells[1:1])

        @test haskey(WorkspaceManager.active_workspaces, notebook.notebook_id)
        w = fetch(WorkspaceManager.active_workspaces[notebook.notebook_id])
        oldmod = getproperty(Main, w.module_name)

        setcode!(notebook.cells[begin], "")
        update_run!(🍭, notebook, notebook.cells[1:1])

        @test isdefined(oldmod, :x)
        @test isnothing(getproperty(oldmod, :x))

        newmod = getproperty(Main, w.module_name)
        @test !isdefined(newmod, :x)
    end

    @testset "Cleanup only Pluto controlled modules" begin
        notebook = Notebook([
            Cell("""Core.eval(Main, :(
                 module var\"Pluto#2443\"
                    x = 1000
                 end
            ))"""),
            Cell("import .Main.var\"Pluto#2443\": x"),
            Cell("x"),
        ])

        update_run!(🍭, notebook, notebook.cells)
        @test noerror(notebook.cells[1])
        @test noerror(notebook.cells[2])
        @test noerror(notebook.cells[3])

        @test haskey(WorkspaceManager.active_workspaces, notebook.notebook_id)
        w = fetch(WorkspaceManager.active_workspaces[notebook.notebook_id])
        oldmod = getproperty(Main, w.module_name)

        setcode!(notebook.cells[2], "")
        setcode!(notebook.cells[3], "")

        update_run!(🍭, notebook, notebook.cells)

        @test isdefined(oldmod, :x)
        @test which(oldmod, :x) != oldmod
        @test !isnothing(getproperty(oldmod, :x))

        newmod = getproperty(Main, w.module_name)
        @test !isdefined(newmod, :x)

        @test !isnothing(Main.var"Pluto#2443".x)
    end

    @testset "Reactive usings" begin
        notebook = Notebook([
            Cell("June"),
            Cell("using Dates"),
            Cell("July"),
        ])

        update_run!(🍭, notebook, notebook.cells[1:1])

        @test notebook.cells[1].errored == true # this cell is before the using Dates and will error
        @test notebook.cells[3] |> noerror # using the position in the notebook this cell will not error

        update_run!(🍭, notebook, notebook.cells[2:2])

        @test notebook.cells[1] |> noerror
        @test notebook.cells[3] |> noerror
    end

    @testset "Reactive usings 2" begin
        notebook = Notebook([
            Cell("October"),
            Cell("using Dates"),
            Cell("December"),
            Cell(""),
        ])

        update_run!(🍭, notebook, notebook.cells)

        @test notebook.cells[1] |> noerror
        @test notebook.cells[3] |> noerror

        setcode!(notebook.cells[2], "")
        update_run!(🍭, notebook, notebook.cells[2:2])

        @test notebook.cells[1].errored == true
        @test notebook.cells[3].errored == true

        setcode!(notebook.cells[4], "December = 13")
        update_run!(🍭, notebook, notebook.cells[4:4])

        @test notebook.cells[1].errored == true
        @test notebook.cells[3] |> noerror

        setcode!(notebook.cells[2], "using Dates")
        update_run!(🍭, notebook, notebook.cells[2:2])

        @test notebook.cells[1] |> noerror
        @test notebook.cells[3] |> noerror
        @test notebook.cells[3].output.body == "13"
    end

    @testset "Reactive usings 3" begin
        notebook = Notebook([
            Cell("archive_artifact"),
            Cell("using Unknown.Package"),
        ])

        update_run!(🍭, notebook, notebook.cells)

        @test notebook.cells[1].errored == true
        @test notebook.cells[2].errored == true

        setcode!(notebook.cells[2], "using Pkg.Artifacts")
        update_run!(🍭, notebook, notebook.cells)

        @test notebook.cells[1] |> noerror
        @test notebook.cells[2] |> noerror
    end

    @testset "Reactive usings 4" begin
        🍭.options.evaluation.workspace_use_distributed = true

        notebook = Notebook([
            Cell("@sprintf \"double_december = %d\" double_december"),
            Cell("double_december = 2December"),
            Cell("archive_artifact"),
            Cell(""),
        ])


        update_run!(🍭, notebook, notebook.cells)

        @test notebook.cells[1].errored == true
        @test notebook.cells[2].errored == true
        @test notebook.cells[3].errored == true

        setcode!(notebook.cells[4], "import Pkg; using Dates, Printf, Pkg.Artifacts")
        update_run!(🍭, notebook, notebook.cells[4:4])

        @test notebook.cells[1] |> noerror
        @test notebook.cells[2] |> noerror
        @test notebook.cells[3] |> noerror
        @test notebook.cells[4] |> noerror
        @test notebook.cells[1].output.body == "\"double_december = 24\""

        cleanup(🍭, notebook)
        🍭.options.evaluation.workspace_use_distributed = false
    end

    @testset "Reactive usings 5" begin
        notebook = Notebook(Cell.([
            "",
            "x = ones(December * 2)",
            "December = 3",
        ]))


        update_run!(🍭, notebook, notebook.cells)

        @test all(noerror, notebook.cells)

        setcode!(notebook.cells[begin], raw"""
            begin
                @eval(module Hello
                    December = 12
                    export December
                end)
                using .Hello
            end
        """)
        update_run!(🍭, notebook, notebook.cells[begin])

        @test all(noerror, notebook.cells)

        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    end

    @testset "More challenging reactivity of extended function" begin
        notebook = Notebook(Cell.([
            "Base.inv(s::String) = s",
            """
            struct MyStruct
                x
                MyStruct(s::String) = new(inv(s))
            end
            """,
            "Base.inv(ms::MyStruct) = inv(ms.x)",
            "MyStruct(\"hoho\")",
            "a = MyStruct(\"blahblah\")",
            "inv(a)",
        ]))
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        @test all(noerror, notebook.cells)
        @test notebook.cells[end].output.body == "\"blahblah\""

        setcode!(cell(1), "Base.inv(s::String) = s * \"suffix\"")
        update_run!(🍭, notebook, cell(1))

        @test all(noerror, notebook.cells)
        @test notebook.cells[end].output.body == "\"blahblahsuffixsuffix\"" # 2 invs, 1 in constructor, 1 in inv(::MyStruct)

        setcode!(cell(3), "Base.inv(ms::MyStruct) = ms.x") # remove inv in inv(::MyStruct)
        update_run!(🍭, notebook, cell(3))

        @test all(noerror, notebook.cells)
        @test notebook.cells[end].output.body == "\"blahblahsuffix\"" # only one inv

        # Empty and run cells to remove the Base overloads that we created, just to be sure
        setcode!.(notebook.cells, [""])
        update_run!(🍭, notebook, notebook.cells)
        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    end

    @testset "Reactive methods definitions" begin
        notebook = Notebook(Cell.([
            raw"""
            Base.sqrt(s::String) = "sqrt($s)"
            """,
            """
            string((sqrt("🍕"), rand()))
            """,
            "",
        ]))
        cell(idx) = notebook.cells[idx]
        update_run!(🍭, notebook, notebook.cells)

        output_21 = cell(2).output.body
        @test contains(output_21, "sqrt(🍕)")

        setcode!(cell(3), """
        Base.sqrt(x::Int) = sqrt(Float64(x)^2)
        """)
        update_run!(🍭, notebook, cell(3))

        output_22 = cell(2).output.body
        @test cell(3) |> noerror
        @test cell(2) |> noerror
        @test cell(1) |> noerror
        @test output_21 != output_22 # cell2 re-run
        @test contains(output_22, "sqrt(🍕)")

        setcode!.(notebook.cells, [""])
        update_run!(🍭, notebook, notebook.cells)
        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    end

    @testset "Don't lose basic generic types with macros" begin
        notebook = Notebook(Cell.([
            "f(::Val{1}) = @info x",
            "f(::Val{2}) = @info x",
        ]))
        update_run!(🍭, notebook, notebook.cells)

        @test notebook.cells[1] |> noerror
        @test notebook.cells[2] |> noerror
    end

    @testset "Variable deletion" begin
        notebook = Notebook([
            Cell("x = 1"),
            Cell("y = x"),
            Cell("struct a; x end"),
            Cell("a")
        ])

        update_run!(🍭, notebook, notebook.cells[1:2])
        @test notebook.cells[1].output.body == notebook.cells[2].output.body
        
        setcode!(notebook.cells[1], "")
        update_run!(🍭, notebook, notebook.cells[1])
        @test notebook.cells[1] |> noerror
        @test expecterror(UndefVarError(:x), notebook.cells[2])

        update_run!(🍭, notebook, notebook.cells[4])
        update_run!(🍭, notebook, notebook.cells[3])
        @test notebook.cells[3] |> noerror
        @test notebook.cells[4] |> noerror
        update_run!(🍭, notebook, notebook.cells[3])
        @test notebook.cells[3] |> noerror
        @test notebook.cells[4] |> noerror
        setcode!(notebook.cells[3], "struct a; x; y end")
        update_run!(🍭, notebook, notebook.cells[3])
        @test notebook.cells[3] |> noerror
        @test notebook.cells[4] |> noerror
        setcode!(notebook.cells[3], "")
        update_run!(🍭, notebook, notebook.cells[3])
        @test notebook.cells[3] |> noerror
        @test notebook.cells[4].errored == true


        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    end

    @testset "Variable cannot reference its previous value" begin
        notebook = Notebook([
        Cell("x = 3")
    ])

        update_run!(🍭, notebook, notebook.cells[1])
        setcode!(notebook.cells[1], "x = x + 1")
        update_run!(🍭, notebook, notebook.cells[1])
        @test occursinerror("UndefVarError", notebook.cells[1])

        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    end

    notebook = Notebook([
        Cell("y = 1"),
        Cell("f(x) = x + y"),
        Cell("f(3)"),

        Cell("g(a,b) = a+b"),
        Cell("g(5,6)"),

        Cell("h(x::Int) = x"),
        Cell("h(7)"),
        Cell("h(8.0)"),

        Cell("p(x) = 9"),
        Cell("p isa Function"),

        Cell("module Something
            export a
            a(x::String) = \"🐟\"
        end"),
        Cell("using .Something"),
        Cell("a(x::Int) = x"),
        Cell("a(\"i am a \")"),
        Cell("a(15)"),
        
        Cell("module Different
            export b
            b(x::String) = \"🐟\"
        end"),
        Cell("import .Different: b"),
        Cell("b(x::Int) = x"),
        Cell("b(\"i am a \")"),
        Cell("b(20)"),
        
        Cell("module Wow
            export c
            c(x::String) = \"🐟\"
        end"),
        Cell("begin
            import .Wow: c
            c(x::Int) = x
        end"),
        Cell("c(\"i am a \")"),
        Cell("c(24)"),

        Cell("Ref((25,:fish))"),
        Cell("begin
            import Base: show
            show(io::IO, x::Ref{Tuple{Int,Symbol}}) = write(io, \"🐟\")
        end"),

        Cell("Base.tand(n::Integer) = \"🎈\""),
        Cell("Base.tand(28)"),
        Cell("tand(29)"),

        Cell("using Dates"),
        Cell("year(DateTime(31))"),
        
        Cell("Base.tan(::Missing) = 32"),
        Cell("Base.tan(missing)"),
        Cell("tan(missing)"),
    ])

    @testset "Changing functions" begin

        update_run!(🍭, notebook, notebook.cells[2])
        @test notebook.cells[2] |> noerror

        update_run!(🍭, notebook, notebook.cells[1])
        update_run!(🍭, notebook, notebook.cells[3])
        @test notebook.cells[3].output.body == "4"

        setcode!(notebook.cells[1], "y = 2")
        update_run!(🍭, notebook, notebook.cells[1])
        @test notebook.cells[3].output.body == "5"
        @test notebook.cells[2] |> noerror

        setcode!(notebook.cells[1], "y")
        update_run!(🍭, notebook, notebook.cells[1])
        @test occursinerror("UndefVarError", notebook.cells[1])
        @test notebook.cells[2] |> noerror
        @test occursinerror("UndefVarError", notebook.cells[3])

        update_run!(🍭, notebook, notebook.cells[4])
        update_run!(🍭, notebook, notebook.cells[5])
        @test notebook.cells[5].output.body == "11"

        setcode!(notebook.cells[4], "g(a) = a+a")
        update_run!(🍭, notebook, notebook.cells[4])
        @test notebook.cells[4] |> noerror
        @test notebook.cells[5].errored == true

        setcode!(notebook.cells[5], "g(5)")
        update_run!(🍭, notebook, notebook.cells[5])
        @test notebook.cells[5].output.body == "10"

        update_run!(🍭, notebook, notebook.cells[6])
        update_run!(🍭, notebook, notebook.cells[7])
        update_run!(🍭, notebook, notebook.cells[8])
        @test notebook.cells[6] |> noerror
        @test notebook.cells[7] |> noerror
        @test notebook.cells[8].errored == true
    
        setcode!(notebook.cells[6], "h(x::Float64) = 2.0 * x")
        update_run!(🍭, notebook, notebook.cells[6])
        @test notebook.cells[6] |> noerror
        @test notebook.cells[7].errored == true
        @test notebook.cells[8] |> noerror

        update_run!(🍭, notebook, notebook.cells[9:10])
        @test notebook.cells[9] |> noerror
        @test notebook.cells[10].output.body == "true"

        setcode!(notebook.cells[9], "p = p")
        update_run!(🍭, notebook, notebook.cells[9])
        @test occursinerror("UndefVarError", notebook.cells[9])

        setcode!(notebook.cells[9], "p = 9")
        update_run!(🍭, notebook, notebook.cells[9])
        @test notebook.cells[9] |> noerror
        @test notebook.cells[10].output.body == "false"
        
        setcode!(notebook.cells[9], "p(x) = 9")
        update_run!(🍭, notebook, notebook.cells[9])
        @test notebook.cells[9] |> noerror
        @test notebook.cells[10].output.body == "true"
    end

    @testset "Extending imported functions" begin
        update_run!(🍭, notebook, notebook.cells[11:15])
        @test_broken notebook.cells[11] |> noerror
        @test_broken notebook.cells[12] |> noerror # multiple definitions for `Something` should be okay? == false
        @test notebook.cells[13] |> noerror
        @test notebook.cells[14].errored == true # the definition for a was created before `a` was used, so it hides the `a` from `Something`
        @test notebook.cells[15].output.body == "15"

        
        @test_nowarn update_run!(🍭, notebook, notebook.cells[13:15])
        @test notebook.cells[13] |> noerror
        @test notebook.cells[14].errored == true # the definition for a was created before `a` was used, so it hides the `a` from `Something`
        @test notebook.cells[15].output.body == "15"

        @test_nowarn update_run!(🍭, notebook, notebook.cells[16:20])
        @test notebook.cells[16] |> noerror
        @test occursinerror("Multiple", notebook.cells[17])
        @test occursinerror("Multiple", notebook.cells[18])
        @test occursinerror("UndefVarError", notebook.cells[19])
        @test occursinerror("UndefVarError", notebook.cells[20])

        @test_nowarn update_run!(🍭, notebook, notebook.cells[21:24])
        @test notebook.cells[21] |> noerror
        @test notebook.cells[22] |> noerror
        @test notebook.cells[23] |> noerror
        @test notebook.cells[23].output.body == "\"🐟\""
        @test notebook.cells[24].output.body == "24"

        setcode!(notebook.cells[22], "import .Wow: c")
        @test_nowarn update_run!(🍭, notebook, notebook.cells[22])
        @test notebook.cells[22] |> noerror
        @test notebook.cells[23].output.body == "\"🐟\""
        @test notebook.cells[23] |> noerror
        @test notebook.cells[24].errored == true # the extension should no longer exist

        # https://github.com/fonsp/Pluto.jl/issues/59
        original_repr = Pluto.PlutoRunner.format_output(Ref((25, :fish)))[1]
        @test_nowarn update_run!(🍭, notebook, notebook.cells[25])
        @test notebook.cells[25].output.body isa Dict
        @test_nowarn update_run!(🍭, notebook, notebook.cells[26])
        @test_broken notebook.cells[25].output.body == "🐟" # cell'🍭 don't automatically call `show` again when a new overload is defined - that'🍭 a minor issue
        @test_nowarn update_run!(🍭, notebook, notebook.cells[25])
        @test notebook.cells[25].output.body == "🐟"

        setcode!(notebook.cells[26], "")
        @test_nowarn update_run!(🍭, notebook, notebook.cells[26])
        @test_nowarn update_run!(🍭, notebook, notebook.cells[25])
        @test notebook.cells[25].output.body isa Dict

        @test_nowarn update_run!(🍭, notebook, notebook.cells[28:29])
        @test notebook.cells[28].output.body == string(tand(28))
        @test notebook.cells[29].output.body == string(tand(29))
        @test_nowarn update_run!(🍭, notebook, notebook.cells[27])
        @test notebook.cells[28].output.body == "\"🎈\""
        @test notebook.cells[29].output.body == "\"🎈\"" # adding the overload doesn't trigger automatic re-eval because `tand` doesn't match `Base.tand`
        @test_nowarn update_run!(🍭, notebook, notebook.cells[28:29])
        @test notebook.cells[28].output.body == "\"🎈\""
        @test notebook.cells[29].output.body == "\"🎈\""

        setcode!(notebook.cells[27], "")
        update_run!(🍭, notebook, notebook.cells[27])
        @test notebook.cells[28].output.body == string(tand(28))
        @test notebook.cells[29].output.body == string(tand(29)) # removing the overload doesn't trigger automatic re-eval because `tand` doesn't match `Base.tand`
        update_run!(🍭, notebook, notebook.cells[28:29])
        @test notebook.cells[28].output.body == string(tand(28))
        @test notebook.cells[29].output.body == string(tand(29))
    end

    @testset "Using external libraries" begin
        update_run!(🍭, notebook, notebook.cells[30:31])
        @test notebook.cells[30] |> noerror
        @test notebook.cells[31].output.body == "31"
        update_run!(🍭, notebook, notebook.cells[31])
        @test notebook.cells[31].output.body == "31"

        setcode!(notebook.cells[30], "")
        update_run!(🍭, notebook, notebook.cells[30:31])
        @test occursinerror("UndefVarError", notebook.cells[31])
        
        update_run!(🍭, notebook, notebook.cells[32:34])
        @test notebook.cells[32] |> noerror
        @test notebook.cells[33] |> noerror
        @test notebook.cells[34] |> noerror
        @test notebook.cells[33].output.body == "32"
        @test notebook.cells[34].output.body == "32"
        
        setcode!(notebook.cells[32], "")
        update_run!(🍭, notebook, notebook.cells[32])

        @test notebook.cells[32] |> noerror
        @test notebook.cells[33] |> noerror
        @test notebook.cells[34] |> noerror
        @test notebook.cells[33].output.body == "missing"
        @test notebook.cells[34].output.body == "missing"
    end
    WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)

    @testset "Global assignments inside functions" begin
    # We currently have a slightly relaxed version of immutable globals:
    # globals can only be mutated/assigned _in a single cell_.
        notebook = Notebook([
            Cell("x = 1"),
            Cell("x = 2"),
            Cell("y = -3; y = 3"),
            Cell("z = 4"),
            Cell("let global z = 5 end"),
            Cell("wowow"),
            Cell("function floep(x) global wowow = x end"),
            Cell("floep(8)"),
            Cell("v"),
            Cell("function g(x) global v = x end; g(10)"),
            Cell("g(11)"),
            Cell("let
                    local r = 0
                    function f()
                        r = 12
                    end
                    f()
                    r
                end"),
            Cell("apple"),
            Cell("map(14:14) do i; global apple = orange; end"),
            Cell("orange = 15"),
        ])

        update_run!(🍭, notebook, notebook.cells[1])
        update_run!(🍭, notebook, notebook.cells[2])
        @test occursinerror("Multiple definitions for x", notebook.cells[1])
        @test occursinerror("Multiple definitions for x", notebook.cells[1])
    
        setcode!(notebook.cells[2], "x + 1")
        update_run!(🍭, notebook, notebook.cells[2])
        @test notebook.cells[1].output.body == "1"
        @test notebook.cells[2].output.body == "2"
    
        update_run!(🍭, notebook, notebook.cells[3])
        @test notebook.cells[3].output.body == "3"

        update_run!(🍭, notebook, notebook.cells[4])
        update_run!(🍭, notebook, notebook.cells[5])
        @test occursinerror("Multiple definitions for z", notebook.cells[4])
        @test occursinerror("Multiple definitions for z", notebook.cells[5])
    
        update_run!(🍭, notebook, notebook.cells[6:7])
        @test occursinerror("UndefVarError", notebook.cells[6])

        # @test_broken occursinerror("assigns to global", notebook.cells[7])
        # @test_broken occursinerror("wowow", notebook.cells[7])
        # @test_broken occursinerror("floep", notebook.cells[7])
    
        update_run!(🍭, notebook, notebook.cells[8])
        @test_broken !occursinerror("UndefVarError", notebook.cells[6])

        update_run!(🍭, notebook, notebook.cells[9:10])
        @test !occursinerror("UndefVarError", notebook.cells[9])
        @test notebook.cells[10] |> noerror

        update_run!(🍭, notebook, notebook.cells[11])
        @test_broken notebook.cells[9].errored == true
        @test_broken notebook.cells[10].errored == true
        @test_broken notebook.cells[11].errored == true

        update_run!(🍭, notebook, notebook.cells[12])
        @test notebook.cells[12].output.body == "12"

        update_run!(🍭, notebook, notebook.cells[13:15])
        @test notebook.cells[13].output.body == "15"
        @test notebook.cells[14] |> noerror

        setcode!(notebook.cells[15], "orange = 10005")
        update_run!(🍭, notebook, notebook.cells[15])
        @test notebook.cells[13].output.body == "10005"

        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    end

    @testset "No top level return" begin
        notebook = Notebook([
            Cell("return 10"),
            Cell("return (0, 0)"),
            Cell("return (0, 0)"),
            Cell("return (0, 0, 0)"),
            Cell("begin return \"a string\" end"),
            Cell("""
                let
                    return []
                end
            """),
            Cell("""filter(1:3) do x
                return true
            end"""),

            # create struct to disable the function-generating optimization
            Cell("struct A1 end; return 10"),
            Cell("struct A2 end; return (0, 0)"),
            Cell("struct A3 end; return (0, 0)"),
            Cell("struct A4 end; return (0, 0, 0)"),
            Cell("struct A5 end; begin return \"a string\" end"),
            Cell("""
                struct A6 end; let
                    return []
                end
            """),
            Cell("""struct A7 end; filter(1:3) do x
                return true
            end"""),

            # Function assignments
            Cell("""f(x) = if x == 1
                return false
            else
                return true
            end"""),
            Cell("""g(x::T) where {T} = if x == 1
                return false
            else
                return true
            end"""),
            Cell("(h(x::T)::MyType) where {T} = return(x)"),
            Cell("i(x)::MyType = return(x)"),
        ])

        update_run!(🍭, notebook, notebook.cells)
        @test occursinerror("You can only use return inside a function.", notebook.cells[1])
        @test occursinerror("You can only use return inside a function.", notebook.cells[2])
        @test occursinerror("You can only use return inside a function.", notebook.cells[3])
        @test occursinerror("You can only use return inside a function.", notebook.cells[4])
        @test occursinerror("You can only use return inside a function.", notebook.cells[5])
        @test occursinerror("You can only use return inside a function.", notebook.cells[6])
        @test notebook.cells[7] |> noerror

        @test occursinerror("You can only use return inside a function.", notebook.cells[8])
        @test occursinerror("You can only use return inside a function.", notebook.cells[9])
        @test occursinerror("You can only use return inside a function.", notebook.cells[10])
        @test occursinerror("You can only use return inside a function.", notebook.cells[11])
        @test occursinerror("You can only use return inside a function.", notebook.cells[12])
        @test occursinerror("You can only use return inside a function.", notebook.cells[13])
        @test notebook.cells[14] |> noerror

        # Function assignments
        @test notebook.cells[15] |> noerror
        @test notebook.cells[16] |> noerror
        @test notebook.cells[17] |> noerror
        @test notebook.cells[18] |> noerror

        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    end

    @testset "Using package from module" begin
        notebook = Notebook([
            Cell("""module A
                        using Dates
                    end"""),
            Cell(""),
            Cell("December"),
        ])

        update_run!(🍭, notebook, notebook.cells)

        @test notebook.cells[begin] |> noerror
        @test occursinerror("UndefVarError", notebook.cells[end])

        setcode!(notebook.cells[2], "using Dates")

        update_run!(🍭, notebook, [notebook.cells[2]])

        @test notebook.cells[1] |> noerror
        @test notebook.cells[2] |> noerror
        @test notebook.cells[3] |> noerror

        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)
    end

    @testset "Function wrapping" begin
        notebook = Notebook([
            Cell("false && jlaksdfjalskdfj"),
            Cell("fonsi = 2"),
            Cell("""
            filter(1:fonsi) do x
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                false
            end |> length
            """),
            Cell("4"),
            Cell("[5]"),
            Cell("6 / 66"),
            Cell("false && (seven = 7)"),
            Cell("seven"),
            
            Cell("nine = :identity"),
            Cell("nine"),
            Cell("@__FILE__; nine"),
            Cell("@__FILE__; twelve = :identity"),
            Cell("@__FILE__; twelve"),
            Cell("twelve"),

            Cell("fifteen = :(1 + 1)"),
            Cell("fifteen"),
            Cell("@__FILE__; fifteen"),
            Cell("@__FILE__; eighteen = :(1 + 1)"),
            Cell("@__FILE__; eighteen"),
            Cell("eighteen"),

            Cell("qb = quote value end"),
            Cell("typeof(qb)"),

            Cell("qn0 = QuoteNode(:value)"),
            Cell("qn1 = :(:value)"),
            Cell("qn0"),
            Cell("qn1"),

            Cell("""
                 named_tuple(obj::T) where {T} = NamedTuple{fieldnames(T),Tuple{fieldtypes(T)...}}(ntuple(i -> getfield(obj, i), fieldcount(T)))
            """),
            Cell("named_tuple"),
            
            Cell("ln = LineNumberNode(29, \"asdf\")"),
            Cell("@assert ln isa LineNumberNode"),
        ])

        update_run!(🍭, notebook, notebook.cells)
        @test notebook.cells[1] |> noerror
        @test notebook.cells[1].output.body == "false"
        @test notebook.cells[22].output.body == "Expr"
        @test notebook.cells[25].output.body == ":(:value)"
        @test notebook.cells[26].output.body == ":(:value)"

        function benchmark(fonsi)
            filter(1:fonsi) do x
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                x = sum(1 for z in 1:x)
                false
            end |> length
        end

        bad = @elapsed benchmark(2)
        good = 0.01 * @elapsed for i in 1:100
            benchmark(2)
        end

        update_run!(🍭, notebook, notebook.cells)
        @test 0.1 * good < notebook.cells[3].runtime / 1.0e9 < 0.5 * bad

        old = notebook.cells[4].output.body
        setcode!(notebook.cells[4], "4.0")
        update_run!(🍭, notebook, notebook.cells[4])
        @test old != notebook.cells[4].output.body
        
        old = notebook.cells[5].output.body
        setcode!(notebook.cells[5], "[5.0]")
        update_run!(🍭, notebook, notebook.cells[5])
        @test old != notebook.cells[5].output.body

        old = notebook.cells[6].output.body
        setcode!(notebook.cells[6], "66 / 6")
        update_run!(🍭, notebook, notebook.cells[6])
        @test old != notebook.cells[6].output.body

        @test notebook.cells[7] |> noerror
        @test notebook.cells[7].output.body == "false"

        @test occursinerror("UndefVarError", notebook.cells[8])

        @test notebook.cells[9].output.body == ":identity"
        @test notebook.cells[10].output.body == ":identity"
        @test notebook.cells[11].output.body == ":identity"
        @test notebook.cells[12].output.body == ":identity"
        @test notebook.cells[13].output.body == ":identity"
        @test notebook.cells[14].output.body == ":identity"

        @test notebook.cells[15].output.body == ":(1 + 1)"
        @test notebook.cells[16].output.body == ":(1 + 1)"
        @test notebook.cells[17].output.body == ":(1 + 1)"
        @test notebook.cells[18].output.body == ":(1 + 1)"
        @test notebook.cells[19].output.body == ":(1 + 1)"
        @test notebook.cells[20].output.body == ":(1 + 1)"

        @test notebook.cells[27] |> noerror
        @test notebook.topology.codes[notebook.cells[27]].function_wrapped == false
        @test notebook.cells[28] |> noerror
        
        update_run!(🍭, notebook, notebook.cells[29:30])
        @test notebook.cells[29] |> noerror
        @test notebook.cells[30] |> noerror
        

        WorkspaceManager.unmake_workspace((🍭, notebook); verbose=false)


        @testset "Expression hash" begin
            same(a,b) = Pluto.PlutoRunner.expr_hash(a) == Pluto.PlutoRunner.expr_hash(b)

            @test same(:(1), :(1))
            @test !same(:(1), :(1.0))
            @test same(:(x + 1), :(x + 1))
            @test !same(:(x + 1), :(x + 1.0))
            @test same(:(1 |> a |> a |> a), :(1 |> a |> a |> a))
            @test same(:(a(b(1,2))), :(a(b(1,2))))
            @test !same(:(a(b(1,2))), :(a(b(1,3))))
            @test !same(:(a(b(1,2))), :(a(b(1,1))))
            @test !same(:(a(b(1,2))), :(a(b(2,1))))
        end
    end


    @testset "Broadcast bug - Issue #2211" begin
        notebook = Notebook(Cell.([
            "abstract type AbstractFoo{T} <: AbstractMatrix{T} end",
            "struct X{T} <: AbstractFoo{T} end",
            "convert(::Type{AbstractArray{T}}, S::AbstractFoo) where {T<:Number} = convert(AbstractFoo{T}, S)",
            "Base.convert(::Type{AbstractArray{T}}, ::AbstractFoo) where {T} = nothing",
            "Base.size(::AbstractFoo) = (2,2)",
            "Base.getindex(::AbstractFoo{T}, args...) where {T} = one(T)",
            "x = X{Float64}()",
            "y = zeros(2,)",
            "x, y",
        ]))
        update_run!(🍭, notebook, notebook.cells)
        @test all(noerror, notebook.cells)
    end

    @testset "ParseError messages" begin
        notebook = Notebook(Cell.([
            "begin",
            "\n\nend",
            "throw(Meta.parse(\"begin\"; raise=false).args[end])",
        ]))
        update_run!(🍭, notebook, notebook.cells)
        @test Pluto.is_just_text(notebook.topology, notebook.cells[1])
        @test Pluto.is_just_text(notebook.topology, notebook.cells[2])
        @test notebook.cells[1].errored
        @test notebook.cells[2].errored
        @test notebook.cells[3].errored

        @test haskey(notebook.cells[1].output.body, :source)
        @test haskey(notebook.cells[1].output.body, :diagnostics)

        @test haskey(notebook.cells[2].output.body, :source)
        @test haskey(notebook.cells[2].output.body, :diagnostics)

        # not literal syntax error
        @test haskey(notebook.cells[3].output.body, :msg)
        @test !haskey(notebook.cells[3].output.body, :source)
        @test !haskey(notebook.cells[3].output.body, :diagnostics)
    end

    @testset "using .LocalModule" begin
        notebook = Notebook(Cell.([
            """
            begin
                @eval module LocalModule
                    const x = :exported
                    export x
                end
                using .LocalModule
            end
            """,
            "x"
        ]))
        update_run!(🍭, notebook, notebook.cells)
        @test notebook.cells[1] |> noerror
        @test notebook.cells[2] |> noerror

        output_2 = notebook.cells[2].output.body
        @test contains(output_2, "exported")

        setcode!(
            notebook.cells[1],
            """
            begin
                @eval module LocalModule
                    const x = :not_exported
                end
                using .LocalModule
            end
            """,
        )

        update_run!(🍭, notebook, [notebook.cells[1]])
        @test expecterror(UndefVarError(:x), notebook.cells[end])
    end
end
