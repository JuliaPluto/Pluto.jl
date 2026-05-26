### A Pluto.jl notebook ###
# v0.20.28

using Markdown
using InteractiveUtils

# ╔═╡ 2d69377e-23f8-11ee-116b-fb6a8f328528
begin
	using Pkg
	Pkg.activate(temp=true)
	# the latest versions of these packages:
	Pkg.add(url="https://github.com/JuliaPluto/AbstractPlutoDingetjes.jl", rev="main")
	Pkg.add("HypertextLiteral")
end

# ╔═╡ 2ea26a4b-2d1e-4bcb-8b7b-cace79f7926a
begin
	using AbstractPlutoDingetjes.Display: published_to_js, @embed
	using AbstractPlutoDingetjes.Display
	using HypertextLiteral
end

# ╔═╡ 646f61b2-f199-4aae-bda9-ed6d87dd09a1


# ╔═╡ 043829fc-af3a-40b9-bb4f-f848ab50eb25
a = [1,2,3];

# ╔═╡ 2f4609fd-7361-4048-985a-2cc74bb25606
@htl """
<script>
const a = JSON.stringify($(published_to_js(a))) + " MAGIC!"
return html`<div id='to_cell_output'>\${a}</div>`
</script>
"""

# ╔═╡ 28eba9fd-0416-49b8-966e-03a381c19ca7
b = [4,5,6];

# ╔═╡ 0a4e8a19-6d43-4161-bb8c-1ebf8f8f68ba
@info @htl """
<script>
const a = JSON.stringify($(published_to_js(b))) + " MAGIC!"
return html`<div id='to_cell_log'>\${a}</div>`
</script>
"""

# ╔═╡ 83162255-9579-46c3-9fb7-f6e2cfc1b4bf
@htl """
<div>
<p>Hello</p>
<p id='array_embedded_here'>$(@embed([8,999,10]))</p>
</div>
"""


# ╔═╡ 274a553e-23d6-4c46-859d-999ea9e60e80
@htl """
<div>
<p id='html_embedded_here'>Hello $(@embed(@htl("<span>Yay</span>")))</p>
</div>
"""

# ╔═╡ 564ac630-e026-414f-aa63-52bda74769f0
Display.ReactDOMElement(tag="div", children=[
	@htl("one"),
	@htl("two"),
	[33,44],
	Display.ReactDOMElement(tag="marquee", children=[
		@htl("cool"),
		@htl("beanz"),
	])
])

# ╔═╡ 234a33af-29bf-4e6f-9014-f7d099c23a47


# ╔═╡ 956d7125-54f9-4bc6-98c2-87839507c292


# ╔═╡ Cell order:
# ╠═2d69377e-23f8-11ee-116b-fb6a8f328528
# ╠═2ea26a4b-2d1e-4bcb-8b7b-cace79f7926a
# ╠═646f61b2-f199-4aae-bda9-ed6d87dd09a1
# ╠═043829fc-af3a-40b9-bb4f-f848ab50eb25
# ╠═2f4609fd-7361-4048-985a-2cc74bb25606
# ╠═28eba9fd-0416-49b8-966e-03a381c19ca7
# ╠═0a4e8a19-6d43-4161-bb8c-1ebf8f8f68ba
# ╠═83162255-9579-46c3-9fb7-f6e2cfc1b4bf
# ╠═274a553e-23d6-4c46-859d-999ea9e60e80
# ╠═564ac630-e026-414f-aa63-52bda74769f0
# ╠═234a33af-29bf-4e6f-9014-f7d099c23a47
# ╠═956d7125-54f9-4bc6-98c2-87839507c292
