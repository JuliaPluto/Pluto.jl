### A Pluto.jl notebook ###
# v0.16.1

using Markdown
using InteractiveUtils

# ╔═╡ c02664e7-2046-4103-8a59-dca4998638df
begin
	import Pkg
	Pkg.activate(joinpath(@__DIR__))
    Pkg.resolve()
    Pkg.instantiate()

	# Pkg.status()
end

# ╔═╡ 8a90d8a0-eb33-417c-8ac3-440822ae99f3
LOAD_PATH

# ╔═╡ 3103370e-488a-4cac-9540-1ef4bec5503b
using PlutoPkgTestA

# ╔═╡ 82d46919-ccb0-4ad2-bb3d-77adfafebc4d
PlutoPkgTestA.MY_VERSION |> Text

# ╔═╡ c44e23b8-3101-11ec-2112-df6ef8652469
@__DIR__

# ╔═╡ a6cee179-f82c-4ef5-8091-cf0be115ec92
pwd()

# ╔═╡ 26283153-f597-44b9-8a17-8018ca7ca34c
Base.active_project()

# ╔═╡ 3b96bb61-08f0-4ba8-90d2-2a2be9902c2d
Base.current_project()

# ╔═╡ 8cc87597-f0c5-4902-9f3e-4ed8c6798ee9
Base.current_project(@__DIR__)

# ╔═╡ 8559b034-f7d2-4eea-a080-557f22ed98d9
Base.current_project(joinpath(@__DIR__, "..")) |> normpath

# ╔═╡ Cell order:
# ╠═c02664e7-2046-4103-8a59-dca4998638df
# ╠═8a90d8a0-eb33-417c-8ac3-440822ae99f3
# ╠═82d46919-ccb0-4ad2-bb3d-77adfafebc4d
# ╠═3103370e-488a-4cac-9540-1ef4bec5503b
# ╠═c44e23b8-3101-11ec-2112-df6ef8652469
# ╠═a6cee179-f82c-4ef5-8091-cf0be115ec92
# ╠═26283153-f597-44b9-8a17-8018ca7ca34c
# ╠═3b96bb61-08f0-4ba8-90d2-2a2be9902c2d
# ╠═8cc87597-f0c5-4902-9f3e-4ed8c6798ee9
# ╠═8559b034-f7d2-4eea-a080-557f22ed98d9
