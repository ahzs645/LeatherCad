# Source-App Stitching Behavior Notes

Date: 2026-03-09

This document reconstructs the source app's stitching behavior from release notes, form resources, string references, and the existing pseudo-C outputs. Each behavior is marked as either `confirmed` or `inferred`.

## Evidence Base

- Release notes:
  - `/Users/ahmadjalil/Downloads/leather-making/extracted-app/Leathercraft_CAD_v2.8.3_macOS_ARM/LeathercraftCAD.app/Contents/Resources/StartUp/ReadMe_en.txt`
- Form controls:
  - `/Users/ahmadjalil/Downloads/leather-making/extracted-rsrc/rsrc_form_details.txt`
- String-to-function references:
  - `/Users/ahmadjalil/Downloads/leather-making/feature_string_refs.csv`
- Config save/load pseudo-C:
  - `/Users/ahmadjalil/Downloads/leather-making/ghidra_feature_functions_pseudoc.txt`

## Confirmed Settings Surfaces

The source app persists stitching-related settings in `lc_options.ini` through the save and load functions `100a28850` and `100a2a05c`.

Recovered keys:

- `AutoPricking.IsFixedPitchDefault`
- `AutoPitch.ForceFitLastPrick`
- `AutoPitch.AutoPitchSteps2`
- `AutoPitch.AutoPitchPrecision2`
- `AutoPitch.AutoPitchStopGap`
- `BoxStitch.Distance`
- `Stitch.ShowStitchPattern`
- `Stitch.ThreadThickness`
- `SVG.AsDots`
- `SVG.DotRadius`

Interpretation:

- `confirmed`: stitching is not just a draw tool; it has persisted application-level defaults.
- `confirmed`: the auto-pitch solver has at least three tuning parameters beyond simple start/end pitch.
- `confirmed`: stitch simulation includes visibility and thread-thickness state, not only thread color.
- `confirmed`: export behavior distinguishes dot mode from geometry-driven line output.

## Behavior Reconstruction

### 1. Fixed vs variable pitch

- `confirmed`: release notes explicitly state that automatic stitching supports both fixed pitch and variable pitch.
- `confirmed`: `TfrmOptions` contains `rbAutoPitchAuto` and `rbAutoPitchFixed`.
- `confirmed`: config functions persist `AutoPricking.IsFixedPitchDefault`.

Practical reading:

- The source app exposes a user-visible default mode switch between fixed and automatic/variable pitch.
- LeatherCad already supports fixed and variable pitch generation, but does not yet expose the source app's persistent default mode and tuning controls.

### 2. Force-fit last hole to path end

- `confirmed`: `TfrmOptions` contains `chkForceFitLastPrick`.
- `confirmed`: config functions persist `AutoPitch.ForceFitLastPrick`.

Interpretation:

- The source app likely lets users choose between preserving nominal pitch vs ensuring the last hole lands exactly at the endpoint.
- LeatherCad currently always uses its own spacing heuristic and does not expose this tradeoff explicitly.

### 3. Auto-pitch tuning

- `confirmed`: `TfrmOptions` contains `nbOP_AutoPitchSteps`, `nbOP_AutoPitchPrecision`, and `nbOP_AutoPitchGapAllowance`.
- `confirmed`: the config load/save functions persist `AutoPitchSteps2`, `AutoPitchPrecision2`, and `AutoPitchStopGap`.
- `confirmed`: release notes repeatedly mention performance and correctness fixes in auto stitching.

Interpretation:

- The source app's variable/fixed placement logic is configurable and solver-driven.
- `inferred`: `AutoPitchSteps2` is likely the number of refinement iterations or segmentation steps.
- `inferred`: `AutoPitchPrecision2` is likely the acceptable error threshold for even spacing.
- `inferred`: `AutoPitchStopGap` is likely the allowable residual gap near the end of the selected section.

### 4. Manual-then-auto workflow on partial sections

- `confirmed`: release notes state that users can place holes manually up to a point with fixed pitch and then place the rest automatically with variable pitch.

Interpretation:

- The source app supports hybrid workflows where the auto placement start is not necessarily the beginning of the path.
- LeatherCad does not currently model a section-limited or partial-path continuation workflow.

### 5. Hole rotation and inversion

- `confirmed`: release notes say hole rotation is adjusted automatically along curves.
- `confirmed`: `TfrmStitchingHoleSettings` exposes `nbAngle`.
- `confirmed`: `TfrmStitchingHoleSettings` and `TfrmChangeStitchingHoleType` expose inversion via `chkInverted` and `chkPTB_Invert`.

Interpretation:

- The source app distinguishes at least two concerns:
  - angle driven by path tangent,
  - user-forced inversion / reverse orientation.
- LeatherCad stores `angleDeg` on each hole, but does not currently store an explicit inversion flag.

### 6. Pricking iron toolbox

- `confirmed`: `TfrmChangeStitchingHoleType` includes group CRUD, name, blade count, pitch, width, height, angle, and invert controls.
- `confirmed`: string references mention `Pricking Iron Toolbox`, deletion guards for system presets, and `prickingirons.lccp` / `pricking_iron_groups`.

Interpretation:

- The source app has a proper preset-management subsystem.
- `inferred`: pricking iron groups are serialized separately from project data and may support system-defined immutable groups.
- LeatherCad currently treats presets as flat local-storage entries with `id`, `name`, `shape`, and `pitchMm`.

### 7. Count and delete behavior on selected paths

- `confirmed`: actions exist for counting and deleting holes on selected paths.
- `confirmed`: release notes mention right-click access for count-on-selected-lines.
- `confirmed`: string references include `numOfStitchingHoles` and `Number of stitching holes:`.

Interpretation:

- The source app likely shows a dedicated result dialog or formatted popup.
- LeatherCad currently reports the count through status text only.

### 8. Stitch simulator behavior

- `confirmed`: actions and strings exist for:
  - showing/hiding the simulator,
  - changing thread color,
  - fixing stitching order,
  - selecting next stitching hole,
  - ending the stitch at a chosen hole.
- `confirmed`: release notes mention:
  - arrows to the next hole,
  - even/odd visibility toggles,
  - thread thickness hotkeys,
  - automatic order fixing from a right-clicked position.
- `confirmed`: `TfrmOptions` persists `Stitch.ThreadThickness`.
- `confirmed`: strings reference `chkShowStitchPattern`, `chkShowEvenStitches`, and `chkShowOddStitches`.

Interpretation:

- The source app has a first-class stitch simulator state model.
- LeatherCad currently has thread rendering in the 3D bridge and a thread color setting, but not:
  - explicit simulator on/off state,
  - even/odd visibility,
  - thread thickness control,
  - "ends stitch here" state,
  - a dedicated simulator mode surface.

### 9. Export rule for dots vs lines

- `confirmed`: `TfrmSVGExportOptions` exposes `gbSVG_StitchingHole` and `nbSVGDotRadius`.
- `confirmed`: config functions persist `SVG.AsDots` and `SVG.DotRadius`.
- `confirmed`: source strings say that setting blade width to `0 mm` causes each stitching hole to export as a single line rather than a dot.

Interpretation:

- Export output depends on both the hole preset geometry and explicit export options.
- LeatherCad currently prints stitch-role lines with a dotted dash pattern when `printStitchAsDots` is enabled, but does not export actual stitch-hole primitives with the source app's dot-vs-line rules.

### 10. Box stitch helper

- `confirmed`: strings and options persist `BoxStitch.Distance`.
- `confirmed`: source strings describe projecting stitching holes on selected lines.
- `confirmed`: a long hint string mentions stretch-factor compensation for round forms when using Box Stitch Helper.

Interpretation:

- The source helper is not just "make an inset rectangle".
- `inferred`: it searches for paired candidate lines within a configurable distance and can compensate for stretch on curved constructions.

## Current Unknowns

These behaviors still need deeper decompilation if exact parity is required:

- the precise variable-pitch spacing algorithm,
- the exact meaning of `AutoPitchSteps2` and `AutoPitchStopGap`,
- the serialized format and lifecycle of pricking iron groups in `prickingirons.lccp`,
- the internal data model for "Ends stitch here",
- the exact simulator rendering rules for even/odd stitches and directional arrows.

## Recommended Next Binary Targets If Needed

- `100a28850`: saves stitching and export defaults.
- `100a2a05c`: loads stitching and export defaults.
- `1009cfe54`: simulator rendering and stitching UI mode behavior.
- `100a296b0`: likely pricking iron group persistence.
- `100a29d24`: likely pricking iron group loading or secondary persistence path.
- `1009e4334`: likely count dialog / hole-count display path.
