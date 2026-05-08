import { detect_deserializer } from "../../common/Serialization.js"
import { EditorView } from "../../imports/CodemirrorPlutoSetup.js"

export let pluto_paste_plugin = ({ pluto_actions, cell_id }) => {
    return EditorView.domEventHandlers({
        paste: (event, view) => {
            if (!view.hasFocus) {
                // Tell codemirror it doesn't have to handle this when it doesn't have focus
                console.log("CodeMirror, why are you registring this paste? You aren't focused!")
                return true
            }

            // Prevent this event from reaching the Editor-level paste handler
            event.stopPropagation()

            const topaste = event.clipboardData?.getData("text/plain") ?? ""
            const deserializer = detect_deserializer(topaste)
            if (deserializer == null) {
                return false
            }

            // If we have the whole cell selected, the user doesn't want their current code to survive...
            // So we paste the cells, but then remove the original cell! (Ideally I want to keep that cell and fill it with the first deserialized one)
            // (This also applies to pasting in an empty cell)
            if (view.state.selection.main.from === 0 && view.state.selection.main.to === view.state.doc.length) {
                pluto_actions.add_deserialized_cells(topaste, cell_id, deserializer)
                pluto_actions.confirm_delete_multiple([cell_id])
                return true
            }

            // End of cell, add new cells below
            if (view.state.selection.main.to === view.state.doc.length) {
                pluto_actions.add_deserialized_cells(topaste, cell_id, deserializer)
                return true
            }

            // Start of cell, ideally we'd add new cells above, but we don't have that yet
            if (view.state.selection.main.from === 0) {
                pluto_actions.add_deserialized_cells(topaste, cell_id, deserializer)
                return true
            }

            return false
        },
    })
}
