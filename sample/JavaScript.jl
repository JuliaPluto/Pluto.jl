### A Pluto.jl notebook ###
# v0.20.21

#> [frontmatter]
#> license_url = "https://github.com/JuliaPluto/featured/blob/2a6a9664e5428b37abe4957c1dca0994f4a8b7fd/LICENSES/Unlicense"
#> image = "https://upload.wikimedia.org/wikipedia/commons/9/99/Unofficial_JavaScript_logo_2.svg"
#> order = "3"
#> tags = ["javascript", "web", "classic"]
#> license = "Unlicense"
#> description = "Use HTML, CSS and JavaScript to make your own interactive visualizations!"
#> 
#>     [[frontmatter.author]]
#>     name = "Pluto.jl"
#>     url = "https://github.com/JuliaPluto"

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

# ╔═╡ 571613a1-6b4b-496d-9a68-aac3f6a83a4b
using PlutoUI, HypertextLiteral

# ╔═╡ 97914842-76d2-11eb-0c48-a7eedca870fb
md"""
# Using _JavaScript_ inside Pluto

You have already seen that Pluto is designed to be _interactive_. You can make fantastic explorable documents using just the basic inputs provided by PlutoUI, together with the wide range of visualization libraries that Julia offers.

_However_, if you want to take your interactive document one step further, then Pluto offers a great framework for **combining Julia with HTML, CSS and _JavaScript_**.
"""

# ╔═╡ 168e13f7-2ff2-4207-be56-e57755041d36
md"""
## Prerequisites

This document assumes that you have used HTML, CSS and JavaScript before in another context. If you know Julia, and you want to add these web languages to your skill set, we encourage you to do so! It will be useful knowledge, also outside of Pluto.

If you're new to all this, Pluto's featured notebooks also include more basic notebooks on using HTML and CSS!
"""

# ╔═╡ ea39c63f-7466-4015-a66c-08bd9c716343
md"""
> My personal favourite resource for learning HTML and CSS is the [Mozilla Developer Network (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS). 
> 
> _-fons_
"""

# ╔═╡ 8b082f9a-073e-4112-9422-4087850fc89e
md"""
#### Learning JavaScript
After learning HTML and CSS, you can already spice up your Pluto notebooks by creating custom layouts, generated dynamically from Julia data. To take things to the next level, you can learn JavaScript. We recommend using an online resource for this. 

> My personal favourite is [javascript.info](https://javascript.info/), a high-quality, open source tutorial. I use it too!
> 
> _-fons_

It is hard to say whether it is easy to _learn JavaScript using Pluto_. On one hand, we highly recommend the high-quality public learning material that already exists for JavaScript, which is generally written in the context of writing traditional web apps. On the other hand, if you have a specific Pluto-related project in mind, then this could be a great motivator to continue learning!

A third option is to learn JavaScript using [observablehq.com](https://observablehq.com), an online reactive notebook for JavaScript (it's awesome!). Pluto's JavaScript runtime is designed to be very close to the way you write code in observable, so the skills you learn there will be transferable!

If you chose to learn JavaScript using Pluto, let me know how it went, and how we can improve! [fons@plutojl.org](mailto:fons@plutojl.org)
"""

# ╔═╡ d70a3a02-ef3a-450f-bf5a-4a0d7f6262e2
TableOfContents()

# ╔═╡ 10cf6ed1-8276-4a4a-ad06-097d10335512
md"""
# Essentials

## Using HTML and JavaScript

To use web languages inside Pluto, we recommend the small package [`HypertextLiteral.jl`](https://github.com/MechanicalRabbit/HypertextLiteral.jl), which provides an `@htl` macro.

You wrap `@htl` around a string expression to mark it as an *HTML literal*, as we did in the example cell from earlier. When a cell outputs an HTML-showable object, it is rendered directly in your browser.
"""

# ╔═╡ d967cdf9-3df9-40bb-9b08-09cae95a5ca7
@htl(" <b> Hello! </b> ")

# ╔═╡ 858745a9-cd59-43a6-a296-803515518e57
md"""
### Adding JavaScript to a cell

You can use JavaScript by including it inside HTML, just like you do when writing a web page.

For example, here we use `<script>` to include some JavaScript.
"""

# ╔═╡ 21a9e3e6-92f4-475d-9c8e-21e15c09336b
@htl("""

<div class='blue-background'>
Hello!
</div>

<script>
// more about selecting elements later!
currentScript.previousElementSibling.innerText = "Hello from JavaScript!"

</script>
""")

# ╔═╡ 4a3398be-ee86-45f3-ac8b-f627a38c00b8
md"""
## Interpolation

Julia has a nice feature: _string interpolation_:
"""

# ╔═╡ 2d5fd611-284b-4428-b6a5-8909203990b9
who = "🌍"

# ╔═╡ 82de4674-9ecc-46c4-8a57-0b4453c579c3
"Hello $(who)!"

# ╔═╡ 70a415be-881a-4c01-9f8c-635b8b89e1ad
md"""
With some (frustrating) exceptions, you can also interpolate into Markdown literals:
"""

# ╔═╡ 730a692f-2bf2-4d5b-86da-6ab861e8b8ac
md"""
Hello $(who)!
"""

# ╔═╡ a45fdec4-2d4b-429b-b809-4c256b57fffe
md"""
**However**, you cannot interpolate into an `html"` string:
"""

# ╔═╡ c68ebd7b-5fb6-4527-ac34-33f9730e4587
html"""
<p>Hello $(who)!</p>
"""

# ╔═╡ 8c03139f-a94b-40cc-859f-0d86f1c72143
md"""

😢 Luckily we can perform these kinds of interpolations (and much more) with the `@htl` macro, as we will see next.


### Interpolating into HTML -- HypertextLiteral.jl
"""

# ╔═╡ d8dcb044-0ac8-46d1-a043-1073bb6d1ff1
@htl("""
	<p> Hello $(who)!</p>
	""")

# ╔═╡ bf592202-a9a4-4e9b-8433-fed55e3aa3bc
@htl("""
	<p>It has a bunch of very cool features! Including:</p>
	<ul>$([
		@htl(
			"<li>$(item)</li>"
		)
		for item in cool_features
	])</ul>
	""")

# ╔═╡ e7d3db79-8253-4cbd-9832-5afb7dff0abf
cool_features = [
	md"Interpolate any **HTML-showable object**, such as plots and images, or another `@htl` literal."
	md"Interpolated lists are expanded _(like in this cell!)_."
	"Easy syntax for CSS"
	]

# ╔═╡ 5ac5b984-8c02-4b8d-a342-d0f05f7909ec
md"""
#### Why not just `HTML(...)`?

You might be thinking, why don't we just use the `HTML` function, together with string interpolation? The main problem is correctly handling HTML _escaping rules_. For example:
"""

# ╔═╡ ef28eb8d-ec98-43e5-9012-3338c3b84f1b
cool_elements = "<div> and <marquee>"

# ╔═╡ 1ba370cc-3631-47ea-9db5-75587e8e4ff3
HTML("""
<h6> My favourite HTML elements are $(cool_elements)!</h6>
""")

# ╔═╡ 7fcf2f3f-d902-4338-adf0-8ef181e79420
@htl("""
<h6> My favourite HTML elements are $(cool_elements)!</h6>
""")

# ╔═╡ 7afbf8ef-e91c-45b9-bf22-24201cbb4828
md"""
### Interpolating into JS -- _HypertextLiteral.jl_

As we see above, using HypertextLiteral.jl, we can interpolate objects (numbers, string, images) into HTML output, great! Next, we want to **interpolate _data_ into _scripts_**. Although you could use `JSON.jl`, HypertextLiteral.jl actually has this ability built-in! 

> When you **interpolate Julia objects into a `<script>` tag** using the `@htl` macro, it will be converted to a JS object _automatically_. 
"""

# ╔═╡ b226da72-9512-4d14-8582-2f7787c25028
simple_data = (msg="Hello! ", times=3)

# ╔═╡ a6fd1f7b-a8fc-420d-a8bb-9f549842ad3e
@htl("""
	<script>

	// interpolate the data 🐸
	const data = $(simple_data)

	const span = document.createElement("span")
	span.innerText = data.msg.repeat(data.times)
	
	return span
	</script>
""")

# ╔═╡ 965f3660-6ec4-4a86-a2a2-c167dbe9315f
md"""
**Let's look at a more exciting example:**
"""

# ╔═╡ 00d97588-d591-4dad-9f7d-223c237deefd
@bind fantastic_x Slider(0:400)

# ╔═╡ 01ce31a9-6856-4ee7-8bce-7ce635167457
my_data = [
	(name="Cool", coordinate=[100, 100]),
	(name="Awesome", coordinate=[200, 100]),
	(name="Fantastic!", coordinate=[fantastic_x, 150]),
]

# ╔═╡ 21f57310-9ceb-423c-a9ce-5beb1060a5a3
@htl("""
	<script src="https://cdn.jsdelivr.net/npm/d3@6.2.0/dist/d3.min.js"></script>

	<script>

	// interpolate the data 🐸
	const data = $(my_data)

	const svg = DOM.svg(600,200)
	const s = d3.select(svg)

	s.selectAll("text")
		.data(data)
		.join("text")
		.attr("x", d => d.coordinate[0])
		.attr("y", d => d.coordinate[1])
		.style("fill", "red")
		.text(d => d.name)

	return svg
	</script>
""")

# ╔═╡ 0866afc2-fd42-42b7-a572-9d824cf8b83b
md"""
## Custom `@bind` output
"""

# ╔═╡ 75e1a973-7ef0-4ac5-b3e2-5edb63577927
md"""
**You can use JavaScript to write input widgets.** The `input` event can be triggered on any object using

```javascript
obj.value = ...
obj.dispatchEvent(new CustomEvent("input"))
```

For example, here is a button widget that will send the number of times it has been clicked as the value:

"""

# ╔═╡ e8d8a60e-489b-467a-b49c-1fa844807751
ClickCounter(text="Click") = @htl("""
<span>
<button>$(text)</button>

<script>

	// Select elements relative to `currentScript`
	const span = currentScript.parentElement
	const button = span.querySelector("button")

	// we wrapped the button in a `span` to hide its default behaviour from Pluto

	let count = 0

	button.addEventListener("click", (e) => {
		count += 1

		// we dispatch the input event on the span, not the button, because 
		// Pluto's `@bind` mechanism listens for events on the **first element** in the
		// HTML output. In our case, that's the span.

		span.value = count
		span.dispatchEvent(new CustomEvent("input"))
		e.preventDefault()
	})

	// Set the initial value
	span.value = count

</script>
</span>
""")

# ╔═╡ 9346d8e2-9ba0-4475-a21f-11bdd018bc60
@bind num_clicks ClickCounter()

# ╔═╡ 7822fdb7-bee6-40cc-a089-56bb32d77fe6
num_clicks

# ╔═╡ 701de4b8-42d3-46a3-a399-d7761dccd83d
md"""
As an exercise to get familiar with these techniques, you can try the following:
- 👉 Add a "reset to zero" button to the widget above.
- 👉 Make the bound value an array that increases size when you click, instead of a single number.
- 👉 Create a "two sliders" widget: combine two sliders (`<input type=range>`) into a single widget, where the bound value is the two-element array with both values.
- 👉 Create a "click to send" widget: combine a text input and a button, and only send the contents of the text field when the button is clicked, not on every keystroke.

Questions? Ask them on our [GitHub Discussions](https://github.com/fonsp/Pluto.jl/discussions)!
"""

# ╔═╡ 88120468-a43d-4d58-ac04-9cc7c86ca179
md"""
## Debugging

The HTML, CSS and JavaScript that you write run in the browser, so you should use the [browser's built-in developer tools](https://developer.mozilla.org/en-US/docs/Learn/Common_questions/What_are_browser_developer_tools) to debug your code. 
"""

# ╔═╡ ea4b2da1-4c83-4a1f-8fc3-c71a120e58e1
@htl("""

<script>

console.info("Can you find this message in the console?")

</script>

""")

# ╔═╡ 08bdeaff-5bfb-49ab-b4cc-3a3446c63edc
@htl("""
	<style>
	.cool-class {
		font-size: 1.3rem;
		color: purple;
		background: lightBlue;
		padding: 1rem;
		border-radius: 1rem;
	}
	
	
	</style>
	
	<div class="cool-class">Can you find out which CSS class this is?</div>
	""")

# ╔═╡ 9b6b5da9-8372-4ebf-9c66-ae9fcfc45d47
md"""
## Selecting elements

When writing the javascript code for a widget, it is common to **select elements inside the widgets** to manipulate them. In the number-of-clicks example above, we selected the `<span>` and `<button>` elements in our code, to trigger the input event, and attach event listeners, respectively.

There are a numbers of ways to do this, and the recommended strategy is to **create a wrapper `<span>`, and use `currentScript.parentElement` to select it**.

### `currentScript`

When Pluto runs the code inside `<script>` tags, it assigns a reference to that script element to a variable called `currentScript`. You can then use properties like `previousElementSibling` or `parentElement` to "navigate to other elements".

Let's look at the "wrapper span strategy" again.

```htmlmixed
@htl("\""

<!-- the wrapper span -->
<span>

	<button id="first">Hello</button>
	<button id="second">Julians!</button>
	
	<script>
		const wrapper_span = currentScript.parentElement
		// we can now use querySelector to select anything we want
		const first_button = wrapper_span.querySelector("button#first")

		console.log(first_button)
	</script>
</span>
"\"")
```
"""

# ╔═╡ f18b98f7-1e0f-4273-896f-8a667d15605b
md"""
#### Why not just select on `document.body`?

In the example above, it would have been easier to just select the button directly, using:
```javascript
// ⛔ do no use:
const first_button = document.body.querySelector("button#first")
```

However, this becomes a problem when **combining using the widget multiple times in the same notebook**, since all selectors will point to the first instance. 

Similarly, try not to search relative to the `<pluto-cell>` or `<pluto-output>` element, because users might want to combine multiple instances of the widget in a single cell.
"""

# ╔═╡ d83d57e2-4787-4b8d-8669-64ed73d79e73
md"""
## Script loading

To use external javascript dependencies, you can load them from a CDN, such as:
- [jsdelivr.com](https://www.jsdelivr.com/)
- [esm.sh](https://esm.sh)

Just like when writing a browser app, there are two ways to import JS dependencies: a `<script>` tag, and the more modern ES6 import.

### Loading method 1: ES6 imports

We recommend that you use an [**ES6 import**](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) if the library supports it. (If it does not, you might be able to still get it using [esm.sh](https://esm.sh)!)


##### Awkward note about syntax

Normally, you can import libraries inside JS using the import syntax:
```javascript
// ⛔ do no use:
import confetti from "https://esm.sh/canvas-confetti@1.4.0"
import { html, render, useEffect } from "https://cdn.jsdelivr.net/npm/htm@3.0.4/preact/standalone.mjs"
```

In Pluto, this is [currently not yet supported](https://github.com/fonsp/Pluto.jl/issues/992), and you need to use a different syntax as workaround:
```javascript
// ✔ use:
const { default: confetti } = await import("https://esm.sh/canvas-confetti@1.4.0")
const { html, render, useEffect } = await import("https://cdn.jsdelivr.net/npm/htm@3.0.4/preact/standalone.mjs")
```
"""

# ╔═╡ 077c95cf-2a1b-459f-830e-c29c11a2c5cc
md"""

### Loading method 2: script tag

`<script src="...">` tags with a `src` attribute set, like this tag to import the d3.js library:

```html
<script src="https://cdn.jsdelivr.net/npm/d3@6.2.0/dist/d3.min.js"></script>
```

will work as expected. The execution of other script tags within the same cell is delayed until a `src` script finished loading, and Pluto will make sure that every source file is only loaded once.
"""

# ╔═╡ 80511436-e41f-4913-8a30-d9e113cfaf71
md"""
### Pinning versions

When using a CDN almost **never** want to use an unpinned import. Always version your CDN imports!
```js
// ⛔ do no use:
"https://esm.sh/canvas-confetti"
"https://cdn.jsdelivr.net/npm/htm/preact/standalone.mjs"

// ✔ use:
"https://esm.sh/canvas-confetti@1.4.0"
"https://cdn.jsdelivr.net/npm/htm@3.0.4/preact/standalone.mjs"
```
"""

# ╔═╡ 8388a833-d535-4cbd-a27b-de323cea60e8
md"""
# Advanced
"""

# ╔═╡ 4cf27df3-6a69-402e-a71c-26538b2a52e7
md"""
## Script output & `observablehq/stdlib`

Pluto's original inspiration was [observablehq.com](https://observablehq.com/), and online reactive notebook for JavaScript. _(It's REALLY good, try it out!)_ We design Pluto's JavaScript runtime to be close to the way you write code in observable.

Read more about the observable runtime in their (interactive) [documentation](https://observablehq.com/@observablehq/observables-not-javascript). The following is also true for JavaScript-inside-scripts in Pluto:
- ⭐️ If you return an HTML node, it will be displayed.
- ⭐️ The [`observablehq/stdlib`](https://observablehq.com/@observablehq/stdlib) library is pre-imported, you can use `DOM`, `html`, `Promises`, etc.
- ⭐️ When a cell re-runs reactively, `this` will be set to the previous output (with caveat, see the later section)
- The variable `invalidation` is a Promise that will get resolved when the cell output is changed or removed. You can use this to remove event listeners, for example.
- You can use top-level `await`, and a returned HTML node will be displayed when ready.
- Code is run in "strict mode", use `let x = 1` instead of `x = 1`.

The following is different in Pluto:
- JavaScript code is not reactive, there are no global variables.
- Cells can contain multiple script tags, and they will run consecutively (also when using `await`)
- We do not (yet) support async generators, i.e. `yield`.
- We do not support the observable keywords `viewof` and `mutable`.
"""

# ╔═╡ 5721ad33-a51a-4a91-adb2-0915ea0efa13
md"""
### Example: 
(Though using `HypertextLiteral.jl` would make more sense for this purpose.)
"""

# ╔═╡ c857bb4b-4cf4-426e-b340-592cf7700434
@htl("""
	<script>
	
	let data = $(films)
	
	// html`...` is from https://github.com/observablehq/stdlib
	// note the escaped dollar signs:
	let Film = ({title, director, year}) => html`
		<li class="film">
			<b>\${title}</b> by <em>\${director}</em> (\${year})
		</li>
	`
	
	// the returned HTML node is rendered
	return html`
		<ul>
			\${data.map(Film)}
		</ul>
	`
	
	</script>
	""")

# ╔═╡ fc8984c8-4668-418a-b258-a1718809470c


# ╔═╡ 846354c8-ba3b-4be7-926c-d3c9cc9add5f
films = [
	(title="Frances Ha", director="Noah Baumbach", year=2012),
	(title="Portrait de la jeune fille en feu", director="Céline Sciamma", year=2019),
	(title="De noorderlingen", director="Alex van Warmerdam", year=1992),
];

# ╔═╡ a33c7d7a-8071-448e-abd6-4e38b5444a3a
md"""
## Stateful output with `this`

Just like in observablehq, if a cell _re-runs reactively_, then the javascript variable `this` will take the value of the last thing that was returned by the script. If the cell runs for the first time, then `this == undefined`. In particular, if you return an HTML node, and the cell runs a second time, then you can access the HTML node using `this`. Two reasons for using this feature are:
- Stateful output: you can persist some state in-between re-renders. 
- Performance: you can 'recycle' the previous DOM and update it partially (using d3, for example). _When doing so, Pluto guarantees that the DOM node will always be visible, without flicker._

##### 'Re-runs reactively'?
With this, we mean that the Julia cell re-runs not because of user input (Ctrl+S, Shift+Enter or clicking the play button), but because it was triggered by a variable reference.

##### ☝️ Caveat
This feature is **only enabled** for `<script>` tags with the `id` attribute set, e.g. `<script id="first">`. Think of setting the `id` attribute as saying: "I am a Pluto script". There are two reasons for this:
- One Pluto cell can output multiple scripts, Pluto needs to know which output to assign to which script.
- Some existing scripts assume that `this` is set to `window` in toplevel code (like in the browser). By hiding the `this`-feature behind this caveat, we still support libraries that output such scripts.

"""

# ╔═╡ 91f3dab8-5521-44a0-9890-8d988a994076
trigger = "edit me!"

# ╔═╡ dcaae662-4a4f-4dd3-8763-89ea9eab7d43
let
	trigger
	
	html"""
	<script id="something">
	
	console.log("'this' is currently:", this)

	if(this == null) {
		return html`<blockquote>I am running for the first time!</blockqoute>`
	} else {
		return html`<blockquote><b>I was triggered by reactivity!</b></blockqoute>`
	}


	</script>
	"""
end

# ╔═╡ e77cfefc-429d-49db-8135-f4604f6a9f0b
md"""
### Example: d3.js transitions

Type the coordinates of the circles here! 
"""

# ╔═╡ 2d5689f5-1d63-4b8b-a103-da35933ad26e
@bind positions TextField(default="100, 300")

# ╔═╡ 6dd221d1-7fd8-446e-aced-950512ea34bc
dot_positions = try
	parse.([Int], split(replace(positions, ',' => ' ')))
catch e
	[100, 300]
end

# ╔═╡ 0a9d6e2d-3a41-4cd5-9a4e-a9b76ed89fa9
# dot_positions = [100, 300] # edit me!

# ╔═╡ 0962d456-1a76-4b0d-85ff-c9e7dc66621d
md"""
Notice that, even though the cell below re-runs, we **smoothly transition** between states. We use `this` to maintain the d3 transition states in-between reactive runs.
"""

# ╔═╡ bf9b36e8-14c5-477b-a54b-35ba8e415c77
@htl("""
<script src="https://cdn.jsdelivr.net/npm/d3@6.2.0/dist/d3.min.js"></script>

<script id="hello">

const positions = $(dot_positions)
	
const svg = this == null ? DOM.svg(600,200) : this
const s = this == null ? d3.select(svg) : this.s

s.selectAll("circle")
	.data(positions)
	.join("circle")
    .transition()
    .duration(300)
	.attr("cx", d => d)
	.attr("cy", 100)
	.attr("r", 10)
	.attr("fill", "gray")


const output = svg
output.s = s
return output
</script>

""")

# ╔═╡ 781adedc-2da7-4394-b323-e508d614afae
md"""
### Example: Preact with persistent state
"""

# ╔═╡ de789ad1-8197-48ae-81b2-a21ec2340ae0
md"""
Modify `x`, add and remove elements, and notice that preact maintains its state.
"""

# ╔═╡ 85483b28-341e-4ed6-bb1e-66c33613725e
x = ["hello pluton!", 232000,2,2,12 ,12,2,21,1,2, 120000]

# ╔═╡ 9e37c18c-3ebb-443a-9663-bb4064391d6e
@htl("""
<script id="asdf">
	//await new Promise(r => setTimeout(r, 1000))
	
	const { html, render, Component, useEffect, useLayoutEffect, useState, useRef, useMemo, createContext, useContext, } = await import( "https://cdn.jsdelivr.net/npm/htm@3.0.4/preact/standalone.mjs")

	const node = this ?? document.createElement("div")
	
	const new_state = $(state)
	
	if(this == null){
	
		// PREACT APP STARTS HERE
		
		const Item = ({value}) => {
			const [loading, set_loading] = useState(true)

			useEffect(() => {
				set_loading(true)

				const handle = setTimeout(() => {
					set_loading(false)
				}, 1000)

				return () => clearTimeout(handle)
			}, [value])

			return html`<li>\${loading ? 
				html`<em>Loading...</em>` : 
				value
			}</li>`
		}

        const App = () => {

            const [state, set_state] = useState(new_state)
            node.set_app_state = set_state

            return html`<h5>Hello world!</h5>
                <ul>\${
                state.x.map((x,i) => html`<\${Item} value=\${x} key=\${i}/>`)
            }</ul>`;
        }

		// PREACT APP ENDS HERE

        render(html`<\${App}/>`, node);
	
	} else {
		
		node.set_app_state(new_state)
	}
	return node
</script>
	
	
""")

# ╔═╡ 3266f9e6-42ad-4103-8db3-b87d2c315290
state = Dict(
	:x => x
	)

# ╔═╡ 7d9d6c28-131a-4b2a-84f8-5c085f387e85
md"""
## Embedding Julia data directly into JavaScript!

You can use `AbstractPlutoDingetjes.Display.published_to_js` to embed data directly into JavaScript, using Pluto's built-in, optimized data transfer. See [the documentation](https://plutojl.org/en/docs/abstractplutodingetjes/#published_to_js) for more info.

Example usage:

```julia
let
	x = rand(UInt8, 10_000)
	
	d = Dict(
		"some_raw_data" => x,
		"wow" => 1000,
	)
	
	@htl(\"\"\"
	<script>
		
	const d = $(AbstractPlutoDingetjes.Display.published_to_js(d))
	console.log(d)
	
	</script>
	\"\"\")
end
```

In this example, the `const d` is populated from a hook into Pluto's data transfer. For large amounts of typed vector data (e.g. `Vector{UInt8}` or `Vector{Float64}`), this is *much* more efficient than interpolating the data directly with HypertextLiteral using `$(d)`, which would use a JSON-like string serialization.
"""

# ╔═╡ da7091f5-8ba2-498b-aa8d-bbf3b4505b81
md"""
# Appendix
"""

# ╔═╡ 64cbf19c-a4e3-4cdb-b4ec-1fbe24be55ad
details(x, summary="Show more") = @htl("""
	<details>
		<summary>$(summary)</summary>
		$(x)
	</details>
	""")

# ╔═╡ 94561cb1-2325-49b6-8b22-943923fdd91b
details(md"""
	```htmlmixed
	<script src="https://cdn.jsdelivr.net/npm/d3@6.2.0/dist/d3.min.js"></script>

	<script>

	// interpolate the data 🐸
	const data = $(my_data)

	const svg = DOM.svg(600,200)
	const s = d3.select(svg)

	s.selectAll("text")
		.data(data)
		.join("text")
		.attr("x", d => d.coordinate[0])
		.attr("y", d => d.coordinate[1])
		.style("fill", "red")
		.text(d => d.name)

	return svg
	</script>
	```
	""", "Show with syntax highlighting")

# ╔═╡ b0c246ed-b871-461b-9541-280e49b49136
details(md"""
```htmlmixed
<div>
<button>$(text)</button>

<script>

	// Select elements relative to `currentScript`
	const div = currentScript.parentElement
	const button = div.querySelector("button")

	// we wrapped the button in a `div` to hide its default behaviour from Pluto

	let count = 0

	button.addEventListener("click", (e) => {
		count += 1

		// we dispatch the input event on the div, not the button, because 
		// Pluto's `@bind` mechanism listens for events on the **first element** in the
		// HTML output. In our case, that's the div.

		div.value = count
		div.dispatchEvent(new CustomEvent("input"))
		e.preventDefault()
	})

	// Set the initial value
	div.value = count

</script>
</div>
```
""", "Show with syntax highlighting")

# ╔═╡ d121e085-c69b-490f-b315-c11a9abd57a6
details(md"""
	```htmlmixed
	<script>
	
	let data = $(films)
	
	// html`...` is from https://github.com/observablehq/stdlib
	// note the escaped dollar signs:
	let Film = ({title, director, year}) => html`
		<li class="film">
			<b>\${title}</b> by <em>\${director}</em> (\${year})
		</li>
	`
	
	// the returned HTML node is rendered
	return html`
		<ul>
			\${data.map(Film)}
		</ul>
	`
	
	</script>
	```
	""", "Show with syntax highlighting")

# ╔═╡ d4bdc4fe-2af8-402f-950f-2afaf77c62de
details(md"""
	```htmlmixed
	<script id="something">
	
	console.log("'this' is currently:", this)

	if(this == null) {
		return html`<blockquote>I am running for the first time!</blockqoute>`
	} else {
		return html`<blockquote><b>I was triggered by reactivity!</b></blockqoute>`
	}


	</script>
	```
	""", "Show with syntax highlighting")

# ╔═╡ e910982c-8508-4729-a75d-8b5b847918b6
details(md"""
```htmlmixed
<script src="https://cdn.jsdelivr.net/npm/d3@6.2.0/dist/d3.min.js"></script>

<script id="hello">

const positions = $(dot_positions)

const svg = this == null ? DOM.svg(600,200) : this
const s = this == null ? d3.select(svg) : this.s

s.selectAll("circle")
	.data(positions)
	.join("circle")
	.transition()
	.duration(300)
	.attr("cx", d => d)
	.attr("cy", 100)
	.attr("r", 10)
	.attr("fill", "gray")


const output = svg
output.s = s
return output
</script>
```
""", "Show with syntax highlighting")

# ╔═╡ 05d28aa2-9622-4e62-ab39-ca4c7dde6eb4
details(md"""
	```htmlmixed
	<script type="module" id="asdf">
		//await new Promise(r => setTimeout(r, 1000))

		const { html, render, Component, useEffect, useLayoutEffect, useState, useRef, useMemo, createContext, useContext, } = await import( "https://cdn.jsdelivr.net/npm/htm@3.0.4/preact/standalone.mjs")

		const node = this ?? document.createElement("div")

		const new_state = $(state)

		if(this == null){

			// PREACT APP STARTS HERE

			const Item = ({value}) => {
				const [loading, set_loading] = useState(true)

				useEffect(() => {
					set_loading(true)

					const handle = setTimeout(() => {
						set_loading(false)
					}, 1000)

					return () => clearTimeout(handle)
				}, [value])

				return html`<li>\${loading ? 
					html`<em>Loading...</em>` : 
					value
				}</li>`
			}

			const App = () => {

				const [state, set_state] = useState(new_state)
				node.set_app_state = set_state

				return html`<h5>Hello world!</h5>
					<ul>\${
					state.x.map((x,i) => html`<\${Item} value=\${x} key=\${i}/>`)
				}</ul>`;
			}

			// PREACT APP ENDS HERE

			render(html`<\${App}/>`, node);

		} else {

			node.set_app_state(new_state)
		}
		return node
	</script>
	```
	""", "Show with syntax highlighting")

# ╔═╡ cc318a19-316f-4fd9-8436-fb1d42f888a3
demo_img = let
	url = "https://user-images.githubusercontent.com/6933510/116753174-fa40ab80-aa06-11eb-94d7-88f4171970b2.jpeg"
	data = read(download(url))
	PlutoUI.Show(MIME"image/jpg"(), data)
end

# ╔═╡ 7aacdd8c-1571-4461-ba6e-0fd65dd8d788
demo_html = @htl("<b style='font-family: cursive;'>Hello!</b>")

# ╔═╡ ebec177c-4c33-45a4-bdbd-f16944631aff
md"""
## Embeddable output

Pluto has a multimedia object viewer, which is used to display the result of a cell's output. Depending on the _type_ of the resulting object, the richest possible viewer is used. This includes:
- an interactive structure viewer for arrays, tables, dictionaries and more: $(embed_display([1,2,(a=3, b=4)]))
- an `<img>` tag with optimized data transfer for images: $(embed_display(demo_img))
- raw HTML for HTML-showable objects: $(embed_display(demo_html))

Normally, you get this object viewer for the _output_ of a cell. However, as demonstrated in the list above, you can also **embed Pluto's object viewer in your own HTML**. To do so, Pluto provides a function:
```julia
embed_display(x)
```

#### Example

As an example, here is how you display two arrays side-by-side:

```julia
@htl("\""

<div style="display: flex;">
$(embed_display(rand(4)))
$(embed_display(rand(4)))
</div>

"\"")

```

You can [learn more](https://github.com/fonsp/Pluto.jl/pull/1126) about how this feature works, or how to use it inside packages.
"""

# ╔═╡ 00000000-0000-0000-0000-000000000001
PLUTO_PROJECT_TOML_CONTENTS = """
[deps]
HypertextLiteral = "ac1192a8-f4b3-4bfe-ba22-af5b92cd3ab2"
PlutoUI = "7f904dfe-b85e-4ff6-b463-dae2292396a8"

[compat]
HypertextLiteral = "~0.9.3"
PlutoUI = "~0.7.34"
"""

# ╔═╡ 00000000-0000-0000-0000-000000000002
PLUTO_MANIFEST_TOML_CONTENTS = """
# This file is machine-generated - editing it directly is not advised

[[AbstractPlutoDingetjes]]
deps = ["Pkg"]
git-tree-sha1 = "793501dcd3fa7ce8d375a2c878dca2296232686e"
uuid = "6e696c72-6542-2067-7265-42206c756150"
version = "1.2.2"

[[ArgTools]]
uuid = "0dad84c5-d112-42e6-8d28-ef12dabb789f"
version = "1.1.1"

[[Artifacts]]
uuid = "56f22d72-fd6d-98f1-02f0-08ddc0907c33"

[[Base64]]
uuid = "2a0f44e3-6c83-55bd-87e4-b1978d98bd5f"

[[ColorTypes]]
deps = ["FixedPointNumbers", "Random"]
git-tree-sha1 = "eb7f0f8307f71fac7c606984ea5fb2817275d6e4"
uuid = "3da002f7-5984-5a60-b8a6-cbb66c0b333f"
version = "0.11.4"

[[CompilerSupportLibraries_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "e66e0078-7015-5450-92f7-15fbd957f2ae"
version = "1.1.1+0"

[[Dates]]
deps = ["Printf"]
uuid = "ade2ca70-3891-5945-98fb-dc099432e06a"

[[Downloads]]
deps = ["ArgTools", "FileWatching", "LibCURL", "NetworkOptions"]
uuid = "f43a241f-c20a-4ad4-852c-f6b1247861c6"
version = "1.6.0"

[[FileWatching]]
uuid = "7b1f6079-737a-58dc-b8bc-7a2ca5c1b5ee"

[[FixedPointNumbers]]
deps = ["Statistics"]
git-tree-sha1 = "335bfdceacc84c5cdf16aadc768aa5ddfc5383cc"
uuid = "53c48c17-4a7d-5ca2-90c5-79b7896eea93"
version = "0.8.4"

[[Hyperscript]]
deps = ["Test"]
git-tree-sha1 = "8d511d5b81240fc8e6802386302675bdf47737b9"
uuid = "47d2ed2b-36de-50cf-bf87-49c2cf4b8b91"
version = "0.0.4"

[[HypertextLiteral]]
deps = ["Tricks"]
git-tree-sha1 = "7134810b1afce04bbc1045ca1985fbe81ce17653"
uuid = "ac1192a8-f4b3-4bfe-ba22-af5b92cd3ab2"
version = "0.9.5"

[[IOCapture]]
deps = ["Logging", "Random"]
git-tree-sha1 = "d75853a0bdbfb1ac815478bacd89cd27b550ace6"
uuid = "b5f81e59-6552-4d32-b1f0-c071b021bf89"
version = "0.2.3"

[[InteractiveUtils]]
deps = ["Markdown"]
uuid = "b77e0a4c-d291-57a0-90e8-8db25a27a240"

[[JSON]]
deps = ["Dates", "Mmap", "Parsers", "Unicode"]
git-tree-sha1 = "31e996f0a15c7b280ba9f76636b3ff9e2ae58c9a"
uuid = "682c06a0-de6a-54ab-a142-c8b1cf79cde6"
version = "0.21.4"

[[LibCURL]]
deps = ["LibCURL_jll", "MozillaCACerts_jll"]
uuid = "b27032c2-a3e7-50c8-80cd-2d36dbcbfd21"
version = "0.6.4"

[[LibCURL_jll]]
deps = ["Artifacts", "LibSSH2_jll", "Libdl", "MbedTLS_jll", "Zlib_jll", "nghttp2_jll"]
uuid = "deac9b47-8bc7-5906-a0fe-35ac56dc84c0"
version = "8.4.0+0"

[[LibGit2]]
deps = ["Base64", "LibGit2_jll", "NetworkOptions", "Printf", "SHA"]
uuid = "76f85450-5226-5b5a-8eaa-529ad045b433"

[[LibGit2_jll]]
deps = ["Artifacts", "LibSSH2_jll", "Libdl", "MbedTLS_jll"]
uuid = "e37daf67-58a4-590a-8e99-b0245dd2ffc5"
version = "1.6.4+0"

[[LibSSH2_jll]]
deps = ["Artifacts", "Libdl", "MbedTLS_jll"]
uuid = "29816b5a-b9ab-546f-933c-edad1886dfa8"
version = "1.11.0+1"

[[Libdl]]
uuid = "8f399da3-3557-5675-b5ff-fb832c97cbdb"

[[LinearAlgebra]]
deps = ["Libdl", "OpenBLAS_jll", "libblastrampoline_jll"]
uuid = "37e2e46d-f89d-539d-b4ee-838fcccc9c8e"

[[Logging]]
uuid = "56ddb016-857b-54e1-b83d-db4d58db5568"

[[MIMEs]]
git-tree-sha1 = "65f28ad4b594aebe22157d6fac869786a255b7eb"
uuid = "6c6e2e6c-3030-632d-7369-2d6c69616d65"
version = "0.1.4"

[[Markdown]]
deps = ["Base64"]
uuid = "d6f4376e-aef5-505a-96c1-9c027394607a"

[[MbedTLS_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "c8ffd9c3-330d-5841-b78e-0817d7145fa1"
version = "2.28.2+1"

[[Mmap]]
uuid = "a63ad114-7e13-5084-954f-fe012c677804"

[[MozillaCACerts_jll]]
uuid = "14a3606d-f60d-562e-9121-12d972cd8159"
version = "2023.1.10"

[[NetworkOptions]]
uuid = "ca575930-c2e3-43a9-ace4-1e988b2c1908"
version = "1.2.0"

[[OpenBLAS_jll]]
deps = ["Artifacts", "CompilerSupportLibraries_jll", "Libdl"]
uuid = "4536629a-c528-5b80-bd46-f80d51c5b363"
version = "0.3.23+4"

[[Parsers]]
deps = ["Dates", "PrecompileTools", "UUIDs"]
git-tree-sha1 = "8489905bcdbcfac64d1daa51ca07c0d8f0283821"
uuid = "69de0a69-1ddd-5017-9359-2bf0b02dc9f0"
version = "2.8.1"

[[Pkg]]
deps = ["Artifacts", "Dates", "Downloads", "FileWatching", "LibGit2", "Libdl", "Logging", "Markdown", "Printf", "REPL", "Random", "SHA", "Serialization", "TOML", "Tar", "UUIDs", "p7zip_jll"]
uuid = "44cfe95a-1eb2-52ea-b672-e2afdf69b78f"
version = "1.10.0"

[[PlutoUI]]
deps = ["AbstractPlutoDingetjes", "Base64", "ColorTypes", "Dates", "FixedPointNumbers", "Hyperscript", "HypertextLiteral", "IOCapture", "InteractiveUtils", "JSON", "Logging", "MIMEs", "Markdown", "Random", "Reexport", "URIs", "UUIDs"]
git-tree-sha1 = "bd7c69c7f7173097e7b5e1be07cee2b8b7447f51"
uuid = "7f904dfe-b85e-4ff6-b463-dae2292396a8"
version = "0.7.54"

[[PrecompileTools]]
deps = ["Preferences"]
git-tree-sha1 = "03b4c25b43cb84cee5c90aa9b5ea0a78fd848d2f"
uuid = "aea7be01-6a6a-4083-8856-8a6e6704d82a"
version = "1.2.0"

[[Preferences]]
deps = ["TOML"]
git-tree-sha1 = "00805cd429dcb4870060ff49ef443486c262e38e"
uuid = "21216c6a-2e73-6563-6e65-726566657250"
version = "1.4.1"

[[Printf]]
deps = ["Unicode"]
uuid = "de0858da-6303-5e67-8744-51eddeeeb8d7"

[[REPL]]
deps = ["InteractiveUtils", "Markdown", "Sockets", "Unicode"]
uuid = "3fa0cd96-eef1-5676-8a61-b3b8758bbffb"

[[Random]]
deps = ["SHA"]
uuid = "9a3f8284-a2c9-5f02-9a11-845980a1fd5c"

[[Reexport]]
git-tree-sha1 = "45e428421666073eab6f2da5c9d310d99bb12f9b"
uuid = "189a3867-3050-52da-a836-e630ba90ab69"
version = "1.2.2"

[[SHA]]
uuid = "ea8e919c-243c-51af-8825-aaa63cd721ce"
version = "0.7.0"

[[Serialization]]
uuid = "9e88b42a-f829-5b0c-bbe9-9e923198166b"

[[Sockets]]
uuid = "6462fe0b-24de-5631-8697-dd941f90decc"

[[SparseArrays]]
deps = ["Libdl", "LinearAlgebra", "Random", "Serialization", "SuiteSparse_jll"]
uuid = "2f01184e-e22b-5df5-ae63-d93ebab69eaf"
version = "1.10.0"

[[Statistics]]
deps = ["LinearAlgebra", "SparseArrays"]
uuid = "10745b16-79ce-11e8-11f9-7d13ad32a3b2"
version = "1.10.0"

[[SuiteSparse_jll]]
deps = ["Artifacts", "Libdl", "libblastrampoline_jll"]
uuid = "bea87d4a-7f5b-5778-9afe-8cc45184846c"
version = "7.2.1+1"

[[TOML]]
deps = ["Dates"]
uuid = "fa267f1f-6049-4f14-aa54-33bafae1ed76"
version = "1.0.3"

[[Tar]]
deps = ["ArgTools", "SHA"]
uuid = "a4e569a6-e804-4fa4-b0f3-eef7a1d5b13e"
version = "1.10.0"

[[Test]]
deps = ["InteractiveUtils", "Logging", "Random", "Serialization"]
uuid = "8dfed614-e22c-5e08-85e1-65c5234f0b40"

[[Tricks]]
git-tree-sha1 = "eae1bb484cd63b36999ee58be2de6c178105112f"
uuid = "410a4b4d-49e4-4fbc-ab6d-cb71b17b3775"
version = "0.1.8"

[[URIs]]
git-tree-sha1 = "67db6cc7b3821e19ebe75791a9dd19c9b1188f2b"
uuid = "5c2747f8-b7ea-4ff2-ba2e-563bfd36b1d4"
version = "1.5.1"

[[UUIDs]]
deps = ["Random", "SHA"]
uuid = "cf7118a7-6976-5b1a-9a39-7adc72f591a4"

[[Unicode]]
uuid = "4ec0a83e-493e-50e2-b9ac-8f72acf5a8f5"

[[Zlib_jll]]
deps = ["Libdl"]
uuid = "83775a58-1f1d-513f-b197-d71354ab007a"
version = "1.2.13+1"

[[libblastrampoline_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "8e850b90-86db-534c-a0d3-1478176c7d93"
version = "5.11.0+0"

[[nghttp2_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "8e850ede-7688-5339-a07c-302acd2aaf8d"
version = "1.52.0+1"

[[p7zip_jll]]
deps = ["Artifacts", "Libdl"]
uuid = "3f19e933-33d8-53b3-aaab-bd5110c3b7a0"
version = "17.4.0+2"
"""

# ╔═╡ Cell order:
# ╟─97914842-76d2-11eb-0c48-a7eedca870fb
# ╠═571613a1-6b4b-496d-9a68-aac3f6a83a4b
# ╟─168e13f7-2ff2-4207-be56-e57755041d36
# ╟─ea39c63f-7466-4015-a66c-08bd9c716343
# ╟─8b082f9a-073e-4112-9422-4087850fc89e
# ╟─d70a3a02-ef3a-450f-bf5a-4a0d7f6262e2
# ╟─10cf6ed1-8276-4a4a-ad06-097d10335512
# ╠═d967cdf9-3df9-40bb-9b08-09cae95a5ca7
# ╟─858745a9-cd59-43a6-a296-803515518e57
# ╠═21a9e3e6-92f4-475d-9c8e-21e15c09336b
# ╟─4a3398be-ee86-45f3-ac8b-f627a38c00b8
# ╠═2d5fd611-284b-4428-b6a5-8909203990b9
# ╠═82de4674-9ecc-46c4-8a57-0b4453c579c3
# ╟─70a415be-881a-4c01-9f8c-635b8b89e1ad
# ╠═730a692f-2bf2-4d5b-86da-6ab861e8b8ac
# ╟─a45fdec4-2d4b-429b-b809-4c256b57fffe
# ╠═c68ebd7b-5fb6-4527-ac34-33f9730e4587
# ╟─8c03139f-a94b-40cc-859f-0d86f1c72143
# ╠═d8dcb044-0ac8-46d1-a043-1073bb6d1ff1
# ╠═bf592202-a9a4-4e9b-8433-fed55e3aa3bc
# ╟─e7d3db79-8253-4cbd-9832-5afb7dff0abf
# ╟─5ac5b984-8c02-4b8d-a342-d0f05f7909ec
# ╠═ef28eb8d-ec98-43e5-9012-3338c3b84f1b
# ╠═1ba370cc-3631-47ea-9db5-75587e8e4ff3
# ╠═7fcf2f3f-d902-4338-adf0-8ef181e79420
# ╟─7afbf8ef-e91c-45b9-bf22-24201cbb4828
# ╠═b226da72-9512-4d14-8582-2f7787c25028
# ╠═a6fd1f7b-a8fc-420d-a8bb-9f549842ad3e
# ╟─965f3660-6ec4-4a86-a2a2-c167dbe9315f
# ╠═01ce31a9-6856-4ee7-8bce-7ce635167457
# ╠═00d97588-d591-4dad-9f7d-223c237deefd
# ╠═21f57310-9ceb-423c-a9ce-5beb1060a5a3
# ╟─94561cb1-2325-49b6-8b22-943923fdd91b
# ╟─0866afc2-fd42-42b7-a572-9d824cf8b83b
# ╟─75e1a973-7ef0-4ac5-b3e2-5edb63577927
# ╠═e8d8a60e-489b-467a-b49c-1fa844807751
# ╟─b0c246ed-b871-461b-9541-280e49b49136
# ╠═9346d8e2-9ba0-4475-a21f-11bdd018bc60
# ╠═7822fdb7-bee6-40cc-a089-56bb32d77fe6
# ╟─701de4b8-42d3-46a3-a399-d7761dccd83d
# ╟─88120468-a43d-4d58-ac04-9cc7c86ca179
# ╠═ea4b2da1-4c83-4a1f-8fc3-c71a120e58e1
# ╟─08bdeaff-5bfb-49ab-b4cc-3a3446c63edc
# ╟─9b6b5da9-8372-4ebf-9c66-ae9fcfc45d47
# ╟─f18b98f7-1e0f-4273-896f-8a667d15605b
# ╟─d83d57e2-4787-4b8d-8669-64ed73d79e73
# ╟─077c95cf-2a1b-459f-830e-c29c11a2c5cc
# ╟─80511436-e41f-4913-8a30-d9e113cfaf71
# ╟─8388a833-d535-4cbd-a27b-de323cea60e8
# ╟─4cf27df3-6a69-402e-a71c-26538b2a52e7
# ╟─5721ad33-a51a-4a91-adb2-0915ea0efa13
# ╠═c857bb4b-4cf4-426e-b340-592cf7700434
# ╟─d121e085-c69b-490f-b315-c11a9abd57a6
# ╟─fc8984c8-4668-418a-b258-a1718809470c
# ╠═846354c8-ba3b-4be7-926c-d3c9cc9add5f
# ╟─a33c7d7a-8071-448e-abd6-4e38b5444a3a
# ╠═91f3dab8-5521-44a0-9890-8d988a994076
# ╠═dcaae662-4a4f-4dd3-8763-89ea9eab7d43
# ╟─d4bdc4fe-2af8-402f-950f-2afaf77c62de
# ╟─e77cfefc-429d-49db-8135-f4604f6a9f0b
# ╠═2d5689f5-1d63-4b8b-a103-da35933ad26e
# ╠═6dd221d1-7fd8-446e-aced-950512ea34bc
# ╠═0a9d6e2d-3a41-4cd5-9a4e-a9b76ed89fa9
# ╟─0962d456-1a76-4b0d-85ff-c9e7dc66621d
# ╠═bf9b36e8-14c5-477b-a54b-35ba8e415c77
# ╟─e910982c-8508-4729-a75d-8b5b847918b6
# ╟─781adedc-2da7-4394-b323-e508d614afae
# ╟─de789ad1-8197-48ae-81b2-a21ec2340ae0
# ╠═85483b28-341e-4ed6-bb1e-66c33613725e
# ╠═9e37c18c-3ebb-443a-9663-bb4064391d6e
# ╟─05d28aa2-9622-4e62-ab39-ca4c7dde6eb4
# ╠═3266f9e6-42ad-4103-8db3-b87d2c315290
# ╟─7d9d6c28-131a-4b2a-84f8-5c085f387e85
# ╟─ebec177c-4c33-45a4-bdbd-f16944631aff
# ╟─da7091f5-8ba2-498b-aa8d-bbf3b4505b81
# ╠═64cbf19c-a4e3-4cdb-b4ec-1fbe24be55ad
# ╟─cc318a19-316f-4fd9-8436-fb1d42f888a3
# ╟─7aacdd8c-1571-4461-ba6e-0fd65dd8d788
# ╟─00000000-0000-0000-0000-000000000001
# ╟─00000000-0000-0000-0000-000000000002
