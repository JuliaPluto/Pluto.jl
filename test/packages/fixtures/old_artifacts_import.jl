### A Pluto.jl notebook ###
# v0.15.0

using Markdown
using InteractiveUtils

# ╔═╡ c581d17a-c965-11eb-1607-bbeb44933d25
# This file imports an outdated version of PlutoPkgTestA: 0.2.1 (which is stored in the embedded Manifest file) and Artifacts, which is now a standard library (as of Julia 1.6), but it used to be a registered package (https://github.com/JuliaPackaging/Artifacts.jl). This notebook was generated on Julia 1.5, so the Manifest will be very very confusing for Julia 1.6 and up.

# It is generated on Julia 1.5 (our oldest supported Julia version (at the time of writing), Manifest.toml is not backwards-compatible):

# 1. add our test registry: 
#   pkg> registry add https://github.com/JuliaPluto/PlutoPkgTestRegistry

# 2. using Pluto, open the simple_import.jl notebook

# 3. add the `import Artifacts` cell



import PlutoPkgTestA

# ╔═╡ aef57966-ea36-478f-8724-e71430f10be9
PlutoPkgTestA.MY_VERSION |> Text

# ╔═╡ f9bdbb35-4326-4786-b308-88b6894923df
import Artifacts

# ╔═╡ 00000000-0000-0000-0000-000000000001
PLUTO_PROJECT_TOML_CONTENTS = """
[deps]
Artifacts = "56f22d72-fd6d-98f1-02f0-08ddc0907c33"
PlutoPkgTestA = "419c6f8d-b8cd-4309-abdc-cee491252f94"

[compat]
Artifacts = "~1.3.0"
PlutoPkgTestA = "~0.2.2"
"""

# ╔═╡ 00000000-0000-0000-0000-000000000002
PLUTO_MANIFEST_TOML_CONTENTS = """
# This file is machine-generated - editing it directly is not advised

[[Artifacts]]
deps = ["Pkg"]
git-tree-sha1 = "c30985d8821e0cd73870b17b0ed0ce6dc44cb744"
uuid = "56f22d72-fd6d-98f1-02f0-08ddc0907c33"
version = "1.3.0"

[[Base64]]
uuid = "2a0f44e3-6c83-55bd-87e4-b1978d98bd5f"

[[Dates]]
deps = ["Printf"]
uuid = "ade2ca70-3891-5945-98fb-dc099432e06a"

[[InteractiveUtils]]
deps = ["Markdown"]
uuid = "b77e0a4c-d291-57a0-90e8-8db25a27a240"

[[LibGit2]]
deps = ["Printf"]
uuid = "76f85450-5226-5b5a-8eaa-529ad045b433"

[[Libdl]]
uuid = "8f399da3-3557-5675-b5ff-fb832c97cbdb"

[[Logging]]
uuid = "56ddb016-857b-54e1-b83d-db4d58db5568"

[[Markdown]]
deps = ["Base64"]
uuid = "d6f4376e-aef5-505a-96c1-9c027394607a"

[[Pkg]]
deps = ["Dates", "LibGit2", "Libdl", "Logging", "Markdown", "Printf", "REPL", "Random", "SHA", "UUIDs"]
uuid = "44cfe95a-1eb2-52ea-b672-e2afdf69b78f"

[[PlutoPkgTestA]]
deps = ["Pkg"]
git-tree-sha1 = "6c9aa67135641123c559d59ba88e8cb93841773a"
uuid = "419c6f8d-b8cd-4309-abdc-cee491252f94"
version = "0.2.2"

[[Printf]]
deps = ["Unicode"]
uuid = "de0858da-6303-5e67-8744-51eddeeeb8d7"

[[REPL]]
deps = ["InteractiveUtils", "Markdown", "Sockets"]
uuid = "3fa0cd96-eef1-5676-8a61-b3b8758bbffb"

[[Random]]
deps = ["Serialization"]
uuid = "9a3f8284-a2c9-5f02-9a11-845980a1fd5c"

[[SHA]]
uuid = "ea8e919c-243c-51af-8825-aaa63cd721ce"

[[Serialization]]
uuid = "9e88b42a-f829-5b0c-bbe9-9e923198166b"

[[Sockets]]
uuid = "6462fe0b-24de-5631-8697-dd941f90decc"

[[UUIDs]]
deps = ["Random", "SHA"]
uuid = "cf7118a7-6976-5b1a-9a39-7adc72f591a4"

[[Unicode]]
uuid = "4ec0a83e-493e-50e2-b9ac-8f72acf5a8f5"
"""

# ╔═╡ Cell order:
# ╠═c581d17a-c965-11eb-1607-bbeb44933d25
# ╠═aef57966-ea36-478f-8724-e71430f10be9
# ╠═f9bdbb35-4326-4786-b308-88b6894923df
# ╟─00000000-0000-0000-0000-000000000001
# ╟─00000000-0000-0000-0000-000000000002
