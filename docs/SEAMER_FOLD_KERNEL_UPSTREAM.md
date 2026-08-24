# Two engine defects to upstream to seamer-studio

**Found by:** porting seamer's GPU cloth kernels to CPU for LeatherCad's fold
drape (`atelier/packages/sim/src/xpbdCollision.ts`, `xpbdCloth.ts`).
**Status here:** both are fixed in the CPU port; neither has been touched in
seamer-studio. This file is the upstream task, written so that whoever applies
it can check every claim before they do.
**Reproduce:** `node scripts/seamer-fold-kernel-check.mjs` — no dependencies,
both defects, in plain JavaScript with seamer's exact algebra.
**Verified against:** seamer-studio `35b24dd`.

---

## 1. `getClosestPointOnTriangle` solves the negated problem

`packages/cloth-sim/src/webgpu/shaders.ts:331` (in `solveExternalCollisionWGSL`)
and **`:723`** (in `solveSelfCollisionWGSL`) — the same function, copied twice:

```wgsl
let edge0 = p1 - p0; let edge1 = p2 - p0; let v0 = point - p0;
```

Everything after that line is Eberly's region walk verbatim, and Eberly derives
it for `v0 = p0 − point`. With the difference reversed, `d` and `e` flip sign,
so `s = b*e − c*d` and `t = b*d − a*e` are negated: an interior query lands in
the `s < 0, t < 0` corner branch instead of the interior one, and the function
returns a **vertex** for a point over the middle of a face.

```
query (3.33, 1, 3.33) over triangle (0,0,0) (10,0,0) (0,0,10)
  Eberly's form  -> (3.33, 0.00, 3.33)   the point on the face
  as shipped     -> (0.00, 0.00, 0.00)   the first vertex
```

**Fix:** one token, in both copies.

```wgsl
let v0 = p0 - point;
```

**Why it has not been obvious.** Edge and near-vertex queries — most contacts
in a draping garment — return the same answer either way, and a face contact
that resolves to a vertex still pushes the particle roughly outward. It shows
up as face contacts that are weaker and less stable than they should be, worst
where a panel lands flat on another panel.

## 2. The bending kernel nudges away from its target

`packages/cloth-sim/src/webgpu/shaders.ts:180-181`, in `bendingConstraintWGSL`:

```wgsl
p1 = hingeMid + rotateAroundAxis(p1 - hingeMid, edgeDir, -angleStep * w1Scale);
p2 = hingeMid + rotateAroundAxis(p2 - hingeMid, edgeDir,  angleStep * w2Scale);
```

`angleStep` is `clamp(error * gain, …)` with `error = clampAngle(phi - targetAngle)`,
so these two signs rotate the pair the way that **grows** the error. The fold
still comes to rest, because `clampAngle` wraps the error at ±π and that wrap
is a stable point — but it rests half a turn from where it was asked to:

```
target  30deg  ->  fixed sign   30.0deg    as shipped  -150.5deg
target  60deg  ->  fixed sign   60.0deg    as shipped  -120.3deg
target  90deg  ->  fixed sign   90.0deg    as shipped   -90.5deg
target 120deg  ->  fixed sign  120.0deg    as shipped   -59.6deg
target 179deg  ->  fixed sign  179.0deg    as shipped    -1.1deg
```

The resting dihedral is `target − 180°`, not `−target`. The two coincide only
at ±90°, which is worth stating plainly because "it mirrors the fold" is the
natural guess and it is wrong everywhere except that one angle.

**Fix:** swap the two signs.

```wgsl
p1 = hingeMid + rotateAroundAxis(p1 - hingeMid, edgeDir,  angleStep * w1Scale);
p2 = hingeMid + rotateAroundAxis(p2 - hingeMid, edgeDir, -angleStep * w2Scale);
```

### The calibration question, and how big it actually is

Any fold authored against the current shader was tuned to the wrapped resting
point, so fixing the kernel moves it by half a turn. That is the reason this is
not a two-line drive-by. The size of the problem, measured rather than assumed:

- **Every `foldAngle` in seamer's shipped templates is `0`** — 25 of them
  across `static/templates/*.json`, all zero. The angular path only runs when
  `abs(targetAngle) > ANGLE_EPS`, so **no shipped garment changes shape.**
- The only non-zero fold angle in the repository is the `90` in
  `packages/cloth-sim/src/build.test.ts:211`, and that test asserts the
  constraint's target is set, not where the cloth settles. At 90° the two
  conventions agree anyway.
- What is at risk is **user documents** that set a non-zero `foldAngle` through
  the piece command. For those, the value that reproduces today's shape under
  the fixed kernel is `foldAngle − 180°·sign(foldAngle)` — a migration, if one
  is wanted, not a negation.

### Suggested order

1. Fix §1 in both shaders, on its own. It changes contact quality only, and no
   authored data is calibrated against it.
2. Fix §2, and check a garment with a real fold: with the fix, a hinge
   authored at 90° should settle at 90°, and one at 179° should close rather
   than lie flat.
3. Decide on the migration for user documents, if seamer has any in the field
   with non-zero fold angles.

LeatherCad and atelier need nothing from this: both already carry the corrected
kernels. This is upstreaming a fix, not chasing a bug.
