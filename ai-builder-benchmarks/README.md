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

## Functional validation

The score above is twelve presence checks. Run the second harness for whether
the thing works:

```sh
npm run test:ai-builder-functional
```

It writes `functional-report.json`: pieces cuttable, seams sewable, folds
settle, folds stay inside what the leather gives (drape stress), folds clear
the other pieces (drape clash). A document with no fold is scored out of 4
rather than 12, so compare like with like.

Both harnesses honour two environment variables so several agents can score
their own file at once:

```sh
AI_BENCH_FILTER=loop-bifold-wallet AI_BENCH_REPORT=/tmp/mine.json npm run test:ai-builder-functional
```

## Arms in this corpus

- `swarm-*` — the original committed outputs.
- `blind-*` — agents given the prompt and skill file and forbidden to run
  anything against their own output, i.e. the current one-shot pipeline's
  conditions.
- `loop-*` — agents given the same plus both harnesses, iterating.

All ten of `blind-*` and `loop-*` score 12/12 structurally and are
indistinguishable by it. Functionally, of the documents that authored a fold,
blind closed 0 of 3 and loop closed 4 of 4. See
[`docs/AI_BUILDER_PRIOR_ART.md`](../docs/AI_BUILDER_PRIOR_ART.md) §5 for the
per-prompt table, the failure modes, and the harness's own blind spots.
