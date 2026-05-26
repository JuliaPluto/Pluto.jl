using Test
import Pluto
import Pluto: update_save_run!, WorkspaceManager, ClientSession, ServerSession, Notebook, Cell

import UUIDs: UUID, uuid1

function get_unique_short_id()
    string(uuid1())[1:8]
end

function stringify_keys(d::Dict)
    Dict(string(k) => stringify_keys(v) for (k, v) in d)
end
stringify_keys(x::Any) = x

import Pluto.Firebasey


function await_with_timeout(check::Function, timeout::Real=60.0, interval::Real=.05)
    starttime = time()
    while !check()
        sleep(interval)
        if time() - starttime >= timeout
            error("Timeout after $(timeout) seconds")
        end
    end
end

@testset "Communication protocol" begin

    @testset "Functionality sweep" begin
        u = [uuid1() for _ in 1:100]

        buffer = IOBuffer()
        client = ClientSession(:buffery, buffer)

        🍭 = ServerSession()

        notebook = Notebook([
            Cell(
                u[1], 
                ""
            ),
        ])
        🍭.notebooks[notebook.notebook_id] = notebook
        update_save_run!(🍭, notebook, notebook.cells)
        client.connected_notebook = notebook
        read(buffer)

        local_state = Pluto.notebook_to_js(notebook)


        function send(type, body, metadata = Dict(:notebook_id => string(notebook.notebook_id)))
            request_id = get_unique_short_id()
            Pluto.process_ws_message(🍭, Dict(
                "type" => string(type),
                "client_id" => string(client.id),
                "request_id" => request_id,
                "body" => body,
                metadata...
            ) |> stringify_keys, client.stream)
        end

        function send_new_state(new_state)
            patches::Array{Dict} = Firebasey.diff(new_state, local_state)
            # @info "patches" patches
            send(:update_notebook, Dict("updates" => patches))

            new_state
        end

        # function update_local_notebook(mutate_fn::Function)
        #     mutable_notebook = deepcopy(notebook)

        #     mutate_fn(mutable_notebook)

        #     new_state = Pluto.notebook_to_js(mutable_notebook)
        #     send_new_state(new_state)
        # end

        last_position = position(buffer)
        function wait_for_updates(process=true)
            # @info "Waiting for updates"
            await_with_timeout() do
                position(buffer) != last_position
            end
            seek(buffer, last_position)
            response = Pluto.unpack(buffer)
            last_position = position(buffer)

            if process
                if response["type"] == "notebook_diff"
                    message = response["message"]
                    patches = [Base.convert(Firebasey.JSONPatch, update) for update in message["patches"]]
                    # @show patches
                    for patch in patches
                        Firebasey.applypatch!(local_state, patch)
                    end
                end
            end

            # @info "Response received" response

            local_state
        end

        # function patch_and_check(mutate_fn::Function)
        #     desired = update_local_notebook(mutate_fn)
        #     result = wait_for_updates()
        #     desired == result
        # end

        @test_nowarn send(:connect, Dict())
        wait_for_updates()

        @test_nowarn send_new_state(local_state)
        wait_for_updates(false)

        read(buffer)

        #= 
        We would also like to test:
        - add cell
        - set code and run
        - fold cell
        - move cell
        - delete cell

        - run multiple cells
        - move cells
        - set bond

        - move notebook file
        - search for docs
        - show more items of an array =#
        @testset "Extension of response" begin
            Pluto.responses[:custom_response] = function (🙋::Pluto.ClientRequest)
                return "Yes this can be extended!"
            end
           @test send(:custom_response, Dict()) == "Yes this can be extended!"           
        end

        @test_nowarn send(:shutdown_notebook, Dict("keep_in_session" => false))

        @test_nowarn await_with_timeout() do
            !haskey(🍭.notebooks, notebook.notebook_id)
        end
    end

    @testset "Docs" begin
        @test occursin("square root", Pluto.PlutoRunner.doc_fetcher("sqrt", Main)[1])
        @test occursin("square root", Pluto.PlutoRunner.doc_fetcher("Base.sqrt", Main)[1])
        @test occursin("Functions are defined", Pluto.PlutoRunner.doc_fetcher("function", Main)[1])
        @test occursin("Within a module", Pluto.PlutoRunner.doc_fetcher("module", Main)[1])
        @test occursin("No documentation found", Pluto.PlutoRunner.doc_fetcher("Base.findmeta", Main)[1])
        let
            doc_output = Pluto.PlutoRunner.doc_fetcher("sor", Main)[1]
            @test occursin("Similar results:", doc_output)
            @test occursin("<b>s</b><b>o</b><b>r</b>t", doc_output)
        end

        @test occursin("\\div", Pluto.PlutoRunner.doc_fetcher("÷", Main)[1])
        @test occursin("\\gamma", Pluto.PlutoRunner.doc_fetcher("γ", Main)[1])
        let # the expression is not valid, so this doc fetch fails
            doc_output, result = Pluto.PlutoRunner.doc_fetcher("🍕\"", Main)
            @test isnothing(doc_output)
            @test result == :👎
        end

        # Issue #1128
        # Ref https://docs.julialang.org/en/v1/manual/documentation/#Dynamic-documentation
        m = Module()
        Core.eval(m, :(
            module DocTest
            "Normal docstring"
            struct MyType
                value::String
            end
            Docs.getdoc(t::MyType) = "Documentation for MyType with value $(t.value)"
            const x = MyType("x")
            "A global variable"
            global y
            end
        ))

        @test occursin("Normal docstring", Pluto.PlutoRunner.doc_fetcher("MyType", m.DocTest)[1])
        @test occursin("Normal docstring", Pluto.PlutoRunner.doc_fetcher("DocTest.MyType", m)[1])
        @test occursin("Documentation for MyType with value", Pluto.PlutoRunner.doc_fetcher("x", m.DocTest)[1])
        @test occursin("Documentation for MyType with value", Pluto.PlutoRunner.doc_fetcher("DocTest.x", m)[1])
        @test occursin("A global variable", Pluto.PlutoRunner.doc_fetcher("y", m.DocTest)[1])
        @test occursin("A global variable", Pluto.PlutoRunner.doc_fetcher("DocTest.y", m)[1])
    end

    @testset "PlutoRunner API" begin
        🍭 = ServerSession()
        # 🍭.options.evaluation.workspace_use_distributed = true
        
        cid = uuid1()

        notebook = Notebook([
            Cell("PlutoRunner.notebook_id[] |> Text"),
            # These cells tests `core_published_to_js`, which is the function used by the official API (`AbtractPlutoDingetjes.Display.published_to_js`).
            Cell(cid, """
            begin
                
                a = Dict(
                    "hello" => "world",
                    "xx" => UInt8[6,7,8],
                )
                b = "cool"
                
                struct ZZZ
                    x
                    y
                end
                
                function Base.show(io::IO, ::MIME"text/html", z::ZZZ)
                    write(io, "<script>\n")
                    PlutoRunner.core_published_to_js(io, z.x)
                    PlutoRunner.core_published_to_js(io, z.y)
                    write(io, "\n</script>")
                end
                
                ZZZ(a, b)
            end
            """),
            Cell("""
            begin
                struct ABC
                    x
                end
                ZZZ(
                    123, 
                    Dict("a" => 234, "b" => ABC(4)),
                )
            end
            """),
        ])

        update_save_run!(🍭, notebook, notebook.cells)
        @test notebook.cells[1].output.body == notebook.notebook_id |> string

        @test notebook.cells[2] |> noerror
        @test notebook.cells[2].output.mime isa MIME"text/html"

        ab1, ab2 = keys(notebook.cells[2].published_objects)
        @test occursin(ab1, notebook.cells[2].output.body)
        @test occursin(ab2, notebook.cells[2].output.body)
        
        ab() = sort(collect(keys(notebook.cells[2].published_objects)); by=(s -> findfirst(s, notebook.cells[2].output.body) |> first))
        a, b = ab()
        
        p = notebook.cells[2].published_objects

        @test p[a] == Dict(
            "hello" => "world",
            "xx" => UInt8[6,7,8],
        )
        @test p[b] == "cool"
        
        old_pa = p[a]
        old_pb = p[b]
        update_save_run!(🍭, notebook, notebook.cells)
        p = notebook.cells[2].published_objects
        a, b = ab()
        @test p[a] == old_pa
        @test p[b] == old_pb
        
        @test !isempty(notebook.cells[2].published_objects)
        
        setcode!(notebook.cells[2], "2")
        update_save_run!(🍭, notebook, notebook.cells)
        @test isempty(notebook.cells[2].published_objects)
        @test isempty(notebook.cells[2].published_objects)
        
        cleanup(🍭, notebook)
    end
end
