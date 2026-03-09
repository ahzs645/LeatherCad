# Source-App Stitching Feature Matrix

Date: 2026-03-09

This matrix consolidates stitching-related actions and controls recovered from the extracted LeathercraftCAD app and compares them against the current LeatherCad implementation.

## Evidence Used

- `/Users/ahmadjalil/Downloads/leather-making/feature_string_refs.csv`
- `/Users/ahmadjalil/Downloads/leather-making/source_app_action_ticket_map.csv`
- `/Users/ahmadjalil/Downloads/leather-making/source_app_actions_core.txt`
- `/Users/ahmadjalil/Downloads/leather-making/extracted-rsrc/rsrc_form_details.txt`
- `/Users/ahmadjalil/Downloads/leather-making/extracted-app/Leathercraft_CAD_v2.8.3_macOS_ARM/LeathercraftCAD.app/Contents/Resources/StartUp/ReadMe_en.txt`
- `/Users/ahmadjalil/github/LeatherCad/src/features/editor/components/StitchHolePanel.tsx`
- `/Users/ahmadjalil/github/LeatherCad/src/features/editor/hooks/useStitchActions.ts`
- `/Users/ahmadjalil/github/LeatherCad/src/features/editor/ops/stitch-hole-ops.ts`
- `/Users/ahmadjalil/github/LeatherCad/src/features/editor/ops/pricking-iron-ops.ts`
- `/Users/ahmadjalil/github/LeatherCad/src/features/editor/ops/advanced-pattern-ops.ts`
- `/Users/ahmadjalil/github/LeatherCad/src/features/editor/components/ThreePreviewPanel.tsx`

## Action Matrix

| Action / Control | Source Label / Evidence | Likely Trigger Surface | Linked Function / Address | LeatherCad Parity | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `actChangeStitchingHoleShape` | `actChangeStitchingHoleShape`, `Open Pricking Iron Toolbox...` | Stitch tool menu or toolbox | `100691a9c`, `10069dbd8` | `partial` | high | LeatherCad has hole type selection plus custom pricking iron presets, but not the full toolbox with pitch, width, height, angle, blades, invert, and grouped presets. |
| `actDeleteStitchingHolesOnSelectedPaths` | `Delete stitching holes on the selected line(s)` | Context menu or stitch toolbar | `100692260` | `implemented` | high | Present via `Delete Selected` for selected stitch paths in `useStitchActions.ts`. |
| `actCountNumOfStitchingHolesOnSelectedPaths` | `Count the number of stitching holes on the selected stitching lines` | Context menu or stitch toolbar | `100692b18`, `1009e4334` | `implemented` | high | Present via `Count Selected`; current status is textual only, no dedicated result dialog. |
| `actShowHideStitchingSimulator` | `Turn On/Off Stitching Simulator` | Stitch simulator toggle | `1006944a8` | `partial` | high | LeatherCad has thread rendering in 3D and shape overrides, but no first-class simulator mode toggle matching the source app. |
| `actChangeThreadColor` | `Change thread color for stitching simulator` | Stitch simulator panel | `1006b267c` | `partial` | high | LeatherCad supports `stitchThreadColor`, but does not expose the broader simulator settings surface around it. |
| `actFixStitchingOrder` | `Auto fix the stitching simulation order` | Context menu on stitch hole | `1006b25c0` | `partial` | high | LeatherCad supports fix-order from selected hole and reverse, but not the exact right-click workflow or older-file repair flows described in release notes. |
| `actSelectNextStitchingHole` | `Specify the next stitching hole` | Explicit stitch-order mode | `10069435c`, `1006a6f3c`, `1009cfe54` | `implemented` | high | LeatherCad supports cycling to the next hole on a path. |
| `actEndsStitchHere` | `Ends stitch here` | Stitch-order context action | `100694210` | `missing` | medium | No explicit endpoint marker or "stop chain here" action exists in current code. |
| `actBoxStitch` | `Project stitching holes on the selected line(s)` | Box stitch helper | `1006945f4` | `partial` | high | Current helper generates an inset rectangle from bounds; source app exposes search distance, pairing logic, and stretch-related guidance. |
| `actExtractAsBoxStitchLine` | `actExtractAsBoxStitchLine` | Box stitch helper workflow | `100694740` | `missing` | medium | No extraction workflow exists for turning existing shapes into dedicated box-stitch candidate lines. |
| `ShowStitchPattern` | `chkShowStitchPattern`, `Show Stitches` | Simulator visibility checkbox | `100699e64`, `100a28850`, `100a2a05c`, `1009cfe54` | `partial` | high | Source app persists a stitch-visibility toggle; LeatherCad shows thread paths in 3D but lacks a matching simulator state model. |
| `ShowEven/ShowOddStitches` | `chkShowEvenStitches`, `chkShowOddStitches` | Simulator visibility controls | `100699fb0`, `10069a0ec` | `missing` | high | No even/odd thread visibility controls exist in current repo. |
| `Pricking Iron Toolbox` | `Pricking Iron Toolbox`, `btnDeletePrickingIronGroup`, `CannotDeleteSystePrickingIrons` | Dedicated preset editor dialog | `10069dbd8`, `100961934` | `partial` | high | LeatherCad supports builtin and custom irons in local storage, but not grouped presets, system presets, delete guards, or blade geometry editing. |
| `SVG stitch export options` | `gbSVG_StitchingHole`, `Stitching Holes Shape`, `If you want to export a stitching hole not a dot but as a line...` | SVG/DXF export dialog | `1006ada8c`, `1006ae710`, `100a28850`, `100a2a05c` | `missing` | high | Current export actions operate on shapes only and do not emit stitch-hole geometry or dot-vs-line settings. |
| `Print stitch holes as dots` | `chkPrintStitchingHoleAsDot`, `Print stitching holes as dots` | Print preview dialog | `10069f5a8` | `implemented` | high | Present in `PrintPreviewModal.tsx` and `print-output.ts`. |

## Direct Repo Observations

- LeatherCad already covers the core day-to-day operations:
  - custom pricking iron presets in local storage,
  - manual hole placement on stitch-role paths,
  - fixed and variable auto placement,
  - count and delete on selected paths,
  - resequence, reverse, select-next, and fix-order-from-selected,
  - thread color in the 3D preview.
- The clearest missing depth is around:
  - full pricking iron toolbox data,
  - inversion and blade geometry,
  - simulator state and visibility controls,
  - export behavior for stitch holes,
  - advanced box-stitch helper semantics.

## Recommended Immediate Follow-Ups

1. Use `TfrmChangeStitchingHoleType` and the `100a28850` / `100a2a05c` config functions as the primary source for the pricking iron and export settings model.
2. Treat `1009cfe54` as the main target if deeper extraction is needed for simulator rendering and `selectNextStitchingHoleMode`.
3. Do not spend more time on `10068db64`; it is a label catalog, not stitching logic.
