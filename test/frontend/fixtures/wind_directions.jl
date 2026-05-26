### A Pluto.jl notebook ###
# v0.20.28

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

# ╔═╡ 2e54b8fc-7852-11ec-27d7-df0bfe7f344a
using PlutoUI

# ╔═╡ 257ee9b0-d955-43d2-9c94-245716708a2d
using HypertextLiteral

# ╔═╡ 82c316c7-a279-4728-b16a-921d7fc52886


# ╔═╡ 0b19e53d-eb7a-42b6-a7db-d95bc8c63eae
import MarkdownLiteral: @mdx

# ╔═╡ 0c0bab41-a020-41a0-83ad-0c57b4699ffa
const Layout = PlutoUI.ExperimentalLayout

# ╔═╡ c097b477-e154-47eb-b7d9-a4d2981dcf0e
padded(x) = Layout.Div([x]; style=Dict("padding" => "0em 1em"))

# ╔═╡ 9f601f94-e85e-4a66-92d5-2ea57164c463
import AbstractPlutoDingetjes.Display: @embed

# ╔═╡ ddccf592-0d0f-475c-81ae-067c37ba3f7e
const all_directions = ["North", "East", "South", "West"]

# ╔═╡ d441b495-a00c-4de3-a232-7c75f55fc95b
function Carousel2(
		elementsList;
		wraparound::Bool=false,
		peek::Bool=true,
	)
	
	@assert peek
	
    carouselHTML = map(elementsList) do element
		Layout.Div([element]; class="carousel-slide")
    end

	h = Layout.Div([
		@htl("""
		<style>
	    .carousel-box{
	        width: 100%;
	        overflow: hidden;
	    }
	    .carousel-container{
	        top: 0;
	        left: 0;
	        display: flex;
	        width: 100%;
	        flex-flow: row nowrap;
	        transform: translate(10%, 0px);
	        transition: transform 200ms ease-in-out;
	    }
	    .carousel-controls{
	        display: flex;
	        justify-content: center;
	        align-items: center;
	    }
	    .carousel-controls button{
	        margin: 8px;
	        width: 6em;
	    }
	    .carousel-slide {
	        min-width: 80%;
			overflow-x: auto;
	    }
	    </style>
		"""),
		
		Layout.Div([
			Layout.Div(carouselHTML; class="carousel-container")
		]; class="carousel-box"),
		@htl("""
		<div class="carousel-controls">
	        <button data-value="-1">Previous</button>
	        <button data-value="1">Next</button>
	    </div>
		"""),
		@htl("""
		<script>
		// Here is a little trick!
		// We include the number of elements inside the code, which will make this script re-run whenever it changes. Pluto only re-renders HTML when it changed.
		const max = $(length(elementsList))

        let div = currentScript.closest(".carousel-wrapper")
		let bound_element = div.parentElement.tagName === "PLUTO-DISPLAY" ? div.parentElement : div
		bound_element.value = 1
		let count = 0

		let buttons = div.querySelectorAll("button")

		const update_ui = () => {
			buttons[0].disabled = !$(wraparound) && count === 0
			buttons[1].disabled = !$(wraparound) && count === max - 1
		
			div.querySelector(".carousel-container").style = `transform: translate(\${10-count*80}%, 0px)`;
		}

		Object.defineProperty(bound_element, "value", {
			get: () => count + 1,
			set: (new_value) => {
				count = new_value - 1
				update_ui()
			}
		})


		const mod = (n, m) => ((n % m) + m) % m
		const clamp = (x, a, b) => Math.max(Math.min(x, b), a)
		
		const onclick = (e) => {
			const new_count = count + parseInt(e.target.dataset.value)
			if($(wraparound)){
				count = mod(new_count, max)
			} else {
				count = clamp(new_count, 0, max - 1)
			}
			
            
			bound_element.dispatchEvent(new CustomEvent("input"))
			update_ui()
            e.preventDefault()
        }

		// This code is in a requestIdleCallback because we need the buttons to be rendered before we can select them.
		requestIdleCallback(() => {
        	buttons = div.querySelectorAll("button")
	        buttons.forEach(button => button.addEventListener("click", onclick))
			update_ui()
		})
		
	    </script>
		"""),
	]; class="carousel-wrapper")
	
	# BondDefault(h,1)
	h
end

# ╔═╡ fa0b6647-6911-4c27-a1a6-240d215331d1
function Carousel(
		elementsList;
		wraparound::Bool=false,
		peek::Bool=true,
	)
	
	@assert peek
	
    carouselHTML = map(elementsList) do element
        @htl("""<div class="carousel-slide">
            $(element)
        </div>""")
    end
	
    h = @htl("""
<div>
    <style>
    .carousel-box{
        width: 100%;
        overflow: hidden;
    }
    .carousel-container{
        top: 0;
        left: 0;
        display: flex;
        width: 100%;
        flex-flow: row nowrap;
        transform: translate(10%, 0px);
        transition: transform 200ms ease-in-out;
    }
    .carousel-controls{
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .carousel-controls button{
        margin: 8px;
        width: 6em;
    }
    .carousel-slide {
        min-width: 80%;
    }
    </style>
		
    <script>
        const div = currentScript.parentElement
        const buttons = div.querySelectorAll("button")
		
		const max = $(length(elementsList))

		let count = 0
		
		const mod = (n, m) => ((n % m) + m) % m
		const clamp = (x, a, b) => Math.max(Math.min(x, b), a)
		
		const update_ui = (count) => {
			buttons[0].disabled = !$(wraparound) && count === 0
			buttons[1].disabled = !$(wraparound) && count === max - 1
		
			div.querySelector(".carousel-container").style = `transform: translate(\${10-count*80}%, 0px)`;
		}
		
		const onclick = (e) => {
			const new_count = count + parseInt(e.target.dataset.value)
			if($(wraparound)){
				count = mod(new_count, max)
			} else {
				count = clamp(new_count, 0, max - 1)
			}
			
            
			div.value = count + 1
			div.dispatchEvent(new CustomEvent("input"))
			update_ui(div.value - 1)
            e.preventDefault()
        }
        buttons.forEach(button => button.addEventListener("click", onclick))
        div.value = count + 1
		update_ui(div.value - 1)
    </script>
		
    <div class="carousel-box">
        <div class="carousel-container">
            $(carouselHTML)
        </div>
    </div>
		
    <div class="carousel-controls">
        <button data-value="-1">Previous</button>
        <button data-value="1">Next</button>
    </div>
</div>
    """)
	
	# BondDefault(h,1)
	h
end

# ╔═╡ 6c84a84f-9ead-4091-819e-0de088e2dd4d
function wind_speeds(directions)
	PlutoUI.combine() do Child
		@htl("""
		<h6>Wind speeds</h6>
		<ul>
		$([
			@htl("<li>$(name): $(Child(name, Slider(1:100)))</li>")
			for name in directions
		])
		</ul>
		""")
	end
end


# ╔═╡ e866282e-7c63-4364-b344-46f4c6ad165c
dogscats() = PlutoUI.combine() do Child
	md"""
	# Hi there!

	I have $(
		Child(Slider(1:10))
	) dogs and $(
		Child(Slider(5:100))
	) cats.

	Would you like to see them? $(Child(CheckBox(true)))
	"""
end

# ╔═╡ cd3b9ad1-8efc-4f92-96d0-b9b038d8cfae
md"""
## MultiCheckBox copy

This is a version of MultiCheckBox from PlutoUI that did not support synchronizing multiple bonds, i.e. it doesn't have `Object.defineProperty(wrapper, "input", {get, set})`.

This means that this won't work be synced:

```julia
bond = @bind value MultiCheckbox([1,2])
```

```julia
bond
```

We need this for the test to be extra sensitive.
"""

# ╔═╡ 79b6ac0f-4d0b-485f-8fb0-9849932dc34e
import AbstractPlutoDingetjes.Bonds

# ╔═╡ eaad4fed-ea22-4132-a84a-429f486ddce2
subarrays(x) = (
	x[collect(I)]
	for I in Iterators.product(Iterators.repeated([true,false],length(x))...) |> collect |> vec
)

# ╔═╡ 146474b5-9aa6-4000-867d-ba91e4061d9b
begin
    local result = begin
    """
    ```julia
    MultiCheckBox(options::Vector; [default::Vector], [orientation ∈ [:row, :column]], [select_all::Bool])
    ```
    
    A group of checkboxes - the user can choose which of the `options` to return.
    The value returned via `@bind` is a list containing the currently checked items.

    See also: [`MultiSelect`](@ref).

    `options` can also be an array of pairs `key::Any => value::String`. The `key` is returned via `@bind`; the `value` is shown.

    # Keyword arguments
    - `defaults` specifies which options should be checked initally.
    - `orientation` specifies whether the options should be arranged in `:row`'s `:column`'s.
    - `select_all` specifies whether or not to include a "Select All" checkbox.

    # Examples
    ```julia
    @bind snacks MultiCheckBox(["🥕", "🐟", "🍌"]))
    
    if "🥕" ∈ snacks
        "Yum yum!"
    end
    ```
    
    ```julia
    @bind functions MultiCheckBox([sin, cos, tan])
    
    [f(0.5) for f in functions]
    ```

    ```julia
    @bind snacks MultiCheckBox(["🥕" => "🐰", "🐟" => "🐱", "🍌" => "🐵"]; default=["🥕", "🍌"])
    ```

    ```julia
    @bind animals MultiCheckBox(["🐰", "🐱" , "🐵", "🐘", "🦝", "🐿️" , "🐝",  "🐪"]; orientation=:column, select_all=true)
    ```
    """
    struct MultiCheckBox{BT,DT}
        options::AbstractVector{Pair{BT,DT}}
        default::Union{Missing,AbstractVector{BT}}
        orientation::Symbol
        select_all::Bool
    end
    end

    MultiCheckBox(options::AbstractVector{<:Pair{BT,DT}}; default=missing, orientation=:row, select_all=false) where {BT,DT} = MultiCheckBox(options, default, orientation, select_all)
        
    MultiCheckBox(options::AbstractVector{BT}; default=missing, orientation=:row, select_all=false) where BT = MultiCheckBox{BT,BT}(Pair{BT,BT}[o => o for o in options], default, orientation, select_all)

    function Base.show(io::IO, m::MIME"text/html", mc::MultiCheckBox)
        @assert mc.orientation == :column || mc.orientation == :row "Invalid orientation $(mc.orientation). Orientation should be :row or :column"

        defaults = coalesce(mc.default, [])

		# Old:
		# checked = [k in defaults for (k,v) in mc.options]
		# 
		# More complicated to fix https://github.com/JuliaPluto/PlutoUI.jl/issues/106
		defaults_copy = copy(defaults)
		checked = [
			let
				i = findfirst(isequal(k), defaults_copy)
				if i === nothing
					false
				else
					deleteat!(defaults_copy, i)
					true
				end
			end
		for (k,v) in mc.options]
		
        show(io, m, @htl("""
        <plj-multi-checkbox style="flex-direction: $(mc.orientation);"></plj-multi-checkbox>
        <script type="text/javascript">
		const labels = $([string(v) for (k,v) in mc.options]);
		const values = $(1:length(mc.options));
		const checked = $(checked);
		const includeSelectAll = $(mc.select_all);

		const container = (currentScript ? currentScript : this.currentScript).previousElementSibling
		
		const my_id = crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
		
		// Add checkboxes
		const inputEls = []
		for (let i = 0; i < labels.length; i++) {
			const boxId = `\${my_id}-box-\${i}`
		
			const item = document.createElement('div')
		
			const checkbox = document.createElement('input')
			checkbox.type = 'checkbox'
			checkbox.id = boxId
			checkbox.name = labels[i]
			checkbox.value = values[i]
			checkbox.checked = checked[i]
			inputEls.push(checkbox)
			item.appendChild(checkbox)
		
			const label = document.createElement('label')
			label.htmlFor = boxId
			label.innerText = labels[i]
			item.appendChild(label)
		
			container.appendChild(item)
		}
		
		function setValue() {
			container.value = inputEls.filter((o) => o.checked).map((o) => o.value)
		}
		// Add listeners
		function sendEvent() {
			setValue()
			container.dispatchEvent(new CustomEvent('input'))
		}
		
		function updateSelectAll() {}
		
		if (includeSelectAll) {
			// Add select-all checkbox.
			const selectAllItem = document.createElement('div')
			selectAllItem.classList.add(`select-all`)
		
			const selectID = `\${my_id}-select-all`
		
			const selectAllInput = document.createElement('input')
			selectAllInput.type = 'checkbox'
			selectAllInput.id = selectID
			selectAllItem.appendChild(selectAllInput)
		
			const selectAllLabel = document.createElement('label')
			selectAllLabel.htmlFor = selectID
			selectAllLabel.innerText = 'Select All'
			selectAllItem.appendChild(selectAllLabel)
		
			container.prepend(selectAllItem)
		
			function onSelectAllClick(event) {
				event.stopPropagation()
				inputEls.forEach((o) => (o.checked = this.checked))
				sendEvent()
			}
			selectAllInput.addEventListener('click', onSelectAllClick)
            selectAllInput.addEventListener('input', e => e.stopPropagation())
		
			/// Taken from: https://stackoverflow.com/questions/10099158/how-to-deal-with-browser-differences-with-indeterminate-checkbox
			/// Determine the checked state to give to a checkbox
			/// with indeterminate state, so that it becomes checked
			/// on click on IE, Chrome and Firefox 5+
			function getCheckedStateForIndeterminate() {
				// Create a unchecked checkbox with indeterminate state
				const test = document.createElement('input')
				test.type = 'checkbox'
				test.checked = false
				test.indeterminate = true
		
				// Try to click the checkbox
				const body = document.body
				body.appendChild(test) // Required to work on FF
				test.click()
				body.removeChild(test) // Required to work on FF
		
				// Check if the checkbox is now checked and cache the result
				if (test.checked) {
					getCheckedStateForIndeterminate = function () {
						return false
					}
					return false
				} else {
					getCheckedStateForIndeterminate = function () {
						return true
					}
					return true
				}
			}
		
			updateSelectAll = function () {
				const checked = inputEls.map((o) => o.checked)
				if (checked.every((x) => x)) {
					selectAllInput.checked = true
					selectAllInput.indeterminate = false
				} else if (checked.some((x) => x)) {
					selectAllInput.checked = getCheckedStateForIndeterminate()
					selectAllInput.indeterminate = true
				} else {
					selectAllInput.checked = false
					selectAllInput.indeterminate = false
				}
			}
			// Call once at the beginning to initialize.
			updateSelectAll()
		}
		
		function onItemClick(event) {
			event.stopPropagation()
			updateSelectAll()
			sendEvent()
		}
		setValue()
		inputEls.forEach((el) => el.addEventListener('click', onItemClick))
		inputEls.forEach((el) => el.addEventListener('input', e => e.stopPropagation()))
		
        </script>
        <style type="text/css">
		plj-multi-checkbox {
			display: flex;
			flex-wrap: wrap;
			/* max-height: 8em; */
		}
		
		plj-multi-checkbox * {
			display: flex;
		}
		
		plj-multi-checkbox > div {
			margin: 0.1em 0.3em;
			align-items: center;
		}
		
		plj-multi-checkbox label,
		plj-multi-checkbox input {
			cursor: pointer;
		}
		
		plj-multi-checkbox .select-all {
			font-style: italic;
			color: hsl(0, 0%, 25%, 0.7);
		}
		</style>
        """))
    end

    Base.get(select::MultiCheckBox) = Bonds.initial_value(select)
    Bonds.initial_value(select::MultiCheckBox{BT,DT}) where {BT,DT} = 
        ismissing(select.default) ? BT[] : select.default
    Bonds.possible_values(select::MultiCheckBox) = 
        subarrays(map(string, 1:length(select.options)))
    
    function Bonds.transform_value(select::MultiCheckBox{BT,DT}, val_from_js) where {BT,DT}
        # val_from_js will be a vector of Strings, but let's allow Integers as well, there's no harm in that
        @assert val_from_js isa Vector
        
        val_nums = (
            v isa Integer ? v : tryparse(Int64, v)
            for v in val_from_js
        )
        
        BT[select.options[v].first for v in val_nums]
    end
    
    function Bonds.validate_value(select::MultiCheckBox, val)
        val isa Vector && all(val_from_js) do v
            val_num = v isa Integer ? v : tryparse(Int64, v)
            1 ≤ val_num ≤ length(select.options)
        end
    end
    result
end

# ╔═╡ 67e2cb97-e224-47ca-96ba-2e89d94959e7
ppp = @bind opop Slider(1:10);

# ╔═╡ b1c0d12c-f383-44fb-bcfe-4157a2801b9a
Layout.Div([
	ppp,
	@htl("""$(opop)""")
])

# ╔═╡ a060f034-b540-4b1e-a87f-7e6185e15646
directions_bond = @bind chosen_directions MultiCheckBox(all_directions);

# ╔═╡ 466bf852-144c-47df-98e1-89935754f5f1
chosen_directions_copy = chosen_directions

# ╔═╡ 6e26a930-1b49-4ff5-8704-9149d3cab7e9
speeds_bond = @bind speeds wind_speeds(chosen_directions);

# ╔═╡ ede20024-1aea-4d80-a19a-8a5ec88a00ac
data = map(speeds) do s
	rand(50) .+ s
end

# ╔═╡ acb08d1f-30f9-4e01-8216-3440c82714c7
pairs(speeds) |> collect

# ╔═╡ fffd6402-d508-48a6-abc6-3de333497787
big_input = Carousel2([
	md"""
	## Step 1: *directions*
	$(directions_bond)
	""" |> identity,
	
	md"""
	## Step 2: *speeds*
	$(speeds_bond)
	""" |> identity,

	md"""
	## Step 3: 🎉
	$(@embed(
		data
	))
	""" |> identity,
	
	# md"""
	# ## Step 4: 📉
	# $(@embed(
	# 	let
	# 		p = plot()
			
	# 		for (n,v) in pairs(data)
	# 			plot!(p, v; label=string(n))
	# 		end
	# 		p
	# 	end
	# ))
	# """ |> padded,
])

# ╔═╡ 0cb7b599-cec5-4391-9485-4e1c63cd9ff2
speeds_copy = speeds

# ╔═╡ ab108b97-4dd5-49e4-845c-2f0fab131f8a
Layout.vbox([
	directions_bond,
	speeds_bond,
	speeds
])

# ╔═╡ 596dbead-63ce-432a-8a0b-b3ea361e279e
xoxob = @bind xoxo Carousel2([md"# a",md"# b",3,rand(4)])

# ╔═╡ 8c96934c-3e23-45ed-b945-dce344bfb6eb
xoxob_again = xoxob

# ╔═╡ af1ad32b-af53-4865-9807-ba8d0fba2a8c
xoxo

# ╔═╡ 00000000-0000-0000-0000-000000000001
PLUTO_PROJECT_TOML_CONTENTS = """
[deps]
AbstractPlutoDingetjes = "6e696c72-6542-2067-7265-42206c756150"
HypertextLiteral = "ac1192a8-f4b3-4bfe-ba22-af5b92cd3ab2"
MarkdownLiteral = "736d6165-7244-6769-4267-6b50796e6954"
PlutoUI = "7f904dfe-b85e-4ff6-b463-dae2292396a8"

[compat]
AbstractPlutoDingetjes = "~1.4.0"
HypertextLiteral = "~1.0.0"
MarkdownLiteral = "~0.1.5"
PlutoUI = "~0.7.82"
"""

# ╔═╡ 00000000-0000-0000-0000-000000000002
PLUTO_MANIFEST_TOML_CONTENTS = """
# This file is machine-generated - editing it directly is not advised

julia_version = "1.12.5"
manifest_format = "2.0"
project_hash = "b2853370bd52396971f5ee247959809383595c1b"

[[deps.AbstractPlutoDingetjes]]
git-tree-sha1 = "6c3913f4e9bdf6ba3c08041a446fb1332716cbc2"
uuid = "6e696c72-6542-2067-7265-42206c756150"
version = "1.4.0"

[[deps.ArgTools]]
uuid = "0dad84c5-d112-42e6-8d28-ef12dabb789f"
version = "1.1.2"

[[deps.Artifacts]]
uuid = "56f22d72-fd6d-98f1-02f0-08ddc0907c33"
version = "1.11.0"

[[deps.Base64]]
uuid = "2a0f44e3-6c83-55bd-87e4-b1978d98bd5f"
version = "1.11.0"

[[deps.ColorTypes]]
deps = ["FixedPointNumbers", "Random"]
git-tree-sha1 = "67e11ee83a43eb71ddc950302c53bf33f0690dfe"
uuid = "3da002f7-5984-5a60-b8a6-cbb66c0b333f"
version = "0.12.1"
weakdeps = ["StyledStrings"]

    [deps.ColorTypes.extensions]
    StyledStringsExt = "StyledStrings"

[[deps.CommonMark]]
deps = ["PrecompileTools"]
git-tree-sha1 = "019ad9e55bb3549403f2d5a9b314fbb29a806ecb"
uuid = "a80b9123-70ca-4bc0-993e-6e3bcb318db6"
version = "1.0.1"

    [deps.CommonMark.extensions]
    CommonMarkMarkdownASTExt = "MarkdownAST"
    CommonMarkMarkdownExt = "Markdown"

    [deps.CommonMark.weakdeps]
    Markdown = "d6f4376e-aef5-505a-96c1-9c027394607a"
    MarkdownAST = "d0879d2d-cac2-40c8-9cee-1863dc0c7391"

[[deps.CompilerSupportLibraries_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "e66e0078-7015-5450-92f7-15fbd957f2ae"
version = "1.3.0+1"

[[deps.Dates]]
deps = ["Printf"]
uuid = "ade2ca70-3891-5945-98fb-dc099432e06a"
version = "1.11.0"

[[deps.Downloads]]
deps = ["ArgTools", "FileWatching", "LibCURL", "NetworkOptions"]
uuid = "f43a241f-c20a-4ad4-852c-f6b1247861c6"
version = "1.7.0"

[[deps.FileWatching]]
uuid = "7b1f6079-737a-58dc-b8bc-7a2ca5c1b5ee"
version = "1.11.0"

[[deps.FixedPointNumbers]]
deps = ["Statistics"]
git-tree-sha1 = "05882d6995ae5c12bb5f36dd2ed3f61c98cbb172"
uuid = "53c48c17-4a7d-5ca2-90c5-79b7896eea93"
version = "0.8.5"

[[deps.Hyperscript]]
deps = ["Test"]
git-tree-sha1 = "179267cfa5e712760cd43dcae385d7ea90cc25a4"
uuid = "47d2ed2b-36de-50cf-bf87-49c2cf4b8b91"
version = "0.0.5"

[[deps.HypertextLiteral]]
deps = ["Tricks"]
git-tree-sha1 = "d1a86724f81bcd184a38fd284ce183ec067d71a0"
uuid = "ac1192a8-f4b3-4bfe-ba22-af5b92cd3ab2"
version = "1.0.0"

[[deps.IOCapture]]
deps = ["Logging", "Random"]
git-tree-sha1 = "0ee181ec08df7d7c911901ea38baf16f755114dc"
uuid = "b5f81e59-6552-4d32-b1f0-c071b021bf89"
version = "1.0.0"

[[deps.InteractiveUtils]]
deps = ["Markdown"]
uuid = "b77e0a4c-d291-57a0-90e8-8db25a27a240"
version = "1.11.0"

[[deps.JuliaSyntaxHighlighting]]
deps = ["StyledStrings"]
uuid = "ac6e5ff7-fb65-4e79-a425-ec3bc9c03011"
version = "1.12.0"

[[deps.LibCURL]]
deps = ["LibCURL_jll", "MozillaCACerts_jll"]
uuid = "b27032c2-a3e7-50c8-80cd-2d36dbcbfd21"
version = "0.6.4"

[[deps.LibCURL_jll]]
deps = ["Artifacts", "LibSSH2_jll", "Libdl", "OpenSSL_jll", "Zlib_jll", "nghttp2_jll"]
uuid = "deac9b47-8bc7-5906-a0fe-35ac56dc84c0"
version = "8.15.0+0"

[[deps.LibSSH2_jll]]
deps = ["Artifacts", "Libdl", "OpenSSL_jll"]
uuid = "29816b5a-b9ab-546f-933c-edad1886dfa8"
version = "1.11.3+1"

[[deps.Libdl]]
uuid = "8f399da3-3557-5675-b5ff-fb832c97cbdb"
version = "1.11.0"

[[deps.LinearAlgebra]]
deps = ["Libdl", "OpenBLAS_jll", "libblastrampoline_jll"]
uuid = "37e2e46d-f89d-539d-b4ee-838fcccc9c8e"
version = "1.12.0"

[[deps.Logging]]
uuid = "56ddb016-857b-54e1-b83d-db4d58db5568"
version = "1.11.0"

[[deps.MIMEs]]
git-tree-sha1 = "c64d943587f7187e751162b3b84445bbbd79f691"
uuid = "6c6e2e6c-3030-632d-7369-2d6c69616d65"
version = "1.1.0"

[[deps.Markdown]]
deps = ["Base64", "JuliaSyntaxHighlighting", "StyledStrings"]
uuid = "d6f4376e-aef5-505a-96c1-9c027394607a"
version = "1.11.0"

[[deps.MarkdownLiteral]]
deps = ["CommonMark", "HypertextLiteral"]
git-tree-sha1 = "e88f9af659a0cc9326fa464427f71ae6c9a83381"
uuid = "736d6165-7244-6769-4267-6b50796e6954"
version = "0.1.5"

[[deps.MozillaCACerts_jll]]
uuid = "14a3606d-f60d-562e-9121-12d972cd8159"
version = "2025.11.4"

[[deps.NetworkOptions]]
uuid = "ca575930-c2e3-43a9-ace4-1e988b2c1908"
version = "1.3.0"

[[deps.OpenBLAS_jll]]
deps = ["Artifacts", "CompilerSupportLibraries_jll", "Libdl"]
uuid = "4536629a-c528-5b80-bd46-f80d51c5b363"
version = "0.3.29+0"

[[deps.OpenSSL_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "458c3c95-2e84-50aa-8efc-19380b2a3a95"
version = "3.5.4+0"

[[deps.PlutoUI]]
deps = ["AbstractPlutoDingetjes", "Base64", "ColorTypes", "Dates", "Downloads", "FixedPointNumbers", "Hyperscript", "HypertextLiteral", "IOCapture", "InteractiveUtils", "Logging", "MIMEs", "Markdown", "Random", "Reexport", "URIs", "UUIDs"]
git-tree-sha1 = "0ecd70a51c13e150266e76a865f10a64a7f178a3"
uuid = "7f904dfe-b85e-4ff6-b463-dae2292396a8"
version = "0.7.82"

[[deps.PrecompileTools]]
deps = ["Preferences"]
git-tree-sha1 = "edbeefc7a4889f528644251bdb5fc9ab5348bc2c"
uuid = "aea7be01-6a6a-4083-8856-8a6e6704d82a"
version = "1.3.4"

[[deps.Preferences]]
deps = ["TOML"]
git-tree-sha1 = "8b770b60760d4451834fe79dd483e318eee709c4"
uuid = "21216c6a-2e73-6563-6e65-726566657250"
version = "1.5.2"

[[deps.Printf]]
deps = ["Unicode"]
uuid = "de0858da-6303-5e67-8744-51eddeeeb8d7"
version = "1.11.0"

[[deps.Random]]
deps = ["SHA"]
uuid = "9a3f8284-a2c9-5f02-9a11-845980a1fd5c"
version = "1.11.0"

[[deps.Reexport]]
git-tree-sha1 = "45e428421666073eab6f2da5c9d310d99bb12f9b"
uuid = "189a3867-3050-52da-a836-e630ba90ab69"
version = "1.2.2"

[[deps.SHA]]
uuid = "ea8e919c-243c-51af-8825-aaa63cd721ce"
version = "0.7.0"

[[deps.Serialization]]
uuid = "9e88b42a-f829-5b0c-bbe9-9e923198166b"
version = "1.11.0"

[[deps.Statistics]]
deps = ["LinearAlgebra"]
git-tree-sha1 = "ae3bb1eb3bba077cd276bc5cfc337cc65c3075c0"
uuid = "10745b16-79ce-11e8-11f9-7d13ad32a3b2"
version = "1.11.1"

    [deps.Statistics.extensions]
    SparseArraysExt = ["SparseArrays"]

    [deps.Statistics.weakdeps]
    SparseArrays = "2f01184e-e22b-5df5-ae63-d93ebab69eaf"

[[deps.StyledStrings]]
uuid = "f489334b-da3d-4c2e-b8f0-e476e12c162b"
version = "1.11.0"

[[deps.TOML]]
deps = ["Dates"]
uuid = "fa267f1f-6049-4f14-aa54-33bafae1ed76"
version = "1.0.3"

[[deps.Test]]
deps = ["InteractiveUtils", "Logging", "Random", "Serialization"]
uuid = "8dfed614-e22c-5e08-85e1-65c5234f0b40"
version = "1.11.0"

[[deps.Tricks]]
git-tree-sha1 = "311349fd1c93a31f783f977a71e8b062a57d4101"
uuid = "410a4b4d-49e4-4fbc-ab6d-cb71b17b3775"
version = "0.1.13"

[[deps.URIs]]
git-tree-sha1 = "bef26fb046d031353ef97a82e3fdb6afe7f21b1a"
uuid = "5c2747f8-b7ea-4ff2-ba2e-563bfd36b1d4"
version = "1.6.1"

[[deps.UUIDs]]
deps = ["Random", "SHA"]
uuid = "cf7118a7-6976-5b1a-9a39-7adc72f591a4"
version = "1.11.0"

[[deps.Unicode]]
uuid = "4ec0a83e-493e-50e2-b9ac-8f72acf5a8f5"
version = "1.11.0"

[[deps.Zlib_jll]]
deps = ["Libdl"]
uuid = "83775a58-1f1d-513f-b197-d71354ab007a"
version = "1.3.1+2"

[[deps.libblastrampoline_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "8e850b90-86db-534c-a0d3-1478176c7d93"
version = "5.15.0+0"

[[deps.nghttp2_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "8e850ede-7688-5339-a07c-302acd2aaf8d"
version = "1.64.0+1"
"""

# ╔═╡ Cell order:
# ╠═67e2cb97-e224-47ca-96ba-2e89d94959e7
# ╠═b1c0d12c-f383-44fb-bcfe-4157a2801b9a
# ╠═82c316c7-a279-4728-b16a-921d7fc52886
# ╠═ede20024-1aea-4d80-a19a-8a5ec88a00ac
# ╠═acb08d1f-30f9-4e01-8216-3440c82714c7
# ╠═c097b477-e154-47eb-b7d9-a4d2981dcf0e
# ╠═0b19e53d-eb7a-42b6-a7db-d95bc8c63eae
# ╠═2e54b8fc-7852-11ec-27d7-df0bfe7f344a
# ╠═0c0bab41-a020-41a0-83ad-0c57b4699ffa
# ╠═9f601f94-e85e-4a66-92d5-2ea57164c463
# ╠═257ee9b0-d955-43d2-9c94-245716708a2d
# ╟─ddccf592-0d0f-475c-81ae-067c37ba3f7e
# ╠═fffd6402-d508-48a6-abc6-3de333497787
# ╠═a060f034-b540-4b1e-a87f-7e6185e15646
# ╠═466bf852-144c-47df-98e1-89935754f5f1
# ╠═6e26a930-1b49-4ff5-8704-9149d3cab7e9
# ╠═0cb7b599-cec5-4391-9485-4e1c63cd9ff2
# ╠═ab108b97-4dd5-49e4-845c-2f0fab131f8a
# ╠═596dbead-63ce-432a-8a0b-b3ea361e279e
# ╠═8c96934c-3e23-45ed-b945-dce344bfb6eb
# ╠═af1ad32b-af53-4865-9807-ba8d0fba2a8c
# ╠═d441b495-a00c-4de3-a232-7c75f55fc95b
# ╟─fa0b6647-6911-4c27-a1a6-240d215331d1
# ╟─6c84a84f-9ead-4091-819e-0de088e2dd4d
# ╟─e866282e-7c63-4364-b344-46f4c6ad165c
# ╟─cd3b9ad1-8efc-4f92-96d0-b9b038d8cfae
# ╠═79b6ac0f-4d0b-485f-8fb0-9849932dc34e
# ╟─eaad4fed-ea22-4132-a84a-429f486ddce2
# ╟─146474b5-9aa6-4000-867d-ba91e4061d9b
# ╟─00000000-0000-0000-0000-000000000001
# ╟─00000000-0000-0000-0000-000000000002
