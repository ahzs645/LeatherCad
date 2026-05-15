# Source-App Stitching Parity Gaps

Date: 2026-03-09

This document compares the recovered source-app stitching behavior against the current LeatherCad implementation.

## Current LeatherCad Baseline

Verified in current repo:

- Manual stitch-hole placement on stitch-role paths
- Custom pricking iron presets in local storage
- Fixed-pitch auto placement
- Variable-pitch auto placement
- Hole resequence and reverse
- Select next stitch hole
- Fix order from selected hole
- Thread color in 3D preview
- Print option to render stitch-role lines as dots
- LCC import/export for `S_HOLE` entities and linked sequences
- Grouped pricking iron catalogs with system delete guards, blade count, width, height, tilt, inversion, and source-shaped `prickingirons.lccp` JSON import/export
- Stitch simulator pattern visibility, even/odd toggles, thread thickness, and F6 / quick-key controls
- Leather Simulator coupling that enables stitch simulator pattern rendering and hides raw stitch holes

## Gap Matrix

| Capability | Source-App Evidence | Current LeatherCad | Status | Gap Summary |
| --- | --- | --- | --- | --- |
| Custom pricking iron group persistence | `TfrmChangeStitchingHoleType`, `prickingirons.lccp`, `pricking_iron_groups`, deletion guards for system groups | Grouped builtin/custom catalogs in `pricking-iron-ops.ts`; source-shaped JSON import/export | `partial` | Native desktop `.lccp` fixture still needed; UI is still partly prompt-driven instead of a full source-style editor. |
| Hole inversion handling | `chkInverted`, `chkPTB_Invert`, release note "Changing holes to inverted... can be done anytime" | `StitchHole.inverted` plus pricking-iron defaults; manual multi-blade placement walks backward when inverted | `partial` | Need broader source evidence for existing-hole inversion workflows and endpoint behavior on complex curves. |
| Hole rotation and endpoint handling | Release notes mention curve-aligned rotation and endpoint bug fixes | `angleDeg` is computed from sampled path segments | `partial` | Baseline exists, but no source-style controls for manual override, inversion interaction, or endpoint correction behavior. |
| Fixed and variable auto placement | Readme, `TfrmOptions`, `AutoPitch` config keys | Supported in `useStitchActions.ts` and `stitch-hole-ops.ts` | `implemented` | Present, but not configurable to the same depth as source app. |
| Section-limited / manual-then-auto placement | Readme explicitly describes it | Continuation/end-boundary logic exists | `partial` | Still needs a first-class selected-section start/end workflow. |
| Force-fit-last-hole behavior | `chkForceFitLastPrick`, `AutoPitch.ForceFitLastPrick` | Exposed in advanced auto-stitch settings | `implemented` | Needs native fixture validation. |
| Auto-pitch tuning parameters | `AutoPitchSteps2`, `AutoPitchPrecision2`, `AutoPitchStopGap` | Exposed in advanced auto-stitch settings | `implemented` | Needs native fixture validation. |
| Count by selected stitching paths | Action and count dialog strings | Supported via status text | `implemented` | Adequate baseline; source app likely has a dedicated result dialog. |
| Delete holes on selected paths | Action and release-note bug fixes | Supported | `implemented` | Baseline present. |
| Stitch order fixing from clicked hole | `actFixStitchingOrder`, release notes for right-click fix | Fix from selected hole and reverse | `partial` | Missing the explicit "clicked hole" context flow and possibly older-file repair logic. |
| Select next hole and end stitch here | `actSelectNextStitchingHole`, `actEndsStitchHere`, `selectNextStitchingHoleMode` | Select next supported; "Ends stitch here" absent | `partial` | Need explicit chain-end editing, not just selection cycling. |
| Simulator controls beyond thread color | `ShowStitchPattern`, `ShowEven/ShowOdd`, `ThreadThickness`, arrows release notes | Simulator state includes pattern, even/odd visibility, thickness, modal controls, and F6/quick-key handling | `partial` | Direction-arrow parity and source hotkey coverage still need validation. |
| Export as dot vs slit/line based on tool geometry | `SVG.AsDots`, `SVG.DotRadius`, blade-width-zero string | Export actions do not output stitch-hole entities | `missing` | Need actual stitch-hole export model for SVG/DXF/PDF and geometry-dependent rendering mode. |
| Print stitch holes as dots | `chkPrintStitchingHoleAsDot` | Supported in print preview | `implemented` | Print output now emits stitch-hole primitives and can force dot output for printing. |
| Box stitch helper parameterization | `BoxStitch.Distance`, helper hint about stretch factor | Guide extraction, selected-hole projection, pitch fallback, and search settings exist | `partial` | Pairing remains heuristic for rotated, curved, and irregular cases until native samples prove the algorithm. |

## Implementation-Ready Tickets

### `STX-01` Pricking iron group model and persistence

User-visible behavior:

- Manage pricking iron groups and presets in a dedicated toolbox.
- Support system presets that cannot be deleted.
- Reorder groups and presets.

Required model changes:

- Add `PrickingIronGroup`.
- Extend `PrickingIronPreset` with `numBlades`, `widthMm`, `heightMm`, `angleDeg`, `inverted`.
- Support persistence separate from per-document stitch holes.

UI changes:

- Replace prompt-based custom-iron creation with a modal/toolbox surface.

Export/IO implications:

- Preset geometry must be available to export logic.

Acceptance criteria:

- User can create, edit, reorder, and delete custom groups.
- System groups cannot be deleted.
- Preset geometry survives reload.

### `STX-02` Stitch-hole geometry, inversion, and endpoint parity

User-visible behavior:

- Toggle inversion on existing holes.
- Preserve correct angle at path ends and on curves.

Required model changes:

- Add `inverted?: boolean`.
- Add richer geometry metadata beyond `holeType`.

UI changes:

- Per-hole settings modal or inline controls for inversion and geometry.

Acceptance criteria:

- Inverting a hole changes orientation without breaking order or path linkage.
- Endpoint holes remain correctly oriented on lines, arcs, and beziers.

### `STX-03` Advanced auto-pitch settings parity

User-visible behavior:

- Expose fixed vs variable default, force-fit-last-hole, and tuning controls.
- Allow partial-path continuation workflows.

Required model changes:

- Persist auto-pitch settings in document or app preferences.
- Add explicit placement mode enum and optional range selection metadata.

UI changes:

- Options modal or stitch panel controls for auto-pitch parameters.

Acceptance criteria:

- User can switch force-fit on and off and observe the endpoint difference.
- User can place holes on a selected subsection of a path.

### `STX-04` Stitch simulator parity

User-visible behavior:

- Toggle simulator on/off.
- Change thread color and thickness.
- Toggle even and odd stitch visibility.
- Show direction arrows.
- Set stitch end explicitly.

Required model changes:

- Add simulator settings object and optional per-shape overrides.

UI changes:

- Dedicated simulator controls panel or stitch subsection in 3D preview.

Acceptance criteria:

- Simulator state persists.
- Even/odd toggles and thickness affect rendering immediately.

### `STX-05` Box stitch helper parity

User-visible behavior:

- Use box-stitch helper with configurable search distance.
- Extract helper lines from selection.
- Support stretch-aware guidance for rounded constructions.

Required model changes:

- Add helper settings and possibly helper-line classification metadata.

UI changes:

- Replace prompt-only inset flow with a structured dialog.

Acceptance criteria:

- Helper can search and pair candidate lines.
- Extracted helper lines can be re-used for projection workflows.

### `STX-06` Stitch export and print parity

User-visible behavior:

- Export stitch holes as dots, slits, or single lines depending on preset geometry and export mode.
- Control dot radius explicitly.

Required model changes:

- Add export settings:
  - `stitchHoleRenderMode`
  - `stitchDotRadius`
  - optional `exportHiddenStitchTypes`

UI changes:

- Expand export dialog with recovered stitch-hole controls.

Acceptance criteria:

- SVG/DXF/PDF output includes stitch-hole primitives.
- Zero-width blade presets export as lines when selected.

## Recommended Implementation Order

1. `STX-01` Pricking iron group model and persistence
2. `STX-02` Stitch-hole geometry, inversion, and endpoint parity
3. `STX-03` Advanced auto-pitch settings parity
4. `STX-06` Stitch export and print parity
5. `STX-04` Stitch simulator parity
6. `STX-05` Box stitch helper parity
