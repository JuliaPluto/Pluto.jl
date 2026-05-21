/**
 * @fileoverview Converts Julia code from dyad codegen to Pluto notebook format
 *
 * This module provides functionality to transform plain Julia code into a complete
 * Pluto notebook structure with predefined package dependencies and execution helpers.
 * The generated notebooks include:
 * - Package management cell with standard scientific computing dependencies
 * - User code wrapped in a module cell for proper scoping
 * - Execution helper cell for interactive Pluto features
 *
 * @author Pluto.jl Frontend Team
 */

import { serialize, PTOML_CELL_ID, MTOML_CELL_ID } from "./parser.js"

export const MODULE_CELL_ID = "00000000-c0de-ce11-0000-000000000000"

export const PKG_CELL_ID = "00000000-de95-ce11-0000-000000000000"
export const PKG_CELL_CODE = `# Dyad·Pluto Notebook
begin
  using DyadEcosystemDependencies
  using DyadInterface
  using Plots, CSV, DataFrames

  using AbstractPlutoDingetjes
end`

// Code that enables using pluto links and `worker.execute`
export const EXECUTION_CELL_ID = "00000000-0000-0208-1991-000000000000"
export const EXECUTION_CELL_ID_CODE = `begin
	function eval_in_pluto(x::String)
    try
		  id = PlutoRunner.moduleworkspace_count[]
		  new_workspace_name = Symbol("workspace#", id)
		  Core.eval(getproperty(Main, new_workspace_name), Meta.parse(x))
    catch
      return "failed to evaluate $x in latest module"
    end
	end
	AbstractPlutoDingetjes.Display.with_js_link(eval_in_pluto)
end`

export function from_dyadgen(code, defaultPackages = {}) {
    return serialize({
        cell_execution_order: [PKG_CELL_ID, MODULE_CELL_ID, EXECUTION_CELL_ID],
        cell_inputs: {
            [PKG_CELL_ID]: {
                cell_id: PKG_CELL_ID,
                code: PKG_CELL_CODE,
                code_folded: false,
                metadata: {
                    disabled: false,
                    show_logs: true,
                    skip_as_script: false,
                    name: "usings cell",
                },
            },
            [MODULE_CELL_ID]: {
                cell_id: MODULE_CELL_ID,
                code,
                code_folded: true,
                metadata: {
                    disabled: false,
                    show_logs: true,
                    skip_as_script: false,
                },
            },
            [EXECUTION_CELL_ID]: {
                cell_id: EXECUTION_CELL_ID,
                code: EXECUTION_CELL_ID_CODE,
                code_folded: true,
                metadata: {
                    disabled: false,
                    show_logs: true,
                    skip_as_script: false,
                },
            },
        },
        cell_order: [PKG_CELL_ID, MODULE_CELL_ID, EXECUTION_CELL_ID],
        _topological_order: [PKG_CELL_ID, MODULE_CELL_ID, EXECUTION_CELL_ID],
        _package_cells: {
            [MTOML_CELL_ID]: `PLUTO_MANIFEST_TOML_CONTENTS = """"""`,
            [PTOML_CELL_ID]: `PLUTO_PROJECT_TOML_CONTENTS = """
name = "DyadAnalysis"

[deps]
AbstractPlutoDingetjes = "6e696c72-6542-2067-7265-42206c756150"
${Object.entries(defaultPackages)
    .map(([name, { uuid }]) => `${name} = "${uuid}"`)
    .join("\n")}

[compat]
${defaultPackages.DyadEcosystemDependencies ? `DyadEcosystemDependencies = "${defaultPackages.DyadEcosystemDependencies.compat}"` : ""}

[extras]
CSV = "336ed68f-0bac-5ca0-87d4-7b16caf5d00b"
DataFrames = "a93c6f00-e57d-5684-b7b6-d8193f3e46c0"
Plots = "91a5bcdd-55d7-5caf-9e0b-520d859cae80"
"""`,
        },
    })
}
