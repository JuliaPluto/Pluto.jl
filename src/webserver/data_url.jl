### A Pluto.jl notebook ###
# v0.19.9

using Markdown
using InteractiveUtils

# ╔═╡ b987a8a2-6ab0-4e88-af3c-d7f2778af657
# ╠═╡ show_logs = false
# ╠═╡ skip_as_script = true
#=╠═╡
begin
	import Pkg

	# create a local environment for this notebook
	# used to install and load PlutoTest
	local_env = mktempdir()
	Pkg.activate(local_env)
	Pkg.add(name="PlutoTest", version="0.2")
	pushfirst!(LOAD_PATH, local_env)

	# activate Pluto's environment, used to load HTTP.jl
	Pkg.activate(Base.current_project(@__FILE__))
	using PlutoTest
end
  ╠═╡ =#

# ╔═╡ cc180e7e-46c3-11ec-3fff-05e1b5c77986
# ╠═╡ skip_as_script = true
#=╠═╡
md"""
# Download Data URLs


"""
  ╠═╡ =#

# ╔═╡ 2385dd3b-15f8-4790-907f-e0576a56c4c0
# ╠═╡ skip_as_script = true
#=╠═╡
random_data = rand(UInt8, 30)
  ╠═╡ =#

# ╔═╡ d8ed6d44-33cd-4c9d-828b-d237d43769f5
# try
# download("asdffads")
# catch e
# 	e
# end |> typeof

# ╔═╡ b3f685a3-b52d-4190-9196-6977a7e76aa1
begin
	import HTTP.URIs
	import Base64
	import Downloads
end

# ╔═╡ a85c0c0b-47d0-4377-bc22-3c87239a67b3
"""
```julia
download_cool(url::AbstractString, [path::AbstractString = tempname()]) -> path
```

The same as [`Base.download`](@ref), but also supports [Data URLs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs).
"""
function download_cool(url::AbstractString, path::AbstractString=tempname())
	if startswith(url, "data:")
		comma_index = findfirst(',', url)

		@assert comma_index isa Int "Invalid data URL."
		
		metadata_str = url[length("data:")+1:comma_index-1]
		metadata_parts = split(metadata_str, ';')
		
		mime = MIME(first(metadata_parts))
		is_base64 = "base64" ∈ metadata_parts

		data_str = SubString(url, comma_index+1)
		
		data = is_base64 ? 
			Base64.base64decode(data_str) : 
			URIs.unescapeuri(data_str)
		
		write(path, data)
		path
	else
		Downloads.download(url, path)
	end
end

# ╔═╡ 6e1dd79c-a7bf-44d6-bfa6-ced75b45170a
download_cool_string(args...) = read(download_cool(args...), String)

# ╔═╡ 6339496d-11be-40d0-b4e5-9247e5199367
#=╠═╡
@test download_cool_string("data:,Hello%2C%20World%21") == "Hello, World!"
  ╠═╡ =#

# ╔═╡ bf7b4241-9cb0-4d90-9ded-b527bf220803
#=╠═╡
@test download_cool_string("data:text/plain,Hello%2C%20World%21") == "Hello, World!"
  ╠═╡ =#

# ╔═╡ d6e01532-a8e4-4173-a270-eae37c8002c7
#=╠═╡
@test download_cool_string("data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==") == "Hello, World!"
  ╠═╡ =#

# ╔═╡ b0ba1add-f452-4a44-ab23-becbc610e2b9
#=╠═╡
@test download_cool_string("data:;base64,SGVsbG8sIFdvcmxkIQ==") == "Hello, World!"
  ╠═╡ =#

# ╔═╡ e630e261-1c2d-4117-9c44-dd49199fa3de
#=╠═╡
@test download_cool_string("data:,hello") == "hello"
  ╠═╡ =#

# ╔═╡ 4bb75573-09bd-4ce7-b76f-34c0249d7b88
#=╠═╡
@test download_cool_string("data:text/html,%3Ch1%3EHello%2C%20World%21%3C%2Fh1%3E") == "<h1>Hello, World!</h1>"
  ╠═╡ =#

# ╔═╡ 301eee81-7715-4d39-89aa-37bffde3557f
#=╠═╡
@test download_cool_string("data:text/html,<script>alert('hi');</script>") == "<script>alert('hi');</script>"
  ╠═╡ =#

# ╔═╡ 525b2cb6-b7b9-436e-898e-a951e6a1f2f1
#=╠═╡
@test occursin("reactive", download_cool_string("https://raw.githubusercontent.com/fonsp/Pluto.jl/v0.17.1/README.md"))
  ╠═╡ =#

# ╔═╡ 3630b4bc-ff63-426d-b95d-ae4e4f9ccd88
download_cool_data(args...) = read(download_cool(args...))

# ╔═╡ 40b48818-e191-4509-85ad-b9ff745cd0cb
#=╠═╡
@test_throws Exception download_cool("data:xoxo;base10,asdfasdfasdf")
  ╠═╡ =#

# ╔═╡ 1f175fcd-8b94-4f13-a912-02a21c95f8ca
#=╠═╡
@test_throws Exception download_cool("data:text/plain;base10,asdfasdfasdf")
  ╠═╡ =#

# ╔═╡ a4f671e6-0e23-4753-9301-048b2ef505e3
#=╠═╡
@test_throws Exception download_cool("data:asdfasdfasdf")
  ╠═╡ =#

# ╔═╡ ae296e09-08dd-4ee8-87ac-eb2bf24b28b9
#=╠═╡
random_data_url = "data:asf;base64,$(
	Base64.base64encode(random_data)
)"
  ╠═╡ =#

# ╔═╡ 2eabfa58-2d8f-4479-9c00-a58b934638d9
#=╠═╡
@test download_cool_data(random_data_url) == random_data
  ╠═╡ =#

# ╔═╡ Cell order:
# ╟─cc180e7e-46c3-11ec-3fff-05e1b5c77986
# ╠═a85c0c0b-47d0-4377-bc22-3c87239a67b3
# ╠═6339496d-11be-40d0-b4e5-9247e5199367
# ╠═bf7b4241-9cb0-4d90-9ded-b527bf220803
# ╠═d6e01532-a8e4-4173-a270-eae37c8002c7
# ╠═b0ba1add-f452-4a44-ab23-becbc610e2b9
# ╠═e630e261-1c2d-4117-9c44-dd49199fa3de
# ╠═4bb75573-09bd-4ce7-b76f-34c0249d7b88
# ╠═301eee81-7715-4d39-89aa-37bffde3557f
# ╠═2385dd3b-15f8-4790-907f-e0576a56c4c0
# ╠═ae296e09-08dd-4ee8-87ac-eb2bf24b28b9
# ╠═2eabfa58-2d8f-4479-9c00-a58b934638d9
# ╠═525b2cb6-b7b9-436e-898e-a951e6a1f2f1
# ╠═6e1dd79c-a7bf-44d6-bfa6-ced75b45170a
# ╠═3630b4bc-ff63-426d-b95d-ae4e4f9ccd88
# ╠═40b48818-e191-4509-85ad-b9ff745cd0cb
# ╠═1f175fcd-8b94-4f13-a912-02a21c95f8ca
# ╠═a4f671e6-0e23-4753-9301-048b2ef505e3
# ╠═d8ed6d44-33cd-4c9d-828b-d237d43769f5
# ╠═b3f685a3-b52d-4190-9196-6977a7e76aa1
# ╠═b987a8a2-6ab0-4e88-af3c-d7f2778af657
