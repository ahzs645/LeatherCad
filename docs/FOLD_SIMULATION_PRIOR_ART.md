# How other people fold things, and what ours is doing instead

Written because the fold still looks wrong after two rounds of fixing what was
visibly wrong with it. This is the measurement that says *why*, and what the
published work does about each part of it.

**Correction, and it is the main finding.** The first version of this note
claimed the fold spends no material and that the flap over-reaches by about
`A·R/2`. That was wrong, and the evidence against it was already in the
previous section's own measurements: the cross-section's arc length is
preserved to 0.00%, which cannot be true of a fold that stretches to reach.

What misled me: at 180° the flap does land on the mirror of the flat piece to
within 0.03 mm. That is not a missing bend allowance — **it is what a correct
symmetric fold does.** The arc's material comes half from each side of the
crease, so the bend bulges out past the crease by exactly as much as it eats,
and the tip lands back on the mirror. Worked through:

```
half-zone   w = A·R/2                     material each side gives to the arc
flat part   the half that stays ends at   w from the crease
arc         radius R, centre at (w, -R),  turning through A
flap        runs straight off the arc's far end
at A = pi   arc ends directly above its start; the flap runs back out
            and its tip lands at -s: the mirror
```

**Checked against the solver rather than argued.** Comparing every vertex down
the middle of a 60 mm panel against that textbook fold, at four combinations of
angle and radius (90°/1.8, 180°/1.8, 180°/4, 120°/2.5): **mean deviation
0.068 mm, worst 0.25 mm**, and the worst is the flap's far tip where the
solver's own contact and settling do their work. The fold's kinematics are
right, and a test in `assembled-fold-drape.test.ts` now pins them there.

**And the convention is the standard one.** Sheet-metal practice puts a single
drawn bend line at *the centre of the bend allowance* — "the bend line should
be dimensioned to the center of the bend from the nearest edge, which is the
middle of the bend allowance section". Our bend zone straddles the fold line
symmetrically and consumes `A·R` of flat material. That is the same
convention, already implemented, and it is the one a maker wants: draw the line
where the leather turns, and the two edges meet when it closes.

## 1. What is actually still open

Three things, none of them the fold's shape:

- **The fold is prescribed, not simulated.** Every movable vertex is pulled
  toward a pose computed in advance; the solver's real job is only to notice
  contact. The shape is right because the pose is right — not because the
  physics found it. Leather stiffness, the sag of an unsupported flap, and the
  difference between a soft chrome-tan and a firm veg-tan cannot show up in a
  fold whose every vertex is already told where to go.
- **`neutralAxisRatio` is ignored by the assembled view.** A mid-surface model
  is a K = 0.5 model by construction. Leather compresses on the inside of a
  bend, so its neutral axis sits inboard of the middle — K nearer 0.35 — which
  moves the material a bend eats by `A·T·(K − 0.5)`, about 0.85 mm at a full
  fold in 1.8 mm leather. Small, real, and the slider for it already exists in
  the document model.
- **No gravity.** Deliberate, and recorded in the follow-ups, but it is the
  most likely reason a fold reads as "not quite right" once its geometry is
  correct: nothing sags, nothing settles, an unsupported flap holds its swept
  pose exactly.

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

## 5. What makes a fold read as leather rather than as geometry

The shape is right, so this is the question that is left. Four answers from
four different literatures, and in three of them **the knob already exists in
our document model and the assembled view ignores it.**

### The fold is specified as an angle and a strength, everywhere else

Marvelous Designer — the garment tool this problem most resembles — gives an
internal line a **fold angle** (0–360°, with 180° flat, folding to the front
below 180° and to the back above) and a **fold strength**, where "higher values
make the fold closer to the set angle". That is the Discrete Shells rest-angle
model with a stiffness on top. It is not a prescribed vertex pose.

Ours already carries both: `resolveFoldBehavior` parses `targetAngleDeg` *and*
`stiffness` (default 0.3), and the Bend Controls panel shows a Stiffness slider
per fold **in Assembled mode**. The assembled builder reads neither the
stiffness nor three of its siblings — `thicknessMm`, `neutralAxisRatio` and
`clearanceMm` are all parsed, clamped, defaulted and surfaced in the UI, and
only Fold mode consumes them. Dragging Stiffness in Assembled changes nothing
at all.

### A real crease is not a circular arc

The bend profile of an elastic sheet is an **elastica** — Euler's large-
deflection curve for a slender beam — and the curved-crease origami literature
builds its surfaces from elastica curves precisely because a circular arc is
the wrong shape. Work on crease mechanics goes further and treats a fold as a
thin sheet with a *non-flat reference configuration*, faces and crease
described continuously, rather than as a hinge between flat panels.

Ours is a circular arc by construction — the pose draws it — and it is the
*same* arc at every station along the crease. Even with the kinematics right,
that is a large part of why it reads as CAD.

### Leather remembers being folded; ours does not

Cloth's residual curvature and permanent wrinkles come from plastic
deformation and internal friction in the fibre structure, past a yield strain
threshold. Wong et al. model bending hysteresis directly; Gong et al. add the
time dependence, and note that plasticity — not friction alone — is what
produces the sharp high-curvature ridges you actually see.

Leather is the extreme case of this: creasing and burnishing a fold is a
*finishing step*, and the fold stays where it was put. Our bending is purely
elastic, so a fold has no memory: dial the angle back to zero and the leather
is flat as though it had never been folded.

### The leather at a fold is thinner than the panel

Every wallet is **skived at its fold lines**: a 1.6–1.8 mm body panel is thinned
to roughly **0.9–1.1 mm** where it folds, turned edges to 0.6–0.8 mm, and a
high-end turned edge is feathered to near zero. The point of it is exactly the
thing our model gets stuck on — leather that thick will not turn that tight
without it.

We fold full-thickness leather everywhere, and derive the minimum bend radius
from that full thickness, so our spine is blunter than a made piece and our
minimum radius is pessimistic by roughly the skive ratio. The per-fold
`thicknessMm` that would express a skive already exists in the document model,
defaulted to 1.6 mm, and the assembled view ignores it.

### And if the material is ever to *be* a material

Wang, O'Brien and Ramamoorthi measured ten cloth materials into a piecewise
linear model of nonlinear, anisotropic stretching and bending, fit from a cheap
measurement rig. That is the shape of the answer for "veg-tan behaves
differently from chrome-tan" — a small parameter set per material, fit from
data, rather than one global stiffness.

## 6. What to do, in order

**1. Make the fold's own controls do something in Assembled — done.** All
three now reach the drape:

| knob | what it does now | measured, wallet body at 180° |
|---|---|---|
| `neutralAxisRatio` | sets the radius the bend spends leather at, `R + (K−½)·T` | K 0.5 → 0.35 narrows the bend zone 5.655 → 4.901 mm |
| `foldThicknessMm` | thins the drawn leather through the bend, bevelled back out | spine drawn at 1.600 mm against a 1.800 mm panel |
| `stiffness` | bending compliance of the leather inside the crease's zone | a free fold's crown 6.220 mm soft → 6.897 mm stiff; over an obstacle the cut edge lands 1.8–2.4 mm apart |

Two things worth keeping from doing it:

- **At K = ½ the thickness cancels out of the bend allowance entirely.**
  `R − T/2 + T/2 = R`. So a skive changes what is *drawn* and nothing about
  where the leather goes until the neutral axis also moves off centre. The
  neutral axis, not the skive, is what decides whether thickness is spent at
  all. Writing the formula as `R + (K−½)·T` rather than `R − T/2 + K·T` is
  what makes the default a bit-exact no-op — the second spelling does not
  round-trip in floating point, and would have moved every saved document.
- **Stiffness cannot move the flap, only how the crease answers contact.**
  Setting the bend zone's compliance to literally zero — an unbendable crease —
  changes a free fold's closed height by 0.01 mm. The anchors pull every free
  vertex toward the posed position, so the crease's bending stiffness competes
  against a force spread over the whole flap and loses. The knob has real
  authority where something is in the way, and almost none where nothing is.
  If "how hard the crease holds its angle" should mean what it sounds like, the
  lever is the anchor hold, not the bend compliance — which is item 2 wearing a
  different hat.

**2. Drive the fold by its dihedral** (`assignCreaseTargets`) — still the one
that changes what the simulation *is*, and now with a second reason: it is what
would give stiffness authority over the fold rather than only over its
reaction. Needs a quasi-static ramp; the naive swap scrolls the flap.

**3. Give a crease memory.** Bending plasticity past a yield curvature is what
makes leather look creased rather than bent.

**4. A little gravity**, so an unsupported flap settles instead of holding its
swept pose exactly.

**5. Adaptive crease-aligned remeshing** (Narain et al.) when oblique or
crossing folds matter; **C-IPC**-style thickness guarantees if folding over
deep stacks becomes routine.

### Left open by the work above

- An unset fold thickness defaults to a constant 1.6 mm rather than tracking
  the panel, so a document that never authored one now draws its folds slightly
  skived. Harmless and arguably right, but it is a default nobody chose.
- `addDrapedStitchHoles` still places holes at the panel's half thickness, so a
  stitch hole inside a skive sits a few tenths proud of the thinned surface.
- The analytic fallback (`buildBendGeometry`) draws one constant half thickness,
  so a piece too big to mesh renders its skived fold at full thickness.
- `clearanceMm` is still carried into the drape and ignored.

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
- Where a drawn bend line sits relative to the bend, in shop practice:
  https://www.eng-tips.com/threads/location-of-bend-line-on-flat-layout.407904/
- Wong, Kwok et al. *Modelling Bending Behaviour in Cloth Simulation Using
  Hysteresis*. Computer Graphics Forum, 2013.
  https://onlinelibrary.wiley.com/doi/abs/10.1111/cgf.12196
- Gong et al. *Cloth Animation with Time-dependent Persistent Wrinkles*.
  Computer Graphics Forum, 2025. https://arxiv.org/abs/2502.13491
- Wang, O'Brien, Ramamoorthi. *Data-Driven Elastic Models for Cloth: Modeling
  and Measurement*. ACM TOG 30(4), 2011.
  http://graphics.berkeley.edu/papers/Wang-DDE-2011-08/Wang-DDE-2011-08.pdf
- *Elastica surface generation of curved-crease origami*. Int. J. Solids and
  Structures, 2018. https://www.sciencedirect.com/science/article/pii/S0020768317305334
- Marvelous Designer, *Fold Seam Line* and *Fold Arrangement* (fold angle and
  fold strength on an internal line).
  https://support.marvelousdesigner.com/hc/en-us/articles/47358411649305-Fold-Seam-Line
- Skiving practice and thicknesses at a fold:
  https://en.wikipedia.org/wiki/Skiving_(leathercraft) ·
  https://hab-to.com/blogs/leather-hour-blog/what-is-leather-skiving-the-artisan-s-guide-to-professional-finishes
