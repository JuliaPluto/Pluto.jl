import REPL: REPL, REPLCompletions
import REPL.REPLCompletions: Completion, BslashCompletion, ModuleCompletion, PropertyCompletion, FieldCompletion, PathCompletion, DictCompletion


function basic_completion_priority((s, description, exported, from_notebook))
	c = first(s)
	if islowercase(c)
		1 - 10exported
	elseif isuppercase(c)
		2 - 10exported
	else
		3 - 10exported
	end
end

completion_value_type_inner(x::Function) = :Function
completion_value_type_inner(x::Number) = :Number
completion_value_type_inner(x::AbstractString) = :String
completion_value_type_inner(x::Module) = :Module
completion_value_type_inner(x::AbstractArray) = :Array
completion_value_type_inner(x::Any) = :Any


function source_module(c::ModuleCompletion)
    if VERSION >= v"1.12.0-a" && is_pluto_workspace(c.parent)
        sym = completion_str_to_symbol(c.mod)
        isdefined(c.parent, sym) ? 
            which(c.parent, sym) : c.parent
    else
        c.parent
    end
end

completion_str_to_symbol(s::String) = endswith(s, "\"") ? Symbol("@$(s[begin:end-1])_str") : Symbol(s)

completion_value_type(c::ModuleCompletion) = try
    completion_value_type_inner(getfield(c.parent, completion_str_to_symbol(c.mod)))::Symbol
catch
    :unknown
end
completion_value_type(::Completion) = :unknown

completion_special_symbol_value(::Completion) = nothing
function completion_special_symbol_value(completion::BslashCompletion)
    s = @static hasfield(BslashCompletion, :bslash) ? completion.bslash : completion.completion
    symbol_dict = startswith(s, "\\:") ? REPLCompletions.emoji_symbols : REPLCompletions.latex_symbols
    get(symbol_dict, s, nothing)
end

function is_pluto_workspace(m::Module)
    isdefined(m, PLUTO_INNER_MODULE_NAME) &&
        which(m, PLUTO_INNER_MODULE_NAME) == m
end

"""
Returns wether the module is a pluto workspace or any of its ancestors is.

For example, writing the following julia code in Pluto:

```julia
import Plots

module A
end
```

will give the following module tree:

```
Main                 (not pluto controlled)
└── var"workspace#1" (pluto controlled)
    └── A            (pluto controlled)
└── var"workspace#2" (pluto controlled)
    └── A            (pluto controlled)
Plots                (not pluto controlled)
```
"""
function is_pluto_controlled(m::Module)
    is_pluto_workspace(m) && return true
    parent = parentmodule(m)
    parent != m && is_pluto_controlled(parent)
end

function completion_exported(c::Completion)
    if c isa ModuleCompletion
        sym = completion_str_to_symbol(c.mod)
        @static if isdefined(Base, :ispublic)
            Base.ispublic(source_module(c), sym)
        else
            Base.isexported(c.parent, sym)
        end
    else
        true
    end
end

function completion_from_notebook(c::ModuleCompletion)
    c.mod != "include" &&
    c.mod != "eval" &&
    !startswith(c.mod, "#") &&
    is_pluto_workspace(source_module(c))
end
completion_from_notebook(c::Completion) = false

completion_type(::REPLCompletions.PathCompletion) = :path
completion_type(::REPLCompletions.DictCompletion) = :dict
completion_type(::REPLCompletions.MethodCompletion) = :method
completion_type(::REPLCompletions.ModuleCompletion) = :module
completion_type(::REPLCompletions.BslashCompletion) = :bslash
completion_type(::REPLCompletions.FieldCompletion) = :field
completion_type(::REPLCompletions.KeywordArgumentCompletion) = :keyword_argument
completion_type(::REPLCompletions.KeywordCompletion) = :keyword
completion_type(::REPLCompletions.PropertyCompletion) = :property
completion_type(::REPLCompletions.Text) = :text
completion_type(::Completion) = :unknown



function completion_contents(c::Completion)
    @static if isdefined(REPLCompletions, :named_completion)
        REPLCompletions.named_completion(c).completion
    else
        REPLCompletions.completion_text(c)
    end
end

is_method_completions_results(results) = length(results) >= 1 && results[1] isa REPLCompletions.MethodCompletion

"You say Linear, I say Algebra!"
function completion_fetcher(query::String, query_full::String, workspace::Module)
    results, loc, found = REPLCompletions.completions(
        query, lastindex(query), workspace
    )

    ## METHODS & KWARGS
    if query != query_full && is_method_completions_results(results)
        # We are doing autocomplete inside a method call.
        # But because query != query_full, we know that we are actually typing something extra
        
        # Try if the full query gives a different result.
        results, loc, found = REPLCompletions.completions(
            query_full, lastindex(query_full), workspace
        )

        # If they give a keywordargument completion, then we should use that.
        if !any(r -> r isa REPLCompletions.KeywordArgumentCompletion, results)
            # Otherwise, we are just completing a function argument. So let's just complete the empty string.
            results, loc, found = REPLCompletions.completions("", 0, workspace)
            # loc is wrong, because the empty string has a different offset.
            loc = (ncodeunits(query)+1):ncodeunits(query_full)
        end
    end

    ## TOO MANY RESULTS
    if length(results) > 2000 && query != query_full
        results, loc, found = REPLCompletions.completions(
            query_full, lastindex(query_full), workspace
        )
    end
    if (too_long = length(results) > 2000)
        results = results[1:2000]
    end

    ## SPECIAL ENDINGS
    if endswith(query, '.')
        filter!(is_dot_completion, results)
        # we are autocompleting a module, and we want to see its fields alphabetically
        sort!(results; by=completion_contents)
    elseif endswith(query, '/')
        filter!(is_path_completion, results)
        sort!(results; by=completion_contents)
    elseif endswith(query, '[')
        filter!(is_dict_completion, results)
        sort!(results; by=completion_contents)
    else
        contains_slash = '/' ∈ query
        if !contains_slash
            filter!(!is_path_completion, results)
        end
    end
    # Add this if you are seeing keyword completions twice in results
    # filter!(!is_keyword_completion, results)
    smooshed_together = map(results) do result
        r = (
            completion_contents(result)::String,
            completion_value_type(result)::Symbol,
            completion_exported(result)::Bool,
            completion_from_notebook(result)::Bool,
            completion_type(result)::Symbol,
            completion_special_symbol_value(result),
        )
        
        # @info "yeah" result rexported r
        r
    end

    sort!(smooshed_together; alg=MergeSort, by=basic_completion_priority)
    (smooshed_together, loc, found, too_long)
end

is_dot_completion(::Union{ModuleCompletion,PropertyCompletion,FieldCompletion}) = true
is_dot_completion(::Completion)                                                 = false

is_path_completion(::PathCompletion) = true
is_path_completion(::Completion)     = false

is_dict_completion(::DictCompletion) = true
is_dict_completion(::Completion)     = false

is_kwarg_completion(::REPLCompletions.KeywordArgumentCompletion) = true
is_kwarg_completion(::Completion)                                 = false

is_keyword_completion(::REPLCompletions.KeywordCompletion) = true
is_keyword_completion(::Completion) = false

