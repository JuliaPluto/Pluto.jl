cd(@__DIR__)

import Pkg
Pkg.activate(".")
Pkg.instantiate()
using YAML
using JSON3
using OrderedCollections



const lang_files = filter(endswith(".json"), readdir())
const not_english = filter(!isequal("english.json"), lang_files)

@info "Found language files" lang_files not_english

load_json(path) = YAML.load_file(path; dicttype=OrderedCollections.OrderedDict{String,Any})

function write_json(path, data)
    open(path, "w") do io
        JSON3.pretty(io, data, JSON3.AlignmentContext(alignment=:Left, indent=4))
    end
end



const english = load_json("english.json")

const plural_suffixes = ["zero", "one", "two", "few", "many", "other"]
const plural_regex = Regex("^(.*)_(" * join(plural_suffixes, "|") * ")\$")

# Return the base key if it ends with an i18next plural suffix.
# For example "t_time_minutes_other" -> "t_time_minutes".
base_plural(key) = begin
    m = match(plural_regex, key)
    m === nothing ? nothing : m.captures[1]
end

# Keep a list of pluralized keys in the English file so we can
# retain additional plural forms in other languages.
const english_plural_bases = Set(filter(!isnothing, base_plural.(keys(english))))


for lang_file in not_english
    @info "🔄 Updating" lang_file
    json = load_json(lang_file)
    
    # Warn about keys that should not be there
    for key in keys(json)
        if !(haskey(english, key) || (base_plural(key) !== nothing && base_plural(key) in english_plural_bases))
            @warn "🗑️ Key $key found in $lang_file but not in english.json. Removing..." old_value=json[key]
        end
    end

    for key in keys(english)
        if !haskey(json, key)
            @info "🆕 Adding key: $key"
        end
    end

    new_data = OrderedDict{String,Any}()
    for key in keys(english)
        # copy the English key or initialize with an empty string
        base = base_plural(key)
        if base === nothing
            new_data[key] = haskey(json, key) ? json[key] : ""
        elseif haskey(json, base)
            @info "# the localization uses the base without plural forms, so copy that" base
            new_data[base] = json[base]
        else
            newfile_has_a_plural = any(haskey(json, base * "_" * suffix) for suffix in plural_suffixes)
            
            if !newfile_has_a_plural
                # if the new file does not define any plural forms, add the same forms as english
                new_data[key] = ""
            end
            
            # if the English file defines one plural form, copy any
            # additional forms present in the translation file
            for suffix in plural_suffixes
                candidate = string(base, "_", suffix)
                if haskey(json, candidate)
                    new_data[candidate] = json[candidate]
                end
            end
        end
    end
    
    write_json(lang_file, new_data)   
    
    @info "✅ Update complete" lang_file
end





