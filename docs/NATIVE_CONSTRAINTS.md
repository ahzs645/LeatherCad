# Native constraint and dimension engine

The solver now supports analytic cubic Bézier curves and elliptic arcs/ellipses without converting them to segments. This is an **engine API**, not a new interface workflow: `solveConstraints` and `applyDimensionBindings` currently have no production callers. Existing editor alignment/translation constraints still use `applyParametricConstraints` in `ops/pattern-ops.ts`.

## Constraint meanings

| Relation | Geometric contract |
| --- | --- |
| Horizontal / vertical | Rigidly rotate the primitive so its endpoint chord has the requested direction. A closed noncircular ellipse uses its major axis. |
| Parallel / perpendicular | Rigidly rotate a free curve relative to the other curve's chord/major axis. These are unoriented line relations. |
| Angle | Directed chord angle from A to B in canonical editor coordinates. If either curve is a closed ellipse, its axis angle is equivalent modulo 180 degrees. |
| Equal length | Uniformly scale free primitives to match **curve length**, not endpoint distance. Circular arcs have analytic length; Bézier/ellipse speed is integrated with bounded adaptive quadrature. |
| Tangent | Make the selected endpoints coincident and their analytic limiting tangents parallel, in either direction (G1 continuity). Rotate and translate the free curve rigidly. This does not impose equal tangent magnitudes or curvature continuity. |
| Coincident / distance | Move the named anchors. Ellipse parameter landmarks move by whole-curve translation; moving a cubic endpoint retains its other controls. |
| Symmetric | Reflect the named point across an independent axis curve's chord, or a closed ellipse's major axis. This is a point relation, not whole-curve mirrored geometry. |

Tangent constraints accept optional `anchorA` / `anchorB` (`start` or `end`). Otherwise the nearest pair is chosen once before iteration and stays fixed. A closed ellipse's parameter seam is a valid tangent contact, including for a circle. Repeated Bézier endpoint controls use the first nonzero limiting derivative direction. Text and completely collapsed curves have no supported curve tangent.

A closed circle has no unique major-axis direction. A zero-chord closed cubic also has no chord direction. Directional constraints on these shapes report ambiguity; position, length and nondegenerate endpoint tangency remain available. Unsatisfied relations that require treating one curve as two independent shapes are rejected; use dimension bindings for supported within-curve measurements. Inflation of a zero-length primitive and collapse through equal-length scaling are rejected.

## Results, locks and convergence

```ts
const result = solveConstraints(shapes, constraints, 200, 0.001, {
  layers,
  sketchGroups,
})
if (result.converged) {
  const next = shapes.map(shape => result.shapeUpdates.get(shape.id) ?? shape)
  // Commit next through the editor's normal history/document action.
}
```

`shapeUpdates` contains complete analytic records, including cubic controls and ellipse radii/rotation/parameters. The legacy `updates` map is an anchor view; reconstructing an ellipse from those virtual points would lose its geometry. Inputs are immutable. Own locks are always honored; callers must provide layers/groups to enforce inherited locks.

After each projection sweep the solver measures **every relation against the final geometry**. Positional and length residuals are millimetres; angular residuals are degrees. The tolerance applies to both kinds independently. Tangency uses the larger of contact distance and tangent-angle error. `converged` is false for unsatisfied locked relations, invalid references/targets, ambiguous geometry, resource/coordinate-limit failures, or relations that do not converge within the iteration budget. Nonconverged `shapeUpdates` are diagnostic intermediate results and must not be committed as a successful solution. The solver is an iterative projection method, not a proof that every feasible constraint system can be solved.

## Dimension bindings

Bindings now support `center`, `quarter`, `threeQuarter`, `control1` and `control2` in addition to `start`, `end`, `mid` and `control`. Quarter/mid/threeQuarter on native curves are points at parameter `0.25`, `0.5`, `0.75` along the authored sweep, not arc-length fractions. `control` is an alias for a cubic's first control (and retains the existing ellipse-midpoint alias). Cubic `center` is the endpoint midpoint; ellipse `center` is its physical center. Legacy anchor meanings remain distinct where applicable, such as an arc's stored `mid` point.

For a full ellipse starting at parameter zero, center-to-start and center-to-quarter distance bindings set its independent radii, including when rotated. More general ellipse landmark bindings use a nonsingular affine map that keeps the source fixed and moves the target; semiaxes and sweep are recovered analytically. Negative x/y values can reflect the curve. A zero signed x/y projection can rotate the chord onto the free axis; a zero Euclidean distance between distinct ellipse landmarks would collapse the ellipse and is rejected. The coincident start/end seam of a full ellipse cannot be separated by an affine map.

Cubic bindings solve the affine weights of the stored controls. They keep the source landmark fixed and move the target exactly, including an actual curve midpoint or either control. A direct start-to-control1 binding changes only control1. Identical anchor definitions cannot have a nonzero requested dimension.

`applyDimensionBindings(shapes, bindings, values, { layers, sketchGroups })` verifies the whole binding set before returning. It throws on locked unsatisfied requests, missing shapes, nonfinite/negative Euclidean targets, collapse, invalid geometry bounds, or conflicting/nonconvergent combinations. Originals remain unchanged when it throws. Missing parameter values retain the prior skip behavior. The optional `tolerance` defaults to `1e-6` mm and `maxIterations` to 64. Simultaneous nonlinear bindings can fail to converge even when another geometric solution exists; the error identifies this as nonconvergence rather than proving impossibility.

## Verification

Focused tests in `solver/native-constraints.test.ts` and `cad/native-dimensions.test.ts` measure final contact points, true tangents, lengths and requested dimensions independently of the projection's reported residual. Cases include cubic/ellipse/line/circular-arc combinations; positive/negative and closed sweeps; locked references and inherited protection; independent ellipse radii and cubic controls; limiting tangents; combined tangent/length constraints; impossible or ambiguous requests; atomic binding failures; and complete native undo/redo. Existing solver, parameter and native-transform tests remain part of the focused gate. No browser workflow or external format support is implied by these engine tests.
