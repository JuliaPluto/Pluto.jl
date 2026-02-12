import { timeout_promise } from "./PlutoConnection.js"

// Sorry Fons, even this part of the code is now unnessarily overengineered.
// But at least, I overengineered this on purpose. - DRAL

let async = async (async) => async()

let firebase_load_promise = null
const init_firebase = async () => {
    if (firebase_load_promise == null) {
        firebase_load_promise = async(async () => {
            let [{ initializeApp }, firestore_module] = await Promise.all([
                // @ts-ignore
                import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"),
                // @ts-ignore
                import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"),
            ])
            let { getFirestore, addDoc, doc, collection } = firestore_module

            // @ts-ignore
            let app = initializeApp({
                apiKey: "AIzaSyC0DqEcaM8AZ6cvApXuNcNU2RgZZOj7F68",
                authDomain: "localhost",
                projectId: "pluto-feedback",
            })

            let db = getFirestore(app)
            let feedback_db = collection(db, "feedback")

            let add_feedback = async (feedback) => {
                let docref = await addDoc(feedback_db, feedback)
                console.debug("Firestore doc created ", docref.id, docref)
            }

            console.log("🔥base loaded", { initializeApp, firestore_module, app, db, feedback_db, add_feedback })

            // @ts-ignore
            return add_feedback
        })
    }
    return await firebase_load_promise
}

export const init_feedback = async () => {
    try {
        // Only load firebase when the feedback form is touched
        const feedbackform = document.querySelector("form#feedback")
        if (feedbackform == null) return
        feedbackform.addEventListener("submit", (e) => {
            const email = prompt("Would you like us to contact you?\n\nEmail: (leave blank to stay anonymous 👀)")

            e.preventDefault()

            async(async () => {
                try {
                    const feedback = String(new FormData(e.target).get("opinion"))
                    if (feedback.length < 4) return

                    let add_feedback = await init_firebase()
                    await timeout_promise(
                        add_feedback({
                            feedback,
                            timestamp: Date.now(),
                            email: email ? email : "",
                        }),
                        5000
                    )
                    let message = "Submitted. Thank you for your feedback! 💕"
                    console.log(message)
                    alert(message)
                    // @ts-ignore
                    feedbackform.querySelector("#opinion").value = ""
                } catch (error) {
                    let message =
                        "Whoops, failed to send feedback 😢\nWe would really like to hear from you! Please got to https://github.com/JuliaPluto/Pluto.jl/issues to report this failure:\n\n"
                    console.error(message)
                    console.error(error)
                    alert(message + error)
                }
            })
        })

        feedbackform.addEventListener("focusin", () => {
            // Start loading firebase when someone interacts with the form
            init_firebase()
        })
    } catch (error) {
        console.error("Something went wrong loading the feedback form:", error)
        // @ts-ignore
        document.querySelector("form#feedback").style.opacity = 0
        for (let char of "Oh noooooooooooooooooo...") {
            // @ts-ignore
            document.querySelector("form#feedback input").value += char
            await new Promise((resolve) => setTimeout(resolve, 200))
        }
    }
}
