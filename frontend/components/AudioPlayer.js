import _ from "../imports/lodash-es.js"
import { createSilentAudio } from "../common/AudioRecording.js"
import { html, useEffect, useState, useRef, useLayoutEffect } from "../imports/Preact.js"

let run = (x) => x()

export const AudioPlayer = ({ onPlay, src, loaded_recording, audio_element_ref }) => {
    useLayoutEffect(() => {
        run(async () => {
            if (src == null) {
                // We create a silent audio track to play. The duration is the last timestamp of the loaded recording state.
                let last_timestamp = (things) => _.last([[0, null], ...things])[0]
                let fake_duration = Math.max(last_timestamp((await loaded_recording).scrolls), last_timestamp((await loaded_recording).steps))
                fake_duration = Math.ceil(fake_duration + 0.1)
                console.log({ fake_duration })

                let fake_source = createSilentAudio(fake_duration)
                audio_element_ref.current.src = fake_source
            } else {
                audio_element_ref.current.src = src
            }
        })
    }, [])

    return html`<div class="recording-playback"><audio ref=${audio_element_ref} onPlay=${onPlay} controls></audio></div>`
}
