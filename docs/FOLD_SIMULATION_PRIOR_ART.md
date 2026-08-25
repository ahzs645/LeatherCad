# How other people fold things, and what ours is doing instead

Written because the fold still looks wrong after two rounds of fixing what was
visibly wrong with it. This is the measurement that says *why*, and what the
published work does about each part of it.

Short version: our fold is **not simulated, it is prescribed**. Every movable
vertex is pulled toward a pose computed by rotating the flap rigidly about a
lifted axis, and the cloth solver's job is only to notice contact. That
convention has one measurable consequence a maker will care about — the fold
consumes no material — and it is the reason the leather looks subtly wrong even
when nothing is obviously broken.

---

## 1. What ours does, measured

**The flap lands on the mirror of the flat piece.** Fold a 40 mm square in half
at 180°: the tip starts 20 mm from the crease and lands 20 mm past it, to
within 0.03 mm. Same on the wallet's own body panel — 52 flap vertices, mean
0.02 mm off the mirror image of the flat pattern.

That is a rigid hinge, not a bend. A real fold spends material on its arc:

```
bend allowance   BA = A · (R + K·T)        A in radians, R inside radius,
                                            T thickness, K the neutral axis
mid-surface form BA = A · R                 (K = 0.5, which is what a
                                            mid-surface model already is)
```

For the wallet — A = π, R = 1.8 mm, symmetric bend zone — the flap should come
to rest about **A·R/2 ≈ 2.8 mm short** of the mirror. It doesn't come up short
at all. Two things follow, and both are visible:

- **The flap over-reaches by ~2.8 mm.** On a piece where the flap's edge is
  meant to meet a stitch line, that is the difference between meeting it and
  not.
- **The bend region takes the strain instead.** The only edges anywhere in the
  mesh above 1% strain are the ~1.9 mm edges *inside the bend* — three of 1515
  on a 300 mm panel. The leather is being stretched over the arc to make up the
  material the pose never spent.

**The app already owns the missing parameter.** Every fold line carries a
`neutralAxisRatio` — a K-factor by another name — and `resolveFoldBehavior`
parses and clamps it. Only Fold mode reads it (`fold-manager.ts`, as a
`(ratio − 0.5) × thickness` offset). The assembled view, analytic and draped
alike, ignores it and consumes nothing.

**The drape and the rigid fold share this convention deliberately.** A builder
test pins the drape against the rigid transform, so this is not a drift between
two paths — it is one convention, applied consistently, that happens not to
conserve material.

## 2. How the published work drives a fold

Nobody in the literature folds a sheet by dragging every vertex to a
precomputed pose. They set the **rest angle of the hinges along the crease**
and let the sheet find the rest:

- **Discrete Shells** (Grinspun, Hirani, Desbrun, Schröder, SCA 2003) measures
  bending as the dihedral angle at each mesh edge against a rest angle. A
  crease is a row of hinges whose rest angle is not zero. The arc's radius then
  falls out of the bending stiffness and the sheet's own inextensibility rather
  than being drawn in.
- **Quadratic / isometric bending models** (Bergou et al. 2006; Wardetzky et
  al. 2007) specialise that to inextensible surfaces — a bending energy
  quadratic in positions with a constant Hessian, which is why it is the
  default in production cloth solvers.

**We already have this and don't call it.** `@atelier/sim` exports
`assignCreaseTargets`, whose own comment says posing the rest mesh and
measuring every hinge "makes the folded pose the solver's equilibrium exactly,
whatever the triangulation", and `buildClothConstraints` takes a
`targetAngleForHinge`. Our drape passes neither, so every hinge in the piece
wants to be flat and only the anchors bend it.

**Tried it: not a drop-in.** Swapping the blanket anchors for
`assignCreaseTargets` ramped over the sweep, with the crease hinges stiffened
to 1e-5, curls the flap into a scroll — a 180° fold of a 40 mm square puts the
tip 12.9 mm below the base instead of 3.6 mm above it. Angle-driven folding
needs the pose re-imposed quasi-statically (settle between target increments)
rather than ramped against momentum. That is the work, and it is real work.

## 3. How they mesh it

Our lattice aligns to the first crease because an irregular inextensible
triangulation cannot fold at all. That instinct is exactly right and the
literature names the failure:

- **Folding and Crumpling Adaptive Sheets** (Narain, Pfaff, O'Brien, TOG 2013)
  uses adaptive anisotropic remeshing to "dynamically align mesh edges with
  folds and creases", which "avoids bend locking that would be otherwise caused
  by stiff in-plane behavior", and keeps a separate plastic embedding so
  remeshing does not diffuse the shape.

The difference between theirs and ours is that theirs is *adaptive and
per-fold*. Ours picks one crease and aligns the whole piece to it, which is why
oblique and crossing folds are recorded as a known limit (item 4 of the
follow-ups). Their approach is the answer to that item, not a workaround for
it.

## 4. Thickness, and how much a fold can close over

This is the part the question was really about, and there are two separate
literatures.

**Engineering: you cannot fold a thick pattern like a thin one.** Origami with
real material thickness is a whole field, and every technique in it exists
because panels of finite thickness collide before a zero-thickness model says
they should:

- **Axis shift / hinge shift** (Tachi, *Rigid-Foldable Thick Origami*): move
  the hinge to the valley side of the fold. Simplest, and applies to a single
  fold line — which is exactly our case.
- **Offset panel technique** (Edmondson, Lang et al.): thicken the panels,
  stack them in the folded position, pick a reference plane, and offset each
  panel out to the zero-thickness hinge axis. Accommodates any thickness,
  including different thicknesses in one mechanism, at the cost of material
  added and removed per panel.
- Surveyed together in *A Review of Thickness-Accommodation Techniques in
  Origami-Inspired Engineering* (Lang et al., ASME Appl. Mech. Rev. 2018),
  along with membrane, tapered-panel and rolling-contact families.

The recurring result: **thickness costs fold range, and a stack compounds it.**
Each layer's thickness constrains where the next layer's hinge can sit.

**We are half-way there already.** `wrappedThicknessMm` works out what a fold
closes over, and `minimumBendRadiusMm` grows the bend radius to clear it —
which is the same instinct as hinge shift, and correct. What is missing is the
other half: a fold whose radius grew to clear a stack should also *spend* the
extra material that a bigger arc consumes. Today the radius grows and the flat
pattern never pays for it, so the thicker the stack, the further the flap
over-reaches.

**Graphics: contact with real thickness.** For folding many layers over each
other, the state of the art is **C-IPC** (Li, Kaufman, Jiang, SIGGRAPH 2021):
it models thickness as an enforced distance offset with "a strict guarantee
that mid-surfaces … will not move closer than applied thickness values", plus
strain limiting as a barrier energy. That is the guarantee we approximate with
a triangle collider and a contact thickness — ours is cheaper and has no such
guarantee, which is why a tight stack is where it will fail first.

## 5. What to do, in order

1. **Spend the bend allowance.** The cheapest correct fix for the visible
   error: the pose should carry the moving side toward the crease by the arc's
   material, `A·R/2` for a symmetric zone, and honour `neutralAxisRatio` while
   it is at it. This is a change of *convention*, so it lands in the analytic
   fold and the drape together — the builder test pins them to each other on
   purpose. **Needs a decision first:** does a drawn fold line mean the apex of
   the bend (today) or the material that the bend will eat (every leatherworker
   and every sheet-metal CAD package)?
2. **Drive the fold by its dihedral, not by dragging every vertex.**
   `assignCreaseTargets` is already in the engine, and with it the arc, its
   radius and the material it spends all come out of the physics instead of
   being drawn. Needs a quasi-static ramp; the naive swap scrolls the flap.
   This subsumes (1) rather than adding to it.
3. **Adaptive crease-aligned remeshing**, when oblique or crossing folds
   matter. Narain et al. is the reference.
4. **Thickness guarantees**, if folding over deep stacks becomes routine. C-IPC
   is the target to aim at; the cheap version is to keep growing the radius by
   the wrapped stack, which we already do.

## Sources

- Grinspun, Hirani, Desbrun, Schröder. *Discrete Shells*. SCA 2003.
  https://multires.caltech.edu/pubs/ds.pdf
- Bergou, Wardetzky, Harmon, Zorin, Grinspun. *A Quadratic Bending Model for
  Inextensible Surfaces*. 2006. https://cims.nyu.edu/gcl/papers/bergou2006qbm.pdf
- Wardetzky, Bergou, Harmon, Zorin, Grinspun. *Discrete Quadratic Curvature
  Energies*. 2007. https://cims.nyu.edu/gcl/papers/wardetzky2007dqb.pdf
- Narain, Pfaff, O'Brien. *Folding and Crumpling Adaptive Sheets*. ACM TOG
  32(4), 2013. http://graphics.berkeley.edu/papers/Narain-FCA-2013-07/
- Bridson, Marino, Fedkiw. *Simulation of Clothing with Folds and Wrinkles*.
  2003. https://www.cs.ubc.ca/~rbridson/docs/cloth2003.pdf
- Li, Kaufman, Jiang. *Codimensional Incremental Potential Contact*. ACM TOG
  40(4), 2021. https://ipc-sim.github.io/C-IPC/ · https://arxiv.org/pdf/2012.04457
- Tachi. *Rigid-Foldable Thick Origami*. 5OSME.
  https://origami.c.u-tokyo.ac.jp/~tachi/cg/ThickRigidOrigami_tachi_5OSME.pdf
- Edmondson, Lang et al. *An Offset Panel Technique for Thick Rigidly Foldable
  Origami*. ASME IDETC-CIE 2014.
- Lang et al. *A Review of Thickness-Accommodation Techniques in
  Origami-Inspired Engineering*. ASME Appl. Mech. Rev. 70(1), 2018.
- Bend allowance and the K-factor, for the formula and typical values:
  https://metricmech.com/articles/bend-allowance-k-factor
