
> # Install Pluto
> Installing Pluto is easy! Start **Julia**, and run:
> ```julia
> import Pluto
> Pluto.run()
> ```
> See [plutojl.org/#install](https://plutojl.org/#install) for a complete guide to install Julia and Pluto!

<br>
<br>
<br>
<br>
<br>
<br>
<br>



<h1><img alt="Pluto.jl" src="https://raw.githubusercontent.com/JuliaPluto/Pluto.jl/dd0ead4caa2d29a3a2cfa1196d31e3114782d363/frontend/img/logo_white_contour.svg" width=300 height=74 ></h1>

_Writing a notebook is not just about writing the final document — Pluto empowers the experiments and discoveries that are essential to getting there._

**Explore models and share results** in a notebook that is:

- **_reactive_** - when changing a function or variable, Pluto automatically updates all affected cells.
- **_lightweight_** - Pluto is written in pure Julia and is easy to install.
- **_simple_** - no hidden workspace state; friendly UI.


<p align="center"><a href="https://binder.plutojl.org/">🎈 <b>Pluto demo</b> inside your browser 🎈</a></p>


<img alt="reactivity screencap" src="https://raw.githubusercontent.com/JuliaPluto/Pluto.jl/580ab811f13d565cc81ebfa70ed36c84b125f55d/demo/plutodemo.gif" >




### Input

A Pluto notebook is made up of small blocks of Julia code (_cells_) and together they form a [**_reactive_** notebook](https://medium.com/@mbostock/a-better-way-to-code-2b1d2876a3a0) (using other languages, e.g. Python is indirectly possible).
When you change a variable, Pluto automatically re-runs the cells that refer to it. Cells can even be placed in arbitrary order - intelligent syntax analysis figures out the dependencies between them and takes care of execution.

Cells can contain _arbitrary_ Julia code, and you can use external libraries. There are no code rewrites or wrappers, Pluto just looks at your code once before evaluation.

### Output

Your notebooks are **saved as pure Julia files** ([sample](https://github.com/JuliaPluto/Pluto.jl/blob/main/sample/Basic.jl)), which you can then import as if you had been programming in a regular editor all along. You can also export your notebook with cell outputs as attractive HTML and PDF documents. By reordering cells and hiding code, you have full control over how you tell your story.

<br >

<p align="center"><a href="https://www.youtube.com/watch?v=IAF8DjrQSSk">🎈 Pluto – introduction (20 min) at <b>Juliacon 2020</b> 🎈</a></p>

<br>
<p align="center"><a href="https://www.youtube.com/watch?v=HiI4jgDyDhY">🌐 Pluto – one year later (25 min) at <b>Juliacon 2021</b> 🌐</a></p>

<br>
<p align="center"><a href="https://www.youtube.com/watch?v=Rg3r3gG4nQo">🪐 Pluto – reactive and reproducible (25 min) at <b>JupyterCon 2023</b> 🪐</a></p>

<br>


## Dynamic environment

Pluto offers an environment where changed code takes effect instantly and where deleted code leaves no trace.
Unlike Jupyter or Matlab, there is **no mutable workspace**, but rather, an important guarantee:

<blockquote align="center"><em><b>At any instant</b>, the program state is <b>completely described</b> by the code you see.</em></blockquote>
No hidden state, no hidden bugs.

### Interactivity

Your programming environment becomes interactive by splitting your code into multiple cells! Changing one cell **instantly shows effects** on all other cells, giving you a fast and fun way to experiment with your model.

In the example below, changing the parameter `A` and running the first cell will directly re-evaluate the second cell and display the new plot.

<img alt="Example of interactive ODE" src="https://github.com/user-attachments/assets/a31840fe-1f6f-4849-8d7e-8e78a9a142aa" width="50%">

<br >

### Built-in package manager

Pluto uses syntax analysis to understand which packages are being used in a notebook, and it **automatically manages a package environment** for your notebook. You no longer need to install packages, you can directly import any registered package like `Plots` or `DataFrames` and use it.

To ensure reproducibility, the information to exactly reproduce the package environment is **stored in your notebook file**. When someone else opens your notebook with Pluto, the exact same package environment will be used, and packages will work on their computer, automatically! _[more info](https://plutojl.org/pkg/)_

<img alt="package manager screencap" src="https://user-images.githubusercontent.com/6933510/134823403-fbb79d7f-dd3e-4712-b5d5-b48ad0770f13.gif" width="50%">

<br >

### Interactivity with `@bind`

Lastly, here's _**one more feature**_: Pluto notebooks have a `@bind` macro to create a **live bond between an browser widget and a Julia variable**. Combined with reactivity, this is a very powerful tool!

<img alt="bind macro example where moving a slider changes the value of a variable, and a value that is computed from the variable" src="https://github.com/user-attachments/assets/06286537-fff3-4cef-aafb-036a4a0ea1f5" width="50%">

<br >

The [PlutoUI package](https://github.com/JuliaPluto/PlutoUI.jl) contains basic inputs like sliders, buttons, and much more! [Read the docs →](https://featured.plutojl.org/basic/plutoui.jl)

> For those who want to dive deeper - you can use Julia, HTML, JavaScript and CSS to write your own widgets! [Learn more →](https://plutojl.org/en/docs/advanced-widgets/)

<br >

## Pluto for teaching

Pluto was developed alongside the free online course [Introduction to Computational Thinking](https://computationalthinking.mit.edu/) at MIT, with the goal of creating a programming environment that is powerful, helpful and interactive, without being too intimidating for students and teachers. 

Are you interested in using Pluto for your class? Here are some presentations by people who are using it already: [the MIT team](https://www.youtube.com/watch?v=LFRI3s0DE-o), [Gerhard Dorn](https://www.youtube.com/watch?v=6Qs5EXDpZBI), [Daniel Molina](https://www.youtube.com/watch?v=NrIxgnFXslg), [Henki W. Ashadi](https://youtu.be/GnEKgW23PvY?t=586) and [Max Köhler](https://www.youtube.com/watch?v=8H5KgSIWsWQ).

[**Learn more →**](https://plutojl.org/en/docs/education/)

https://user-images.githubusercontent.com/6933510/134824521-7cefa38a-7102-4767-bee4-777caf30ba47.mp4

_([video](https://www.youtube.com/watch?v=rpB6zQNsbQU)) Grant Sanderson ([3Blue1Brown](https://www.youtube.com/channel/UCYO_jab_esuFRV4b17AJtAw)) using Pluto's interactivity to teach [Computational Thinking at MIT](https://computationalthinking.mit.edu/)!_

<br >
<hr >
<hr >
<hr >
<br >

# Let's do it!

See [plutojl.org/#install](https://plutojl.org/#install) for an easy guide to install Pluto!

## Questions and Help

Questions? Have a look at the [FAQ](https://github.com/JuliaPluto/Pluto.jl/wiki) and the [documentation](https://plutojl.org).
<br>
<br>
<br>
<blockquote>
<img align="right" src=https://upload.wikimedia.org/wikipedia/commons/0/0c/MIT_logo.svg height="60px">
<p><em>Interested in learning Julia, Pluto and applied mathematics?</em> Join the <strong>open MIT course</strong> taught by <strong>Alan Edelman</strong>, <strong>David P. Sanders</strong> &amp; Grant Sanderson (<strong>3blue1brown</strong>) (<em>and a bit of me</em>): <a href="https://computationalthinking.mit.edu" rel="nofollow">Introduction to Computational Thinking</a>, Spring 2021.
<br></p>
</blockquote>
<br>

Since Pluto notebooks are Julia source code, that's the only language directly supported, but others can be used, e.g. Python with PythonCall.jl, and ClojureScript with [Cljuto.jl](https://github.com/kiranshila/Cljuto.jl).

## Contribute to Pluto

Follow [these instructions](https://github.com/JuliaPluto/Pluto.jl/blob/main/CONTRIBUTING.md) to start working on the package.

<img src="https://raw.githubusercontent.com/gist/fonsp/9a36c183e2cad7c8fc30290ec95eb104/raw/ca3a38a61f95cd58d79d00b663a3c114d21e284e/cute.svg">

## License

Pluto.jl is open source! Specifically, it is [MIT Licensed](https://github.com/JuliaPluto/Pluto.jl/blob/main/LICENSE). Pluto.jl is built by gluing together open source software:

-   `Julia` - [license](https://github.com/JuliaLang/julia/blob/master/LICENSE.md)
-   `CodeMirror` - [license](https://github.com/codemirror/codemirror.next/blob/master/LICENSE-MIT)
-   `HTTP.jl` - [license](https://github.com/JuliaWeb/HTTP.jl/blob/master/LICENSE.md)
-   `MsgPack.jl` - [license](https://github.com/JuliaIO/MsgPack.jl)
-   `msgpack-lite` - [license](https://github.com/kawanet/msgpack-lite/blob/master/LICENSE)
-   `observablehq/stdlib` - [license](https://github.com/observablehq/stdlib/blob/master/LICENSE)
-   `preact` - [license](https://github.com/preactjs/preact/blob/master/LICENSE)
-   `developit/htm` - [license](https://github.com/developit/htm/blob/master/LICENSE)
-   `MathJax` - [license](https://github.com/mathjax/MathJax-src/blob/master/LICENSE)

If you want to reference Pluto.jl in scientific writing, you can use our DOI: [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.4792401.svg)](https://doi.org/10.5281/zenodo.4792401)

### Featured notebooks

Unless otherwise specified, the included featured notebooks have a more permissive license: the [Unlicense](https://github.com/JuliaPluto/Pluto.jl/blob/main/sample/LICENSE). This means that you can use them however you like - you do not need to credit us! 

Your notebook files are _yours_, you also do not need to credit us. Have fun!

## From the authors

The Pluto project is an ambition to [_rethink what a programming environment should be_](http://worrydream.com/#!/LearnableProgramming). We believe that scientific computing can be a lot simpler and more accessible. If you feel the same, give Pluto a try! We would love to hear what you think. 😊

### You can chat with us

-   talk with fellow Pluto users in the **[Zulip chat room](https://gist.github.com/fonsp/db7d00fd3fe5bc0b379b4af9ec6674b6)** (_search for the `pluto.jl` stream_)
-   use Pluto's **[built-in feedback system:](https://github.com/JuliaPluto/Pluto.jl/issues/182#issue-637726414)**
-   contact fons **[via email](mailto:fons@plutojl.org)**

<img alt="feedback screencap" src="https://user-images.githubusercontent.com/6933510/84502876-6f08db00-acb9-11ea-84c3-f5daaba29273.png" width="100%">

Questions? Have a look at the [FAQ](https://github.com/JuliaPluto/Pluto.jl/wiki).

## Sponsors

Development of Pluto.jl is partially sponsored by

| | |
|----|----|
| <a href="https://computationalthinking.mit.edu"><img title="Massachusetts Institute of Technology" src="https://user-images.githubusercontent.com/6933510/103308960-09412e00-4a14-11eb-8a3a-39201a9c186d.png" width=400 alt="MIT logo"></a> | The free online course _[Introduction to Computational Thinking](https://computationalthinking.mit.edu)_ at **MIT** uses Pluto notebooks to teach scientific computing in a new way. Homeworks react to the student in realtime, with _live answer checks and visualizations_ while you solve problems. |
| <a href="http://quera-computing.com"><img title="QuEra Computing" src="https://user-images.githubusercontent.com/6933510/103309531-9e90f200-4a15-11eb-850f-99609e3b9bd8.png" width=400 alt="QuEra logo"></a> | **QuEra Computing** uses a Pluto notebook as an online dashboard to control their _quantum computer_! |
| <a href="https://juliahub.com/"><img title="JuliaHub" src="https://i.imgur.com/IGdcVt7.png" width=200 alt="JuliaHub logo"></a> | [**JuliaHub**](https://juliahub.com) enables the creation and editing of Pluto notebooks *on the cloud*! |
| <a href="https://numfocus.org/"><img title="NumFOCUS" src="https://user-images.githubusercontent.com/6933510/110683397-42e4a100-81dc-11eb-9bdb-db58f9c283b4.png" width=400 alt="NumFOCUS logo"></a> | The mission of **NumFOCUS** is to promote open practices in research, data, and scientific computing by serving as a fiscal sponsor for open source projects and organizing community-driven educational programs. |
| <a href="https://biaslab.github.io/"><img src="https://upload.wikimedia.org/wikipedia/commons/6/67/Eindhoven_University_of_Technology_logo_new.svg" alt="TU Eindhoven logo"></a> | Fons works at **TU Eindhoven** to make the course [Bayesian Machine Learning and Information Processing](https://bmlip.nl/) interactive. |

_Created by [**Fons van der Plas**](https://github.com/fonsp), [**Mikołaj Bochenski**](https://github.com/malyvsen) and friends. Inspired by [Observable](https://observablehq.com/)._
