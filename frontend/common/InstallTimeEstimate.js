import { useEffect, useState } from "../imports/Preact.js"
import _ from "../imports/lodash.js"

const loading_times_url = `https://julia-loading-times-test.netlify.app/pkg_load_times.csv`
const package_list_url = `https://julia-loading-times-test.netlify.app/top_packages_sorted_with_deps.txt`

/** @typedef {{ install: Number, precompile: Number, load: Number }} LoadingTime */

/**
 * @typedef PackageTimingData
 * @type {{
 *  times: Map<String,LoadingTime>,
 *  packages: Map<String,String[]>,
 * }}
 */

/** @type {{ current: Promise<PackageTimingData>? }} */
const data_promise_ref = { current: null }

export const get_data = () => {
    if (data_promise_ref.current != null) {
        return data_promise_ref.current
    } else {
        const times_p = fetch(loading_times_url)
            .then((res) => res.text())
            .then((text) => {
                const lines = text.split("\n")
                const header = lines[0]?.split(",")
                return new Map(
                    lines.slice(1).map((line) => {
                        let [pkg = "", ...times] = line.split(",")

                        return [pkg, { install: Number(times[0]), precompile: Number(times[1]), load: Number(times[2]) }]
                    })
                )
            })

        const packages_p = fetch(package_list_url)
            .then((res) => res.text())
            .then(
                (text) =>
                    new Map(
                        text.split("\n").map((line) => {
                            let [pkg = "", ...deps] = line.split(",")
                            return [pkg, deps]
                        })
                    )
            )

        data_promise_ref.current = Promise.all([times_p, packages_p]).then(([times, packages]) => ({ times, packages }))

        return data_promise_ref.current
    }
}

export const usePackageTimingData = () => {
    const [data, set_data] = useState(/** @type {PackageTimingData?} */ (null))

    useEffect(() => {
        get_data().then(set_data)
    }, [])

    return data
}

const recursive_deps = (/** @type {PackageTimingData} */ data, /** @type {string} */ pkg, found = []) => {
    const deps = data.packages.get(pkg)
    if (deps == null) {
        return []
    } else {
        const newfound = _.union(found, deps)
        return [...deps, ..._.difference(deps, found).flatMap((dep) => recursive_deps(data, dep, newfound))]
    }
}

export const time_estimate = (/** @type {PackageTimingData} */ data, /** @type {string[]} */ packages) => {
    let deps = packages.flatMap((pkg) => recursive_deps(data, pkg))
    let times = _.uniq([...packages, ...deps])
        .map((pkg) => data.times.get(pkg))
        .filter((x) => x != null)

    let sum = (xs) => xs.reduce((acc, x) => acc + (x == null || isNaN(x) ? 0 : x), 0)

    return {
        install: sum(times.map(_.property("install"))) * timing_weights.install,
        precompile: sum(times.map(_.property("precompile"))) * timing_weights.precompile,
        load: sum(times.map(_.property("load"))) * timing_weights.load,
    }
}

const timing_weights = {
    // Because the GitHub Action runner has superfast internet
    install: 2,
    // Because the GitHub Action runner has average compute speed
    load: 1,
    // Because precompilation happens in parallel
    precompile: 0.3,
}
