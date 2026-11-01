# Interface implementation: reference-style drafting surface and interaction model

Implemented 2026-11-01, following the findings in the [interface comparison](INTERFACE_COMPARISON_2026-11-01.md). The reference is the captured Leathercraft CAD web editor (build `2026-10-27`). Behaviour was reproduced from its observable interface and embedded UI strings. No reference code or assets were copied.

## Drafting surface

| Change | Details | Where |
| --- | --- | --- |
| Reference grid | A 1-2-5 tick ladder chosen so one tick is at least 10 px. Minor lines are dashed, with a heavier line every 5 ticks (4 in inches), a stronger line every 10 (8 in inches), and axes. Distance labels inside the drawing area were removed; the rulers carry them. | [`reference-grid.ts`](../src/features/editor/ops/reference-grid.ts), [`useCanvasGrid.ts`](../src/features/editor/hooks/useCanvasGrid.ts) |
| Reference surface colours | `#1a1a1a` dark surface or `#ffffff` light surface with the reference grid colours. It follows the app theme by default (see the theme pass below). The choice is remembered. | [`interface-preferences.ts`](../src/features/editor/ops/interface-preferences.ts) |
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

## Theme and layout pass

A second pass aligned the whole workbench with the reference's colours and fixed layout collisions found in a screenshot audit (light and dark, at 1440×900, 1024×768 and 390×844).

| Change | Details | Where |
| --- | --- | --- |
| Reference palette in both themes | **Dark:** warm graphite (`#1a1a1e` / `#26262c`, borders `#3a3a45`) with the reference amber (`#c8922a` / `#e8b44a`). **Light:** warm paper (`#efebe3` / `#fbfaf6`) with a deeper amber (`#a8690b`) that keeps white text readable. Shell tokens are re-pointed rather than each rule rewritten. Active buttons use readable text on amber, and native checkboxes, sliders and selects follow the theme. | [`_theme-reference.scss`](../src/app/styles/partials/_theme-reference.scss) |
| One token set for drafting chrome | The tool bar, right-click menu, tour, command line, inspector fields and status toggles use `--cad-*` tokens, and nothing is hard-coded. Controls floating on the canvas (hint, zoom, legend, touch pad) use `--cad-overlay-*`, which follows the canvas surface because it can be set separately from the app theme. | [`_cad-chrome.scss`](../src/app/styles/partials/_cad-chrome.scss) |
| Canvas follows the app theme | The default is now *Follow app theme*: a dark theme gives the reference's dark surface and a light theme a white sheet. Light or Dark in Options › Display and grid still force it. The preference moved to a new key because the earlier value was saved automatically, not chosen. | [`interface-preferences.ts`](../src/features/editor/ops/interface-preferences.ts) |
| Command line in the layout | The command line sits below the canvas instead of covering its bottom edge. Previously it hid the zoom controls. | `_cad-chrome.scss` |
| Zoom controls show the zoom | − / **146%** / + / Fit. The percentage resets to 100%. | [`EditorCanvasPane.tsx`](../src/features/editor/components/EditorCanvasPane.tsx) |
| Legend folded by default | The legend starts as a small **Legend** chip on every screen size and remembers when it is opened. Expanded, it covered up to half of a 1280×720 canvas (an existing editor test's clicks landed on it). The chip sizes to its label, so on phones it no longer covers the zoom controls. | [`LayerLegendPanel.tsx`](../src/features/editor/components/LayerLegendPanel.tsx), `_cad-chrome.scss` |
| Compact selection actions | The tool bar's selection actions are icon buttons with tooltips, shortcut hints and accessible names, so they fit without scrolling. | [`tool-action-icons.tsx`](../src/features/editor/components/tool-action-icons.tsx) |
| Tablet (768–1100 px) | The canvas takes the width, and the tool rail is kept (it was hidden, leaving no tool access without a keyboard). The document browser is a sheet opened from a **Document** tab. The header hides the subtitle, document caption and workspace-preset menu so tabs and actions no longer overlap. | `_cad-chrome.scss`, [`EditorWorkbench.tsx`](../src/features/editor/workbench/EditorWorkbench.tsx) |
| Options readability | Body text inside Options is 12 px muted copy instead of oversized paragraphs. | `_cad-chrome.scss` |

The tablet smoke test now opens the Document tab before checking that pieces and seams are reachable. The reference-interface spec checks that the canvas follows the system theme in both directions.

## Consistency pass and second comparison

**Measured, not eyeballed.** A script records the rendered height, radius and font size of every visible button, select and input in each region (header, ribbon, document browser, tool rail, tool bar, canvas overlays, command line, inspector, status bar, phone top bar) at 1440×900, 1024×768 (touch) and 390×844 (touch). Before this pass the desktop alone had **12 control heights** (18–44 px) and **6 radii** (0–8 px). The command-line input was 21 px with square corners next to a 31 px rounded Run button. The tablet zoom group mixed 44 px and 30 px buttons, because an old rule sized only the first two buttons of the group.

**One scale, loaded last** ([`_controls.scss`](../src/app/styles/partials/_controls.scss)):

| Token | Mouse | Touch | Used by |
| --- | --- | --- | --- |
| `--ctl-h` | 26 px | 44 px | Header, tool bar, canvas overlays, command line, inspector fields and actions, browser rows and V/L buttons, tour |
| `--ctl-h-tab` | 26 px | 44 px | Header tabs, inspector tabs |
| `--ctl-h-tool` | 36 px | 44 px | Tool rail |
| `--ctl-h-xs` | 20 px | 32 px | Status bar |
| `--ctl-radius` / `--panel-radius` | 4 px / 6 px | same | All controls / panels and popovers |
| `--ctl-font` / `--ctl-font-small` | 12 px / 11 px | same | Controls / labels and status bar |

After the pass, every region measures the same on desktop (compact controls 26 px with a 4 px radius, status 20 px, rail 36 px, ribbon commands 56 px). On touch screens every group is 44 px. The values follow the reference's compact proportions: it uses 25–26 px controls, 3–4 px radii and 36 px tool buttons. Text stays at 12 px rather than the reference's 11 px, for readability.

Fixes found along the way:

- The header tabs sat 6.5 px below the other header controls.
- Empty document-browser sections stretched into tall blank boxes.
- The *Canvas first* preset left the shell grid with a missing row.
- The active tool used a solid amber fill. It now uses the reference's amber wash with an amber icon.

### Region-by-region comparison with the reference (current state)

Captured in the same state in both apps (rectangle drawn, one edge selected, dark theme) with the offline replay of the captured reference build.

| Region | Reference | LeatherCad now | Status |
| --- | --- | --- | --- |
| Drawing surface | Dark grid, 1-2-5 ticks, edge rulers with cursor marker and selection band, hint bubble | Same, in light and dark | Matches |
| Tool options | In the 44 px top bar, by tool | Bar above the canvas, same per-tool fields, icon selection actions | Matches (placement differs) |
| Chrome above the canvas | One 44 px bar | Header + ribbon + tool bar (canvas at 183 px). The ribbon can now be hidden (canvas at 96 px) and returns when a tab is clicked | Intentional difference; much closer when collapsed |
| Tool rail | 36 px buttons, amber wash for the active tool, undo/redo pinned on top | 36 px buttons, amber wash for the active tool; undo/redo in the header | Matches except undo/redo placement |
| Numeric size and position | Floating palette near the selection | Inspector *Position & size* (Enter focuses it) | Equivalent, different placement |
| Right-click menu | Shape-aware, layer submenu | Shape-aware, grouped, layer actions inline | Equivalent |
| Selection on canvas | Dashed outline with square handles | Thicker stroke with amber handles; amber window box | Partly aligned |
| Line types / layers | 40-slot palette and layer list always visible on the right | Line type in the status bar and ribbon, layers in the document browser | Different structure (LeatherCad also has pieces, seams and 3D) |
| Bottom / status | Go-to X/Y, selection info, cursor X/Y, units, snap, shape count | Command line (accepts `x,y`), selection, **cursor X/Y**, zoom, units, snap, grid, **shape count** | Matches |
| Colours | Graphite + amber, dark only (light canvas option) | Same palette in dark; warm-paper variant in light | Matches, plus a light theme |
| Phone | No phone layout | Dedicated phone shell, 44 px targets | LeatherCad only |

Remaining differences worth considering next: an always-visible line-type palette (the reference's quickest way to pick cut/stitch/guide lines), dashed selection outlines, and a floating size palette next to the selection as an alternative to the inspector.

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
- The canvas follows the app theme by default. Choose Light or Dark in Options to force it.
- The old in-canvas axis ruler overlay is still available: turn off *Edge rulers* and the Ruler command (S) shows it as before.
