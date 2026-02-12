### A Pluto.jl notebook ###
# v0.19.9

using Markdown
using InteractiveUtils

# ╔═╡ 092c4b11-8b75-446f-b3ad-01fa858daebb
# ╠═╡ show_logs = false
# ╠═╡ skip_as_script = true
#=╠═╡
# Only define this in Pluto using skip_as_script = true
begin
	import Pkg
	Pkg.activate(mktempdir())
	Pkg.add(Pkg.PackageSpec(name="PlutoTest"))
	using PlutoTest
end
  ╠═╡ =#

# ╔═╡ 058a3333-0567-43b7-ac5f-1f6688325a08
begin
	"""
	Mark an instance of a custom struct as immutable. The resulting object is also an `AbstractDict`, where the keys are the struct fields (converted to strings).
	"""
	struct ImmutableMarker{T} <: AbstractDict{String,Any}
		source::T
	end

	
	function Base.getindex(ldict::ImmutableMarker, key::String)
	    Base.getfield(ldict.source, Symbol(key))
	end
	# disabled because it's immutable!
	# Base.setindex!(ldict::ImmutableMarker, args...) = Base.setindex!(ldict.source, args...)
	# Base.delete!(ldict::ImmutableMarker, args...) = Base.delete!(ldict.source, args...)
	Base.keys(ldict::ImmutableMarker{T}) where T = String.(fieldnames(T))
	# Base.values(ldict::ImmutableMarker) = Base.values(ldict.source)
	Base.length(ldict::ImmutableMarker) = nfields(ldict.source)
	Base.iterate(ldict::ImmutableMarker) = Base.iterate(ldict, 1)
	function Base.iterate(ldict::ImmutableMarker{T}, i) where T
		a = ldict.source
		
		if i <= nfields(a)
			name = fieldname(T, i)
			(String(name) => getfield(a, name), i + 1)
		end
	end
	function Base.show(io::IO, t::ImmutableMarker)
		print(io, typeof(t), "(")
		show(io, t.source)
		print(io, ")")
	end
end

# ╔═╡ 55975e53-f70f-4b70-96d2-b144f74e7cde
# ╠═╡ skip_as_script = true
#=╠═╡
struct A
	x
	y
	z
end
  ╠═╡ =#

# ╔═╡ d7e0de85-5cb2-4036-a2e3-ca416ea83737
#=╠═╡
id1 = ImmutableMarker(A(1,"asdf",3))
  ╠═╡ =#

# ╔═╡ 08350326-526e-4c34-ab27-df9fbf69243e
#=╠═╡
id2 = ImmutableMarker(A(1,"asdf",4))
  ╠═╡ =#

# ╔═╡ aa6192e8-410f-4924-8250-4775e21b1590
#=╠═╡
id1d, id2d = Dict(id1), Dict(id2)
  ╠═╡ =#

# ╔═╡ 273c7c85-8178-44a7-99f0-581754aeb8c8
begin
	"""
	Mark a vector as being append-only: let Firebasey know that it can diff this array simply by comparing lengths, without looking at its contents.

	It was made specifically for logs: Logs are always appended, OR the whole log stream is reset. AppendonlyMarker is like SubArray (a view into another array) except we agree to only ever append to the source array. This way, firebase can just look at the index and diff based on that.
	"""
	struct AppendonlyMarker{T} <: AbstractVector{T}
		mutable_source::Vector{T}
		length_at_time_of_creation::Int
	end
	AppendonlyMarker(arr::Vector) = AppendonlyMarker(arr, length(arr))
	
	# We use a view here to ensure that if the source array got appended after creation, those newer elements are not accessible.
	_contents(a::AppendonlyMarker) = view(a.mutable_source, 1:a.length_at_time_of_creation)
	
	# Poor mans vector-proxy
	# I think this is enough for Pluto to show, and for msgpack to pack
	Base.size(arr::AppendonlyMarker) = Base.size(_contents(arr))
	Base.getindex(arr::AppendonlyMarker, index::Int) = Base.getindex(_contents(arr), index)
	Base.iterate(arr::AppendonlyMarker, args...) = Base.iterate(_contents(arr), args...)
end

# ╔═╡ ef7032d1-a666-48a6-a56e-df175f5ed832
# ╠═╡ skip_as_script = true
#=╠═╡
md"""
## ImmutableMarker
"""
  ╠═╡ =#

# ╔═╡ 183cef1f-bfe9-42cd-8239-49e9ed00a7b6
# ╠═╡ skip_as_script = true
#=╠═╡
md"""
## AppendonlyMarker(s)

Example of how to solve performance problems with Firebasey:
We make a new type with a specific diff function.
It might be very specific per problem, but that's fine for performance problems (I think).
It also keeps the performance solutions as separate modules/packages to whatever it is you're actually modeling.
"""
  ╠═╡ =#

# ╔═╡ 35d3bcd7-af51-466a-b4c4-cc055e74d01d
# ╠═╡ skip_as_script = true
#=╠═╡
appendonly_1, appendonly_2 = let
	array_1 = [1,2,3,4]
	appendonly_1 = AppendonlyMarker(array_1)
	push!(array_1, 5)
	appendonly_2 = AppendonlyMarker(array_1)

	appendonly_1, appendonly_2
end;
  ╠═╡ =#

# ╔═╡ 1017f6cc-58ac-4c7b-a6d0-a03f5e387f1b
# ╠═╡ skip_as_script = true
#=╠═╡
appendonly_1_large, appendonly_2_large = let
	large_array_1 = [
		Dict{String,Any}(
			"x" => 1,
			"y" => [1,2,3,4],
			"z" => "hi",
		)
		for i in 1:10000
	];
	appendonly_1 = AppendonlyMarker(large_array_1)
	push!(large_array_1, Dict("x" => 5))
	appendonly_2 = AppendonlyMarker(large_array_1)

	appendonly_1, appendonly_2
end;
  ╠═╡ =#

# ╔═╡ 06492e8d-4500-4efe-80ee-55bf1ee2348c
#=╠═╡
@test length([AppendonlyMarker([1,2,3])...]) == 3
  ╠═╡ =#

# ╔═╡ 2284ae12-5b8c-4542-81fa-c4d34f2483e7
# @test length([AppendonlyMarker([1,2,3], 1)...]) == 1

# ╔═╡ dc5cd268-9cfb-49bf-87fb-5b7db4fa6e3c
# ╠═╡ skip_as_script = true
#=╠═╡
md"## Import Firebasey when running inside notebook"
  ╠═╡ =#

# ╔═╡ 0c2f23d8-8e98-47b7-9c4f-5daa70a6c7fb
# OH how I wish I would put in the time to refactor with fromFile or SOEMTGHINLAS LDKJ JULIA WHY ARE YOU LIKE THIS GROW UP
if !@isdefined(Firebasey)
	Firebasey = let
		wrapper_module = Module()
		Core.eval(wrapper_module, :(module Firebasey
				include("Firebasey.jl")
			end
		))
		wrapper_module.Firebasey
	end
end

# ╔═╡ 2903d17e-c6fd-4cea-8585-4db26a00b0e7
function Firebasey.diff(a::AppendonlyMarker, b::AppendonlyMarker)
	if a.mutable_source !== b.mutable_source
		[Firebasey.ReplacePatch([], b)]
	else
		if a.length_at_time_of_creation > b.length_at_time_of_creation
			throw(ErrorException("Not really supposed to diff AppendonlyMarker with the original being longer than the next version (you know, 'append only' and al)"))
		end
		
		map(a.length_at_time_of_creation+1:b.length_at_time_of_creation) do index
			Firebasey.AddPatch([index], b.mutable_source[index])
		end
	end
end

# ╔═╡ 129dee79-61c0-4524-9bef-388837f035bb
function Firebasey.diff(a::ImmutableMarker, b::ImmutableMarker)
	if a.source !== b.source
		Firebasey.diff(Dict(a), Dict(b))
		# Firebasey.JSONPatch[Firebasey.ReplacePatch([], b)]
	else
		Firebasey.JSONPatch[]
	end
end

# ╔═╡ 138d2cc2-59ba-4f76-bf66-ecdb98cf4fd5
#=╠═╡
Firebasey.diff(id1, id2)
  ╠═╡ =#

# ╔═╡ 8537488d-2ff9-42b7-8bfc-72d43fca713f
#=╠═╡
@test Firebasey.diff(appendonly_1, appendonly_2) == [Firebasey.AddPatch([5], 5)]
  ╠═╡ =#

# ╔═╡ 721e3c90-15ae-43f2-9234-57b38e3e6b69
# ╠═╡ skip_as_script = true
#=╠═╡
md"""
## Track
"""
  ╠═╡ =#

# ╔═╡ e830792c-c809-4fde-ae55-8ae01b4c04b9
# ╠═╡ skip_as_script = true
#=╠═╡
function prettytime(time_ns::Number)
    suffices = ["ns", "μs", "ms", "s"]
	
	current_amount = time_ns
	suffix = ""
	for current_suffix in suffices
    	if current_amount >= 1000.0
        	current_amount = current_amount / 1000.0
		else
			suffix = current_suffix
			break
		end
	end
    
    # const roundedtime = time_ns.toFixed(time_ns >= 100.0 ? 0 : 1)
	roundedtime = if current_amount >= 100.0
		round(current_amount; digits=0)
	else
		round(current_amount; digits=1)
	end
    return "$(roundedtime) $(suffix)"
end
  ╠═╡ =#

# ╔═╡ 16b03608-0f5f-421a-bab4-89365528b0b4
# ╠═╡ skip_as_script = true
#=╠═╡
begin
    Base.@kwdef struct Tracked
		expr
		value
		time
		bytes
		times_ran = 1
		which = nothing
		code_info = nothing
    end
    function Base.show(io::IO, mime::MIME"text/html", value::Tracked)
	times_ran = if value.times_ran === 1
		""
	else
		"""<span style="opacity: 0.5"> ($(value.times_ran)×)</span>"""
	end
	# method = sprint(show, MIME("text/plain"), value.which)
	code_info = if value.code_info ≠ nothing
		codelength = length(value.code_info.first.code)
		"$(codelength) frames in @code_typed"
	else
		""
	end
	color = if value.time > 1
		"red"
	elseif value.time > 0.001
		"orange"
	elseif value.time > 0.0001
		"blue"
	else
		"green"
	end
		
	
	show(io, mime, HTML("""
		<div
			style="
				display: flex;
				flex-direction: row;
				align-items: center;
			"
		>
			<div
				style="
					width: 12px;
					height: 12px;
					border-radius: 50%;
					background-color: $(color);
				"
			></div>
			<div style="width: 12px"></div>
			<div>
				<code
					class="language-julia"
					style="
						background-color: transparent;
						filter: grayscale(1) brightness(0.8);
					"
				>$(value.expr)</code>
				<div style="
					font-family: monospace;
					font-size: 12px;
					color: $(color);
				">
					$(prettytime(value.time * 1e9 / value.times_ran))
					$(times_ran)
				</div>
				<div style="
					font-family: monospace;
					font-size: 12px;
					color: gray;
				">$(code_info)</div>

			</div>
			
		</div>
	"""))
    end
	Tracked
end
  ╠═╡ =#

# ╔═╡ 875fd249-37cc-49da-8a7d-381fe0e21063
#=╠═╡
macro track(expr)
	times_ran_expr = :(1)
	expr_to_show = expr
	if expr.head == :for
		@assert expr.args[1].head == :(=)
		times_ran_expr = expr.args[1].args[2]
		expr_to_show = expr.args[2].args[2]
	end

	Tracked # reference so that baby Pluto understands
				
	quote
		local times_ran = length($(esc(times_ran_expr)))
		local value, time, bytes = @timed $(esc(expr))
		
		local method = nothing
		local code_info = nothing
		try
			# Uhhh
			method = @which $(expr_to_show)
			code_info = @code_typed $(expr_to_show)
		catch nothing end
		Tracked(
			expr=$(QuoteNode(expr_to_show)),
			value=value,
			time=time,
			bytes=bytes,
			times_ran=times_ran,
			which=method,
			code_info=code_info
		)
	end
end
  ╠═╡ =#

# ╔═╡ a5f43f47-6189-413f-95a0-d98f927bb7ce
#=╠═╡
@track for _ in 1:1000 Firebasey.diff(id1, id1) end
  ╠═╡ =#

# ╔═╡ ab5089cc-fec8-43b9-9aa4-d6fa96e231e0
#=╠═╡
@track for _ in 1:1000 Firebasey.diff(id1d, id1d) end
  ╠═╡ =#

# ╔═╡ a84dcdc3-e9ed-4bf5-9bec-c9cbfc267c17
#=╠═╡
@track for _ in 1:1000 Firebasey.diff(id1, id2) end
  ╠═╡ =#

# ╔═╡ f696bb85-0bbd-43c9-99ea-533816bc8e0d
#=╠═╡
@track for _ in 1:1000 Firebasey.diff(id1d, id2d) end
  ╠═╡ =#

# ╔═╡ 37fe8c10-09f0-4f72-8cfd-9ce044c78c13
#=╠═╡
@track for _ in 1:1000 Firebasey.diff(appendonly_1_large, appendonly_2_large) end
  ╠═╡ =#

# ╔═╡ 9862ee48-48a0-4178-8ec4-306792827e17
#=╠═╡
@track sleep(0.1)
  ╠═╡ =#

# ╔═╡ Cell order:
# ╟─ef7032d1-a666-48a6-a56e-df175f5ed832
# ╠═058a3333-0567-43b7-ac5f-1f6688325a08
# ╠═129dee79-61c0-4524-9bef-388837f035bb
# ╠═55975e53-f70f-4b70-96d2-b144f74e7cde
# ╠═d7e0de85-5cb2-4036-a2e3-ca416ea83737
# ╠═08350326-526e-4c34-ab27-df9fbf69243e
# ╠═138d2cc2-59ba-4f76-bf66-ecdb98cf4fd5
# ╠═aa6192e8-410f-4924-8250-4775e21b1590
# ╟─a5f43f47-6189-413f-95a0-d98f927bb7ce
# ╟─ab5089cc-fec8-43b9-9aa4-d6fa96e231e0
# ╟─a84dcdc3-e9ed-4bf5-9bec-c9cbfc267c17
# ╟─f696bb85-0bbd-43c9-99ea-533816bc8e0d
# ╟─183cef1f-bfe9-42cd-8239-49e9ed00a7b6
# ╠═273c7c85-8178-44a7-99f0-581754aeb8c8
# ╠═2903d17e-c6fd-4cea-8585-4db26a00b0e7
# ╠═35d3bcd7-af51-466a-b4c4-cc055e74d01d
# ╠═1017f6cc-58ac-4c7b-a6d0-a03f5e387f1b
# ╟─06492e8d-4500-4efe-80ee-55bf1ee2348c
# ╠═2284ae12-5b8c-4542-81fa-c4d34f2483e7
# ╟─8537488d-2ff9-42b7-8bfc-72d43fca713f
# ╟─37fe8c10-09f0-4f72-8cfd-9ce044c78c13
# ╟─dc5cd268-9cfb-49bf-87fb-5b7db4fa6e3c
# ╠═0c2f23d8-8e98-47b7-9c4f-5daa70a6c7fb
# ╠═092c4b11-8b75-446f-b3ad-01fa858daebb
# ╟─721e3c90-15ae-43f2-9234-57b38e3e6b69
# ╟─9862ee48-48a0-4178-8ec4-306792827e17
# ╟─16b03608-0f5f-421a-bab4-89365528b0b4
# ╟─875fd249-37cc-49da-8a7d-381fe0e21063
# ╟─e830792c-c809-4fde-ae55-8ae01b4c04b9
