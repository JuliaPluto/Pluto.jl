
# Convert a user-returned `AbstractPlutoDingetjes.Display.ReactDOMElement` to the wire Dict, recursively formatting children through Pluto's usual display pipeline.

function reactdom_data(@nospecialize(x), context::Context)
    # The user's show method returns a ReactDOMElement (no writes to `io`).
    el = Base.invokelatest(show, context, MIME"application/vnd.pluto.reactdomelement+object"(), x)
    _reactdom_to_dict(el, context)
end

function _reactdom_to_dict(@nospecialize(el), context::Context)
    Dict{Symbol,Any}(
        :tag => String(el.tag),
        :attributes => Dict{String,Any}(string(k) => v for (k, v) in el.attributes),
        :children => Any[
            with_auto_id_counter(context, get_react_child_key(i, value)) do io
                format_output_default(value, io)
            end
            for (i, value) in enumerate(el.children)
        ],
    )
end

get_react_child_key(i, value) = i
# In integrations.jl, we will add a specific method for ReactDOMElement that looks for a "key" in the attributes.



