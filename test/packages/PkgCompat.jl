import Pluto.PkgCompat
import Pluto
import Pluto: update_save_run!, update_run!, WorkspaceManager, ClientSession, ServerSession, Notebook, Cell, project_relative_path, SessionActions, load_notebook
using Test
import Pkg
import TOML


@testset "PkgCompat" begin
    PkgCompat.refresh_registry_cache()

    @testset "Available versions" begin
        vs = PkgCompat.package_versions("HTTP")

        @test v"0.9.0" ∈ vs
        @test v"0.9.1" ∈ vs
        @test "stdlib" ∉ vs
        @test PkgCompat.package_exists("HTTP")

        vs = PkgCompat.package_versions("Dates")

        @test vs == ["stdlib"]
        @test PkgCompat.package_exists("Dates")

        @test PkgCompat.is_stdlib("Dates")
        @test PkgCompat.is_stdlib("Markdown")
        @test PkgCompat.is_stdlib("Sockets")
        @test PkgCompat.is_stdlib("MbedTLS_jll")
        @test PkgCompat.is_stdlib("Test")
        @test PkgCompat.is_stdlib("Pkg")
        @test PkgCompat.is_stdlib("Random")
        @test PkgCompat.is_stdlib("FileWatching")
        @test PkgCompat.is_stdlib("Distributed")
        # upgradable stdlibs:
        @test PkgCompat.is_stdlib("Statistics")
        @test PkgCompat.is_stdlib("DelimitedFiles")

        @test !PkgCompat.is_stdlib("PlutoUI")


        vs = PkgCompat.package_versions("Dateskjashdfkjahsdfkjh")

        @test isempty(vs)
        @test !PkgCompat.package_exists("Dateskjashdfkjahsdfkjh")
        
    end
    
    @testset "URL" begin
        @test PkgCompat.package_url("HTTP") == "https://github.com/JuliaWeb/HTTP.jl.git"
        @test PkgCompat.package_url("HefefTTP") === nothing
        @test PkgCompat.package_url("Downloads") == "https://docs.julialang.org/en/v1/stdlib/Downloads/"
    end
    
    @testset "Registry queries" begin
        Pkg.Registry.add(pluto_test_registry_spec)
        PkgCompat.refresh_registry_cache()
        
        es = PkgCompat._registry_entries("PlutoPkgTestA")
        @test length(es) == 1
        @test occursin("P/PlutoPkgTestA", only(es))
        @test occursin("PlutoPkgTestRegistry", only(es))
        
        es = PkgCompat._registry_entries("Pluto")
        @test length(es) == 1
        @test occursin("P/Pluto", only(es))
        @test occursin("General", only(es))
        
        es = PkgCompat._registry_entries("HelloWorldC_jll")
        @test length(es) == 1
        @test occursin("H/HelloWorldC_jll", only(es))
        @test occursin("General", only(es))
        
        Pkg.Registry.rm(pluto_test_registry_spec)
    end

    @testset "Installed versions" begin
        # we are querying the package environment that is currently active for testing
        ctx = Pkg.Types.Context()

        ctx = PkgCompat.create_empty_ctx()
        Pkg.add(ctx, [Pkg.PackageSpec("HTTP"), Pkg.PackageSpec("UUIDs"), ])
        @test PkgCompat.get_manifest_version(ctx, "HTTP") > v"0.8.0"
        @test PkgCompat.get_manifest_version(ctx, "UUIDs") == "stdlib"

    end

    @testset "Completions" begin
        cs = PkgCompat.registered_package_names()
        @test "HypertextLiteral" ∈ cs
        @test "Hyperscript" ∈ cs

        @test "Dates" ∈ cs
    end

    @testset "Compat manipulation" begin
        old_path = joinpath(pkg_fixtures, "old_artifacts_import.jl")
        old_contents = read(old_path, String)
        
        dir = mktempdir()
        path = joinpath(dir, "hello.jl")
        
        write(path, old_contents)
        
        notebook = load_notebook(path)
        ptoml_contents() = PkgCompat.read_project_file(notebook)
        mtoml_contents() = PkgCompat.read_manifest_file(notebook)
        
        @test num_backups_in(dir) == 0
        
        
        
        @test Pluto.only_versions_or_lineorder_differ(old_path, path)
        
        ptoml = TOML.parse(ptoml_contents())
        @test haskey(ptoml["deps"], "PlutoPkgTestA")
        @test haskey(ptoml["deps"], "Artifacts")
        @test haskey(ptoml["compat"], "PlutoPkgTestA")
        @test haskey(ptoml["compat"], "Artifacts")
        
        PkgCompat.clear_stdlib_compat_entries!(notebook.nbpkg_ctx)
        
        ptoml = TOML.parse(ptoml_contents())
        @test haskey(ptoml["deps"], "PlutoPkgTestA")
        @test haskey(ptoml["deps"], "Artifacts")
        @test haskey(ptoml["compat"], "PlutoPkgTestA")
        if PkgCompat.is_stdlib("Artifacts")
            @test !haskey(ptoml["compat"], "Artifacts")
        end
        
        old_a_compat_entry = ptoml["compat"]["PlutoPkgTestA"]
        PkgCompat.clear_auto_compat_entries!(notebook.nbpkg_ctx)
        
        ptoml = TOML.parse(ptoml_contents())
        @test haskey(ptoml["deps"], "PlutoPkgTestA")
        @test haskey(ptoml["deps"], "Artifacts")
        @test !haskey(ptoml, "compat")
        compat = get(ptoml, "compat", Dict())
        @test !haskey(compat, "PlutoPkgTestA")
        @test !haskey(compat, "Artifacts")
        
        PkgCompat.write_auto_compat_entries!(notebook.nbpkg_ctx)
        
        ptoml = TOML.parse(ptoml_contents())
        @test haskey(ptoml["deps"], "PlutoPkgTestA")
        @test haskey(ptoml["deps"], "Artifacts")
        @test haskey(ptoml["compat"], "PlutoPkgTestA")
        if PkgCompat.is_stdlib("Artifacts")
            @test !haskey(ptoml["compat"], "Artifacts")
        end
        
        
    end
    
    
    @testset "Misc" begin
        PkgCompat.create_empty_ctx()
    end
end
