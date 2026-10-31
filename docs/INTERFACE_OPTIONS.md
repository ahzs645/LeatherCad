# Interface and input preferences

The Options dialog now provides searchable categories with stable section IDs. Searching looks across categories, reports the number of matching sections, and preserves the last category in this browser. Category reset affects only that category and is disabled during a global search; clear the search before resetting. Settings apply immediately; closing the dialog does not undo settings changes.

Each section identifies browser preferences or session-only settings. Browser preferences include input behavior, tool order, display unit, most editing defaults, autosave choice and custom translations. Dimension appearance, print calibration, inspector auto-hide and startup-demo choice retain their existing session scope. Category resets do not reset the drawing or other categories. Partial preference updates preserve unrelated saved choices; older callbacks previously wrote defaults over those choices.

## Input and tool options

- **Wheel Auto / Zoom / Pan:** Auto interprets small, fractional or horizontal pixel deltas as trackpad motion and other wheel events as zoom. Browsers do not identify every device reliably, so explicit Zoom and Pan modes are available. Trackpad sensitivity ranges from 0.25× to 2×. Ctrl/Command or pinch always zooms around the pointer. Existing Alt/Shift selection shortcuts remain available.
- **Tool order and labels:** Move workbench rail tools up/down, show their labels, or reset the input/tool category. Unknown and duplicated saved tool IDs are removed; newly introduced tools are appended. The native Cubic curve tool has its own stable `cubic` ID and is separate from the existing quadratic Bézier tool.
- **Edge-pick radius:** Separate mouse and coarse-pointer ranges configure tools that pick a pattern-piece edge. These are not claimed as equivalents to all three reference selection/drag/multiple-pick radii. General selection behavior is unchanged.

Input preferences use the versioned `leathercad.interface-preferences.v1` browser record and tolerate missing/corrupt fields. Changes propagate to mounted controls and other browser tabs. No geometry is stored in this preference record.

## Units and numeric dialogs

Millimeter/inch display selectors, ruler/grid formatting and stitch-length conversion already existed. This pass persists the display choice and extends conversion to Change Shape Size, Mandala length/coordinate inputs, and length fields in Options. These controls accept displayed lengths and deliver millimetres to the document/actions. Changing units never rescales geometry. Dedicated format-specific export-unit choices continue to apply independently.

Change Shape Size distinguishes scaling the selection from editing a line, arc or text curve. Invalid size, arc or text fields disable the corresponding action and show inline errors. Options keeps invalid length drafts out of persisted settings. Calibration reference/measured lengths use the displayed unit; changing that unit clears uncommitted measured values to avoid mixing units.

Options, Mandala and Change Shape Size use named modal semantics and the shared focus helper for initial focus, Tab containment, Escape and launcher restoration. Canvas keyboard shortcuts ignore modal controls, inputs, selects and editable text. Other older specialist dialogs still need the same review.

Both even-hole-count actions now open a shared modal form with integer validation from 2 to 10,000. Cancel preserves the drawing. Applying after a document/selection change is rejected. The chosen set-number mode now survives preference reload.

## Workspace and phones

The Sketches browser now displays actual nested groups with inherited hidden/locked state. Group activation is separate from disclosure. Disclosure buttons expose expanded state, and Arrow Right/Left opens, enters, closes or returns to a parent group. IDs and activation remain stable, including IDs containing colons. Invalid hierarchies render safely as protected roots while import validation reports their errors.

The workbench preset selector offers Drafting, Assembly, Printing and Canvas first. Presets set mode, ribbon tab and dock layout; custom layouts remain available through resizing and mode controls. Canvas first hides the document tree, inspector and ribbon while retaining tools, drawing, command line, status and an inspector restore control. A changed mode/tab/width becomes Custom; selecting a preset again restores it. The selected preset survives reload without changing document contents.

Phone Options exposes direct Open, Save, Export and File tools buttons with 44px minimum touch targets. Less common file actions remain available in the existing File selector. This avoids requiring the select/Apply path for the common actions.

## Verification and limits

Focused unit/component checks cover preference migration and preservation, wheel navigation, canonical-mm input, category search/reset, actual rail updates, modal focus and count-form validation. Browser checks exercise Options persistence, the canvas preset and phone file tools; screenshots are captured from our own synthetic drawing and UI. Japanese includes the new input, preset and size-editing labels; broad translation completeness and native-language review remain follow-up work.

The captured reference also exposes pen-lift guard, automatic loupe, modifier-pad side, drawing-check settings and conditional AI connection/grant controls. Those reference controls require explicit behavior mapping and separate implementations; this interface pass does not claim those workflows are complete.

[Focused verification](verification/interface-followup-2026-10-31.json) includes [Options search](verification/interface-options-2026-10-31.png), [Canvas first](verification/interface-canvas-first-2026-10-31.png), [phone actions](verification/interface-phone-actions-2026-10-31.png) and [native inspection with nested groups](verification/interface-native-inspector-2026-10-31.png). Final integrated test results are recorded separately by the coordinating implementation pass.
