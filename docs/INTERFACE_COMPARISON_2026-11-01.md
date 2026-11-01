# Interface comparison: Coffee Craft CAD web vs LeatherCad

Reviewed 2026-11-01. This pass compares the **interface and interaction model** of both apps. Interchange, manufacturing and cloud parity are covered in the [baseline comparison](COFFEE_CAD_COMPARISON_2026-10-31.md) and later reports. It also completes the "focused behavior mapping" that [the remaining-parity analysis](REMAINING_PARITY_ANALYSIS_2026-10-31.md#reference-controls-needing-a-focused-behavior-mapping) left open.

> **Status:** the findings below (I1–I9) and the reference-style drafting surface are implemented. See the [implementation report](INTERFACE_IMPLEMENTATION_2026-11-01.md). The tables here record the state at `b619687`.

## Evidence and method

| Input | Identity |
| --- | --- |
| Reference capture | The same private `cadcoffee` HAR, SHA-256 `19537cb5a7361b1b366f68fc2e0dc524cb921a34f0e62b295aa7776672f10107` |
| Reference build | `app-affc2f74a7.js` / `.html`, application version `2026-10-27` |
| LeatherCad | `b619687` (main), Vite dev server, Chromium |

- **Reference runtime:** the captured HTML body and module were mounted in a synthetic entry page at a fake origin and driven with Playwright. CDN modules (Supabase, earcut) were answered only from the HAR. Every request to the auth/storage host was aborted, so no session, account data or cloud call was involved. All drawings are new synthetic shapes.
- **Reference vocabulary:** the bundle embeds all 20 dictionaries. The English one has **2,296 UI strings**, which gives a complete inventory of labels, tooltips, hints and toasts. These include strings for controls not exercised here.
- **Reference code anchors** below refer to a local esbuild-formatted copy (`app.fmt.js`, esbuild 0.27.0 default formatting). Its line numbers differ from the prettier copy cited in earlier reports. Neither file is in this repository.
- **LeatherCad:** booted the default startup document and drove the same flows: draw a rectangle, select it, right-click, switch tools, open Options. Captured at 1440×900, 1024×768 and 390×844.

Screenshots and raw walkthrough logs are kept outside the repository with the other comparison evidence.

## The short version

The two apps solve the same drafting problem with opposite interface philosophies:

- **Reference: a dense, tool-modal desktop CAD.** It has a fixed dark layout: tool column on the left, a **context bar on top that changes with the active tool**, line-style palette, layers and file buttons on the right, then a coordinate bar and status bar. Every tool has a one-key shortcut. Precision entry happens in place (top-bar fields, a floating numeric palette, the go-to bar). Touch is treated as a first-class *pen/iPad* input: pinch, modifier pad, loupe, pen-lift guard. There is no phone layout.
- **LeatherCad: a workbench for a broader product.** It adds pieces, seams, folds and 3D assembly. Its structure is a ribbon of verb tabs (Draft / Modify / Piece / Stitch / Output), a document tree, an inspector with tabs, a command line, and 2D/3D/split routes. It has a real phone shell, accessible dialogs, searchable settings and workspace presets.

LeatherCad already covers most of the reference's *settings* (wheel mode, trackpad sensitivity, pick radius, tool order and labels, language, units). The useful lessons are mostly about **moment-to-moment drafting ergonomics**: what happens when you press a key, pick a tool, select a shape or touch the screen.

## Layout at a glance

| Region | Reference | LeatherCad |
| --- | --- | --- |
| Top | Logo, **tool name + tool options** (changes per tool), language, Guild, account, settings | Document title, 5 ribbon tabs, history, language, workspace preset, 2D/Both/3D |
| Left | Pinned undo/redo/select; draw tools; divider; finishing tools (user-orderable) | Document tree (Pieces, Seams, Layers, Sketches, Tracing, 3D Assets) + 18-tool icon rail |
| Canvas | Edge rulers with a corner toggle for relative origin, hint bubble, floating drawing-check bar | Rulers/grid labels, layer legend overlay, command line with step prompt |
| Right | 40-slot line-style palette, layers, file actions, view toggles, simulators. Auto-hides with a 📌 pin | Inspector tabs (Inspect / Piece / Preview 3D / Document) with context actions |
| Bottom | Go-to X/Y, selection summary, cursor coordinates, memo toggle; status bar with **clickable** units, snap and zoom (1:1 reset) and a clickable document title (properties) | Status bar text (tool, selection, zoom, unit, layer, line type, message) + Precision button |
| Narrow widths | Breakpoints only at 1280/1100 px (icons collapse). At 390 px the right pane is clipped | Dedicated mobile shell: tool select, 2D/3D/Split, Options, 44 px targets |

## What we can learn: prioritized findings

P1 means it affects every drafting session. P2 means it affects a specific but common workflow. P3 is polish.

### I1 / P1: No single-key tool shortcuts, and three keys conflict with the reference

The reference switches tools with bare keys (`app.fmt.js:33140`). The rail tooltips and the tour show each shortcut.

| Key | Reference | LeatherCad today |
| --- | --- | --- |
| A | Select | — (Ctrl+A only) |
| D or . | Dot | — |
| L | Line | — |
| R | Rectangle | — |
| B | Bezier | — |
| E / Shift+E | Circle / Ellipse | — |
| V | Arc | **Back to select (Move)** |
| T | Text | **Toggle tracing visibility** |
| P | Stitch | — |
| X | Chamfer | — |
| O | Offset | — |
| C | Centerline | — |
| M | Distance mark | — |
| ! | Trim | — |
| # | Dimension | — |
| Arrows | **Nudge selection** by snap spacing (Shift = 0.1 mm) | **Pan viewport**; nudge needs Ctrl (1 mm), Ctrl+Shift (0.1 mm), Ctrl+Alt (0.01 mm) |

Pressing `l`, `r`, `e` or `a` in LeatherCad leaves the tool unchanged; the status only reports "Draft and selection cleared". [`useKeyboardShortcuts.ts`](../src/features/editor/hooks/useKeyboardShortcuts.ts) has no tool map.

**Recommendation:** add a single tool keymap driven by stable tool IDs, shown in rail tooltips and in the "Show tool labels" mode, as the reference does. Decide deliberately about V, T and the arrow keys: users moving from the reference (or the desktop app) will press them. Keep the existing behavior available through a modifier or setting rather than silently diverging. Shared keys that already match: S (ruler), Z (extend/trim), G (grid), F5 (dimensions), [ ] { } (rotate 1°/5°), Ctrl+Z/Y/C/X/V/A.

Other reference keys worth noting: N (toggle mm/inch), I (intersection/tangent dots), K (merge collinear lines), F2 (edit text), F8/F9/F10 (template-part explode/convert), Ctrl+G / Ctrl+Shift+G or Ctrl+U (group/ungroup), Ctrl+I / Ctrl+J (flip), Ctrl+[ ] (scale ±1%/±5%), Ctrl+Alt+N/D/A/I (layer add/delete/hide-others/ignore mode), Ctrl+, (settings) and Enter (focus the numeric palette) (`app.fmt.js:23020–23075`, `:25741–25811`, `:45146–45160`).

### I2 / P1: Picking a tool does not surface its parameters

In the reference, each tool fills the top bar (`ey.render`, `app.fmt.js:33163`):

| Tool | Top-bar controls |
| --- | --- |
| Line | Length, Angle, Horiz, Vert, Angle snap (Off/5°/15°/30°/45°) |
| Rectangle | Width, Height |
| Circle | Radius, tangent-circle mode |
| Text | Text, Size (mm), Font |
| Chamfer | Round/Straight, Distance |
| Offset | Distance |
| Stitch | Mode (Even / Smart corners / All junctions / Manual iron), iron type, Reverse, pitch list, Auto/Fixed/Count, spacing basis, corner angle |
| Distance | Straight/Path, mark offset, mark length, mark origin, continuous |
| Dimension | Line type, flags, unit, gap, font size, precision |
| Select | Clipboard, flip/rotate/mirror copy, order, group/ungroup/merge, delete/deselect/lock/unlock, fit, grid, loupe, numeric palette, multi-select toggle |

In LeatherCad, switching between Line, Rect, Circle, Stitch, Text, Fold, Seam and Notch changes only the status bar text. The ribbon and inspector stay the same. Parameters live in the command line (`rect`, `offset 3`), Options sections (line constraint, arc mode, notch defaults) and Stitch-ribbon dialogs. The command line's step prompt ("Rectangle: pick opposite corner") is a good equivalent of the reference's hint bubble. The missing piece is **visible, editable parameters at the moment of use**.

**Recommendation:** add a tool-options strip, either in the ribbon area or as a compact bar above the canvas, rendered from per-tool descriptors. Start with Line (length/angle/angle snap), Rect (W/H), Circle (radius), Offset (distance), Text (size/font) and Stitch (pitch/mode/count). Its values should feed the same code paths as the command line, so the two stay consistent.

### I3 / P1: No numeric transform palette for a selection

The reference's "Shape position & size" palette shows X, Y, W, H, keep aspect, scale %, rotation and (for a line) length. Enter opens it, so it is keyboard-reachable. LeatherCad's inspector shows Start/End X/Y for a single line, but no length or angle. For multi-selection it shows only actions, with no bounding-box X/Y/W/H. Scaling and rotating go through separate modal dialogs (Scale…, Rotate…, Resize).

**Recommendation:** add a selection-geometry section to the Inspect tab: bounding-box X/Y/W/H with keep-aspect, rotation and scale, plus length/angle for a single line. Each edit should be one undoable change. Keep the dialogs for pivot-based operations.

### I4 / P2: Context actions are not filtered by what is selected

Selecting four plain lines in LeatherCad offers 18 inspector actions, including Create Piece, Apply/Clear Seam, Text Defaults and Extract/Clear Box Source, regardless of applicability. The right-click menu is the opposite problem: it has 5 generic items (Bring to Front, Send to Back, Duplicate, Convert to Path, Delete). The reference's right-click menu is **shape-aware**. On a line it offers Lock/Unlock, set rotate/scale pivot, rotate so the line is horizontal or vertical, apply leather, convert to template part (F10/F9), Delete (n) and a **Layer submenu** with move/duplicate to another layer. Drawing-check fixes also appear there when a warning is under the cursor.

**Recommendation:** use one applicability model for both surfaces. Hide or group actions that cannot apply, and move the relevant ones into the right-click menu: layer moves, pivot, align-to-axis, lock, and arc-to-Bézier when arcs are selected.

### I5 / P1 for tablets: The 2D canvas does not respond to touchscreen pinch

The same synthetic two-finger pinch was sent through Chrome DevTools touch events at 1024×768. The reference went from **100% to 400%**; LeatherCad stayed at **170%**. LeatherCad cancels the browser's default multi-touch and gesture handling on the canvas ([`useCanvasPanAndZoom.ts`](../src/features/editor/hooks/canvas-interactions/useCanvasPanAndZoom.ts#L36)), and its pointer handlers ignore secondary touch pointers, so a pinch currently does nothing. Trackpad pinch (delivered as Ctrl+wheel) is a separate path and is not affected.

Reference touch support also includes two-finger double tap = undo, three-finger double tap = redo, a modifier pad (Shift/Cmd/Alt/Ctrl latches plus undo/redo, placed left or right), an auto loupe near snap points, a pen-lift slip guard, and a multi-select toggle for pencil use.

**Recommendation:** implement two-pointer pinch/pan on the 2D canvas first, anchored at the pinch midpoint. Then consider gesture undo/redo and a modifier pad, since modifier-dependent behaviors (Shift constraint, Alt layer bypass) are otherwise unreachable on a tablet. Confirm on real iPad hardware, as [the device acceptance plan](PHYSICAL_DEVICE_ACCEPTANCE.md) already requires.

### I6 / P2: Numeric fields accept only plain numbers

Reference numeric fields accept arithmetic (`100/3`, `20+5`), normalize full-width digits and symbols, accept inch values with units in length fields, and adjust with the mouse wheel (`app.fmt.js:33195–33215`). [`LengthInput`](../src/features/editor/components/LengthInput.tsx) uses `type="number"` and `Number(text)`, so `100/3` or `5/32in` is rejected.

**Recommendation:** add a small, safe expression parser (numbers, + − × ÷, parentheses, optional `mm`/`in`/`"` suffix, fractions) shared by `LengthInput` and the command line. Show the evaluated value before commit.

### I7 / P2: Escape and Select All behave more coarsely

- **Escape.** The reference cascades: cancel the in-progress shape → return from a drawing tool to Select → clear the selection → **return to the previous tool** (`app.fmt.js:23004–23017`). LeatherCad's Escape always clears the draft and selection and keeps the current tool.
- **Select All.** The reference's first Ctrl+A selects only the active layer's unlocked, visible shapes, with a hint; a second press extends to all layers. LeatherCad selects everything.

**Recommendation:** adopt the Escape cascade (cheap, and it makes single-key tools comfortable). Make layer-scoped Select All optional, paired with the reference's "picks only the active layer (Alt for all)" setting.

### I8 / P2: Tool rail icons are ambiguous

In `DESKTOP_TOOL_ICON_ITEMS`, Stitch and Notch share `dot.png`, Seam and Seam+ share `p2p.png`, and Freehand reuses the Bézier icon ([`editor-constants.ts`](../src/features/editor/editor-constants.ts#L102)). The reference gives every tool a distinct drawn icon and shows "name + shortcut" labels on hover when enabled.

**Recommendation:** give each tool a unique icon, and include the shortcut in the tooltip once I1 exists.

### I9 / P3: Smaller reference ideas worth borrowing

| Idea | Reference behavior | LeatherCad status |
| --- | --- | --- |
| Clickable status bar | Click unit to toggle mm/inch, snap to toggle, zoom to reset 1:1, title to open properties, warning count to open the drawing check | Status items are text; only Precision is a button |
| First-run tour | 7-step spotlight tour (draw tools, finishing tools, tool options, canvas, line types/layers, files, panel pin), replayable from Settings | None. The app starts on a dense demo document, with an Options toggle to disable that |
| Drawing-check bar | Floating bar over the canvas while warnings exist: previous/next, fix one, repair all, kinds filter | Geometry diagnostics exist; no persistent navigate-and-fix bar was found |
| Line-style palette menu | Right-click a slot: show/hide type, select all of this type, unselect type/others, reset slot | Line type palette and manager exist; per-type select/unselect not verified |
| Hint bubble | Next-click guidance next to the toolbar ("Click the opposite corner", "Enter for a new line · ⌘+Enter to finish") | Command-line step prompt (equivalent; less visible when the command bar is collapsed) |
| Go-to bar | Always-visible X/Y entry; ruler corner toggles a relative origin | Command line accepts `x,y` and relative input |
| Phone canvas | n/a | Layer legend covers about a third of a 390 px canvas by default; consider collapsing it on phones |

## Reference-only controls: behavior mapping

This completes the list left open in the remaining-parity analysis. "Equivalent" means a comparable user-visible behavior exists, not identical defaults.

| Reference control | LeatherCad | Classification |
| --- | --- | --- |
| Wheel Auto / Zoom / Pan, trackpad sensitivity 0.25–2× | Same three modes + sensitivity | Equivalent |
| Click pick radius (11.89 px) | Mouse edge-pick radius (12 px) and touch radius (24 px) | Equivalent |
| Add-to-selection radius (7.52 px), drag-to-move radius (9.95 px) | Not found | Missing (low value) |
| Show tool names on hover | Show tool labels | Equivalent |
| Left toolbar order with movable divider + reset | Tool order ↑/↓ + reset; no divider | Different (no grouping) |
| Default unit for new drawings vs per-drawing unit (N key) | Single browser-wide display unit | Different |
| Invert Y axis (display only) | No setting found | Missing |
| Ignore Apple Pencil slip on lift | Not found | Missing (tablet) |
| Snap-release hint (Ctrl/⌘ releases snap) | Snap indicators; release hint not found | Partial |
| Auto loupe near snap points | Not found | Missing (tablet/precision) |
| Modifier pad position (pen/touch) | Not found | Missing (tablet) |
| Dim other layers / select only the active layer (Alt = all) | Highlight active layer option; active-layer-only picking not found | Partial |
| Layer ignore mode, independent layers | Not found | Missing |
| Recording panel, AI speech bubbles, AI MCP connection/grants | LeatherCad has its own AI Builder / agent server; no recording UI | Different product surface |
| Screen tour replay | None | Missing |
| Rebuild cloud thumbnails | Cloud deferred (local-first) | Not applicable |
| Bucket wall line types | Paint Closed Parts / leather fill exist; wall selection not mapped | Not verified |
| Duplicate tolerance + drawing-check kinds | Geometry diagnostics exist; tolerance and kind filter not mapped | Not verified |
| Stitch pitch list (mm and inch irons), blade counts per iron type | Pricking-iron presets/groups | Equivalent in scope; editing UI differs |

## Where LeatherCad is ahead (keep)

- **Phone support.** It has a dedicated mobile shell with 44 px targets and direct file actions. The reference clips at 390 px.
- **Assembly workflow surfaces.** Pieces/seams/folds in the document tree, Piece and Preview 3D inspector tabs, and 2D/Both/3D routes have no reference counterpart.
- **Settings ergonomics.** Searchable Options, scoped resets, a storage scope stated per section, and workspace presets (Drafting/Assembly/Printing/Canvas first).
- **Accessibility.** A shared focus helper traps and restores dialog focus, numeric fields report inline errors (`aria-invalid` plus an alert), and canvas shortcuts are suppressed while typing or inside a modal. The reference also marks most dialogs `role="dialog"` / `aria-modal`, but its generic `#modal-overlay` has no dialog semantics, and its tool buttons are named only by `title`. Reference focus management was not assessed.
- **Command line.** A typed command language with prompts serves keyboard-heavy users better than the reference's go-to bar alone.

## Suggested order

1. I1 + I7: tool keymap with documented V/T/arrow decisions, and the Escape cascade. Small, high-frequency wins.
2. I2: tool-options strip for Line/Rect/Circle/Offset/Text/Stitch.
3. I3: selection geometry in the inspector.
4. I5: 2D touch pinch/pan, then gesture undo/redo; verify on an iPad.
5. I4 and I6: applicability-filtered actions with a richer right-click menu, and expression-aware numeric input.
6. I8 and I9: icon distinctness, clickable status bar, first-run tour, drawing-check bar.

## Limits of this comparison

- Pinch results come from synthetic DevTools touch events in headless Chromium; real-device behavior still needs confirming.
- Reference cloud, Guild, AI and recording surfaces were not exercised, because the backend host was blocked by design.
- "Not found" means not found in current source or UI during this pass. It is not proof of absence in every code path.
- The reference build is a moving target; this records `2026-10-27`.
