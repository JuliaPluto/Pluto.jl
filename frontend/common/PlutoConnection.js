import { Promises } from "../common/SetupCellEnvironment.js"
import { pack, unpack } from "./MsgPack.js"
import "./Polyfill.js"
import { Stack } from "./Stack.js"
import { with_query_params } from "./URLTools.js"

const reconnect_after_close_delay = 500
const retry_after_connect_failure_delay = 5000

/**
 * Return a promise that resolves to:
 *  - the resolved value of `promise`
 *  - an error after `time_ms` milliseconds
 * whichever comes first.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} time_ms
 * @returns {Promise<T>}
 */
export const timeout_promise = (promise, time_ms) =>
    Promise.race([
        promise,
        new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("Promise timed out."))
            }, time_ms)
        }),
    ])

/**
 * Keep calling @see f until it resolves, with a delay before each try.
 * @param {Function} f Function that returns a promise
 * @param {Number} time_ms Timeout for each call to @see f
 */
const retry_until_resolved = (f, time_ms) =>
    timeout_promise(f(), time_ms).catch((e) => {
        console.error(e)
        console.error("godverdomme")
        return retry_until_resolved(f, time_ms)
    })

/**
 * @template T
 * @returns {{current: Promise<T>, resolve: (value: T) => void, reject: (error: any) => void }}
 */
export const resolvable_promise = () => {
    let resolve = () => {}
    let reject = () => {}
    const p = new Promise((_resolve, _reject) => {
        //@ts-ignore
        resolve = _resolve
        reject = _reject
    })
    return {
        current: p,
        resolve: resolve,
        reject: reject,
    }
}

/**
 * @returns {string}
 */
const get_unique_short_id = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36)

const socket_is_alright = (socket) => socket.readyState == WebSocket.OPEN || socket.readyState == WebSocket.CONNECTING

const socket_is_alright_with_grace_period = (socket) =>
    new Promise((res) => {
        if (socket_is_alright(socket)) {
            res(true)
        } else {
            setTimeout(() => {
                res(socket_is_alright(socket))
            }, 1000)
        }
    })

const try_close_socket_connection = (/** @type {WebSocket} */ socket) => {
    socket.onopen = () => {
        try_close_socket_connection(socket)
    }
    socket.onmessage = socket.onclose = socket.onerror = null
    try {
        socket.close(1000, "byebye")
    } catch (ex) {}
}

/**
 * Open a 'raw' websocket connection to an API with MessagePack serialization. The method is asynchonous, and resolves to a @see WebsocketConnection when the connection is established.
 * @typedef {{socket: WebSocket, send: Function}} WebsocketConnection
 * @param {string} address The WebSocket URL
 * @param {{on_message: Function, on_socket_close:Function}} callbacks
 * @param {number} timeout_s Timeout for creating the websocket connection (seconds)
 * @returns {Promise<WebsocketConnection>}
 */
const create_ws_connection = (address, { on_message, on_socket_close }, timeout_s = 30) => {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(address)

        let has_been_open = false

        const timeout_handle = setTimeout(() => {
            console.warn("Creating websocket timed out", new Date().toLocaleTimeString())
            try_close_socket_connection(socket)
            reject("Socket timeout")
        }, timeout_s * 1000)

        const send_encoded = (message) => {
            const encoded = pack(message)
            if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) throw new Error("Socket is closed")
            socket.send(encoded)
        }

        let last_task = Promise.resolve()
        socket.onmessage = (event) => {
            // we read and deserialize the incoming messages asynchronously
            // they arrive in order (WS guarantees this), i.e. this socket.onmessage event gets fired with the message events in the right order
            // but some message are read and deserialized much faster than others, because of varying sizes, so _after_ async read & deserialization, messages are no longer guaranteed to be in order
            //
            // the solution is a task queue, where each task includes the deserialization and the update handler
            last_task = last_task.then(async () => {
                try {
                    const buffer = await event.data.arrayBuffer()
                    const message = unpack(new Uint8Array(buffer))

                    try {
                        on_message(message)
                    } catch (process_err) {
                        console.error("Failed to process message from websocket", process_err, { message })
                        // prettier-ignore
                        alert(`Something went wrong! You might need to refresh the page.\n\nPlease open an issue on https://github.com/JuliaPluto/Pluto.jl with this info:\n\nFailed to process update\n${process_err.message}\n\n${JSON.stringify(event)}`)
                    }
                } catch (unpack_err) {
                    console.error("Failed to unpack message from websocket", unpack_err, { event })

                    // prettier-ignore
                    alert(`Something went wrong! You might need to refresh the page.\n\nPlease open an issue on https://github.com/JuliaPluto/Pluto.jl with this info:\n\nFailed to unpack message\n${unpack_err}\n\n${JSON.stringify(event)}`)
                }
            })
        }

        socket.onerror = async (e) => {
            console.error(`Socket did an oopsie - ${e.type}`, new Date().toLocaleTimeString(), "was open:", has_been_open, e)

            if (await socket_is_alright_with_grace_period(socket)) {
                console.log("The socket somehow recovered from an error?! Onbegrijpelijk")
                console.log(socket)
                console.log(socket.readyState)
            } else {
                if (has_been_open) {
                    on_socket_close()
                    try_close_socket_connection(socket)
                } else {
                    reject(e)
                }
            }
        }
        socket.onclose = async (e) => {
            console.warn(`Socket did an oopsie - ${e.type}`, new Date().toLocaleTimeString(), "was open:", has_been_open, e)

            if (has_been_open) {
                on_socket_close()
                try_close_socket_connection(socket)
            } else {
                reject(e)
            }
        }
        socket.onopen = () => {
            console.log("Socket opened", new Date().toLocaleTimeString())
            clearInterval(timeout_handle)
            has_been_open = true
            resolve({
                socket: socket,
                send: send_encoded,
            })
        }
        console.log("Waiting for socket to open...", new Date().toLocaleTimeString())
    })
}

let next_tick_promise = () => {
    return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * batched_updates(send) creates a wrapper around the real send, and understands the update_notebook messages.
 * Whenever those are sent, it will wait for a "tick" (basically the end of the code running now)
 * and then send all updates from this tick at once. We use this to fix https://github.com/fonsp/Pluto.jl/issues/928
 *
 * I need to put it here so other code,
 * like running cells, will also wait for the updates to complete.
 * I SHALL MAKE IT MORE COMPLEX! (https://www.youtube.com/watch?v=aO3JgPUJ6iQ&t=195s)
 * @param {import("./PlutoConnectionSendFn").SendFn} send
 * @returns {import("./PlutoConnectionSendFn").SendFn}
 */
const batched_updates = (send) => {
    let current_combined_updates_promise = null
    let current_combined_updates = []
    let current_combined_notebook_id = null

    let batched = async (message_type, body, metadata, no_broadcast) => {
        if (message_type === "update_notebook") {
            if (current_combined_notebook_id != null && current_combined_notebook_id != metadata.notebook_id) {
                // prettier-ignore
                throw new Error("Switched notebook inbetween same-tick updates??? WHAT?!?!")
            }
            current_combined_updates = [...current_combined_updates, ...body.updates]
            current_combined_notebook_id = metadata.notebook_id

            if (current_combined_updates_promise == null) {
                current_combined_updates_promise = next_tick_promise().then(async () => {
                    let sending_current_combined_updates = current_combined_updates
                    current_combined_updates_promise = null
                    current_combined_updates = []
                    current_combined_notebook_id = null
                    return await send(message_type, { updates: sending_current_combined_updates }, metadata, no_broadcast)
                })
            }

            return await current_combined_updates_promise
        } else {
            return await send(message_type, body, metadata, no_broadcast)
        }
    }

    return batched
}

export const ws_address_from_base = (/** @type {string | URL} */ base_url) => {
    const ws_url = new URL("./", base_url)
    ws_url.protocol = ws_url.protocol.replace("http", "ws")

    // if the original URL had a secret in the URL, we can also add it here:
    const ws_url_with_secret = with_query_params(ws_url, { secret: new URL(base_url).searchParams.get("secret") })

    return ws_url_with_secret
}

export const auth_check_url_from_ws = (/** @type {string | URL} */ ws_url) => {
    const auth_url = new URL("./auth-check", ws_url)
    auth_url.protocol = auth_url.protocol.replace("ws", "http")
    return auth_url.toString()
}

const default_ws_address = () => ws_address_from_base(window.location.href)

/**
 * @typedef PlutoConnection
 * @type {{
 *  session_options: Record<string,any>,
 *  send: import("./PlutoConnectionSendFn").SendFn,
 *  kill: (allow_reconnect?: boolean) => void,
 *  version_info: {
 *      julia: string,
 *      pluto: string,
 *      dismiss_update_notification: boolean,
 *  },
 *  notebook_exists: boolean,
 *  message_log: import("./Stack.js").Stack<any>,
 * }}
 */

/**
 * @typedef PlutoMessage
 * @type {any}
 */

/**
 * Open a connection with Pluto, that supports a question-response mechanism. The method is asynchonous, and resolves to a @see PlutoConnection when the connection is established.
 *
 * The server can also send messages to all clients, without being requested by them. These end up in the @see on_unrequested_update callback.
 *
 * @param {{
 *  on_unrequested_update: (message: PlutoMessage, by_me: boolean) => void,
 *  on_reconnect: () => Promise<boolean>,
 *  on_connection_status: (connection_status: boolean, hopeless: boolean) => void,
 *  connect_metadata?: Object,
 *  ws_address?: String,
 * }} options
 * @return {Promise<PlutoConnection>}
 */
export const create_pluto_connection = async ({
    on_unrequested_update,
    on_reconnect,
    on_connection_status,
    connect_metadata = {},
    ws_address = default_ws_address(),
}) => {
    let ws_connection = /** @type {WebsocketConnection?} */ (null) // will be defined later i promise
    const message_log = new Stack(100)
    // @ts-ignore
    window.pluto_get_message_log = () => message_log.get()
    let auto_reconnect = true

    const client = {
        // send: null,
        // session_options: null,
        version_info: {
            julia: "unknown",
            pluto: "unknown",
            dismiss_update_notification: false,
        },
        notebook_exists: true,
        // kill: null,
        message_log,
    } // same

    const client_id = get_unique_short_id()
    const sent_requests = new Map()

    /** @type {import("./PlutoConnectionSendFn").SendFn} */
    const send = async (message_type, body = {}, metadata = {}, no_broadcast = true) => {
        if (ws_connection == null) {
            throw new Error("No connection established yet")
        }
        const request_id = get_unique_short_id()

        // This data will be sent:
        const message = {
            type: message_type,
            client_id: client_id,
            request_id: request_id,
            body: body,
            ...metadata,
        }

        let p = resolvable_promise()

        sent_requests.set(request_id, (response_message) => {
            p.resolve(response_message)
            if (no_broadcast === false) {
                on_unrequested_update(response_message, true)
            }
        })

        ws_connection.send(message)
        return await p.current
    }

    client.send = batched_updates(send)

    const connect = async () => {
        let update_url_with_binder_token = async () => {
            try {
                const on_a_binder_server = window.location.href.includes("binder")
                if (!on_a_binder_server) return
                const url = new URL(window.location.href)
                const response = await fetch("possible_binder_token_please")
                if (!response.ok) {
                    return
                }
                const possible_binder_token = await response.text()
                if (possible_binder_token !== "" && url.searchParams.get("token") !== possible_binder_token) {
                    url.searchParams.set("token", possible_binder_token)
                    history.replaceState({}, "", url.toString())
                }
            } catch (error) {
                console.warn("Error while setting binder url:", error)
            }
        }
        update_url_with_binder_token()

        try {
            ws_connection = await create_ws_connection(String(ws_address), {
                on_message: (update) => {
                    message_log.push(update)

                    const by_me = update.initiator_id == client_id
                    const request_id = update.request_id

                    if (by_me && request_id) {
                        const request = sent_requests.get(request_id)
                        if (request) {
                            request(update)
                            sent_requests.delete(request_id)
                            return
                        }
                    }
                    on_unrequested_update(update, by_me)
                },
                on_socket_close: async () => {
                    on_connection_status(false, false)
                    if (!auto_reconnect) {
                        console.log("Auto-reconnect is disabled, so we're not reconnecting")
                        on_connection_status(false, true)
                        return
                    }

                    console.log(`Starting new websocket`, new Date().toLocaleTimeString())
                    await Promises.delay(reconnect_after_close_delay)
                    await connect() // reconnect!

                    console.log(`Starting state sync`, new Date().toLocaleTimeString())
                    const accept = await on_reconnect()
                    console.log(`State sync ${accept ? "" : "not "}successful`, new Date().toLocaleTimeString())
                    on_connection_status(accept, false)
                    if (!accept) {
                        alert("Connection out of sync 😥\n\nRefresh the page to continue")
                    }
                },
            })

            // let's say hello
            console.log("Hello?")
            const u = await send("connect", {}, connect_metadata)
            console.log("Hello!")
            client.kill = (allow_reconnect = true) => {
                auto_reconnect = allow_reconnect
                if (ws_connection) ws_connection.socket.close()
            }
            client.session_options = u.message.session_options
            client.version_info = u.message.version_info
            client.notebook_exists = u.message.notebook_exists

            console.log("Client object: ", client)

            if (connect_metadata.notebook_id != null && !u.message.notebook_exists) {
                on_connection_status(false, true)
                return {}
            }
            on_connection_status(true, false)

            const ping = () => {
                send("ping", {}, {})
                    .then(() => {
                        // Ping faster than timeout?
                        setTimeout(ping, 28 * 1000)
                    })
                    .catch(() => undefined)
            }
            ping()

            return u.message
        } catch (ex) {
            console.error("connect() failed", ex)
            alert_if_not_authenticated(ws_address, ex).catch(() => null) // No await, we want this to run in the background
            await Promises.delay(retry_after_connect_failure_delay)
            return await connect()
        }
    }
    await connect()

    return /** @type {PlutoConnection} */ (client)
}

const alert_if_not_authenticated = async (/** @type {string | URL} */ ws_url, ex) => {
    if (ex instanceof CloseEvent) {
        if (ex.code === 1006) {
            const auth_url = auth_check_url_from_ws(ws_url)
            const response = await fetch(auth_url)
            if (response.status === 403 || response.status === 401) {
                alert("This window has lost authentication to the Pluto server. Please refresh the page to continue.")
            }
        }
    }
}
