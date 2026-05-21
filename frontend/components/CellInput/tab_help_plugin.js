import { th } from "../../common/lang.js"
import { open_pluto_popup } from "../../common/open_pluto_popup.js"
import { ViewPlugin, StateEffect, StateField } from "../../imports/CodemirrorPlutoSetup.js"
import _ from "../../imports/lodash-es.js"
import { html } from "../../imports/Preact.js"

/** @type {any} */
const TabHelpEffect = StateEffect.define()
const TabHelp = StateField.define({
    create() {
        return false
    },
    update(value, tr) {
        for (let effect of tr.effects) {
            if (effect.is(TabHelpEffect)) return effect.value
        }
        return value
    },
})

/** @type {any} */
export const LastFocusWasForcedEffect = StateEffect.define()
const LastFocusWasForced = StateField.define({
    create() {
        return false
    },
    update(value, tr) {
        for (let effect of tr.effects) {
            if (effect.is(LastFocusWasForcedEffect)) return effect.value
        }
        return value
    },
})

export const tab_help_plugin = ViewPlugin.define(
    (view) => ({
        setready: (x) =>
            requestIdleCallback(() => {
                view.dispatch({
                    effects: [TabHelpEffect.of(x)],
                })
            }),
    }),
    {
        provide: (p) => [TabHelp, LastFocusWasForced],
        eventObservers: {
            focus: function (event, view) {
                // The next key should trigger the popup
                this.setready(true)
            },
            blur: function (event, view) {
                this.setready(false)
                requestIdleCallback(() => {
                    view.dispatch({
                        effects: [LastFocusWasForcedEffect.of(false)],
                    })
                })
            },
            click: function (event, view) {
                // This means you are not doing keyboard navigation :)
                this.setready(false)
            },
            keydown: function (event, view) {
                if (event.key == "Tab") {
                    if (view.state.field(TabHelp) && !view.state.field(LastFocusWasForced) && !view.state.readOnly) {
                        open_pluto_popup({
                            type: "info",
                            source_element: view.dom,
                            body: th("t_help_about_tab_navigation_inside_cell"),
                        })
                        this.setready(false)
                    }
                } else {
                    this.setready(false)
                }
            },
        },
    }
)
