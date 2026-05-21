// Polyfill for Blob::text when there is none (safari)
// This is not "officialy" supported
if (Blob.prototype.text == null) {
    Blob.prototype.text = function () {
        const reader = new FileReader()
        const promise = new Promise((resolve, reject) => {
            // on read success
            reader.onload = () => {
                resolve(reader.result)
            }
            // on failure
            reader.onerror = (e) => {
                reader.abort()
                reject(e)
            }
        })
        reader.readAsText(this)
        return promise
    }
}

// Polyfill for Blob::arrayBuffer when there is none (safari)
// This is not "officialy" supported
if (Blob.prototype.arrayBuffer == null) {
    Blob.prototype.arrayBuffer = function () {
        return new Response(this).arrayBuffer()
    }
}

//@ts-ignore
import { polyfill as scroll_polyfill } from "https://esm.sh/seamless-scroll-polyfill@2.1.8/lib/polyfill.js?target=es2020"

scroll_polyfill()
