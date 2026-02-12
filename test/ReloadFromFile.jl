using Test
import Pluto: Configuration, Notebook, ServerSession, ClientSession, update_run!, Cell, WorkspaceManager, SessionActions, save_notebook
import Pluto.Configuration: Options, EvaluationOptions
using Pluto.WorkspaceManager: poll
import Pkg


function retry(f::Function, n)
    try
        f()
    catch e
        if n > 0
            retry(f, n - 1)
        else
            rethrow(e)
        end
    end
end

@testset "Reload from file" begin
    
    retry(3) do
    
    🍭 = ServerSession()
    🍭.options.evaluation.workspace_use_distributed = false
    🍭.options.server.auto_reload_from_file = true
    
    
    timeout_between_tests = 🍭.options.server.auto_reload_from_file_cooldown * 1.5

    notebook = SessionActions.new(🍭; run_async=false)
    
    ### 
    sleep(timeout_between_tests)
    
    nb1 = Notebook([
        Cell("x = 123"),
        Cell("x + x"),
        Cell("rand()"),
    ])
    file1 = sprint(Pluto.save_notebook, nb1)

    
    write(notebook.path, file1)
    
    @assert poll(30) do
        length(notebook.cells) == 3
    end
    @assert poll(5) do
        notebook.cells[1].output.body == "123"
    end
    @assert poll(5) do
        all(c -> !c.running, notebook.cells)
    end
    
    @assert notebook.cells[2].output.body == "246"
    @assert notebook.cells[3] |> noerror
    
    original_rand_output = notebook.cells[3].output.body
    
    ###
    sleep(timeout_between_tests)
    
    
    nb2 = Notebook(reverse(nb1.cells))

    file2 = sprint(Pluto.save_notebook, nb2)
    write(notebook.path, file2)
    
    @assert poll(10) do
        notebook.cells[3].output.body == "123"
    end
    
    # notebook order reversed, but cell should not re-run
    @assert original_rand_output == notebook.cells[1].output.body
    
    
    ###
    sleep(timeout_between_tests)
    
    
    file3 = replace(file1, "123" => "6")
    write(notebook.path, file3)
    
    
    @assert poll(10) do
        notebook.cells[1].output.body == "6"
    end
    @assert poll(5) do
        all(c -> !c.running, notebook.cells)
    end
    @assert notebook.cells[2].output.body == "12"
    
    # notebook order reversed again, but cell should not re-run
    @assert original_rand_output == notebook.cells[3].output.body

    
        
    ###
    sleep(timeout_between_tests)
    
    file4 = read(notebook.path, String)
    last_hot_reload_time4 = notebook.last_hot_reload_time
    notebook.cells[3].code_folded = true
    save_notebook(notebook)
    sleep(timeout_between_tests)
    
    file5 = read(notebook.path, String)
    @test file4 != file5
    @test notebook.cells[3].code_folded
    write(notebook.path, file4)
    
    
    @assert poll(10) do
        notebook.cells[3].code_folded == false
    end
    
    # cell folded, but cell should not re-run
    @assert original_rand_output == notebook.cells[3].output.body

    @assert poll(10) do
        last_hot_reload_time5 = notebook.last_hot_reload_time
        last_hot_reload_time5 != last_hot_reload_time4
    end
        
    ###
    sleep(timeout_between_tests)
    
    
    file6 = read(notebook.path, String)
    Pluto.set_disabled(notebook.cells[3], true)
    save_notebook(notebook)
    sleep(timeout_between_tests)
    
    file7 = read(notebook.path, String)
    @assert file6 != file7
    @assert Pluto.is_disabled(notebook.cells[3])
    
    write(notebook.path, file6)
    @assert poll(10) do
        !Pluto.is_disabled(notebook.cells[3])
    end
    
    # cell disabled and re-enabled, so it should re-run
    @assert poll(10) do
        original_rand_output != notebook.cells[3].output.body
    end


    ###
    sleep(timeout_between_tests)
    
    file8 = read(joinpath(@__DIR__, "packages", "fixtures", "simple_stdlib_import.jl"), String)
    write(notebook.path, file8)
    
    
    @assert poll(10) do
        notebook.cells[2].output.body == "false"
    end
    
    @assert length(notebook.cells) == 2
    @assert notebook.nbpkg_restart_required_msg !== nothing
end
@test true
end
