
using Pluto.WorkspaceManager: WorkspaceManager, poll
using Pluto: Pluto, ServerSession, Notebook, Cell, update_save_run!, PkgCompat
import TOML

without_pluto_version(s) = replace(s, r"# v.*" => "")


@testset "Project.toml editing" begin
    Pkg.Registry.add(pluto_test_registry_spec)
    🍭 = ServerSession()
    notebook = Notebook([
        Cell("1 + 1"),
        Cell("2 + 2"),
        Cell(""),
        Cell(""),
    ])
    update_save_run!(🍭, notebook, notebook.cells)
    
    gett() = PkgCompat.read_project_file(notebook)
    function sett(oldval, newval)
        Pluto.edit_project_toml(
            🍭, notebook, 
            oldval, newval; 
            run_async=false,
            save=!🍭.options.server.disable_writing_notebook_files,
            backup=true,
        )
    end
    
    
    
    @test strip(gett()) in ["", "[deps]"]
    @test notebook.nbpkg_restart_required_msg === nothing
    
    # 
    # Add a dependency before it is in the notebook
    # 
    old = gett()
    sett(old, """
[deps]
PlutoPkgTestA = "419c6f8d-b8cd-4309-abdc-cee491252f94"

[compat]
PlutoPkgTestA = "=0.1.1"
""")
    
    @test notebook.nbpkg_restart_required_msg !== nothing
    
    setcode!(notebook.cells[1], "import PlutoPkgTestA")
    setcode!(notebook.cells[2], "PlutoPkgTestA.MY_VERSION |> Text")
    update_save_run!(🍭, notebook, notebook.cells)
    @test noerror(notebook.cells[2])
    @test notebook.cells[2].output.body == "0.1.1"
    
    
    
    
    # 
    # Change from = to ~
    # 
    old = gett()
    sett(old, replace(old, "=0.1.1" => "~0.1.1"))
    @test notebook.nbpkg_restart_required_msg !== nothing

    function get_manifest_version()
        m = PkgCompat.read_manifest_file(notebook)
        r = TOML.parse(m)
        r["deps"]["PlutoPkgTestA"][1]["version"] |> VersionNumber
    end
    
    @test get_manifest_version() == v"0.1.1"
    
    # Set to latest version
    old = gett()
    sett(old, replace(old, "~0.1.1" => "~0.2.0"))
    @test notebook.nbpkg_restart_required_msg !== nothing
    @test get_manifest_version() == v"0.2.2"
    
    
    # Project.toml should have auto updated the compat entry:
    old = gett()
    @test TOML.parse(old)["compat"]["PlutoPkgTestA"] == "~0.2.2"
    
    
    
    
    # Adding a package from github
    if VERSION >= v"1.12.0"
        old = gett()
        sett(old, """
[deps]
PlutoPkgTestA = "419c6f8d-b8cd-4309-abdc-cee491252f94"

[sources]
PlutoPkgTestA = {url="https://github.com/JuliaPluto/PlutoPkgTestA.jl", rev="crazy"}
""")
        @info "hmmm" 
        println(stderr, notebook.nbpkg_terminal_outputs["nbpkg_edit"])
        
        # Now restart
        Pluto.response_restart_process(Pluto.ClientRequest(
            session=🍭,
            notebook=notebook,
        ); run_async=false)
        
        @test notebook.nbpkg_restart_required_msg === nothing
        @test get_manifest_version() == v"12.34.56"
        @test notebook.cells[2].output.body == "12.34.56"
        
        
        
        
        
        
        
    end
    
    
    
    
    
    
    cleanup(🍭, notebook)
    Pkg.Registry.rm(pluto_test_registry_spec)
end


