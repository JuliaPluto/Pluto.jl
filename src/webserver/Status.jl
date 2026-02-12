"""
This module contains the "Status" system from Pluto, which you can see in the bottom right in the Pluto editor. It's used to track what is currently happening, for how long. (E.g. "Notebook startup > Julia process starting".)

The Status system is hierachical: a status item can have multiple subtasks. E.g. the "Package manager" status can have subtask "instantiate" and "precompile". In the UI, these are sections that you can fold out.

!!! warning
    This module is not public API of Pluto.
"""
module Status

_default_update_listener() = nothing

Base.@kwdef mutable struct Business
    name::Symbol=:ignored
    success::Union{Nothing,Bool}=nothing
    started_at::Union{Nothing,Float64}=nothing
    finished_at::Union{Nothing,Float64}=nothing
    subtasks::Dict{Symbol,Business}=Dict{Symbol,Business}()
    update_listener_ref::Ref{Any}=Ref{Any}(_default_update_listener)
    lock::Threads.SpinLock=Threads.SpinLock()
end



tojs(b::Business) = Dict{String,Any}(
    "name" => b.name,
    "success" => b.success,
    "started_at" => b.started_at,
    "finished_at" => b.finished_at,
    "subtasks" => Dict{String,Any}(
        String(s) => tojs(r)
        for (s, r) in b.subtasks
    ),
)


function report_business_started!(business::Business)
    lock(business.lock) do
        business.success = nothing
        business.started_at = time()
        business.finished_at = nothing
        
        empty!(business.subtasks)
    end
    
    business.update_listener_ref[]()
    return business
end



function report_business_finished!(business::Business, success::Bool=true)
    if business.success === nothing && business.started_at !== nothing && business.finished_at === nothing
        business.success = success
    end
    lock(business.lock) do
        # if it never started, then lets "start" it now
        business.started_at = something(business.started_at, time())
        # if it already finished, then leave the old finish time. 
        business.finished_at = something(business.finished_at, max(business.started_at, time()))
    end
    
    # also finish all subtasks (this can't be inside the same lock)
    for v in values(business.subtasks)
        report_business_finished!(v, success)
    end
    
    business.update_listener_ref[]()
    
    return business
end



create_for_child(parent::Business, name::Symbol) = function()
    Business(; name, update_listener_ref=parent.update_listener_ref, lock=parent.lock)
end

get_child(parent::Business, name::Symbol) = lock(parent.lock) do
    get!(create_for_child(parent, name), parent.subtasks, name)
end

report_business_finished!(parent::Business, name::Symbol, success::Bool=true) = report_business_finished!(get_child(parent, name), success)
report_business_started!(parent::Business, name::Symbol) = get_child(parent, name) |> report_business_started!
report_business_planned!(parent::Business, name::Symbol) = get_child(parent, name)


function report_business!(f::Function, parent::Business, name::Symbol)
    local success = false
    try
        business = report_business_started!(parent, name)
        f()
        success = true
        business
    finally
        report_business_finished!(parent, name, success)
    end
end

delete_business!(business::Business, name::Symbol) = lock(business.lock) do
    delete!(business.subtasks, name)
end



# GLOBAL

# registry update
## once per process

# waiting for other notebook packages










# PER NOTEBOOK

# notebook process starting

# installing packages
# updating packages

# running cells






end



