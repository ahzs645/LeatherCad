# The AI Builder, against what other people have built

**Date:** 2026-08-26 · **Branch:** `claude/fold-solver-roadmap-xzt51z`
**Question asked:** did we build a pipeline for an AI to *use the interface* and
edit recursively, natively — and what have other projects done?

Short answer: **no, and it is a generator rather than an agent.** The pieces
that would make it one mostly already exist in this repo and are not connected.
This file records what is actually wired today, what the field converged on,
and the gaps in the order they are worth closing.

---

## 1. What is wired today

One turn, end to end
(`scripts/leathercad-agent-server.mjs`, `src/features/editor/ai-builder/`):

```
prompt
  -> buildLocalDraftSnapshots()      deterministic draft, streamed as 3 stages
  -> generateOpenAiJson()            ONE call to /v1/responses, gpt-5.2
  -> parseAiBuilderDocument()        bespoke JSON schema, ~34 kB of parser
  -> compileAiBuilderDocument()      -> native DocFile
  -> runPreflight()                  issues shown in AiBuilderModal
  -> turn.completed
```

The instruction sent to the model ends with the line that decides the whole
architecture:

> *"For refinements, output the full updated JSON document."*

So every turn the model rewrites the entire document from scratch. Three
consequences follow directly, and they are the answer to the question:

- **It does not use the interface.** The request carries no `tools` array. The
  model cannot call an operation, select an entity, or undo. `src/features/editor/ops/`
  holds **55 operation modules** — pattern pieces, seam allowances, box stitch,
  nesting, fold lines, constraints, clipper booleans — and not one is reachable
  by the model.
- **It does not edit recursively.** `turn.completed` fires immediately after
  the single call. No validation loop, no retry, no second pass. A malformed or
  unbuildable document is simply the answer.
- **It is not closed-loop.** `generateOpenAiJson({ request, currentJson, draftJson })`
  is the whole input. **Preflight runs, and its findings go only to the human in
  the modal.** The app computes precisely the feedback the model needs and then
  does not send it.

### What *is* good, and worth keeping

- **The compile step is a real boundary.** AI JSON is parsed and compiled into
  the same `DocFile` the rest of the app uses, so the model cannot invent
  private state. That is the right shape and most of the work.
- **Leather-native entities.** The schema speaks `pattern_piece`,
  `seam_allowance`, `seam_connection`, `stitch_path`, `hardware_marker` rather
  than raw polylines. Intent survives into the document.
- **There is an eval harness at all**, which most projects skip:
  `ai-builder-benchmarks/` holds 5 prompts, committed outputs, and a scored
  vitest run (`npm run test:ai-builder-benchmarks`).
- **A skill file** (`.agents/skills/leathercad-ai/SKILL.md`, 63 lines) already
  defines the agent contract.

---

## 2. What everyone else converged on

Two families, and the split is consistent across both products and papers:
**one-shot generation** versus **iterative agents**. LeatherCad is firmly in
the first.

### Products: give the agent the app's own API

| Project | What the model emits | Source of truth |
|---|---|---|
| **Zoo Design Studio** (Zookeeper) | **KCL**, their parametric CAD language | The `.kcl` file. Every AI action becomes KCL, so it stays traceable, diffable, version-controlled, and hand-editable |
| **Figma MCP** | JavaScript against the **Figma Plugin API** (the `use_figma` tool, added March 2026) | The Figma document, mutated through the same API plugins use |
| **Blender MCP** (official Claude connector, April 2026) | Python against **Blender's own API** | The `.blend` scene |

None of them ask the model for a JSON snapshot of the finished artifact. Every
one of them hands it the interface the application already exposes to scripts.
Zoo's variant is the strongest: because the model writes *code*, an edit is a
diff rather than a rewrite, and the user can read, correct, and re-run it.

### Research: the loop is where the gains are

- **ToolCAD** ([arXiv 2604.07960](https://arxiv.org/html/2604.07960v1)) gives
  the model **six FreeCAD MCP primitives** and hybrid feedback: the engine's own
  geometric-conflict alerts, constraint warnings, and API errors, plus the list
  of entities that actually exist now. The model interleaves
  `<think>` / `<tool_call>` / `<tool_response>`.
  Results: **Qwen2.5-7B with ToolCAD reaches 63.9%** success, beating **GPT-4o
  with ReAct prompting at 62.7%** — a 7B model beating a frontier model on
  harness alone. Against one-shot generation: **invalidity ratio 1.51 vs
  Text2CAD's 2.25, median Chamfer distance 1.12 vs 1.97.**
- **Embodied CAD** ([arXiv 2606.31252](https://arxiv.org/pdf/2606.31252))
  formalises it: planner emits skill-level actions, a deterministic resolver
  instantiates typed arguments, an executor calls the CAD backend, and **the
  solver returns execution diagnostics** to the planner. Solver-grounded, closed
  loop.
- **Seek-CAD** ([arXiv 2505.17702](https://arxiv.org/pdf/2505.17702)) —
  self-refinement against a local visual/geometric check.
- **CADDesigner** ([arXiv 2508.01031](https://arxiv.org/abs/2508.01031)) —
  general-purpose agent for conceptual CAD.
- **Clarify Before You Draw** ([arXiv 2602.03045](https://arxiv.org/pdf/2602.03045))
  — the agent *asks* rather than guessing under-specified requirements. Relevant
  here: "make me a bifold wallet" does not determine thickness, stitch pitch, or
  hardware.

The consistent finding is that the harness matters more than the model. That is
good news for a project whose harness is the part it controls.

---

## 3. The gaps, in the order worth closing

### 3a. Feed preflight back — closed the loop, nearly free

`AiBuilderModal.tsx` already renders `preflightErrorCount`,
`preflightWarningCount`, and the first eight issues. Those same issues are not
in the model's input. Appending them and re-calling, up to a small retry cap, is
the single cheapest change on this list and is exactly the "spontaneous
feedback" channel ToolCAD credits its gains to. Nothing new needs computing.

### 3b. Let the model call operations instead of rewriting the document

`ops/` is 55 modules of tested, pure functions over `DocFile`. A first tool
surface does not need all of them — a dozen would cover most intent:
`create_pattern_piece`, `set_seam_allowance`, `add_stitch_path`,
`add_fold_line`, `connect_seam`, `place_hardware`, `offset_edge`,
`mirror_piece`, `nest_pieces`, plus `read_document` and `run_preflight`.

The payoff is not only accuracy. A tool call is a small, reviewable, undoable
edit; a document rewrite is not. It also removes the "rewrite the whole thing to
move one hole" failure mode, which is the dominant cost of the current design on
large documents.

### 3c. The eval scores structure, not whether the thing works

`ai-builder-benchmark.test.ts` scores 12 points: one each for having layers,
shapes, seam allowances, seam connections, hardware markers and zero preflight
warnings; two each for pattern pieces, ≥2 stitch holes, and zero preflight
errors. Every one is a **presence** check. A document scoring 12/12 can still be a wallet that
does not close.

The app can now answer the harder question. Since this branch there is
`solveFoldDrapeData`, which returns per-vertex `stress` (over-bend and membrane
strain) and `clash` (how far a fold ended up inside another piece) — see
[`FOLD_DRAPE_FOLLOW_UPS.md`](./FOLD_DRAPE_FOLLOW_UPS.md) §7 and §8. Scoring
"folds without over-bending its own leather" and "closes without passing
through another piece" turns the benchmark from a schema check into a
functional one, using numbers the app already computes.

### 3d. Nothing asks the user anything

The turn goes straight from an under-specified prompt to a finished document.
Thickness, stitch pitch, hardware sizing and grain direction are all guessed
silently. A clarifying question before generating is cheap and is what the
proactive-agent work above recommends.

### 3e. There is no text source of truth

The Zoo lesson. Today the artifact is a JSON snapshot; a diff between two turns
is unreadable, and a user cannot correct the model's work in its own language —
only in the GUI, after compiling. Whether LeatherCad wants a KCL-equivalent is a
real product question, not an obvious yes: the tool-call log from 3b is already
a replayable, readable edit history and may be enough.

---

## 4. Suggested order

1. **3a** — send preflight back, retry on errors. Hours, and it is the
   change with the best evidence behind it.
2. **3c** — score drape/stress/clash in the benchmark. Also small, and it is
   what tells you whether 3b actually helped.
3. **3b** — the tool surface. The real work, and worth doing only with 3c in
   place to measure it.
4. **3d**, then **3e** as a product decision.

Steps 1 and 2 are worth doing regardless of whether the tool surface ever gets
built, because they make the current generator measurably better and give any
future agent something to be measured against.
