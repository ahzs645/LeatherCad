# Fold drape — follow-ups

**Date:** 2026-08-24 · **Branch:** `claude/leathercad-solver-scope-ro4um0`
**Scope:** the work left open by the simulated fold. The assembled view now
folds by settling cloth — `assembled-fold-drape.ts` over `@atelier/sim`'s XPBD
kernels — instead of rotating rigid halves. That work is done, tested and
honest about what it is; this file is the list of what it deliberately did not
do, so the next session starts from the position this one ended at rather than
rediscovering it.

Ordered by value. The first two were called out when the work shipped; the
rest are limits that were accepted knowingly and are recorded here so they
read as decisions, not oversights.

---

## 1. Make fold scrubbing feel instant

**What it costs today.** A full wallet rebuild solves every folded piece from
flat: ~300–500 ms per piece, ~1.2 s for the document (down from 5 s after the
lattice and step-count tuning, measured in
`assembled-fold-drape.test.ts`-scale runs on this container). Dragging a fold
angle slider triggers a rebuild per input event, so a scrub is a slideshow.

**Why it is slow by design.** The solver sweeps the anchors from *flat* to the
dialled pose every time (`RAMP_STEPS` in `assembled-fold-drape.ts`), because a
sweep is what lets contact catch the leather on the way. Solving from scratch
per angle throws away the fact that consecutive scrub states are neighbours.

**The three steps, in order of leverage:**

- **Warm-start from the previous solve.** Keep the last `FoldDrapeResult` per
  piece keyed by everything *except* the angles (outline, holes, radius,
  obstacle layout). When only angles moved, seed the state from the previous
  solved positions and ramp the anchors from the *previous* pose to the new
  one — a short sweep over a small angle change, tens of steps instead of
  eighty-plus. The cache key discipline matters: an obstacle that moved
  invalidates the warm start, because the previous state may be resting on
  leather that is no longer there.
- **Move the solve off the main thread.** `@atelier/sim` already ships the
  host for exactly this — `createWorkerSteadySolverPlugin` /
  `serveSteadySolverPlugin` with latest-request-wins supersession in
  `createSolveHost`. The drape is a pure function of typed-array-friendly
  inputs, so it serialises cleanly. While a solve is in flight, keep drawing
  the previous drape (or the analytic pose as a preview) and swap when the
  result lands; `SolveSuperseded` handles the scrub firehose.
- **Cache completed solves.** Same key as the warm start plus the angles;
  returning to a previously dialled angle (0, 90, 180 presets especially)
  should not re-solve at all.

**Done looks like:** dragging a fold slider on the wallet holds an
interactive frame rate, with the drape catching up within ~100 ms of the
slider resting, and no solve running on the UI thread.

## 2. Upstream the two engine bugs to seamer-studio

Porting seamer's GPU self-collision to CPU
(`atelier/packages/sim/src/xpbdCollision.ts`, and the bend kernel in
`xpbdCloth.ts`) surfaced two defects in the original WGSL
(`seamer-studio/packages/cloth-sim/src/webgpu/shaders.ts`). Both are fixed in
the CPU port and documented in `atelier/docs/ARCHITECTURE.md` §4.5; neither
has been touched in seamer-studio itself.

- **`getClosestPointOnTriangle` computes the negated solve.** The WGSL uses
  `v0 = point − p0` with branch algebra derived for `p0 − point` (Eberly's
  form), which negates the interior solution and routes centre-of-face
  queries into the wrong region — the function returns a vertex for a query
  point over the middle of a triangle. Face contacts in the live drape only
  work as well as they do because edge contacts and near-vertex cases mask
  it. The fix is one sign (see the CPU port's comment).
- **The bending kernel nudges away from its target.** `bendingWGSL` applies
  its angular step with the sign that *grows* the dihedral error; it appears
  to work because the angle wrap makes φ ≈ −target a stable resting point.
  Any fold data tuned against the current shader is therefore calibrated to
  the *negated* angle — flipping the nudge (as the CPU kernel does) without
  negating seamer's authored `foldAngle`s would mirror every fold in the app.

**Caution that comes with it:** these are fixes to a *port target*, not this
repo. Seamer's garments may rest on the buggy behaviour (the masked face
contacts, the wrapped fold equilibrium), so the upstream change needs its own
verification against seamer's own drapes — it is not a blind copy of two
lines. File it as a seamer-studio task; LeatherCad and atelier are already
correct.

## 3. Couple the pieces: obstacles are rigid today

Each folded piece solves alone, seeing every *other* piece as a rigid slab
(`drapeObstaclesForPiece` in `assembled-model-builder.ts`). That is what makes
the flap-over-pocket case honest, but it is one-way: two pieces that both
fold, or a pocket that should give as the flap presses it, do not deform each
other. The two solves also run against the *undraped* placement of their
neighbours — piece A drapes over where piece B's slab sits, not over B's own
settled surface.

The next step is one solve for the whole assembly: all pieces' meshes in a
single `XpbdClothState`, each with its own anchors and creases, colliding
mutually through the one triangle collider (which already handles it — rigid
obstacles were only ever pinned particles in the same arrays). Costs scale
roughly linearly in total particles, so item 1's worker matters first.

## 4. Non-parallel folds share one lattice

The mesh lattice aligns to the **first** crease
(`foldAlignedLattice`), because alignment is what lets an inextensible
triangulation fold at all — an irregular triangulation is a rigid shell (the
geodesic-dome principle; this cost a real debugging session, see the module
comment). Additional creases get their own station lines only when they are
within ~6° of parallel. A piece with oblique or crossing folds meshes
approximately and leans on the small stretch compliance to fold at all —
expect a softer, less exact bend there. Wallets and trifolds (parallel folds)
are unaffected. If a real pattern needs crossing folds, the mesher wants
per-region lattices stitched at the creases, which is meaningfully harder
than what exists.

## 5. The drape stops at the assembled view

Final Product mode still runs the rigid panel-graph solver
(`final-product-solver.ts`) with its stack offsets and collision *warnings*;
Fold mode still hinges rigid panels. Only Assembled mode drapes. If the
simulated fold proves out, Final Product is the natural second consumer — its
panel graph already knows regions and hinges, and the drape's fold-progress
ramp (`onStep` anchors sweep) is exactly the shape its fold timeline scrubs.

## 6. Smaller, recorded deliberately

- **No gravity.** A free flap holds its swept pose rather than drooping
  (`SOLVE_OPTIONS` sets no `gravityY`). Deterministic on purpose; a small
  gravity plus item 1's warm start would give resting droop cheaply.
- **The drape ignores seam welds.** Stitch *rendering* follows the surface,
  but paired stitch holes are not distance constraints in the fold solve —
  the Final Product XPBD relaxation still does that separately
  (`final-product-xpbd-relaxation.ts`). Folding a piece whose flap is sewn
  down would today fold through the seam's intent. Adding the pairs as
  constraints over the same state is straightforward once item 3 exists.
- **Solver caps.** A piece meshing past `MAX_CLOTH_VERTICES` (700) falls back
  to the rigid pivot-chain path silently. Fine as a guard; if it fires on a
  real pattern, that pattern is the test case for tuning `spacing` bounds
  rather than raising the cap.
- **One flaky e2e, not ours.** `mobile-smoke.spec.ts` › "mobile Options modal
  scrolls and closes" failed once in a full run and passes in isolation and
  on re-runs; it predates this work and touches nothing the fold changed.
  Recorded here so nobody bisects the fold for it.
