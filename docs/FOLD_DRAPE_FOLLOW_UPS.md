# Fold drape — follow-ups

**Date:** 2026-08-24 · **Branch:** `claude/fold-solver-roadmap-xzt51z`
**Scope:** the work left open by the simulated fold. The assembled view folds
by settling cloth — `assembled-fold-drape.ts` over `@atelier/sim`'s XPBD
kernels — instead of rotating rigid halves.

This file was the list of what that work deliberately did not do. Items 1 and
2 have since been worked through and are recorded here as what shipped and
what it measured; 3 to 6 are still open, and two of them have changed shape
now that there are numbers behind them rather than expectations. Items 7 and 8
were not on the original list — they are overlays, added because the fold now
turns tight enough to be worth warning about, and each found something on its
first run: §7 found §2e, a defect in the drape rather than in any pattern, and
§8 found that the frame drawn before the worker answers has no collision at
all.

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

What that leaves open is not the shape. See
[`FOLD_SIMULATION_PRIOR_ART.md`](./FOLD_SIMULATION_PRIOR_ART.md). Two of the
fold line's four material properties now reach the assembled view:
`neutralAxisRatio` and `thicknessMm` set how much flat leather the bend spends
— the zone is `A·(R + (K − ½)·T)`, the bend allowance about the neutral axis
rather than about the mid-surface — and `thicknessMm` also tapers the drawn
shell into the crease, so a skived fold looks skived. `stiffness` and
`clearanceMm` are still carried into the drape and ignored. Beyond that: the
fold is prescribed rather than simulated, its arc is a circle where a real
crease is an elastica, a crease has no memory, and there is no gravity.

**One default is now load-bearing and wants a decision.**
`DEFAULT_FOLD_THICKNESS_MM` is 1.6 mm while the wallet's panel is 1.8 mm, so a
document that never authored a fold thickness reads as very slightly skived:
the imported wallet's spine draws at 1.6 mm instead of 1.8 mm, about 0.1 mm
lower at the crown. Nothing else moves, because at the default neutral axis of
½ the thickness cancels out of the bend allowance entirely — the mid-surface
solve is bit-identical. The alternative is for the fold's thickness to default
to the panel's rather than to a constant, which would make an unauthored fold a
true no-op; that is a product call about what an unset field means, not a
geometry one.

## 2e. Contact inflates the crease band — **diagnosed, not fixed**

Found by the stress overlay (§7) the moment it ran against the shipped wallet:
its membrane term pegged at 1.000 on `piece-a`, and the reason is a defect in
the drape, not in the leather. Edge strain measured against rest length on the
imported wallet's flap:

| | edges | worst | over 5% |
|---|---|---|---|
| 90° | 915 | **62.5%** on a 0.703 mm edge | 17 |
| 180° | 739 | **17.0%** on a 3.770 mm edge | 12 |

`piece-c`, whose fold does not run out to a cut edge, reads **0.0%** and has no
edge over 5% at either angle. No leather grows by two thirds; every offending
rest length is one the mesher chose — 0.703 and 1.390 mm are `finePitch`
(`zoneWidth / 4`) at the two angles, 1.885 and 3.770 mm are the lattice's zone
pitch and its first doubling.

**It is contact, not convergence.** Four experiments, each against the same
wallet:

| change | 90° worst | 180° worst |
|---|---|---|
| *(as shipped)* | 62.5% | 17.0% |
| iterations 4 → 24 | 42.6% | 8.5% |
| collider thickness 1.8 → 0.05 mm | 16.3% | **1.6%** |
| boundary pitch floored at 1.8 mm | 25.6% | 18.9% |
| boundary + lattice floored at 0.9 mm | 32.5% | 17.0% |

Six times the iterations costs five times the wall clock and does not converge;
turning the collider down all but erases the strain and takes 180° to zero
edges over 5%. The collider holds surfaces one thickness apart and has no
notion that two particles it is separating are the two ends of one edge, so
wherever the drape's own mesh is cut finer than the leather is thick, contact
outruns the distance constraints. Excluding the bend band from *self*-collision
changed nothing, which places the push on the obstacle pieces the flap closes
onto rather than on the crease touching itself.

**Why no fix is committed.** Flooring the mesh at half a thickness is the
obvious move and was built and measured: it takes 90° from 62.5% to 32.5%,
leaves 180° untouched, and — because a tight bend in thick leather has a zone
narrower than the leather — coarsens exactly the case the overlay exists to
report, dropping `reads the fold against the leather at the crease` from 0.400
to 0.252. Halving one number while blunting the new instrument is not a win, so
it was reverted rather than shipped.

The fix that would work is the textbook one: exclude topological neighbours
from collision, so a vertex is never pushed off a triangle it shares an edge
with. That lives in the atelier collider, not here. Until then the overlay's
**membrane term is not trustworthy on a piece whose crease reaches a cut edge**
— its bend term, which reads curvature against the wrapped stack, is
unaffected and is the one to read.

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

## 7. Where a fold asks more of the leather than it will give — **added**

**Show fold stress tint**, a checkbox beside the other layer toggles in the 3D
panel (`showFoldStressOverlay`, off by default). It tints the draped shell per
vertex, 0 to 1, where 0 is leather doing nothing it minds.

Two different faults are measured and the worse of the two is reported, because
a maker fixes them differently:

- **Membrane** — every mesh edge's solved length against the length it was cut
  at, full scale at **5% strain**. Not the breaking strain: leather pulled 5%
  past its cut length stays long, so the piece it was cut for no longer fits.
  Stretch compliance is a whisker off rigid, so strain that survives the settle
  means the pose could not be reached without the material changing length —
  a *pattern* fault, not a fold one.
- **Bend** — the radius the crease actually turns through, read against
  `minimumBendRadiusMm` for the stack it closes over, both carried onto the
  neutral axis so the threshold and the bend allowance agree. Skiving lowers
  the threshold, which is what a leatherworker skives *for*: 4 mm leather
  turned 1.2 mm reads 0.400; skive the spine to 1 mm and the same geometry
  reads 0.005.

The stack is a property of the *crease*, not the panel — outside a bend zone
the leather has only itself to clear. Applied piece-wide it lit the free
corners of a hanging flap at 0.79; scoped correctly, off-crease readings are
≤ 0.005.

On the shipped wallet the bend term now reports a real over-bend — **0.54 at
90°, 0.69 at 180°**, hottest at the two ends of the fold — because §2b removed
the mesh-spacing zone floor and the crease finally rolls at its own radius,
which is tighter than its 1.7 mm stack allows over much of the spine. Read the
bend term. **Do not read the membrane term on a piece whose crease reaches a
cut edge**: §2e explains why it pegs at 1.000 there for reasons that are the
collider's, not the leather's.

The tint covers the shell's two faces only, not its cut walls — those take a
double-sided edge material that may carry burnish or paint, and two meanings on
one surface would read worse than one.

## 8. Where a fold ended up inside another piece — **added, and one gap it cannot see**

**Show fold clashes**, a second checkbox beside the stress tint
(`showFoldClashOverlay`, off by default). It tints the drape blue by how far
each vertex finished inside another piece, in millimetres, full scale at one
leather thickness — so half a thickness is pale blue and a whole one, the depth
at which the fold has passed clean through, is indigo. Both overlays share the
vertex-colour channel; with both on the clash wins, because a fold drawn
through another piece is not a picture whose stress reading means anything yet.

It measures the promise the collider already makes rather than forming a new
opinion: the collider is configured to hold surfaces one thickness apart, so a
settled fold should read zero.

**What the settled drape actually does**, measured on the imported wallet
(mid-surface against each obstacle slab, clearance 1.80 mm):

| angle | vertices inside the clearance | worst |
|---|---|---|
| 30°, 60°, 90° | **0** / 516, 468, 380 | 0.000 mm |
| 120° | 1 / 335 | 0.007 mm |
| 150° | 2 / 309 | 0.138 mm |
| 180° | 13 / 292 | **0.160 mm** |

`piece-c` reads zero at every angle. So the solved fold is not what clips —
0.16 mm is under a tenth of the ramp, and the overlay draws the wallet its own
colour.

**Two ways it goes non-zero, both real.** The collider can run out of
iterations where a fold closes hard: the square-onto-slab fixture settles
0.64 mm into a slab it is resting on, over a quarter of its vertices. And an
obstacle is the *flat* slab of another piece, so a fold closing over a piece
that is itself folded is avoiding a shape that is not where that piece went —
item 3, seen from the other side. The wallet cannot show that one, because its
only other folding piece is the tab, 13 mm clear of everything.

**The gap: the frame drawn before the worker answers.** Since item 1 the drape
solves off-thread, and `assembled-model-builder.ts` draws the rigid pivot-chain
fold until it lands. That path extrudes each region and rotates it about the
crease with **no collision of any kind** — there is no collider on it to make a
promise, so this overlay has nothing to measure and will read clean through it.
During a scrub that rigid frame is what is on screen between solves, and it is
the first thing to suspect when a fold is seen passing through another piece.
Fixing it means either carrying the last settled drape forward as the scrub
pose instead of falling back to the rigid chain, or giving the rigid path a
cheap push-out against the same slabs. The first is closer to what the warm
start already does and would not need new geometry.
