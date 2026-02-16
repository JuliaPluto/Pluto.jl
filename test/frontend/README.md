# Pluto end-to-end tests

All commands here are executed in this folder (`Pluto.jl/test/frontend`).

## Install packages

`npm install`

## Run Pluto.jl server

```
PLUTO_PORT=2345; julia --project=/path/to/PlutoDev -e "import Pluto; Pluto.run(port=$PLUTO_PORT, require_secret_for_access=false, launch_browser=false)"
```

or if Pluto is dev'ed in your global environment:

```
PLUTO_PORT=2345; julia -e "import Pluto; Pluto.run(port=$PLUTO_PORT, require_secret_for_access=false, launch_browser=false)"
```

## Run tests

`PLUTO_PORT=2345 npm run test`

## i18n + RTL guardrails

Run static guardrails that prevent new hardcoded UI English and new RTL regressions:

`npm run guard-i18n-rtl`

If you intentionally changed the baseline debt (for example after a cleanup), update the baseline file:

`npm run guard-i18n-rtl:update-baseline`

When this guard fails in CI, track and triage debt here:

https://github.com/JuliaPluto/Pluto.jl/issues/new?title=RTL+%2B+i18n+guardrail+debt+baseline

For RTL verification, Pluto supports a hidden direction override:

- Query parameter: `?pluto_ui_dir=rtl` (or `ltr`)
- Local storage key: `pluto_ui_direction_override` (`rtl` or `ltr`)

## View the browser in action

Add `HEADLESS=false` when running the test command.

`clear && HEADLESS=false PLUTO_PORT=1234 npm run test`

## Run a particular suite of tests

Add `-- -t=name of the suite` to the end of the test command.

`clear && HEADLESS=false PLUTO_PORT=1234 npm run test -- -t=PlutoAutocomplete`

## To make a test fail on a case that does not crash Pluto

Use `console.error("PlutoError ...")`. This suite will fail if a console
command has PlutoError in the text. Do that when a bad situation is handled
but the underlying cause exists.
