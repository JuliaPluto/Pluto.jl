import Malt
using Markdown
import REPL

###
# RESPONSES FOR AUTOCOMPLETE & DOCS
###

function format_path_completion(completion)
    replace(REPL.REPLCompletions.completion_text(completion), "\\ " => " ", "\\\\" => "\\")
end

responses[:completepath] = function response_completepath(🙋::ClientRequest)
    path = 🙋.body["query"]
    pos = lastindex(path)

    results, loc, found = REPL.REPLCompletions.complete_path(path, pos)
    ishidden(path_completion) = let p = path_completion.path
        startswith(basename(isdirpath(p) ? dirname(p) : p), ".")
    end
    filter!(!ishidden, results)

    start_utf8 = let
        # REPLCompletions takes into account that spaces need to be prefixed with `\` in the shell, so it subtracts the number of spaces in the filename from `start`:
        # https://github.com/JuliaLang/julia/blob/c54f80c785a3107ae411267427bbca05f5362b0b/stdlib/REPL/src/REPLCompletions.jl#L270

        # we don't use prefixes, so we need to reverse this.

        # this is from the Julia source code:
        # https://github.com/JuliaLang/julia/blob/c54f80c785a3107ae411267427bbca05f5362b0b/stdlib/REPL/src/REPLCompletions.jl#L195-L204
        if Base.Sys.isunix() && occursin(r"^~(?:/|$)", path)
            # if the path is just "~", don't consider the expanded username as a prefix
            if path == "~"
                dir, prefix = homedir(), ""
            else
                dir, prefix = splitdir(homedir() * path[2:end])
            end
        else
            dir, prefix = splitdir(path)
        end

        loc.start + count(isequal(' '), prefix)
    end
    stop_utf8 = nextind(path, pos) # advance one unicode char, js uses exclusive upper bound

    formatted = format_path_completion.(results)
    msg = UpdateMessage(:completion_result, 
        Dict(
            :start => start_utf8 - 1, # 1-based index (julia) to 0-based index (js)
            :stop => stop_utf8 - 1, # idem
            :results => formatted,
            ), 🙋.notebook, nothing, 🙋.initiator)

    putclientupdates!(🙋.session, 🙋.initiator, msg)
end

function package_name_to_complete(str)
	matches = match(r"(import|using) ([a-zA-Z0-9]+)$", str)
	matches === nothing ? nothing : matches[2]
end

responses[:complete] = function response_complete(🙋::ClientRequest)
    try require_notebook(🙋) catch; return; end
    query = 🙋.body["query"]
    query_full = get(🙋.body, "query_full", query)

    workspace = WorkspaceManager.get_workspace((🙋.session, 🙋.notebook); allow_creation=false)
    
    results, loc, found, too_long = if will_run_code(🙋.notebook) && workspace isa WorkspaceManager.Workspace && isready(workspace.dowork_token)
        # we don't use eval_format_fetch_in_workspace because we don't want the output to be string-formatted.
        # This works in this particular case, because the return object, a `Completion`, exists in this scope too.
        Malt.remote_eval_fetch(workspace.worker, quote
            PlutoRunner.completion_fetcher(
                $query,
                $query_full,
                getfield(Main, $(QuoteNode(workspace.module_name))),
            )
        end)
    else
        # We can at least autocomplete general julia things:
        PlutoRunner.completion_fetcher(query, query_full, Main)
    end

    start_utf8 = loc.start
    stop_utf8 = nextind(query, lastindex(query)) # advance one unicode char, js uses exclusive upper bound

    msg = UpdateMessage(:completion_result, 
        Dict(
            :start => start_utf8 - 1, # 1-based index (julia) to 0-based index (js)
            :stop => stop_utf8 - 1, # idem
            :results => results,
            :too_long => too_long
            ), 🙋.notebook, nothing, 🙋.initiator)

    putclientupdates!(🙋.session, 🙋.initiator, msg)
end

responses[:complete_symbols] = function response_complete_symbols(🙋::ClientRequest)
    msg = UpdateMessage(:completion_result, 
        Dict(
            :latex => REPL.REPLCompletions.latex_symbols,
            :emoji => REPL.REPLCompletions.emoji_symbols,
        ), 🙋.notebook, nothing, 🙋.initiator)

    putclientupdates!(🙋.session, 🙋.initiator, msg)
end

responses[:docs] = function response_docs(🙋::ClientRequest)
    require_notebook(🙋)
    query = 🙋.body["query"]

    # Expand string macro calls to their macro form:
    # `html"` should yield `@html_str` and
    # `Markdown.md"` should yield `@Markdown.md_str`. (Ideally `Markdown.@md_str` but the former is easier)
    if endswith(query, '"') && query != "\""
        query = string("@", SubString(query, firstindex(query), prevind(query, lastindex(query))), "_str")
    end

    workspace = WorkspaceManager.get_workspace((🙋.session, 🙋.notebook); allow_creation=false)

    query_as_symbol = Symbol(query)
    base_binding = Docs.Binding(Base, query_as_symbol)
    doc_md = Docs.doc(base_binding)

    doc_html, status = if doc_md isa Markdown.MD &&
            haskey(doc_md.meta, :results) && !isempty(doc_md.meta[:results])

        # available in Base, no need to ask worker
        PlutoRunner.improve_docs!(doc_md, query_as_symbol, base_binding)

        (repr(MIME("text/html"), doc_md), :👍)
    else
        if will_run_code(🙋.notebook) && workspace isa WorkspaceManager.Workspace && isready(workspace.dowork_token)
            Malt.remote_eval_fetch(workspace.worker, quote
                PlutoRunner.doc_fetcher(
                    $query,
                    getfield(Main, $(QuoteNode(workspace.module_name))),
                )
            end)
        else
            (nothing, :⌛)
        end
    end

    msg = UpdateMessage(:doc_result, 
        Dict(
            :status => status,
            :doc => doc_html,
            ), 🙋.notebook, nothing, 🙋.initiator)

    putclientupdates!(🙋.session, 🙋.initiator, msg)
end
