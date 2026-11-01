# Interface implementation: reference-style drafting surface and interaction model

Implemented 2026-11-01, following the findings in the [interface comparison](INTERFACE_COMPARISON_2026-11-01.md). The reference is the captured Leathercraft CAD web editor (build `2026-10-27`). Behaviour was reproduced from its observable interface and embedded UI strings. No reference code or assets were copied.

## Drafting surface

| Change | Details | Where |
| --- | --- | --- |
| Reference grid | A 1-2-5 tick ladder chosen so one tick is at least 10 px. Minor lines are dashed, with a heavier line every 5 ticks (4 in inches), a stronger line every 10 (8 in inches), and axes. Distance labels inside the drawing area were removed; the rulers carry them. | [`reference-grid.ts`](../src/features/editor/ops/reference-grid.ts), [`useCanvasGrid.ts`](../src/features/editor/hooks/useCanvasGrid.ts) |
| Dark surface by default | `#1a1a1a` surface with the reference grid colours. Light and follow-theme remain in Options › Display and grid. The choice is now remembered. | [`interface-preferences.ts`](../src/features/editor/ops/interface-preferences.ts) |
| Edge rulers | 22 px top/left rulers that follow zoom and pan. Labels sit on major ticks, with millimetres or inch fractions down to 1/64". An orange cursor marker shows the pointer, and a cyan band shows the selection's extent. The corner button toggles a relative origin at the selection's corner. **S** (the Ruler command) shows or hides them. They are hidden at phone widths. | [`CanvasEdgeRulers.tsx`](../src/features/editor/components/canvas/CanvasEdgeRulers.tsx) |
| Tool hint bubble | Tool name, shortcut and next step, e.g. "Rectangle R · Click the first corner". With a selection it suggests Enter for size and position. | [`CanvasToolHint.tsx`](../src/features/editor/components/canvas/CanvasToolHint.tsx) |
| Dark canvas chrome | Legend, view controls, command strip and right-click menu match the dark surface. | `_workspace-canvas-surfaces.scss` |

Rulers show raw world coordinates (Y grows downward), matching the inspector and command line. The previous in-canvas labels showed Y negated, which disagreed with both. **Invert Y axis** in Options flips the rulers and the new size fields for users who prefer Y-up.

## Interaction model

| Finding | Implemented | Where |
| --- | --- | --- |
| I1 tool keys | A single-key tool map shared by the rail tooltips (`aria-keyshortcuts`), the hint bubble, Help and the tour. Reference letters are used where both apps share a tool: A select, L line, R rectangle, E circle, Shift+E ellipse, V arc, B Bézier, T text, P stitch, # dimension. Free letters cover LeatherCad-only tools. **N** toggles mm/inch and Ctrl/Cmd+, opens Options. | [`tool-shortcuts.ts`](../src/features/editor/ops/tool-shortcuts.ts), [`useKeyboardShortcuts.ts`](../src/features/editor/hooks/useKeyboardShortcuts.ts) |
| I1 key conflicts | **V** is now Arc (Select is **A** or Escape). **T** is now Text (tracing visibility moved to **Shift+T**). Arrow keys **nudge a selection** by 1 mm (Shift 0.1 mm) and pan when nothing is selected. Ctrl/Cmd+arrow fine nudges are unchanged. | same |
| I2 tool options bar | A per-tool bar above the canvas. Line: length, angle, constraint and angle step. Rectangle: W/H. Circle: radius. Ellipse: radii. Arc: mode, radius and ratio. Text: text, size and font. Stitch: hole shape and size. Notch: depth and angle. Polyline-type tools get Finish/Cancel. Typed sizes complete the shape at the first click, or immediately if a shape is in progress, through the same command path as the command line. | [`ToolOptionsBar.tsx`](../src/features/editor/components/ToolOptionsBar.tsx), [`tool-option-commands.ts`](../src/features/editor/ops/tool-option-commands.ts) |
| I3 selection geometry | Inspector **Position & size**: bounding-box X/Y/W/H with keep-aspect, plus relative Rotate and Scale about the pivot. A single line also gets Length and Angle. Each edit is one undoable change, and stitch holes move with their shapes. **Enter** (or the bar's *Size & position*) focuses X, opening the Inspect tab if needed. | [`SelectionGeometryControls.tsx`](../src/features/editor/workbench/SelectionGeometryControls.tsx), [`selection-geometry.ts`](../src/features/editor/ops/selection-geometry.ts) |
| I4 context actions | The right-click menu is built from the selection, in sections: clipboard, flip/rotate/pivot, line-to-axis (single line), arcs-to-Bézier (arcs only), order, group/ungroup, lock/unlock, layer moves (only when another layer exists) and Delete (n). With nothing selected it offers Paste, Select all and Fit. It has separators, shortcut hints, arrow-key navigation and keeps itself on screen. Inspector Context Actions are grouped and hide inapplicable commands instead of greying them out. | [`buildCanvasContextMenuItems.ts`](../src/features/editor/modules/canvas/buildCanvasContextMenuItems.ts), [`CanvasContextMenu.tsx`](../src/features/editor/components/CanvasContextMenu.tsx), [`SelectionInspectorPanel.tsx`](../src/features/editor/workbench/SelectionInspectorPanel.tsx) |
| I5 touch | Two-finger pinch zoom about the midpoint and two-finger pan. Two-finger double tap undoes and three-finger double tap redoes. A touch tap with a drawing tool applies on lift, so a pinch never places a stray point, and sliding before lifting moves the point. A touch pad (Multi-select latch, Undo, Redo, Delete) appears for coarse pointers, on the left or right, or hidden. | [`useCanvasTouchGestures.ts`](../src/features/editor/hooks/canvas-interactions/useCanvasTouchGestures.ts), [`CanvasTouchPad.tsx`](../src/features/editor/components/canvas/CanvasTouchPad.tsx) |
| I6 numeric input | A safe recursive-descent parser handles arithmetic, parentheses, unit suffixes (mm/cm/in/"/ft), fractions and mixed numbers (`5/32in`, `1 1/4"`), and full-width digits and operators. It is used by `LengthInput`, the tool bar, the geometry fields and command-line numbers. No `eval`. | [`numeric-expression.ts`](../src/features/editor/ops/numeric-expression.ts) |
| I7 Escape | Cascade: cancel the shape in progress → back to Select → clear the selection → return to the previous tool. | `useKeyboardShortcuts.ts` |
| I8 icons | Stitch, Notch, Seam, Seam+ and Freehand each have their own icon. A test enforces uniqueness. | `public/icons/leathercad/`, [`editor-constants.ts`](../src/features/editor/editor-constants.ts) |
| I9 status bar | Zoom returns to 100%. Unit toggles mm/in. SNAP and GRID are on/off toggles. | [`WorkbenchStatusbar.tsx`](../src/features/editor/workbench/WorkbenchStatusbar.tsx) |
| I9 tour | A non-modal 9-step spotlight tour on first run, replayable from Options. It never opens on its own in automated runs. | [`ScreenTour.tsx`](../src/features/editor/components/ScreenTour.tsx) |
| I9 phone legend | The legend starts folded on phones and can be hidden on desktop. | [`LayerLegendPanel.tsx`](../src/features/editor/components/LayerLegendPanel.tsx) |

New Options entries under *Input devices and tools › Drawing surface*: edge rulers, invert Y, tool hint, touch-pad side, and **Show the screen tour**. The Help shortcut list was rewritten for the new keymap.

## Defects found and fixed along the way

| Defect | Effect | Fix |
| --- | --- | --- |
| **Redo never worked for ordinary edits.** Generic edits are recorded as snapshot operations, which kept only the "before" state; redo returned the state unchanged, and the snapshot fallback never ran. | Ctrl+Y / Ctrl+Shift+Z did nothing after drawing, moving, deleting and so on. | Undo now stores the "after" state on the operation, and redo restores it. Regression test in [`operation-history.test.ts`](../src/features/editor/ops/operation-history.test.ts). |
| **Phone users could not keep a drawing tool.** The responsive-layout effect re-ran on every render and reset the tool to Move. | Picking Rectangle (or any tool) in the phone tool list snapped straight back to Move. | The media listener runs on mount and real breakpoint changes only. Repeat events still follow the route. Covered by the mobile e2e spec. |
| A late startup demo could reset the tool chosen from a list | The startup guard counted only pointer and key events as interaction, so a tool picked through a `change` event was undone when the demo document finished loading. | Form `change`/`input` events also count as interaction. |
| No touchscreen pinch on the 2D canvas | Pinch did nothing on tablets and phones. | I5 above. |
| Single-shape inspector title showed a raw UUID | "line shape / cfcccbd8-…" | Now "Line shape / ID cfcccbd8". |

## Verification

| Check | Result |
| --- | --- |
| Unit suite | 194 files / 1,384 tests. New tests cover the grid ladder and labels, tool keys and icons, expressions, armed commands, selection geometry, the context menu, pinch math and snapshot redo. |
| TypeScript, ESLint, architecture check | Pass |
| Browser (Playwright, system Chromium) | **68 / 68.** The full suite (desktop, production build, tablet, phone) passed 62/62 existing and unchanged tests. After fixing their own timing and coordinate issues, the new [`reference-interface.spec.ts`](../e2e/reference-interface.spec.ts) (rulers, keys, typed sizes, Escape cascade, geometry, menu, redo, status toggles, tour) and the phone tests in [`mobile-smoke.spec.ts`](../e2e/mobile-smoke.spec.ts) (tool list, taps, folded legend, pinch) passed 16/16 on a re-run of both files. |
| Touch | Synthetic DevTools pinch: 155% → 620% (the reference went 100% → 400%, the same 4×). Two/three-finger double taps undo and redo. Real iPad and iPhone hardware still needs the [device walkthrough](PHYSICAL_DEVICE_ACCEPTANCE.md). |

## Behaviour changes to note

- **V**, **T** and the arrow keys changed meaning (see I1). Help, tooltips and the tour show the new keys.
- Touch taps with drawing tools apply on lift rather than on touch-down.
- The canvas defaults to the dark surface. Users who chose a background before keep it only from now on, because the setting was not persisted previously.
- The old in-canvas axis ruler overlay is still available: turn off *Edge rulers* and the Ruler command (S) shows it as before.
