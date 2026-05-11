### A Pluto.jl notebook ###
# v0.20.25

using Markdown
using InteractiveUtils

# This Pluto notebook uses @bind for interactivity. When running this notebook outside of Pluto, the following 'mock version' of @bind gives bound variables a default value (instead of an error).
macro bind(def, element)
    #! format: off
    return quote
        local iv = try Base.loaded_modules[Base.PkgId(Base.UUID("6e696c72-6542-2067-7265-42206c756150"), "AbstractPlutoDingetjes")].Bonds.initial_value catch; b -> missing; end
        local el = $(esc(element))
        global $(esc(def)) = Core.applicable(Base.get, el) ? Base.get(el) : iv(el)
        el
    end
    #! format: on
end

# ╔═╡ f0cc4061-8e20-41a6-9c1b-bc04f075eb5e
import Pkg

# ╔═╡ dc5bf49b-694e-465d-83d0-cc237f884902
Pkg.activate()

# ╔═╡ 00145d19-9a62-4343-89c8-c623688c5af6
using PlutoUI

# ╔═╡ a2cd8e7c-a730-44a5-a111-a18376eeddad
using HypertextLiteral

# ╔═╡ 7668e4a3-9cc9-4400-b400-0ec67b6b2090
using AbstractPlutoDingetjes.Display: @embed

# ╔═╡ 585c2b10-793a-44f2-8c98-c102ec64bc9b
md"""
# Basic
"""

# ╔═╡ 99c57e5a-4f2f-4f57-bbe5-b9b435cd7619
md"""
This should say `123` in a monospace font:
"""

# ╔═╡ 538c90e0-76c9-4030-83fb-a2f76871b6e2
@embed(123)

# ╔═╡ cfa6f124-cc55-40c6-9d4f-81ac8469079d
md"""
`ed` is the same as `embed_display` but with optimizations disabled, see `ed` docs.
"""

# ╔═╡ 50f2d744-3d90-48c7-9fc5-7ddad3ae3e3f
@embed(123)

# ╔═╡ 24155278-a621-49d4-831c-e2adc78719d2
md"""
These two should look exactly the same:
"""

# ╔═╡ 640ae34f-86ec-4f21-8afb-202aa1b4c70d
begin
	demo_img_data = let
		url = "https://user-images.githubusercontent.com/6933510/116753174-fa40ab80-aa06-11eb-94d7-88f4171970b2.jpeg"
		data = read(download(url))
	end
	
	demo_img() = PlutoUI.Show(MIME"image/jpg"(), demo_img_data)
	
	demo_img()
end

# ╔═╡ 041886d2-c38f-4a9e-83da-c4dd5e0bce27
const zzez = md"""
The next array should appear

not here 👇, but here 👉 $(@embed([1,2,3])) 👈 here

And the next image should appear

not here 👇, but here 👉 $(@embed(demo_img())) 👈 here
"""

# ╔═╡ 62b8be72-3bf8-429a-ba22-52802dfe8639
@embed(@embed(demo_img()))

# ╔═╡ 986cf446-dca9-4468-ba0b-73351d02f991
md"""
These two should look exactly the same:
"""

# ╔═╡ 4f24288e-3f19-442b-a440-8427773e840d
html"<h2>Hello</h2>"

# ╔═╡ 4d17f528-1480-44c0-b492-8ea651831e57
md"""
These four should look exactly the same:
"""

# ╔═╡ 41a3fdf0-9b8b-4444-b3e3-f926f075ffba
["asdfasdf a" for x in 1:50]

# ╔═╡ 4e8fc9f8-671a-465f-ba7a-2d41b69f7c49
md"""
These four should look exactly the same:
"""

# ╔═╡ 0a94496e-23eb-4ba6-b748-f0eb28eb1534
begin
	long_array = rand(50)
end

# ╔═╡ 0dd0857a-82e5-4144-9eb8-df54470bfdcf
md"""
$(@embed(long_array))
"""

# ╔═╡ 0d1fd955-a0dc-4230-9fd8-5db13d1c6d0b


# ╔═╡ d7d87f41-5417-412f-aab8-03ad773c519d
nested(n) = x -> nested(n, x)

# ╔═╡ e511171d-76d9-4c57-b655-e727516d5ea7
edddd(x) = @embed(x)

# ╔═╡ ba397445-db5f-457b-bedb-f3dcf77e5b5f
md"""
These three should look exactly the same:
"""

# ╔═╡ 0652dfdc-cb6b-4e79-997f-6e64b8f0e7b2
Any[Any[1,2],Any[3,md"## 4"]]

# ╔═╡ 9df6da34-df5d-47ff-a799-af6ff3312b2e
to_any(x) = Any[x...]

# ╔═╡ 82013d0f-68bc-47b5-9ede-82ad99367adc
to_any(([@embed("asdfasdf a") for x in 1:50]))

# ╔═╡ 3984969b-7af9-44d9-bfe3-b620ca9f4a3d
to_any([@embed(x) for x in long_array])

# ╔═╡ f0cd5783-f5a9-4ab6-9c22-6df8d17b7c43
to_any(edddd.([[1,2],[3,md"## 4"]]))

# ╔═╡ 962ccd56-49be-4e69-9ef1-169073477819
to_any([@embed(x) for x in [[1,2],[3,md"## 4"]]])

# ╔═╡ 0e5fee32-0cfb-434f-8c6b-533150641c06
Any[
	to_any([@embed(x) for x in ([1,2])]),
	to_any([@embed(x) for x in [3,md"## 4"]])
]

# ╔═╡ 5dbecdca-f91b-48fa-ab8f-7510afd2055e
md"""
# Running scripts
"""

# ╔═╡ 39ac42fb-6221-40b1-a811-0db673329d77
md"""
Both checkboxes should each trigger exactly one alert:
"""

# ╔═╡ baf99bdf-21ac-49d9-aac0-666a3e2f2927
@bind test_script_runs_1 html"<input type=checkbox>"

# ╔═╡ ce78e7b8-6d74-43b5-8559-1688b933666d
@bind test_script_runs_2 html"<input type=checkbox>"

# ╔═╡ 1a9d606d-54fc-4948-be9e-52cbdcc79627
md"""
# More items
"""

# ╔═╡ 90f2103d-7cc1-4a82-a056-f141519239af
md"""
Expand the three arrays below and click on "More". You should:
- load more items
- remain in the expanded view after more items are loaded
"""

# ╔═╡ 28e30787-950a-4044-a16b-651e6ce5c649
@bind reset_more html"<input type=button value=Reset>"

# ╔═╡ be19ac0a-0849-4dfe-a786-cf5cf25ff385
reset_more; @embed(@embed(@embed(rand(50))))

# ╔═╡ 43d5a69b-9fdd-43cf-bfa6-0c2706c0c96a
reset_more; @embed(rand(50))

# ╔═╡ 3a8fa3d0-02f3-4f65-9634-95cb1e533e3a
md"""
# Bonds
"""

# ╔═╡ 777d670e-cdb7-48f0-ba3e-59b0044c6880
md"""
These four sliders:
- should be synchronised
- should all control `test_b`
"""

# ╔═╡ 22ab869f-8126-4f2a-a05e-12fdded20625
begin
	test_bond = @bind test_b html"<input type=range>"
end

# ╔═╡ 293579ef-421c-428e-96a7-aa66f21de87b
test_b

# ╔═╡ 6999e86a-cd68-4e97-a875-38a9c1ac8939
md"""
# Persistence
"""

# ╔═╡ e579aafa-60ce-4175-9348-02e6b5687323
md"""
## Same objects, same displays
"""

# ╔═╡ 5636ff9c-b887-4c4c-a02e-b9fe03124a29
md"""
When you move the slider:

- _(failing)_ There should be no flickering
- If the array is expanded, it remains expanded
- _(Failing, but that's fine)_ If the array is showing more items, it will keep those items
"""

# ╔═╡ 51ba2785-2931-4c82-9d1e-8ac162a765af
@bind pers_1_trigger html"<input type=range>"

# ╔═╡ 95f6e0d0-7a2f-4956-b907-9e0e358056f4
md"""
## _(Failing)_ Same objects, new displays
"""

# ╔═╡ c276ef71-913b-476c-b2ff-510b9d5b1d51
md"""
When you move the slider:

- _(Failing)_ There should be no flickering
- If the array is expanded, it remains expanded
- _(Failing, but that's fine)_ If the array is showing more items, it will keep those items
"""

# ╔═╡ 41b5dd76-0e7a-40c8-9e33-a9286739bf9a
@bind pers_2_trigger html"<input type=range>"

# ╔═╡ 7738ab88-0717-4007-830e-e2a50ff0aa1d
pers_2_items = (rand(50), demo_img());

# ╔═╡ e77670a0-0574-4bed-9a60-956f0436caa3
md"""
## _(Failing, but that's fine)_ New objects, new displays
"""

# ╔═╡ 3f684dfe-605c-4b80-a551-341eb6e816f7
md"""
When you move the slider:

- _(Failing)_ There should be no flickering
- If the array is expanded, it remains expanded
"""

# ╔═╡ 70895e40-0192-4f82-b891-5fa43c699a18
@bind pers_3_trigger html"<input type=range>"

# ╔═╡ 89f19fd0-d190-40cb-ba3e-093ec8acbc6e
pers_3_items() = (rand(50), demo_img());

# ╔═╡ a6560e5e-05bb-4966-ae00-05532ba091de
md"""
# Stuff
"""

# ╔═╡ 0fe7980e-0942-4619-aee2-db8f0f7d8f19
showhtml(r) = repr(MIME"text/html"(), r) |> Text

# ╔═╡ 23543b22-90d8-4065-ac46-af0ffe5f8c9c
"""
Force something to display as HTML, to avoid [this optimization](https://github.com/fonsp/Pluto.jl/pull/1605/files#diff-0cc97f3d6a0f647a05e5f913d416242ecb00f6e67e12004a7204b8846a3fa44cR1628-R1630).
"""
force_html(x) = @htl("$(x)")

# ╔═╡ aa560488-d50d-4b90-80f3-40e691b5a65d
@embed(html"<h2>Hello</h2>") |> force_html

# ╔═╡ ba5d08b3-7b20-4958-bf0d-838b7b400434
@embed(["asdfasdf a" for x in 1:50]) |> force_html

# ╔═╡ 5070715c-9e3d-4de3-a535-733dd8f1f2bd
to_any(([force_html(@embed("asdfasdf a")) for x in 1:50]))

# ╔═╡ 3464d183-5c85-48f4-b754-e0ef07533e70
@embed(long_array) |> force_html

# ╔═╡ d55644f6-9f3f-424a-89d4-2cf053d1988a
nested(n, x) = if n == 0
	x
else
	force_html(@embed(nested(n - 1, x)))
end

# ╔═╡ e93308d3-d1c9-4df1-b796-1bf6bc0ad0c2
nested(4, long_array)

# ╔═╡ 7921e510-f2cd-433e-8675-a1d3e698e3fe
test_script_runs_2 === true && nested(3,@htl("""
		<script id=$(rand(UInt))>alert("I should only print once")</script>
		
		$(@embed([1,2]))
		
		"""))

# ╔═╡ 1843f036-f003-4da8-8c91-4a8d25fab6ad
test_script_runs_1 === true && force_html(@embed(@htl("""
		<script id=$(rand(UInt))>alert("I should only print once")</script>
		
		$(@embed([1,2]))
		
		""")))

# ╔═╡ 413e9286-94c5-4c08-a4a4-9ed9e6f50584
force_html(@embed(test_bond))

# ╔═╡ 20584a3d-4f7a-493c-b2b9-7bba2eb646c1
@htl("""
<div style='position: fixed; top: 50px; right: 10px; z-index: 999; background: #eee;'>

<p>Enable HTML render shortcut? $(@bind enable_html_shortcut CheckBox(true))</p>
<p>Enable direct display shortcut? $(@bind enable_direct_display_shortcut CheckBox(true))</p>
<p>Skip entirely? $(@bind skip_embed CheckBox())</p>

</div>

""")

# ╔═╡ 207cddb2-bbad-4e61-b7c6-7e89032b6f7f
Main.PlutoRunner._EmbeddableDisplay_enable_html_shortcut[] = enable_html_shortcut

# ╔═╡ 410c9cae-d648-4f29-bab2-2fba57b36ebf
import Plots

# ╔═╡ b7944093-6eb1-41b3-8f6b-096bd83a9315
function ingredients(path::String)
	# this is from the Julia source code (evalfile in base/loading.jl)
	# but with the modification that it returns the module instead of the last object
	name = Symbol(basename(path))
	m = Module(name)
	Core.eval(m,
        Expr(:toplevel,
             :(eval(x) = $(Expr(:core, :eval))($name, x)),
             :(include(x) = $(Expr(:top, :include))($name, x)),
             :(include(mapexpr::Function, x) = $(Expr(:top, :include))(mapexpr, $name, x)),
             :(include($path))))
	m
end

# ╔═╡ 0d0d4096-3b07-425f-9a5f-adbd3b30877e
const Layout = ingredients(download("https://raw.githubusercontent.com/fonsp/disorganised-mess/286af0e9c435df9b80b833a7587b24c26a81c845/Layout.jl"))


# ╔═╡ abd620ef-fd30-4adb-8681-a26267d21f6b
equal_container(x) = Layout.Div(x, Dict(
			"flex" => "1 1 0px",
			"overflow-x" => "auto",
		))

# ╔═╡ 8139f5ef-1d87-406d-b26b-e0baac01d104
hbox_even(elements...) = Layout.flex(equal_container.(elements)...)

# ╔═╡ e418c6d5-0eb2-4b38-ae8d-74e115ce6fe8
reset_more; hbox_even(embed_display(rand(50)), embed_display(demo_img()))

# ╔═╡ e97c5574-e808-4e35-a1fe-ffba661132de
hbox_even(test_bond |> nested(4), test_bond |> nested(2))

# ╔═╡ 518d06da-c828-47bb-b3c2-92b36a95a52c
pers_1 = hbox_even(@embed(rand(50)), @embed(demo_img()));

# ╔═╡ ac9b8afe-8d54-41ce-8ed3-fefd6c9ba3ae
pers_1_trigger; pers_1

# ╔═╡ bc03bc0f-0d62-4661-b7d3-f7f44c364bff
pers_2() = hbox_even((@embed(x) for x in pers_2_items)...);

# ╔═╡ fb98383e-5e92-487b-964d-986f6c12b70f
pers_2_trigger; pers_2()

# ╔═╡ 17020b64-04bc-4124-aa6a-eaf4210cf6d2
pers_3() = hbox_even((@embed(x) for x in pers_3_items())...);

# ╔═╡ 1c72b7e1-5fb3-4f8b-86a4-c508348ffdf0
pers_3_trigger; pers_3()

# ╔═╡ Cell order:
# ╟─585c2b10-793a-44f2-8c98-c102ec64bc9b
# ╟─99c57e5a-4f2f-4f57-bbe5-b9b435cd7619
# ╠═538c90e0-76c9-4030-83fb-a2f76871b6e2
# ╟─cfa6f124-cc55-40c6-9d4f-81ac8469079d
# ╠═50f2d744-3d90-48c7-9fc5-7ddad3ae3e3f
# ╟─041886d2-c38f-4a9e-83da-c4dd5e0bce27
# ╟─24155278-a621-49d4-831c-e2adc78719d2
# ╟─640ae34f-86ec-4f21-8afb-202aa1b4c70d
# ╠═62b8be72-3bf8-429a-ba22-52802dfe8639
# ╟─986cf446-dca9-4468-ba0b-73351d02f991
# ╟─4f24288e-3f19-442b-a440-8427773e840d
# ╟─aa560488-d50d-4b90-80f3-40e691b5a65d
# ╟─4d17f528-1480-44c0-b492-8ea651831e57
# ╟─41a3fdf0-9b8b-4444-b3e3-f926f075ffba
# ╟─ba5d08b3-7b20-4958-bf0d-838b7b400434
# ╟─82013d0f-68bc-47b5-9ede-82ad99367adc
# ╟─5070715c-9e3d-4de3-a535-733dd8f1f2bd
# ╟─4e8fc9f8-671a-465f-ba7a-2d41b69f7c49
# ╟─0a94496e-23eb-4ba6-b748-f0eb28eb1534
# ╟─3464d183-5c85-48f4-b754-e0ef07533e70
# ╟─3984969b-7af9-44d9-bfe3-b620ca9f4a3d
# ╟─e93308d3-d1c9-4df1-b796-1bf6bc0ad0c2
# ╟─0dd0857a-82e5-4144-9eb8-df54470bfdcf
# ╟─0d1fd955-a0dc-4230-9fd8-5db13d1c6d0b
# ╟─d55644f6-9f3f-424a-89d4-2cf053d1988a
# ╟─d7d87f41-5417-412f-aab8-03ad773c519d
# ╠═e511171d-76d9-4c57-b655-e727516d5ea7
# ╟─ba397445-db5f-457b-bedb-f3dcf77e5b5f
# ╟─0652dfdc-cb6b-4e79-997f-6e64b8f0e7b2
# ╟─f0cd5783-f5a9-4ab6-9c22-6df8d17b7c43
# ╟─962ccd56-49be-4e69-9ef1-169073477819
# ╟─0e5fee32-0cfb-434f-8c6b-533150641c06
# ╟─9df6da34-df5d-47ff-a799-af6ff3312b2e
# ╟─5dbecdca-f91b-48fa-ab8f-7510afd2055e
# ╟─39ac42fb-6221-40b1-a811-0db673329d77
# ╟─baf99bdf-21ac-49d9-aac0-666a3e2f2927
# ╟─1843f036-f003-4da8-8c91-4a8d25fab6ad
# ╟─ce78e7b8-6d74-43b5-8559-1688b933666d
# ╟─7921e510-f2cd-433e-8675-a1d3e698e3fe
# ╟─1a9d606d-54fc-4948-be9e-52cbdcc79627
# ╟─90f2103d-7cc1-4a82-a056-f141519239af
# ╟─be19ac0a-0849-4dfe-a786-cf5cf25ff385
# ╟─43d5a69b-9fdd-43cf-bfa6-0c2706c0c96a
# ╟─e418c6d5-0eb2-4b38-ae8d-74e115ce6fe8
# ╟─28e30787-950a-4044-a16b-651e6ce5c649
# ╟─3a8fa3d0-02f3-4f65-9634-95cb1e533e3a
# ╟─777d670e-cdb7-48f0-ba3e-59b0044c6880
# ╠═293579ef-421c-428e-96a7-aa66f21de87b
# ╟─22ab869f-8126-4f2a-a05e-12fdded20625
# ╟─413e9286-94c5-4c08-a4a4-9ed9e6f50584
# ╟─e97c5574-e808-4e35-a1fe-ffba661132de
# ╟─6999e86a-cd68-4e97-a875-38a9c1ac8939
# ╟─e579aafa-60ce-4175-9348-02e6b5687323
# ╟─5636ff9c-b887-4c4c-a02e-b9fe03124a29
# ╟─51ba2785-2931-4c82-9d1e-8ac162a765af
# ╠═ac9b8afe-8d54-41ce-8ed3-fefd6c9ba3ae
# ╠═518d06da-c828-47bb-b3c2-92b36a95a52c
# ╟─95f6e0d0-7a2f-4956-b907-9e0e358056f4
# ╠═c276ef71-913b-476c-b2ff-510b9d5b1d51
# ╟─41b5dd76-0e7a-40c8-9e33-a9286739bf9a
# ╟─fb98383e-5e92-487b-964d-986f6c12b70f
# ╠═bc03bc0f-0d62-4661-b7d3-f7f44c364bff
# ╠═7738ab88-0717-4007-830e-e2a50ff0aa1d
# ╟─e77670a0-0574-4bed-9a60-956f0436caa3
# ╠═3f684dfe-605c-4b80-a551-341eb6e816f7
# ╟─70895e40-0192-4f82-b891-5fa43c699a18
# ╟─1c72b7e1-5fb3-4f8b-86a4-c508348ffdf0
# ╠═17020b64-04bc-4124-aa6a-eaf4210cf6d2
# ╠═89f19fd0-d190-40cb-ba3e-093ec8acbc6e
# ╟─a6560e5e-05bb-4966-ae00-05532ba091de
# ╠═0fe7980e-0942-4619-aee2-db8f0f7d8f19
# ╠═23543b22-90d8-4065-ac46-af0ffe5f8c9c
# ╠═00145d19-9a62-4343-89c8-c623688c5af6
# ╠═a2cd8e7c-a730-44a5-a111-a18376eeddad
# ╠═abd620ef-fd30-4adb-8681-a26267d21f6b
# ╠═8139f5ef-1d87-406d-b26b-e0baac01d104
# ╠═20584a3d-4f7a-493c-b2b9-7bba2eb646c1
# ╠═207cddb2-bbad-4e61-b7c6-7e89032b6f7f
# ╠═f0cc4061-8e20-41a6-9c1b-bc04f075eb5e
# ╠═dc5bf49b-694e-465d-83d0-cc237f884902
# ╠═7668e4a3-9cc9-4400-b400-0ec67b6b2090
# ╠═410c9cae-d648-4f29-bab2-2fba57b36ebf
# ╠═0d0d4096-3b07-425f-9a5f-adbd3b30877e
# ╟─b7944093-6eb1-41b3-8f6b-096bd83a9315
