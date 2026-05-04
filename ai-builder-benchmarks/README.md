# AI Builder Swarm Benchmarks

Use these prompts to compare agent-generated LeatherCad AI Builder JSON.

## Agent Contract

Give each agent one prompt from `prompts/` plus `.agents/skills/leathercad-ai/SKILL.md`.

- Output only one valid AI Builder JSON document.
- Do not edit app source code.
- Use stable snake_case IDs.
- Prefer `pattern_piece`, `seam_allowance`, `seam_connection`, `stitch_path`, and `hardware_marker` over loose geometry when intent is known.
- Save outputs as `ai-builder-benchmarks/outputs/<agent-name>-<prompt-name>.json`.

## Validation

Run:

```sh
npm run test:ai-builder-benchmarks
```

The harness parses each output, compiles it to a native LeatherCad document, runs AI preflight, and reports a compact score. Invalid JSON, unsupported schema fields, missing pattern pieces, missing geometry, or preflight errors fail the run.
