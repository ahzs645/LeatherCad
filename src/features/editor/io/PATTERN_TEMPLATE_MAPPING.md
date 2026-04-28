# Pattern Template Format - Mapping Notes

This is a planning doc, not a feature spec. It records how the
[Garment-Pattern-Generator](https://github.com/maria-korosteleva/Garment-Pattern-Generator)
pattern-template schema (TypeScript port in `io-pattern-template.ts`) would
land on the existing LeatherCad modules if we add it as a parallel
import/export format.

The upstream schema is intentionally domain-agnostic: panels = vertices +
edges (with optional Bézier curvature) + 3D translation/rotation, plus a
parameter-influence model and `length_equality` constraints. The TS port in
this directory is a literal mirror; the work below is what it takes to wire
it into the editor.

## Why a parallel format (not extending `io-garment.ts`)

`io-garment.ts` is the LeatherCad-flavored interchange (mm-only, edges as
`{index, startIndex, endIndex, lengthMm}`, no curvature payload, seams as
`SeamConnection` with a `kind`). Extending it would either bloat the existing
shape or break consumers. A parallel format keeps interop with upstream
tooling clean and lets the LeatherCad doc remain canonical.

## Field-by-field mapping

### `properties`

| Template field                  | LeatherCad target                                                  | Notes                                                                                              |
| ------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `curvature_coords`              | parser-only                                                        | Convert to absolute on import; LeatherCad stores Bézier control points in world space.             |
| `normalize_panel_translation`   | parser-only                                                        | If true on import, fold the offset into the per-piece `PiecePlacement3D.translationMm`.            |
| `units_in_meter`                | parser-only                                                        | Convert to mm on import (LeatherCad is mm-native). Export emits `units_in_meter: 1000`.            |
| `normalized_edge_loops`         | informational                                                      | We already export with CCW loops; assert on import or auto-normalize.                              |

### `pattern.panels[name]`

| Template field        | LeatherCad target                                                                      | Notes                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| panel `name` (key)    | `PatternPiece.name` (or `code`)                                                        | Names are also used as foreign keys from `stitches`/`influence`, so the importer needs a stable name->id map.                                                               |
| `vertices`            | derived from boundary `Shape`s for the piece                                           | Today `io-garment.ts` produces vertices via `buildPieceMeshes`. Same source.                                                                                                |
| `edges[].endpoints`   | edge-loop ordering produced by `detectOutlines` / `buildPieceMeshes`                   | Already directed, already CCW.                                                                                                                                              |
| `edges[].curvature`   | **gap** - new                                                                          | LeatherCad `BezierShape` has control points; the export pipeline currently flattens to straight segments. Need a path through `buildPieceMeshes` that preserves quadratics. |
| `translation`         | `PiecePlacement3D.translationMm` (`[x, y, z]`)                                         | Already a 1:1 mapping.                                                                                                                                                      |
| `rotation`            | `PiecePlacement3D.rotationDeg` (`[x, y, z]`, XYZ Euler)                                | LeatherCad already uses XYZ Euler degrees - same convention as Maya.                                                                                                        |

### `pattern.stitches`

`SeamConnection { from: PieceEdgeRef, to: PieceEdgeRef, kind, ... }` maps
directly. The template format only supports 1-to-1 stitches, so on export we
emit one entry per `SeamConnection` and skip anything that isn't `sewn` (or
encode `aligned`/`hinge` as a sidecar - probably out of scope for v1).

### `pattern.panel_order`

Maps to the existing `PatternPiece` array order in the doc, or the
`includeInLayout` ordering. Optional in the spec, easy to round-trip.

### `parameters` (the part LeatherCad doesn't have)

This is the headline feature to import. The current `solver/` deals with
geometric constraints over shapes; `cad/pattern-grading.ts` has a flat
`GradeRule { shapeId, anchor, deltaXPerSize, deltaYPerSize }` model. Neither
expresses "this parameter scales this set of edges multiplicatively in
ordered passes."

Three new pieces would be needed:

1. **`PatternParameter` runtime store** - lives next to `PatternPiece[]` on
   the doc. Field: `parameters: Record<string, PatternParameter>` plus
   `parameterOrder: string[]`. Direct mirror of the schema.
2. **Parameter applicator** - new module
   `src/features/editor/cad/pattern-parameters.ts`. For each parameter (in
   `parameter_order`):
   - `length` (multiplicative): for each `(panel, edge_list[])`, scale the
     edge (or meta-edge span) along `along` (defaults to the edge vector) by
     `value`, anchored by `direction` (`start`/`end`/`both`).
   - `additive_length`: same, but add `value` mm directly.
   - `curve`: set the Bézier control offset of the listed edges from the
     scalar/tuple `value` (in the convention from `properties.curvature_coords`).
3. **Meta-edge resolver** - given `id: number[]`, treat the consecutive
   edges as one virtual edge (start of first -> end of last) with internal
   vertices stretched proportionally along the meta-direction. This is the
   abstraction that `buildPieceMeshes` doesn't currently have.

Where it slots in: `pattern-grading.ts` becomes the consumer. A `GradeRule`
can be derived from a parameter (`value` per size, fixed influence list) so
graded sizes fall out of the same machinery.

### `constraints` (`length_equality`)

Maps to a new `EqualLengthGroupConstraint` in `solver/constraint-types.ts`
(the existing `EqualLengthConstraint` is pairwise - we want N-way "all edges
match the mean length"). Influence syntax (per-edge `direction` + optional
`along` + per-edge `value`) is the same edge-locator vocabulary as
parameters, so the same meta-edge resolver works here.

Application order: constraints run after all parameters have been applied,
in `constraint_order`. Today the solver iterates to convergence over the
whole graph - we'd add a phase that runs equality groups as direct
projections (set every member to the mean) before the residual-minimizing
pass takes over.

### `parameter_order` / `constraint_order`

No equivalent in LeatherCad today. Would live alongside the new arrays as
plain `string[]`. Tests should cover non-commutative ordering (e.g.
`length` before `curve` produces a different result than the reverse).

## Capabilities currently missing in LeatherCad

| Capability                                  | Where to add                                       |
| ------------------------------------------- | -------------------------------------------------- |
| Bézier curvature preserved through export   | `three/piece-mesh-data.ts` + `io-garment.ts` edges |
| `additive_length` (mm-direct edge edits)    | new `cad/pattern-parameters.ts`                    |
| `curve` parameter (move Bézier control)     | new `cad/pattern-parameters.ts`                    |
| Meta-edge resolver                          | new helper in `cad/cad-geometry.ts`                |
| N-way length-equality constraint            | extend `solver/constraint-types.ts` + solver       |
| Ordered application passes                  | new orchestrator (could live in `solver/`)         |

## Out of scope (deliberately)

- Maya/Qualoth simulation hooks (`mayaqltools`).
- SMPL avatar, dataset-generation, rendering pipeline.
- 3D draping/stretch behavior - leather is stiff. Their 3D placement is
  enough for a static assembled preview, which is what LeatherCad already
  does in `three/`.

## Suggested next concrete step

If this format gets greenlit:

1. Add `io-pattern-template-import.ts` / `io-pattern-template-export.ts`
   alongside the type file (no parameter machinery yet - just the doc shape
   round-trips).
2. Land Bézier curvature in `buildPieceMeshes` so the export side doesn't
   lose curve data.
3. Add `pattern-parameters.ts` with the three parameter types and the
   meta-edge resolver, behind a feature gate.
4. Add the N-way `length_equality` constraint and ordered application.

Steps 1-2 are mostly mechanical; 3-4 are the real engineering and should
each have their own PR.
