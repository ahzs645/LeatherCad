# Seam · 2D · 3D — mobile and desktop review

> **Status: acted on.** Every finding in this review has been implemented on
> `claude/seam-2d-3d-review-xbacze`, along with four sample patterns that
> exercise the seam pipeline. See [What shipped](#what-shipped) at the end for
> the mapping from findings to commits, and for the defects that only surfaced
> once the work was running in the app, and
> [Pictures](#pictures) for the folding and the seams photographed from the
> running build. The findings themselves are left as they were measured, so the
> before/after is legible.

**Date:** 2026-08-21 · **Branch:** `claude/seam-2d-3d-review-xbacze`
**Scope:** LeatherCad's seam authoring and 2D↔3D workflow, measured on real
viewports, compared against Seamer Studio's equivalent pipeline.

Everything numeric below was measured by driving the dev build in Chromium at
six viewports (`1440×900`, `1280×800`, `1024×768`, `820×1180`, `390×844`,
`844×390`) on `/`, `/workbench/3d`, and `/workbench/split`. No console errors
were logged at any viewport — the problems are layout, reach, and model, not
crashes.

---

## 1. The short version

LeatherCad and Seamer Studio solve the same problem — flat pieces joined at
seams, viewed as a 3D object — but they take opposite positions on **who
places the pieces in 3D**.

| | Seamer Studio | LeatherCad today |
|---|---|---|
| Seam identity | `Seam { fromPaths: SeamRef[], toPaths: SeamRef[] }` — named `PiecePath` ids, many-to-many, mirror-aware | `SeamConnection { from: {pieceId, edgeIndex}, to: {…} }` — one edge to one edge, positional index |
| Seam authoring | Shared `seamTool` state machine driven by **both** the 2D canvas and the 3D viewport | 2D canvas only |
| Direction | Inferred from where you clicked along the edge | Always `reversed: false`, fixed afterwards via a checkbox |
| 3D placement | Derived: arrange around the body, then drape; seams pull pieces together | Typed by hand — six numbers per piece (`Translate X/Y/Z`, `Rotate X/Y/Z`) |
| 3D physics | WebGPU XPBD over the piece mesh: stretch (anisotropic), bend, self-collision, body collision | CPU XPBD over **stitch holes only** — a diagnostic, not an assembly |
| Sew order | `assemblySteps` + `stitchCount`; seams zip shut over a timeline | Fold timeline only; seams are all-or-nothing |
| Default layout | `both` — 2D and 3D side by side, 50/50 | 2D **or** 3D; `/workbench/split` deliberately degrades to 3D on desktop |
| Selection sync | `selectedSeamId` and piece selection shared across 2D/3D | None — the 3D view has no picking at all |

The gap is not that LeatherCad's 3D is weaker. Its fold solver
(`final-product-solver.ts`) is genuinely more capable than anything in Seamer
for rigid, creased, folded leather — Seamer has no fold solver. The gap is that
**seams are inert data in LeatherCad**: they render as coloured lines and feed
stitch-hole diagnostics, but they do not move anything.

---

## 2. Mobile

### 2.1 The 3D tab gives the 3D view 29% of the screen

Measured on iPhone 13 (`390×664` usable) at `/workbench/3d`:

| Element | Height | Share |
|---|---|---|
| `.topbar` | 245px | 37% |
| `.canvas-stage` (**empty** — the 2D pane inside is `display: none`) | 170px | 26% |
| `.preview-pane` header + controls | 54px | 8% |
| **`.three-preview-canvas-wrap`** | **195px** | **29%** |

The 170px hole is a grid bug. `EditorMobileShell` always renders the
`.canvas-stage` wrapper:

```tsx
<div className="canvas-stage">
  <ErrorBoundary>
    <EditorCanvasPane {...canvasPaneProps} hideCanvasPane={hideCanvasPane} />
  </ErrorBoundary>
</div>
<ErrorBoundary>
  <EditorPreviewPane {...previewPaneProps} />
</ErrorBoundary>
```

`hideCanvasPane` hides the pane *inside* the wrapper, but the wrapper itself
still claims the workspace's only explicit grid row
(`.workspace.mobile-preview { grid-template-rows: minmax(0, 1fr) }`), so the
preview pane is pushed into an implicit auto row and sizes to its content.
Computed `grid-template-rows` at that viewport reads `170px 249px`.

**Fix:** hide the stage wrapper, not just its child, and give the visible pane
the `1fr`. Two changes — a `panel-hidden` class on `.canvas-stage` in
`EditorMobileShell.tsx`, and a `grid-template-rows: minmax(0, 1fr)` that
targets the pane which is actually showing.

Same shape of problem in landscape: at `844×390`, `/workbench/split` leaves the
2D canvas **68px tall**.

### 2.2 The topbar costs 37% of a phone screen before anything renders

With the Options menu *closed*, the mobile topbar still stacks five rows: the
`Tool:` select, the 2D/3D/Split tabs, `Precision` + `Project Memo`, `Catalog` +
gear, and `Options`. That is 245 of 664 pixels. Seamer's equivalent is a single
`join` button group.

**Fix:** one row — tool select, view tabs, overflow. Everything else belongs
behind Options.

### 2.3 Pattern pieces cannot be created on mobile, so seams cannot be authored

I enumerated every visible interactive control on the phone shell, menu open
and closed. With Options open there are ~90 actions. None of them creates a
pattern piece, and none opens the piece inspector.

- `openSelectedPatternPieceInspector` is only reachable through workbench view
  models (`buildWorkbenchInspectorViewModels.ts`, `useEditorWorkbenchController.ts`)
  and the workbench is desktop-only.
- `handleCreatePatternPieceFromSelection` is bound to the workbench
  `create-piece` action id — also desktop-only.
- The canvas context menu (`buildCanvasContextMenuItems.ts`) has no piece
  entries, and there is no long-press → context-menu path on touch anyway.

The Seam tool *is* selectable on mobile (it is item 12 of 17 in the tool
select), and `PieceInspectorModal` exists and is wired specifically for
`isMobileLayout`. But `showPieceInspectorModal` has no setter reachable from
the mobile shell, so the modal can never open. Net effect: **the seam tool on
mobile can neither find pieces to connect nor show you what it connected.**

**Fix:** the phone doesn't need the whole workbench. It needs three actions in
Options → a "Pieces" tab: *Create piece from selection*, *Pieces list →
inspector*, *Seams list*. The modal is already built; only the entry point is
missing.

### 2.4 The seam edge picker's hit radius is in millimetres, not pixels

`findNearestPatternPieceEdge` (`ops/pattern-piece-ops.ts:555`):

```ts
if (!best || best.distance > 12) {
  return null
}
```

`point` arrives in document units, so `12` is 12mm of drawing, not 12 screen
pixels. Zoomed out on a phone that can be under 5px — smaller than a
fingertip; zoomed in it can span the whole viewport and grab the wrong edge.

Every other screen-constant in this codebase divides by scale
(`CanvasViewportChrome.tsx` uses `9 / viewportScale`, `5 / viewportScale`, …),
and `runtime.viewportScale` is already on the tool runtime
(`tools/tool-types.ts:33`). This one call site just missed it.

**Fix:** take a `pickRadiusPx` and convert — `12 / viewportScale` for pointer,
something nearer `22 / viewportScale` for coarse pointers.

### 2.5 Tap targets

The zoom cluster (`-`, `+`, `Fit`, `Reset`) renders at **34–38px**; the
touch-baseline block in `_responsive.scss` sets `min-height: 40px` but not
`min-width`, and 40px is still under the 44px platform guidance. In landscape
the tool select drops to 33px tall.

---

## 3. Desktop and tablet

### 3.1 An iPad in landscape is treated as a phone

`MOBILE_MEDIA_QUERY = '(max-width: 1100px)'` (`editor-constants.ts:9`) and
`EditorApp.tsx` forks hard on it:

```tsx
{controller.layout.isMobileLayout
  ? <EditorMobileShell {...controller.mobileShell} />
  : <EditorDesktopShell {...controller.desktopShell} />}
```

A 1024×768 iPad — a perfectly good pattern-drafting surface with a pencil —
therefore loses the ribbon, the document tree, the tool rail, the selection
inspector, the piece inspector, the document inspector, and the 3D controls
inspector. It gets a `Tool:` dropdown.

This is the single largest reach problem in the app. It is also why 2.3 hurts
so much: the cutoff is set where tablets live.

**Fix:** stop treating "small" as "different app". Keep one workbench and
collapse it by capability:
- `> 1100px` — inspector docked, as today.
- `768–1100px` — workbench with the inspector as a right-edge sheet, tool rail
  as an icon strip. This is where the iPad lands.
- `< 768px` — today's phone shell, plus the piece/seam entry points from 2.3.

### 3.2 The 2D canvas gets half the desktop window

At 1440×900 the drawing surface is 740×706 — 51% of width. The left Document
panel and the right inspector are both permanently docked and neither
collapses. At 1280 it is 580px, 45%.

### 3.3 There is no side-by-side 2D + 3D on desktop

> Fixed in `0ab55f6`. See [Pictures](#pictures).

By design: `resolveWorkbenchWorkspaceMode` maps `/workbench/split` → `3d` on
desktop, documented as "a desktop client that opens a `split` link degrades to
the 3D workspace". Measured, `/workbench/split` at 1440 renders the 2D canvas
at 0×0 and the 3D canvas at 740×667.

Seamer's default view mode is `both`, 50/50, and that is the whole point:
you pick an edge in 2D and watch the seam close in 3D. There is a "Peek 2D"
button in the 3D workspace header, but peeking is not the same as working in
both.

### 3.4 Two controls do the same thing

The header carries a `2D Draft` / `3D Assembly` segmented toggle *and* a
separate `Open 3D Workspace` / `Peek 2D` button.

### 3.5 The 2D drawing tool rail stays mounted in 3D mode

Line, polyline, rect, circle, ellipse, arc, bezier, text, cut, trim — all still
in the left rail while the 3D assembly view is showing, where none of them can
do anything. That rail is where a 3D mode should be offering *seam*, *place*,
*pin*, *measure*.

### 3.6 The sample document has 100 shapes and 0 pattern pieces

The bundled Trifold Wallet opens with `100 shapes across 5 layers` and
`0 pieces` — so `Mode final | 2 folds | 0 seams`. Out of the box, every
seam-dependent surface is empty, on both desktop and mobile. A first-run user
sees a 3D preview that works (the fold solver runs on outlines) and a seam
system that appears broken because nothing has been declared a piece.

---

## 4. The seam model itself

### 4.1 Edge indices are positional, so seams are fragile

`PieceEdgeRef = { pieceId, edgeIndex }`, where `edgeIndex` is the position in
`chain.polygon`. Insert a vertex, run a fillet, reverse a path, re-import — the
indices shift and every seam past the edit point now points at the wrong edge.
Nothing detects this; `assembly-diagnostics.ts` validates that the index is
*in range*, not that it is *the same edge*.

Seamer avoids this entirely by referencing `PiecePath` **ids**
(`SeamRef { id, mirrored, reversed }`), which survive edits.

### 4.2 One edge to one edge

`SeamConnection` joins exactly one edge to one other edge. A real seam runs
across several segments per side — a gusset meeting three edges of a panel is
three unrelated `SeamConnection`s with no shared identity, no shared direction,
and no shared stitch numbering.

`PieceInterface` already models the right thing — it has `spans: PieceEdgeSpan[]` —
and `compileAssemblyConnections` flattens interface pairs into per-span
`SeamConnection`s. The multi-span concept exists; it just isn't what the seam
tool produces or what the editor exposes.

### 4.3 Direction is guessed as `false` and fixed by hand

`stitch-hardware-tools.ts` computes `t` (where along the edge you clicked) via
`findNearestPatternPieceEdge` — and then throws it away, hardcoding
`reversed: false`. Seamer's `applySeamPick` uses exactly that signal:
"click-position inferred orientation (nearer the path end ⇒ true)".

The user is then asked to fix it in `SeamConnectionEditor`, which is a form of
`Kind` / `Stitch spacing (mm)` / `Tolerance (mm)` / `Local start` /
`Local end` / `Reverse edge direction`. Local start and end are 0–1
parameters typed as numbers. Nothing about that form tells you which physical
edge you are describing.

### 4.4 The 3D view is read-only

There is no raycasting anywhere in `src/features/editor/three/` — no
`Raycaster`, no pick handler, no pointer handling beyond OrbitControls. You
cannot select a piece, an edge, or a seam in 3D.

Atelier already ships what this needs. `@atelier/viewport` exports a `picking`
module whose `PickHit` carries `kind: 'face' | 'edge' | 'vertex' | 'object'`,
`id`, `elementKind`, `edgeIndex`, `docPoint`, `uv`. It also ships `gizmo`.
LeatherCad imports neither — `engine-runtime.ts` pulls in `Viewport` and then
touches only `viewport.camera.controls`.

Seamer's 3D seam picking is one callback:

```ts
renderer.onSeamEdgePick = (pick: SeamPick) => {
  const kind = get(selectedTool) === 'seam-multi' ? 'multi' : 'single';
  const res = applySeamPick(kind, get(seamTool), pick);
  …
};
```

backed by one piece of bookkeeping in the sim data — `edgeRuns: Map<string, number[]>`
keyed `${pieceId}::${piecePathId}`, "ordered global particle runs per piece
edge … used by the 3D seam tool to pick edges on the draped garment".

### 4.5 The XPBD pass moves stitch holes, not leather

`buildXpbdSeamDistanceConstraints` creates `restLength: 0` distance
constraints between paired stitch holes, and
`final-product-xpbd-relaxation.ts` reports `rmsBeforeMm` / `rmsAfterMm`. That
is a useful *diagnostic* — "how far apart do these holes end up after the fold
sequence" — and it is labelled honestly in the UI as `Relax seam welds`.

But the panel mesh never moves. Compare `@seamer/cloth-sim`, where seams are
particle links with an ordering:

> `seamOrder` — the stitch index of each link… The solver closes a link once
> the sewn-up-to threshold passes its index, which is what makes a seam zip
> shut rather than snap.

---

## 5. How to make it work like the Seamer

Five stages. Each is shippable alone, and they are ordered so the cheap fixes
land before the expensive ones.

### Stage 0 — Reclaim the screen (small, mechanical)

1. `EditorMobileShell.tsx` — apply `panel-hidden` to `.canvas-stage` when
   `hideCanvasPane`, and mirror it for the preview pane.
2. `_responsive.scss` — give the visible pane `minmax(0, 1fr)` in
   `mobile-editor` / `mobile-preview`; raise the landscape split floor so
   neither lane goes under ~140px.
3. Collapse the mobile topbar to one row.
4. `min-width: 44px; min-height: 44px` on coarse-pointer controls.
5. `findNearestPatternPieceEdge` — take `pickRadiusPx`, divide by
   `viewportScale`, widen for coarse pointers.

Effect: the phone 3D view goes from 29% of the screen to roughly 70%, and the
seam tool becomes hittable with a finger.

### Stage 1 — One shell, three densities

Replace the `isMobileLayout` boolean with a `layoutDensity` of
`compact | medium | full` at 768 / 1100. Render `EditorWorkbench` at `medium`
with the inspector as an edge sheet. Keep `EditorMobileShell` for `compact`,
and add a **Pieces** tab to its Options menu carrying *Create piece from
selection*, the piece list, and the seam list — the `PieceInspectorModal` is
already built and already gated on `isMobileLayout`; it only needs a setter it
can reach.

Effect: iPads get the real app. Phones get seam authoring at all.

### Stage 2 — Make the seam model survive editing

1. Add `PieceEdgeId` — a stable id minted per boundary segment when a piece is
   created, carried through fillet/split/reverse the way `PiecePath` ids are in
   Seamer. Keep `edgeIndex` as a derived lookup during migration.
2. Widen `SeamConnection` to `fromSpans: PieceEdgeSpan[]` / `toSpans: […]`,
   with the current single-ref form read as a one-element span. `PieceInterface`
   already has the shape to copy.
3. In the seam tool, use the `t` that `findNearestPatternPieceEdge` already
   returns: `reversed = t > 0.5`, matching `applySeamPick`.
4. Add a `seam-multi` variant of the tool — port `applySeamPick` and
   `advanceSeamToolPhase` from `@seamer/pattern-model/utils/seamTool` (they are
   pure functions over a small state object; nothing Svelte-specific).
5. Surface seams as first-class objects: a **Seams** section in the document
   tree with a `selectedSeamId`, not just a list nested inside whichever piece
   happens to be selected.

### Stage 3 — Make 3D pickable

1. Register the assembled/final meshes with `@atelier/viewport`'s picking, and
   tag each boundary run with its `PieceEdgeId` — LeatherCad's analogue of
   Seamer's `edgeRuns` map. `assembled-model-builder.ts` and
   `final-product-model-builder.ts` already walk exactly these runs when they
   draw seam lines, so the mapping is a by-product of work already being done.
2. Route 3D edge clicks into the *same* seam-tool state machine as the 2D
   canvas, so a seam can be started in 2D and finished in 3D.
3. Add `selectedSeamId` highlighting in both views, and hover-highlight the
   counterpart edge.
4. Add an Atelier `gizmo` for `PiecePlacement3D` so assembly stops being six
   typed numbers.

### Stage 4 — Make seams do work

Two options, and they are not exclusive:

**4a — Seam-driven placement (cheap, high value).** Instead of the user typing
translations, solve them: pick a root piece, walk the seam graph, and for each
connection rigid-transform the child so its seam edge meets its parent's
(matching midpoints, aligning directions, honouring `reversed`). This is
Seamer's `arrangement.ts` idea without the body or the drape. For a wallet or a
bag it is often the *final* answer, because leather panels really are rigid.
It also gives a real error metric — residual gap per seam — which the existing
`stress-score.ts` and `assembly-diagnostics.ts` already know how to display.

**4b — Sew order (moderate).** Give `SeamConnection` a sequence, derive
`stitchCount` and per-seam stitch ranges from the compiled chains, and let the
existing fold-progress scrubber also drive *sewn-up-to*. `seam-stitch-compiler.ts`
already produces ordered `StitchHole`s with a `sequence` field; the timeline UI
in `WorkbenchFoldTimelinePanel.tsx` already exists for folds. This is mostly
plumbing, and it turns the fold timeline into a real assembly timeline.

**Not recommended: porting the WebGPU cloth sim.** Seamer needs it because
fabric drapes. Leather in these patterns is a stiff sheet with creases, which
is precisely what `final-product-solver.ts` already models better than a cloth
solver would. Take Seamer's *interaction* model, not its physics.

---

## 6. Suggested order

| # | Change | Size | Why now |
|---|---|---|---|
| 1 | Mobile grid fix (2.1) | XS | 29% → ~70% of the phone screen, two files |
| 2 | Scale-aware edge picking (2.4) | XS | Seam tool is currently unusable by finger |
| 3 | Mobile topbar to one row (2.2) | S | Another 25% of the phone screen |
| 4 | Mobile Pieces/Seams entry points (2.3) | S | The modal exists; only the door is missing |
| 5 | `medium` density for tablets (3.1) | M | iPads stop being phones |
| 6 | Stable `PieceEdgeId` + multi-span seams (4.1, 4.2) | M | Everything after this depends on it |
| 7 | Click-inferred direction + `seam-multi` (4.3) | S | Direct port of `applySeamPick` |
| 8 | 3D picking + shared seam tool state (4.4) | M | The Seamer feel; Atelier already ships picking |
| 9 | Seam-driven placement (4a) | M | Retires the six-numbers-per-piece inspector |
| 10 | Desktop `both` view + collapsible docks (3.2, 3.3) | M | Needed for 8 and 9 to be worth using |
| 11 | Sew-order timeline (4b) | M | Fold timeline becomes an assembly timeline |

---

## 7. Files this touches

| Area | Files |
|---|---|
| Mobile layout | `components/EditorMobileShell.tsx`, `app/styles/partials/_responsive.scss`, `hooks/useEditorLayoutFlags.ts`, `hooks/useResponsiveLayout.ts`, `editor-constants.ts` |
| Mobile reach | `controllers/buildEditorOverlayProps.ts`, `controllers/usePatternPieceCommands.ts`, `components/EditorTopbar.tsx`, `components/PieceInspectorModal.tsx` |
| Seam model | `cad/cad-types.ts`, `ops/pattern-piece-ops.ts`, `tools/stitch-hardware-tools.ts`, `tools/tool-session.ts`, `assembly/seam-stitch-compiler.ts`, `assembly/assembly-connection-compiler.ts`, `assembly/assembly-diagnostics.ts` |
| Seam UI | `components/SeamConnectionEditor.tsx`, `components/PieceInspectorContent.tsx`, `workbench/DocumentBrowserDock.tsx` |
| 3D picking | `three/engine-runtime.ts`, `three/three-bridge.ts`, `three/assembled-model-builder.ts`, `three/final-product-model-builder.ts`, `hooks/useThreePreviewController.ts` |
| Desktop layout | `components/EditorDesktopShell.tsx`, `workbench/EditorWorkbench.tsx`, `workbench/useWorkbenchRouteSync.ts`, `workbench/WorkbenchThreeWorkspace.tsx` |

Reference implementations in the sibling checkouts:
`seamer-studio/packages/pattern-model/src/utils/seamTool.ts`,
`seamer-studio/packages/cloth-sim/src/build.ts`,
`seamer-studio/packages/cloth-sim/src/geometry/arrangement.ts`,
`seamer-studio/src/lib/components/PatternScene3D.svelte`,
`atelier/packages/viewport/src/picking.ts`,
`atelier/packages/viewport/src/gizmo.ts`.


---

---

## Pictures

Every picture below is a screenshot of this branch running, taken by
`scripts/capture-pattern-images.mjs`. The script drives the app through the same
controls a maker uses — load the preset, switch to the 3D workspace, drag the
assembly angle, drag the sew scrubber — so if one of these stops being true, the
next run says so.

```
pnpm dev
node scripts/capture-pattern-images.mjs
```

### The four sample patterns, flat

Each ships with real pieces and real seams, listed down the left in sewing
order. Before this branch the bundled document had 100 shapes and no pieces at
all, so there was nothing to sew.

| | |
|---|---|
| ![Two-panel card case, flat](images/card-case-flat.jpg) | ![Boxed zip pouch, flat](images/boxed-pouch-flat.jpg) |
| **Card case** — a 47mm pocket sewn to the lower 47mm of a 70mm panel side, on three sides. Seams as *portions* of a boundary shape. | **Boxed pouch** — one 380mm gusset strip sewn up one side of a panel, across its base and down the far side. One seam over three boundary shapes. |
| ![Round dice cup, flat](images/dice-cup-flat.jpg) | ![Tote bag, flat](images/tote-bag-flat.jpg) |
| **Dice cup** — a straight wall sewn to a circular base. The base samples into 200-odd chords, which an edge index could not name at all. | **Tote bag** — five pieces, eight seams, including four handle tabs. |

### The assembly angle opening a seam

One scrubber places every piece from the seams that join them. At 0 the pieces
lie flat and connected; at 90 they stand up; at 180 they fold closed. Before
this branch, placing a piece meant typing six numbers into the inspector.

| 0° | 90° | 180° |
|---|---|---|
| ![Card case laid flat](images/card-case-assembled-000.jpg) | ![Card case at 90 degrees](images/card-case-assembled-090.jpg) | ![Card case folded closed](images/card-case-assembled-180.jpg) |

The dice cup is where the rigid solve reaches its limit, and says so:

| 0° | 90° | 180° |
|---|---|---|
| ![Dice cup laid flat](images/dice-cup-assembled-000.jpg) | ![Dice cup at 90 degrees](images/dice-cup-assembled-090.jpg) | ![Dice cup folded closed](images/dice-cup-assembled-180.jpg) |

A straight wall cannot wrap a circle without bending, so the seam guides stay
warm-coloured through the sweep and the solver reports `requiresCrease`. The
boxed pouch and the tote bag are in `images/` too.

### The seams closing, one stitch at a time

The tote bag's eight seams lay end to end on one stitch axis, 226 stitches long.
The caption names the seam under the needle.

| | |
|---|---|
| ![Tote bag with nothing sewn](images/tote-bag-sewing-unsewn.jpg) | ![Tote bag part sewn](images/tote-bag-sewing-part.jpg) |
| **Stitch 0 of 226** — pieces placed, nothing joined. | **Stitch 75 of 226** — sewing *Right side seam*; the left side is finished and drawn whole. |
| ![Tote bag mostly sewn](images/tote-bag-sewing-most.jpg) | ![Tote bag fully sewn](images/tote-bag-sewing-sewn.jpg) |
| **Stitch 151 of 226** — sewing *Base to back*; both sides and the front base are done. | **Stitch 226 of 226** — all seams closed. |

### The folding

The fold solver was already the stronger half of this app, and none of this work
changed it. It is here because a review of the 2D↔3D workflow that never shows
the fold is not showing the workflow.

| Flat | Half folded | Closed |
|---|---|---|
| ![Trifold wallet flat](images/trifold-fold-flat.jpg) | ![Trifold wallet half folded](images/trifold-fold-half.jpg) | ![Trifold wallet closed](images/trifold-fold-closed.jpg) |

### Both views at once

`/workbench/split` now opens two real lanes with a draggable divider, which is
what finding 3.3 asked for. The old behaviour was to redirect the route to the
3D workspace alone.

![The split workspace, 2D and 3D side by side](images/workspace-split.jpg)

And the phone layout. Finding 2.1 measured the 3D tab at 195px of a 664px
screen; it gets 495px here, and the topbar that cost 245px of the rest is down
to one row:

| 2D | 3D |
|---|---|
| ![The mobile 2D canvas](images/mobile-canvas.jpg) | ![The mobile 3D tab](images/mobile-three.jpg) |

---

## What shipped

Twelve commits, ~5,800 lines changed. Unit tests went 593 → 678; e2e 7 → 18.
Typecheck, lint, unit and e2e all green.

| Finding | Where it landed |
|---|---|
| 3D tab got 29% of a phone screen (2.1) | `058e8f1` — 195px → 495px of 664, topbar 245px → 111px |
| Landscape split left 68px of 2D (2.1) | `058e8f1` — the two lanes share the height below 560px tall |
| Touch targets under 44px (2.5) | `058e8f1` — three separate rules were holding them down |
| Pick radius in millimetres, not pixels (2.4) | `058e8f1` — screen-space constant, widened for touch |
| Edge indices are positional (4.1) | `202c912` — outline chains carry a per-shape segment map; seams name the shape and reconcile on read |
| One edge to one edge (4.2) | `202c912` — multi-span sides, with the single-edge form kept and kept populated |
| Direction guessed as `false` (4.3) | `202c912` — inferred from the click, plus a `seam-multi` tool |
| Seams had no home of their own | `6402ee1` — a Seams section, named, in sewing order, with `selectedSeamId` |
| Sample document had 0 pieces (3.6) | `3ef453e` — card case, boxed pouch, dice cup, tote bag |
| 3D placement was six typed numbers | `01449b5` — Solve From Seams, plus one assembly-angle scrubber |
| 3D view is read-only (4.4) | `c6b4936` — raycast picking; a seam can start in 2D and finish on the model |
| An iPad is treated as a phone (3.1) | `21ec262` — breakpoint at 768px, workbench with edge-sheet docks between 768 and 1100 |
| Pieces and seams unreachable on mobile (2.3) | `21ec262` — a Pieces + Seams tab in Options |
| No side-by-side 2D + 3D on desktop (3.3) | `0ab55f6` — `/workbench/split` opens two real lanes with a draggable divider, matching Seamer's `both` |
| Two controls doing the same thing (3.4) | `0ab55f6` — one `2D Draft / Both / 3D Assembly` toggle; the peek button is gone |
| Sew order was all-or-nothing (4b) | `63ac830` — seams lay end to end on one stitch axis and a "Sewn up to" scrubber closes them one at a time |

### Still open

**Nothing from the plan.** What is left is the ceiling the plan deliberately
chose not to raise: the seam-driven placement is **rigid**, so it satisfies one
seam per piece and lets the rest gape. That is the right answer for a card case
or a boxed pouch, whose panels really are stiff. It is visibly not the answer
for the dice cup, where a straight wall has to wrap a circular base — the
`requiresCrease` diagnostic says so rather than pretending otherwise, and the
pictures below show it. Closing that gap means relaxing the pieces, which is
Stage 5 work and a different argument.

### Defects found while building

Five bugs surfaced that the original review did not catch, because they were
only visible once the new work was running against real multi-piece geometry:

- **The document parser dropped every new seam field on load.** It rebuilds each
  seam field by field, so `boundaryShapeId`, the span lists, the name and the
  sequence were discarded. Every test passed while the running app kept the old
  single-edge behaviour. Now covered by `editor-seam-parsers.test.ts`.
- **Assembled-mode overlays were mirrored.** The piece body is extruded and
  rotated -90° about X, which negates the projected Y on the way to world Z; the
  outline, the stitch holes, the edge labels and the seam indicators skipped that
  negation. Invisible on the bundled trifold, which is near enough symmetric.
- **The assembled camera framed flat models edge-on.** The model root's tilt and
  the orbit offset cancelled to within a degree, so a correctly-placed flat
  layout rendered as a hairline.
- **`resolvePieceEdge` indexed the edge array by array position** while
  `buildEdges` drops degenerate edges, so the two diverge for any piece that has
  one.
- **Rotation pivoted on the document centre**, so typing a rotation swung a piece
  in an arc around the whole drawing instead of turning it in place.

Two diagnostics were also still measuring single edges and would have failed
every multi-span seam: the length-mismatch check read a 110mm panel side against
a 380mm gusset edge as a 270mm error, and the duplicate-edge check treated two
handle tabs on opposite ends of one edge as sewing it twice.

### One thing the review under-called

Curves sample at 48 segments, so a four-sided piece with one arc side has **51**
polygon edges. An `edgeIndex` therefore named a 1/48 chord, which meant a curved
seam could not be expressed at all — not merely that it was fragile. That is why
the fix had to be a shape-level reference rather than a more careful index.
