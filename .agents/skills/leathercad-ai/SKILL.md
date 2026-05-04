---
name: leathercad-ai
description: Use when generating, refining, validating, or repairing LeatherCad AI Builder JSON for leather templates, including pattern pieces, stitch paths, seam allowances, seam connections, hardware markers, stable @leather refs, and preflight issues.
---

# LeatherCad AI Builder

## Workflow

1. Treat AI Builder JSON as the source contract. Return only valid JSON, never markdown.
2. Prefer leather-native entities over raw geometry when intent is known:
   - `stitch_path` for stitch lines plus generated holes.
   - `pattern_piece` for closed cut boundaries.
   - `seam_allowance` for piece offsets.
   - `seam_connection` for edge mating intent.
   - `hardware_marker` for snaps, rivets, buckles, and custom fittings.
3. Use stable snake_case IDs. LeatherCad exposes compiled objects as `@leather[kind:id]` refs, so preserve existing IDs during refinements.
4. Generate in millimeters. Positive x moves right; positive y moves down.
5. Keep closed cut boundaries simple and inspectable. Rectangles are the safest boundary primitive; multi-entity boundaries should form a clean closed loop.
6. For refinements, output the full updated JSON document, not a diff.
7. Address preflight errors before adding decorative detail:
   - Closed pattern-piece boundaries.
   - Seam edge length mismatch.
   - Stitch paths with too few holes.
   - Fold radius versus material thickness.
   - Missing cut-line geometry for export.

## Entity Patterns

Use a closed cut entity first, then bind it into a piece:

```json
{
  "id": "outer_shell_piece",
  "type": "pattern_piece",
  "layer_id": "shell",
  "boundary_entity_id": "outer_shell_outline",
  "name": "Outer Shell",
  "quantity": 1
}
```

Use `stitch_path` instead of manually placing holes:

```json
{
  "id": "bottom_stitching",
  "type": "stitch_path",
  "layer_id": "shell",
  "path_type": "line",
  "start": { "x": -90, "y": 38 },
  "end": { "x": 90, "y": 38 },
  "pitch_mm": 4,
  "hole_type": "slit",
  "render_shape": "diamond",
  "width_mm": 1.2,
  "height_mm": 0.55,
  "tilt_deg": 35
}
```

Use pattern-piece entity IDs for seams and allowances; LeatherCad maps them to native piece IDs during compile.

