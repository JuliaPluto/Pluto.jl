/**
 * Node.js integration for Pluto standalone library
 *
 * This module provides the necessary polyfills and environment setup
 * to run Pluto's browser-based frontend code in Node.js environments.
 */

import { webcrypto } from "crypto"
import { parseHTML } from "linkedom"
import { WebSocket as NodeWebSocket } from "ws"

// Simplified way for HTML
const dom = parseHTML(`
  <!doctype html>
  <html lang="en">
  </html>
`)

let g = globalThis ?? global

Object.assign(global, {
    window: g?.window ?? dom.window,
    location: g?.location ?? { href: "", origin: "", host: "host" },
    localStorage: g?.localStorage ?? dom.localStorage,
    document: g?.window?.document ?? dom.window.document,
    HTMLElement: g?.window?.HTMLElement ?? dom.window.HTMLElement,
    Element: g?.window?.Element ?? dom.window.Element,
    Node: g?.window?.Node ?? dom.window.Node,
    SVGElement: g?.window?.SVGElement ?? dom.window.SVGElement,
    MessageEvent: g?.window?.MessageEvent ?? dom.window.MessageEvent,
    alert: (message) => console.log("ALERT:", message),
    Buffer,
})

// Browser-compatible WebSocket wrapper for Node.js
global.WebSocket = class WebSocket extends NodeWebSocket {
    constructor(url, protocols) {
        super(url, protocols)
        const originalOn = this.on.bind(this)

        this.on = (event, handler) => {
            if (event === "message") {
                return originalOn("message", (data) => {
                    handler({
                        data: {
                            arrayBuffer: () =>
                                Promise.resolve(Buffer.isBuffer(data) ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data),
                        },
                        type: "message",
                        target: this,
                    })
                })
            }
            return originalOn(event, handler)
        }

        this.addEventListener = (event, handler) => this.on(event, handler)
    }
}

// Add missing DOM methods that jsdom doesn't provide
dom.window.HTMLElement.prototype.scrollIntoView = function () {}

// Use Node.js crypto if jsdom doesn't provide sufficient crypto support
if (!global.crypto || !global.crypto.subtle) {
    global.crypto = webcrypto
}
