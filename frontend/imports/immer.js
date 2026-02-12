// @ts-nocheck
import { produce as immer, produceWithPatches, applyPatches, enablePatches, setAutoFreeze } from "https://cdn.jsdelivr.net/npm/immer@10.1.3/dist/immer.mjs"

// note that on the previous version, we used `import immer, { produceWithPatches, ... } from "https://cdn.jsdelivr.net/npm/immer@8.0.0/dist/immer.esm.js"`
// the `immer` variable was actually shadowing the `produce` function on the previously used version
// for backward compatibility with the rest of the code, we still export the `immer` variable which is a renamed version of the `produce` function
// see https://github.com/fonsp/Pluto.jl/pull/3372

export { applyPatches, produceWithPatches }
export default immer

enablePatches()

// we have some Editor.setState functions that use immer, so Editor.this.state becomes an "immer immutable frozen object". But we also have some Editor.setState functions that don't use immer, and they try to _mutate_ Editor.this.state. This gives errors like https://github.com/immerjs/immer/issues/576

// The solution is to tell immer not to create immutable objects

setAutoFreeze(false)
