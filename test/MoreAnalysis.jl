import Pluto: Pluto, Cell, ExpressionExplorerExtras
import Pluto.MoreAnalysis

using Test

@testset "MoreAnalysis" begin

    file = joinpath(@__DIR__, "parallelpaths4.jl")

    newpath = tempname()
    Pluto.readwrite(file, newpath)

    notebook = Pluto.load_notebook(newpath)
    # Run pluto's analysis. This is like opening the notebook, without actually running it
    # s = Pluto.ServerSession()
    # Pluto.update_save_run!(s, notebook, notebook.cells; run)
    notebook.topology = Pluto.updated_topology(notebook.topology, notebook, notebook.cells)
    
    ind(c::Cell) = findfirst(isequal(c), notebook.cells)
    cell_indices(cs) = sort(ind.(cs))
    
    @testset "Recursive stuff" begin
        
        @test cell_indices(MoreAnalysis.downstream_recursive(notebook.topology, notebook.cells[1:1])) == 3:7
        @test cell_indices(MoreAnalysis.upstream_recursive(notebook.topology, notebook.cells[1:1])) == []
        
        @test cell_indices(MoreAnalysis.downstream_recursive(notebook.topology, notebook.cells[6:6])) == [7]
        @test cell_indices(MoreAnalysis.upstream_recursive(notebook.topology, notebook.cells[6:6])) == [1,2,3,4]
        
        @test cell_indices(MoreAnalysis.downstream_recursive(notebook.topology, notebook.cells[7:7])) == []
        @test cell_indices(MoreAnalysis.upstream_recursive(notebook.topology, notebook.cells[7:7])) == 1:6
        
        @test cell_indices(MoreAnalysis.downstream_recursive(notebook.topology, notebook.cells[4:5])) == 6:7
        @test cell_indices(MoreAnalysis.upstream_recursive(notebook.topology, notebook.cells[4:5])) == 1:3
        
        @test cell_indices(MoreAnalysis.downstream_recursive(notebook.topology, notebook.cells[1:2])) == 3:7
        @test cell_indices(MoreAnalysis.upstream_recursive(notebook.topology, notebook.cells[1:2])) == []
        
        @test cell_indices(MoreAnalysis.downstream_recursive(notebook.topology, notebook.cells[1:7])) == 3:7
        @test cell_indices(MoreAnalysis.upstream_recursive(notebook.topology, notebook.cells[1:7])) == 1:6
        
        
        @test cell_indices(MoreAnalysis.downstream_recursive(notebook.topology, notebook.cells[[1,3]])) == 3:7
        @test cell_indices(MoreAnalysis.upstream_recursive(notebook.topology, notebook.cells[[1,3]])) == [1]
        
        @test MoreAnalysis.upstream_recursive(notebook.topology, Cell[]) == Set{Cell}()
        @test MoreAnalysis.downstream_recursive(notebook.topology, Cell[]) == Set{Cell}()
    end
    
    @testset "Bond connections" begin

        # bound_variables = (map(notebook.cells) do cell
        #     MoreAnalysis.find_bound_variables(cell.parsedcode)
        # end)

        connections = MoreAnalysis.bound_variable_connections_graph(notebook.topology)

        @test !isempty(connections)
        wanted_connections = Dict(
            :x         => [:y, :x],
            :y         => [:y, :x],
            :show_dogs => [:show_dogs],
            :b         => [:b],
            :c         => [:c],
            :five1     => [:five1],
            :five2     => [:five2],
            :six1      => [:six2, :six1],
            :six2      => [:six3, :six2, :six1],
            :six3      => [:six3, :six2],
            :cool1     => [:cool1, :cool2],
            :cool2     => [:cool1, :cool2],
            :world     => [:world],
            :boring    => [:boring],
        )

        transform(d) = Dict(k => sort(v) for (k, v) in d)

        @test transform(connections) == transform(wanted_connections)
    end
    
    
        
    @testset "can_be_function_wrapped" begin

        c = ExpressionExplorerExtras.can_be_function_wrapped


        @test c(quote
            a = b + C
            if d
                for i = 1:10
                    while Y
                    end
                end
            end
        end)


        @test c(quote
            map(1:10) do i
                i + 1
            end
        end)


        @test !c(quote
            function x(x)
                X
            end
        end)

        @test !c(quote
            if false
                using Asdf
            end
        end)


    end
end
