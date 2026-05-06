using HTTP
using Test
using Pluto
using Pluto: ServerSession, ClientSession, SessionActions, WorkspaceManager
using Pluto.Configuration
using Pluto.Configuration: notebook_path_suggestion, from_flat_kwargs, _convert_to_flags
using Pluto.WorkspaceManager: WorkspaceManager, poll

@testset "Web server" begin

@testset "base_url" begin
    port = 13433
    host = "localhost"

    n_components = rand(2:6)
    base_url = "/"
    for _ in 1:n_components
        base_url *= String(rand(collect('a':'z') ∪ collect('0':'9'), rand(5:10))) * "/"
    end
    local_url(suffix) = "http://$host:$port$base_url$suffix"

    @show local_url("favicon.ico")
    server_running() = HTTP.get(local_url("favicon.ico")).status == 200 && HTTP.get(local_url("edit")).status == 200

    # without notebook at startup
    options = Pluto.Configuration.from_flat_kwargs(;
        port,
        launch_browser=false,
        workspace_use_distributed=true,
        require_secret_for_access=false,
        require_secret_for_open_links=false,
        base_url,
    )
    🍭 = Pluto.ServerSession(; options)
    server = Pluto.run!(🍭)

    @test server_running()

    sleep(3)
    @test poll(20) do
        # should not exist because of the base url setting
        HTTP.get("http://$host:$port/edit"; status_exception=false).status == 404
    end

    for notebook in values(🍭.notebooks)
        SessionActions.shutdown(🍭, notebook; keep_in_session=false)
    end

    close(server)
end

@testset "pretty_address" begin
    make_session(; kwargs...) = Pluto.ServerSession(;
        options=Pluto.Configuration.from_flat_kwargs(;
            launch_browser=false,
            require_secret_for_access=false,
            require_secret_for_open_links=false,
            kwargs...,
        ),
    )
    call(session) = Pluto.pretty_address(session, Sockets.IPv4("127.0.0.1"), 1234)

    clean_env(f) = withenv(f, "JULIAHUB_APP_URL" => nothing, "JH_APP_URL" => nothing)

    clean_env() do
        @test call(make_session()) == "http://localhost:1234/"
    end

    clean_env() do
        session = make_session(; root_url="https://x.example/{PORT}/")
        @test call(session) == "https://x.example/1234/"
    end

    withenv("JULIAHUB_APP_URL" => "https://x.juliahub.com/", "JH_APP_URL" => nothing) do
        @test call(make_session()) == "https://x.juliahub.com/proxy/1234/"
    end

    withenv("JULIAHUB_APP_URL" => nothing, "JH_APP_URL" => "https://legacy.juliahub.com/") do
        @test call(make_session()) == "https://legacy.juliahub.com/proxy/1234/"
    end

    withenv("JULIAHUB_APP_URL" => "https://new.juliahub.com/", "JH_APP_URL" => "https://legacy.juliahub.com/") do
        @test call(make_session()) == "https://new.juliahub.com/proxy/1234/"
    end

    withenv("JULIAHUB_APP_URL" => "https://x.juliahub.com/", "JH_APP_URL" => nothing) do
        session = make_session(; root_url="https://override.example/{PORT}/")
        @test call(session) == "https://override.example/1234/"
    end
end

@testset "UTF-8 to Codemirror UTF-16 byte mapping" begin
    # range ends are non inclusives
    tests = [
        (" aaaa", (2, 4), (1, 3)), # cm is zero based
        (" 🍕🍕", (2, 6), (1, 3)), # a 🍕 is two UTF16 codeunits
        (" 🍕🍕", (6, 10), (3, 5)), # a 🍕 is two UTF16 codeunits
    ]
    for (s, (start_byte, end_byte), (from, to)) in tests
        @test Pluto.PlutoRunner.map_byte_range_to_utf16_codepoints(s, start_byte, end_byte) == (from, to)
    end
end


@testset "Exports" begin
    port, socket = 
        @inferred Pluto.port_serversocket(Sockets.ip"0.0.0.0", nothing, 5543)

    close(socket)
    @test 5543 <= port < 5600

    port = 13432
    host = "localhost"
    local_url(suffix) = "http://$host:$port/$suffix"


    server_running() = HTTP.get(local_url("favicon.ico")).status == 200 && HTTP.get(local_url("edit")).status == 200


    # without notebook at startup
    options = Pluto.Configuration.from_flat_kwargs(; 
        port, launch_browser=false, 
        workspace_use_distributed=true, 
        require_secret_for_access=false, 
        require_secret_for_open_links=false
    )
    🍭 = Pluto.ServerSession(; options)
    server = Pluto.run!(🍭)
    
    @test server_running()
    
    @test isempty(🍭.notebooks)
    
    HTTP.get(local_url("sample/JavaScript.jl"); retry=false)
    
    # wait for the notebook to be added to the session
    @test poll(10) do
        length(🍭.notebooks) == 1
    end
    
    notebook = only(values(🍭.notebooks))
    
    # right now, the notebook was only added to the session and assigned an ID. Let's wait for it to get a process:
    @test poll(60) do
        haskey(WorkspaceManager.active_workspaces, notebook.notebook_id)
    end
    sleep(2)
    
    # Note that the notebook is running async right now! It's not finished yet. But we can already run these tests:
    
    fileA = try
        download(local_url("notebookfile?id=$(notebook.notebook_id)"))
    catch
        # try again :)
        sleep(1)
        download(local_url("notebookfile?id=$(notebook.notebook_id)"))
    end

    fileB = tempname()
    write(fileB, sprint(Pluto.save_notebook, notebook))
    
    @test Pluto.only_versions_or_lineorder_differ(fileA, fileB)
    
    export_contents = read(download(local_url("notebookexport?id=$(notebook.notebook_id)")), String)
    
    @test occursin(string(Pluto.PLUTO_VERSION), export_contents)
    @test occursin("</html>", export_contents)
    @test occursin("insertion-spot", export_contents)
    # pluto.land needs to find this pattern:
    plutoland_regex = r"href=\"(https://cdn\.jsdelivr\.net/gh/(?:fonsp|JuliaPluto)/Pluto\.jl@([\d.]+)/)[\w/.\\d\-]*\""
    @test occursin(plutoland_regex, export_contents)
    
    
    export_offline_contents = read(download(local_url("notebookexport?offline_bundle=true&id=$(notebook.notebook_id)")), String)
    # We can't test if the offline_bundle is working (and that it is different from the regular bundle), because the tests are probably running on an unbundled Pluto (the directories frontend-dist and frontend-dist-offline are not generated). In that case, Pluto falls back to using the unbundled editor.html with CDN pointing to /frontend/, for example:
    ### https://cdn.jsdelivr.net/gh/JuliaPluto/Pluto.jl@0.20.21/frontend/img/favicon_unsaturated.svg
    @test occursin(string(Pluto.PLUTO_VERSION), export_offline_contents)
    @test occursin("</html>", export_offline_contents)
    @test occursin("insertion-spot", export_offline_contents)
    @test occursin(plutoland_regex, export_offline_contents)
    
    t = tempname(; cleanup=false)
    write(@show(t), export_offline_contents)
    
    
    if isdir(joinpath(pkgdir(Pluto), "frontend-dist")) && isdir(joinpath(pkgdir(Pluto), "frontend-dist-offline"))
        @test hash(export_offline_contents) != hash(export_contents)
        @test length(export_offline_contents) > 4 * length(export_contents) # the offline bundle is much larger than the regular export
        
        https_count = count("https://", export_contents)
        https_count_offline = count("https://", export_offline_contents)
        @test https_count > https_count_offline + 5
    else
        @info "Skipping offline bundle tests because there are no bundle files. That's fine, but if you want to run these tests then you should run the frontend bundlers before, and run with the JULIA_PLUTO_FORCE_BUNDLED=ja env variable."
    end
    
    
    # wait for Pkg to finish
    for _ in 1:10
        Pluto.withtoken(Pluto.pkg_token) do
            sleep(0.01)
        end
    end
    
    for notebook in values(🍭.notebooks)
        SessionActions.shutdown(🍭, notebook; keep_in_session=false, async=false)
    end
    
    close(server)
end
sleep(2)

end # testset
