import _ from "../imports/lodash.js"
import { createSilentAudio, create_recorder } from "../common/AudioRecording.js"
import { html, useEffect, useState, useRef, useCallback, useLayoutEffect, useMemo } from "../imports/Preact.js"
import { AudioPlayer } from "./AudioPlayer.js"
import { base64_arraybuffer, blob_url_to_data_url } from "../common/PlutoHash.js"
import { pack, unpack } from "../common/MsgPack.js"
import { t, th } from "../common/lang.js"

const assert_response_ok = (/** @type {Response} */ r) => (r.ok ? r : Promise.reject(r))
let run = (x) => x()

/**
 * @typedef {[number, Array?]} PatchStep
 */

/**
 * @typedef {Object} RecordingData
 * @property {Array<PatchStep>} steps
 * @property {Array<[number, {cell_id: string, relative_distance: number}]>} scrolls
 */

/**
 * @typedef {RecordingData & {
 *   initial_html: string,
 * scroll_handler: (x: number) => void,
 * audio_recorder: {start: () => void, stop: () => Promise<string>}?
 * }} RecordingState
 */

export const RecordingUI = ({ notebook_name, is_recording, recording_waiting_to_start, set_recording_states, patch_listeners, export_url }) => {
    let current_recording_ref = useRef(/** @type{RecordingState?} */ (null))
    let recording_start_time_ref = useRef(0)

    useEffect(() => {
        let listener = (patches) => {
            if (current_recording_ref.current != null) {
                current_recording_ref.current.steps = [
                    ...current_recording_ref.current.steps,
                    [(Date.now() - recording_start_time_ref.current) / 1000, patches],
                ]
            }
        }

        patch_listeners.push(listener)

        return () => {
            patch_listeners.splice(patch_listeners.indexOf(listener), 1)
        }
    }, [])

    const start_recording = async ({ want_audio }) => {
        let audio_recorder = null,
            audio_record_start_promise

        let abort = async (e) => {
            alert(
                `We were unable to activate your microphone. Make sure that it is connected, and that this site (${
                    window.location.protocol + "//" + window.location.host
                }) has permission to use the microphone.`
            )
            console.warn("Failed to create audio recorder asdfasdf ", e)
            await stop_recording()
        }

        if (want_audio) {
            try {
                audio_recorder = await create_recorder()
                audio_record_start_promise = audio_recorder.start()
            } catch (e) {
                await abort(e)
                return
            }
        }

        let initial_html = await (await fetch(export_url("notebookexport")).then(assert_response_ok)).text()

        initial_html = initial_html.replaceAll(
            "https://cdn.jsdelivr.net/gh/fonsp/Pluto.jl@0.17.3/frontend/",
            "https://cdn.jsdelivr.net/gh/fonsp/Pluto.jl@8d243df/frontend/"
        )
        // initial_html = initial_html.replaceAll("https://cdn.jsdelivr.net/gh/fonsp/Pluto.jl@0.17.3/frontend/", "http://localhost:1234/")

        const scroll_handler_direct = () => {
            if (current_recording_ref.current == null) return

            let y = window.scrollY + window.innerHeight / 2

            /** @type {Array<HTMLElement>} */
            const cell_nodes = Array.from(document.querySelectorAll("pluto-notebook > pluto-cell"))

            let best_index = ""
            let relative_distance = 0

            cell_nodes.forEach((el, i) => {
                let cy = el.offsetTop
                if (cy <= y) {
                    best_index = el.id
                    relative_distance = (y - cy) / el.offsetHeight
                }
            })

            current_recording_ref.current.scrolls = [
                ...current_recording_ref.current.scrolls,
                [
                    (Date.now() - recording_start_time_ref.current) / 1000,
                    {
                        cell_id: best_index,
                        relative_distance,
                    },
                ],
            ]
        }
        const scroll_handler = _.debounce(scroll_handler_direct, 500)

        try {
            await audio_record_start_promise
        } catch (e) {
            await abort(e)
            return
        }

        current_recording_ref.current = {
            initial_html,
            steps: [],
            scrolls: [],
            scroll_handler,
            audio_recorder,
        }
        recording_start_time_ref.current = Date.now()

        set_recording_states({ is_recording: true, recording_waiting_to_start: false })

        // call it once to record the start scroll position
        scroll_handler_direct()
        window.addEventListener("scroll", scroll_handler, { passive: true })
    }

    let notebook_name_ref = useRef(notebook_name)
    notebook_name_ref.current = _.last(notebook_name.split("/"))
        .replace(/\.jl$/, "")
        .replace(/\.plutojl$/, "")
    const stop_recording = async () => {
        if (current_recording_ref.current != null) {
            const { audio_recorder, initial_html, steps, scrolls, scroll_handler } = current_recording_ref.current
            // @ts-ignore
            window.removeEventListener("scroll", scroll_handler, { passive: true })

            const audio_blob_url = await audio_recorder?.stop()
            const audio_data_url = audio_blob_url == null ? null : await blob_url_to_data_url(audio_blob_url)

            const magic_tag = `<meta name="pluto-insertion-spot-parameters">`
            const output_html = initial_html.replace(
                magic_tag,
                `
                <script>
                window.pluto_recording_url = "data:;base64,${await base64_arraybuffer(pack({ steps: steps, scrolls: scrolls }))}";
                window.pluto_recording_audio_url = ${audio_data_url == null ? null : `"${audio_data_url}"`};
                </script>
                ${magic_tag}`
            )

            console.log(current_recording_ref.current)

            window.dispatchEvent(
                new CustomEvent("open pluto html export", {
                    detail: {
                        is_recording: true,
                        download_filename: `${notebook_name_ref.current} recording.html`,
                        download_url: "data:text/html;charset=utf-8," + encodeURIComponent(output_html),
                    },
                })
            )
        }

        recording_start_time_ref.current = 0
        current_recording_ref.current = null

        set_recording_states({ is_recording: false, recording_waiting_to_start: false })
    }

    return html`
        <div class="outline-frame recording"></div>
        ${recording_waiting_to_start
            ? html`<div class="outline-frame-actions-container">
                  <div class="overlay-button">
                      <button
                          onclick=${() => {
                              start_recording({ want_audio: true })
                          }}
                      >
                          <span>${th("t_recording_ui_start_recording")}<span class="microphone-icon pluto-icon"></span></span>
                      </button>
                  </div>
                  <div class="overlay-button record-no-audio">
                      <button
                          onclick=${() => {
                              start_recording({ want_audio: false })
                          }}
                      >
                          <span>${th("t_recording_ui_start_recording_muted")}<span class="mute-icon pluto-icon"></span></span>
                      </button>
                  </div>
              </div>`
            : is_recording
              ? html`<div class="outline-frame-actions-container">
                    <div class="overlay-button">
                        <button
                            onclick=${() => {
                                stop_recording()
                            }}
                        >
                            <span>${th("t_recording_ui_stop_recording")}<span class="stop-recording-icon pluto-icon"></span></span>
                        </button>
                    </div>
                </div>`
              : null}
    `
}

let get_scroll_top = ({ cell_id, relative_distance }) => {
    let cell = document.getElementById(cell_id)
    if (cell) return cell.offsetTop + relative_distance * cell.offsetHeight - window.innerHeight / 2
}

/**
 *
 * @param {{
 *  launch_params: import("./Editor.js").LaunchParameters,
 *  initializing: boolean,
 *  [key: string]: any,
 * }} props
 * @returns
 */
export const RecordingPlaybackUI = ({ launch_params, initializing, apply_notebook_patches, reset_notebook_state }) => {
    const { recording_url, recording_url_integrity, recording_audio_url } = launch_params

    let loaded_recording = useMemo(
        () =>
            Promise.resolve().then(async () => {
                if (recording_url) {
                    return unpack(
                        new Uint8Array(
                            await (
                                await fetch(new Request(recording_url, { integrity: recording_url_integrity ?? undefined })).then(assert_response_ok)
                            ).arrayBuffer()
                        )
                    )
                } else {
                    return null
                }
            }),
        [recording_url]
    )
    let computed_reverse_patches_ref = useRef(/** @type{Array<PatchStep>?} */ (null))

    useEffect(() => {
        loaded_recording.then(console.log)
    }, [loaded_recording])

    let audio_element_ref = useRef(/** @type {HTMLAudioElement?} */ (null))

    let match_state_to_playback_running_ref = useRef(false)
    let current_state_timestamp_ref = useRef(0)

    let [current_scrollY, set_current_scrollY] = useState(/** @type {number?} */ (null))
    let [following_scroll, set_following_scroll] = useState(true)
    let following_scroll_ref = useRef(following_scroll)
    following_scroll_ref.current = following_scroll
    let was_playing_before_scrollout_ref = useRef(false)

    let last_manual_window_scroll_time_ref = useRef(0)
    let last_manual_window_smoothscroll_time_ref = useRef(0)
    const scroll_window = (scrollY, smooth = true) => {
        last_manual_window_scroll_time_ref.current = Date.now()
        last_manual_window_smoothscroll_time_ref.current = Date.now()
        window.scrollTo({
            top: scrollY,
            behavior: smooth ? "smooth" : "auto",
        })
    }

    let on_scroll = ({ cell_id, relative_distance }, smooth = true) => {
        let scrollY = get_scroll_top({ cell_id, relative_distance })
        if (scrollY == null) return
        set_current_scrollY(scrollY)
        if (following_scroll_ref.current) {
            scroll_window(scrollY, smooth)
        }
    }

    const match_state_to_playback_ref = useRef(() => {})
    match_state_to_playback_ref.current = async () => {
        match_state_to_playback_running_ref.current = true

        const deserialized = /** @type {RecordingData} */ (await loaded_recording)

        computed_reverse_patches_ref.current = computed_reverse_patches_ref.current ?? deserialized.steps.map(([t, s]) => [t, undefined])

        const audio = audio_element_ref.current
        if (audio == null) return

        let new_timestamp = audio.currentTime
        let forward = new_timestamp >= current_state_timestamp_ref.current
        /** @type {<T>(x: T[]) => T[]} */
        let directed = (x) => (forward ? x : [...x].reverse())

        let lower = Math.min(current_state_timestamp_ref.current, new_timestamp)
        let upper = Math.max(current_state_timestamp_ref.current, new_timestamp)

        let scrolls_in_time_window = deserialized.scrolls.filter(([t, s]) => lower < t && t <= upper)
        if (scrolls_in_time_window.length > 0) {
            let scroll_state = _.last(directed(scrolls_in_time_window))?.[1]

            if (scroll_state) on_scroll(scroll_state)
        }

        let steps_in_current_direction = forward ? deserialized.steps : computed_reverse_patches_ref.current
        let steps_and_indices = steps_in_current_direction.map((x, i) => /** @type{[PatchStep, number]} */ ([x, i]))
        let steps_and_indices_in_time_window = steps_and_indices.filter(([[t, s], i]) => lower < t && t <= upper)

        let reverse_patches = []
        for (let [[t, patches], i] of directed(steps_and_indices_in_time_window)) {
            reverse_patches = await apply_notebook_patches(patches, undefined, forward)
            if (forward) {
                computed_reverse_patches_ref.current[i] = [t, reverse_patches]
            }
        }
        // if (!_.isEmpty(steps_and_indices_in_time_window)) console.log(computed_reverse_patches_ref.current)

        current_state_timestamp_ref.current = new_timestamp

        if (audio.paused) {
            match_state_to_playback_running_ref.current = false
        } else {
            requestAnimationFrame(() => match_state_to_playback_ref.current())
        }
    }

    let on_audio_playback_change = useCallback(
        (e) => {
            // console.log(e)

            if (!match_state_to_playback_running_ref.current) {
                match_state_to_playback_ref.current()
            }
        },
        [match_state_to_playback_running_ref, match_state_to_playback_ref]
    )

    const event_names = ["seeked", "suspend", "play", "pause", "ended", "waiting"]

    useLayoutEffect(() => {
        const audio_el = audio_element_ref.current
        if (audio_el) {
            event_names.forEach((en) => {
                audio_el.addEventListener(en, on_audio_playback_change)
            })

            return () => {
                event_names.forEach((en) => {
                    audio_el.removeEventListener(en, on_audio_playback_change)
                })
            }
        }
    }, [audio_element_ref.current, on_audio_playback_change])

    useEffect(() => {
        if (!initializing && recording_url != null) {
            // if we are playing a recording, fix the initial scroll position
            loaded_recording.then((x) => {
                let first_scroll = _.first(x?.scrolls)
                if (first_scroll) {
                    let obs = new ResizeObserver(() => {
                        console.log("Scrolling back to first recorded scroll position...")
                        on_scroll(first_scroll[1], false)
                    })
                    let old_value = history.scrollRestoration
                    history.scrollRestoration = "manual"
                    obs.observe(document.body)
                    setTimeout(() => {
                        history.scrollRestoration = old_value
                        obs.disconnect()
                    }, 3000)
                    on_scroll(first_scroll[1], false)
                }

                document.fonts.ready.then(() => {
                    console.info("Fonts loaded")
                    on_scroll(first_scroll[1], false)
                })
            })
        }
    }, [initializing])

    useEffect(() => {
        if (!initializing) {
            // TODO fons wat was je plan hier?
        }
    }, [initializing])

    useEffect(() => {
        if (!initializing && recording_url != null) {
            let on_scroll = (e) => {
                let now = Date.now()
                let dt = (now - last_manual_window_scroll_time_ref.current) / 1000
                let smooth_dt = (now - last_manual_window_smoothscroll_time_ref.current) / 1000
                let is_first_smooth_scroll = smooth_dt === dt
                let ignore = dt < 1 && (is_first_smooth_scroll || smooth_dt < 0.2)
                if (ignore) {
                    // then this must have been a browser-initiated smooth scroll event
                    last_manual_window_smoothscroll_time_ref.current = now
                    // console.log("ignoring scroll", { ignore, dt, smooth_dt, e })
                }

                if (!ignore) {
                    if (following_scroll_ref.current) {
                        console.warn("Manual scroll detected, no longer following playback scroll", { dt, smooth_dt, e })

                        if (audio_element_ref.current != null) {
                            was_playing_before_scrollout_ref.current = !audio_element_ref.current.paused
                            audio_element_ref.current.pause()
                        }
                        set_following_scroll(false)
                    }
                }
            }

            document.fonts.ready.then(() => {
                window.addEventListener("scroll", on_scroll, { passive: true })
            })
            return () => {
                // @ts-ignore
                window.removeEventListener("scroll", on_scroll, { passive: true })
            }
        }
    }, [initializing, recording_url])

    let frame = html`<div
        style=${{
            opacity: following_scroll ? 0.0 : 1,
            top: `${current_scrollY ?? 0}px`,
        }}
        class="outline-frame playback"
    ></div>`

    return html`
        ${recording_url
            ? html`${!following_scroll
                      ? html` <div class="outline-frame-actions-container">
                            <div class="overlay-button playback">
                                <button
                                    onclick=${() => {
                                        scroll_window(current_scrollY, true)
                                        set_following_scroll(true)
                                        if (was_playing_before_scrollout_ref.current && audio_element_ref.current) audio_element_ref.current.play()
                                    }}
                                >
                                    <span
                                        >${th("t_recording_ui_back_to_recording", {
                                            icon: html`<span class="follow-recording-icon pluto-icon"></span>`,
                                        })}</span
                                    >
                                </button>
                            </div>
                        </div>`
                      : null}
                  ${frame} <${AudioPlayer} audio_element_ref=${audio_element_ref} src=${recording_audio_url} loaded_recording=${loaded_recording} />`
            : null}
    `
}
