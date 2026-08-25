# Fold drape — follow-ups

**Date:** 2026-08-24 · **Branch:** `claude/fold-solver-roadmap-xzt51z`
**Scope:** the work left open by the simulated fold. The assembled view folds
by settling cloth — `assembled-fold-drape.ts` over `@atelier/sim`'s XPBD
kernels — instead of rotating rigid halves.

This file was the list of what that work deliberately did not do. Items 1 and
2 have since been worked through and are recorded here as what shipped and
what it measured; 3 to 6 are still open, and two of them have changed shape
now that there are numbers behind them rather than expectations.

---

## 1. Make fold scrubbing feel instant — **done**

**What it cost.** A rebuild solved every folded piece from flat, on the thread
that had to draw the next frame: ~150 ms a piece, ~480–590 ms for the wallet
document per input event of a drag. A scrub was a slideshow.

**What shipped**, in the order the leverage runs:

- **An angle-independent lattice.** The mesh now resolves the bend zone a
  crease can open to at a half-turn (`latticeZoneWidth` in
  `assembled-fold-drape.ts`) rather than the zone it is dialled to, so a
  piece's mesh no longer changes as its angle changes. Nothing else on this
  list works without that: a warm start is only meaningful across meshes that
  correspond vertex for vertex. Measured cost on the wallet: **none** — the
  drape meshes come out at exactly the vertex counts they did before
  (187/187/236 and 106/106/200), because the piece's own point spacing already
  dominated the zone width at these bend radii.
- **Warm starts.** `solveFoldDrapeData` takes a previous solve and sweeps its
  anchors from *that* pose to the new one instead of from flat, with the ramp
  scaled to the angle that actually changed. 2–3× faster per solve, and it
  lands where the cold solve lands — under 0.5 mm apart on a 40 mm fixture,
  which is real hysteresis (leather swept down from 180° does not retrace the
  way up exactly), pinned by a test with that tolerance written into it. The
  guard is the mesh's own rest state: a warm start whose `restPositions` do not
  match the mesh being solved is refused, so a wrong cache key cannot produce
  leather in the shape of another piece.
- **A worker.** `fold-drape.worker.ts` runs the solve behind the engine's own
  steady-solver host — one worker for the document, a `createSolveHost` per
  piece for a 24 ms debounce and latest-request-wins supersession
  (`fold-drape-worker-solver.ts`). While a solve is in flight the previous
  drape keeps being drawn; a piece with nothing settled yet draws its analytic
  fold until the first solve lands.
- **A cache.** `fold-drape-store.ts` keeps finished solves keyed on the
  geometry *and* the angles, and warm starts keyed on the geometry alone — so
  an outline, a hole or a neighbouring piece that moved sweeps from flat again,
  because a state resting on leather that is no longer there is not a head
  start.

- **Materials that outlive a rebuild.** Driving the real app turned up what
  was left once the solve moved off the thread: every rebuild deleted four
  WebGL programs and linked four new ones, eight shader compiles per input
  event. three.js refcounts a compiled program by the materials using it, and
  every material the assembled builder made — outlines, seam guides, seam
  stitching, stitch thread, edge finishes — was built inside the rebuild and
  disposed with it. `shared-materials.ts` keeps one of each configuration
  alive, bounded and disposed with the bridge. Program links per slider event:
  **four to zero**.

**What it measures now**, wallet document, this container:

| | per input event |
|---|---|
| before | 480–590 ms, on the UI thread |
| warm-started solve | 130–190 ms, in the worker |
| angle already dialled | **7–8 ms**, no solve at all |

Driven for real — the production build, the wallet preset, the Bend Controls
slider dragged across its range — a fold-angle event costs the main thread a
**median 35 ms, worst 80 ms**, against 650–1000 ms before the material fix.
(This container renders through SwiftShader, where linking a program costs
~350 ms and an idle page paints at 1 fps; on a GPU the program churn was
smaller but never free, and the 35 ms is app work either way.)

The main thread's share of a scrub is the rebuild; the drape catches up one
debounce plus one warm solve behind the slider, so ~150–200 ms here rather
than the ~100 ms this file originally targeted. On a developer machine it will
be under that; what the target was really asking for — the frame rate holding
while the leather settles — is what `e2e/fold-drape-worker.spec.ts` pins, by
counting timer ticks in a real browser through six cold solves that a
main-thread solver would have swallowed.

**Left over.** A rebuild with no store still solves in place, which is what the
tests and any non-browser caller want. If the catch-up ever needs to be
shorter, the next knob is the settle phase after the ramp — a warm start is
already at equilibrium and spends most of its time proving it. And the
rebuild still rebuilds *everything*: every geometry in the document is
recreated per input event, which is what the remaining 35 ms is. Geometry is
cheaper to recreate than a shader program, so it was not worth the same
treatment yet; if a scrub ever needs to be cheaper still, that is where it
is.

## 2. Upstream the two engine bugs to seamer-studio — **written up, not filed**

The report is [`SEAMER_FOLD_KERNEL_UPSTREAM.md`](./SEAMER_FOLD_KERNEL_UPSTREAM.md),
with a runnable reproduction at `scripts/seamer-fold-kernel-check.mjs`. Both
defects are confirmed in seamer-studio `35b24dd`, and checking them against the
source corrected three things this file used to say:

- The closest-point sign is **two** fixes, not one: `getClosestPointOnTriangle`
  is copied into both `solveExternalCollisionWGSL` and `solveSelfCollisionWGSL`.
- The bending kernel's wrapped resting point is **`target − 180°`**, not
  `−target`. They agree only at ±90°, so "it would mirror every fold" is the
  natural guess and it is wrong at every other angle.
- The calibration caution is **much smaller than it looked**: every `foldAngle`
  in seamer's shipped templates is `0`, and the angular path only runs on a
  non-zero target, so no shipped garment changes shape. Only user documents
  with authored folds need a migration, and it is a half-turn rather than a
  negation.

What remains is filing it upstream and verifying against seamer's own drapes.
LeatherCad and atelier need nothing from it.

## 2b. The bend the drape actually turns — **fixed**

Driving the app raised a question the tests never asked: is the fold the shape
the leather says it is? Measured on the wallet's own body panel, it was not.
A closed fold's two mid-surfaces end up **2 × the bend radius** apart — 3.6 mm
for this 1.8 mm leather — and the wallet was closing to **6.6 mm**.

The cause was the bend zone's floor. `creasesForFolds` widened every zone to at
least the mesh spacing, so the radius the fold actually turned at was
`max(bendRadius, spacing / π)`: the lattice, not the leather. It scaled with
the piece, which is the tell — the same 1.8 mm bend closed to 3.8 mm on a 40 mm
panel and **10.3 mm on a 200 mm one**, a 186% error nobody would see as a bug
because every fold in a document is wrong by the same amount.

The zone now follows the leather (floored only at `MIN_BEND_ZONE_MM`, 1.5 mm,
where no mesh could resolve it), and the lattice grades into it by doubling
its pitch outward instead of dropping straight from the zone's stations to the
regular ones. Measured across panel sizes at a 180° fold:

| panel | before | after | 2 × bend radius |
|---|---|---|---|
| 40 mm | 3.80 mm | 3.80 mm | 3.6 mm |
| 80 mm | 4.44 mm | 3.74 mm | 3.6 mm |
| 130 mm | 7.15 mm | 3.74 mm | 3.6 mm |
| 200 mm | 10.31 mm | 3.73 mm | 3.6 mm |

The wallet's closed fold went 6.6 mm → 3.8 mm. What it costs: three edges of
1515 on a 300 mm panel take more than 1% strain, all of them the 1.9 mm edges
inside the bend itself — about a tenth of a millimetre of stretch where the
leather is wrapped hardest, which is where a real hide stretches too. Mean
strain across the wallet stays at 0.06%, and its cross-section still measures
127.8 mm folded against 127.8 mm flat: the surface bends without growing.

Two properties worth keeping in mind, both measured and both correct:

- **A bend tighter than the leather cannot happen.** Ask for a 0.5 mm radius in
  1.8 mm leather and contact holds the halves 1.8 mm apart regardless. The app
  cannot ask for it anyway — `minimumBendRadiusMm` floors the radius at half
  the thickness plus whatever the fold wraps.
- **The turn is where the crease is.** At a full fold the profile turns 190° of
  its 180° within 8 mm of the crease (the overshoot is the flap curving back
  down onto the base), against 124° before — the bend is a bend now, not a
  smear across the whole flap.

## 2c. The ends of a fold — **fixed**

Seen edge-on, the closed wallet had a spike at each end of its crease. Measured:
the bend crown ran 3.66–3.90 mm along the whole fold and then **7.10 mm** at the
last five vertices, with one vertex pushed 1.08 mm through the half that stays.
Every one of them sat on the outline.

Where a crease runs out to the cut edge, the boundary has to turn through the
whole bend — but the outline is resampled for the piece, not for the crease.
The bend zone is 5.7 mm wide and the cut edge crossed it in a single 8.7 mm
segment with one vertex inside, so the boundary could not follow the arc and
the leather flared at both ends of the fold.

`resampleLoop` now takes its pitch as a function of position and asks for it
across a whole segment rather than at its ends — a crease usually crosses the
edge in the middle of one, with both ends far from the bend. That was the
difference between the fix working and doing nothing at all.

| | before | after |
|---|---|---|
| furthest from the base plane | 7.10 mm | 3.84 mm |
| vertices outside the fold's own band | 4 | 0 |
| vertices through the half that stays | 1 | 0 |
| bend crown along the crease | 3.66–7.10 mm | 3.64–3.72 mm |

## 2d. The fold's kinematics check out — **verified, no change**

Recorded because it was claimed as a bug first. Every vertex down the middle of
a 60 mm panel, compared against a fold worked out by hand — a symmetric bend
zone `A·R` wide, the half that stays, an arc of radius R, the flap running
straight off its far end — at 90°/1.8 mm, 180°/1.8 mm, 180°/4 mm and
120°/2.5 mm: **mean 0.068 mm off, worst 0.25 mm** at the flap's tip.

At a full fold the flap lands on the mirror of the flat piece, which looks like
a bend that consumed no material and is not: the arc takes half its material
from each side of the crease and bulges past it by as much as it eats. The
convention matches sheet-metal practice, where a single drawn bend line marks
the centre of the bend allowance.

What that leaves open is not the shape:
[`FOLD_SIMULATION_PRIOR_ART.md`](./FOLD_SIMULATION_PRIOR_ART.md) — the fold is
prescribed rather than simulated, `neutralAxisRatio` is unused in the assembled
view, and there is no gravity.

## 3. Couple the pieces: obstacles are rigid today

Each folded piece still solves alone, seeing every *other* piece as a rigid slab
at its undraped placement (`drapeObstaclesForPiece` in
`assembled-model-builder.ts`).

**The premise needs correcting before this is picked up.** The wallet is the
document this is meant to fix, and its creased pieces are the main body panel
and the keychain attachment — the piece the flap actually closes over, the card
slot panel, has no crease at all. So coupling *the folded pieces to each other*
would change nothing on the flagship document. The case this file describes —
"a pocket that should give as the flap presses it" — needs the pocket to be
cloth, and the pocket does not fold. Which means item 3 is really:

> every visible piece becomes cloth in one solver state, held at its placement
> by soft anchors when it has no fold of its own, and every piece renders from
> the drape rather than from the region path.

That is a bigger step than "one solve instead of three", and it changes how
every piece in the assembled view is drawn, not just the folded ones.

**The mechanics are cheap; the decision is not.** Checked against the engine:
one solver state needs no changes in `@atelier/sim`. Concatenate the pieces'
meshes with each piece's rest coordinates offset into its own island (the trick
the obstacle path already uses), and `buildClothConstraints` can be called once
over the combined mesh — its rest distances and hinge sides are
translation-invariant and its indices are relative, so disjoint islands produce
exactly the per-piece constraints with no remapping. The collider already
handles the rest of it: mutual contact between islands, and rigid bodies as
pinned particles in the same arrays. What the work actually costs is the frame
bookkeeping — each piece solves in its own document frame today, and a shared
state needs one frame with `pieceFlatToWorldMatrix` in and its inverse out,
which is exactly where a mirrored fold would come from — and re-pointing the
assembled render path at the drape for every piece.

Costs scale roughly linearly in total particles. Item 1's worker means that is
now off the frame budget, which was the stated prerequisite.

## 4. Non-parallel folds share one lattice

The mesh lattice aligns to the **first** crease (`foldAlignedLattice`), because
alignment is what lets an inextensible triangulation fold at all — an irregular
triangulation is a rigid shell (the geodesic-dome principle; this cost a real
debugging session, see the module comment). Additional creases get their own
station lines only when they are within ~6° of parallel, and that test is
unchanged by item 1: what changed is only *how wide* each parallel crease's
station band is (a half-turn's worth, whatever the angle is dialled to). A
piece with oblique or crossing folds still meshes approximately and leans on
the small stretch compliance to fold at all — expect a softer, less exact bend
there. Wallets and trifolds (parallel folds) are unaffected. If a real pattern
needs crossing folds, the mesher wants per-region lattices stitched at the
creases, which is meaningfully harder than what exists.

## 5. The drape stops at the assembled view

Final Product mode still runs the rigid panel-graph solver
(`final-product-solver.ts`) with its stack offsets and collision *warnings*;
Fold mode still hinges rigid panels. Only Assembled mode drapes. If the
simulated fold proves out, Final Product is the natural second consumer — its
panel graph already knows regions and hinges, and the drape's fold-progress
ramp (`onStep` anchors sweep) is exactly the shape its fold timeline scrubs.

Item 1 helps it more than it looks: `fold-drape-store.ts` and
`fold-drape-worker-solver.ts` know nothing about Assembled mode. A second
consumer gets the cache, the warm start and the worker by asking the same
store — which matters most here, because a fold *timeline* is a scrub by
definition.

## 6. Smaller, recorded deliberately

- **No gravity.** A free flap holds its swept pose rather than drooping
  (`SOLVE_OPTIONS` sets no `gravityY`). Deterministic on purpose; a small
  gravity plus item 1's warm start would give resting droop cheaply.
- **The drape ignores seam welds.** Stitch *rendering* follows the surface, but
  paired stitch holes are not distance constraints in the fold solve — the
  Final Product XPBD relaxation still does that separately
  (`final-product-xpbd-relaxation.ts`). Folding a piece whose flap is sewn down
  would today fold through the seam's intent. Adding the pairs as constraints
  over the same state is straightforward once item 3 exists.
- **Solver caps.** A piece meshing past `MAX_CLOTH_VERTICES` (700) falls back
  to the rigid pivot-chain path silently. Re-measured after item 1's lattice
  change and §2b's grading: the wallet's folded pieces mesh to 187 and 106
  vertices at every angle, and a 300 mm panel — the largest tested — to 534, so
  the cap is not close to firing. Fine as a guard; if it fires
  on a real pattern, that pattern is the test case for tuning `spacing` bounds
  rather than raising the cap.
- **The flaky mobile e2e is still flaky, and it has moved.** The full suite
  passes, 21 of 21, this branch included. `mobile-smoke.spec.ts` › "mobile
  Options modal scrolls and closes" — the flake this file used to name — passed
  every way it was run. What is unreliable now is `mobile-smoke.spec.ts:126` ›
  "the phone can create a pattern piece and read its seams": it passes in a
  full run and fails when the `mobile` project runs on its own, waiting for an
  **Edit Piece** button that never appears inside the 5 s expect timeout. Its
  signature is the mirror of the old one (that failed in a full run and passed
  in isolation), which points at the dev server being cold rather than at the
  app — a mobile-only run is the first thing to hit it, and nothing warms it
  first. Not the fold work either way: it fails the same way on `origin/main`
  at 70fd13f. Recorded so nobody bisects the fold for it.
