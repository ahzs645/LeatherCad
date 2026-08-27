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

*(Written before the benchmark in §5 was run. §5 reverses the first two — the
measurement has to come first, because the repair loop can only return findings
the app is capable of having. Both are now built; the order below is corrected.)*

1. **3c** — score drape/stress/clash in the benchmark. It is what makes every
   other change measurable, and on its own it caught three failures that
   preflight rates as perfectly clean.
2. **3a** — send preflight back, retry on errors. Cheap and correct, but on
   this corpus it would have fixed nothing on its own: see §5.
3. **3b** — the tool surface. The real work, and worth doing only with 3c in
   place to measure it.
4. **3d**, then **3e** as a product decision.

Steps 1 and 2 are worth doing regardless of whether the tool surface ever gets
built, because they make the current generator measurably better and give any
future agent something to be measured against.
---

## 5. The benchmark that was actually run

Ten agents, five prompts, two arms, scored on both harnesses. **Blind** got the
prompt and the skill file and was forbidden to execute anything against its own
output — the current pipeline's exact conditions. **Loop** got the same prompt
plus the two harnesses and iterated against them.

### The structural score cannot tell the arms apart

| | blind | loop |
|---|---|---|
| belt-template | 12/12 | 12/12 |
| bifold-wallet | 12/12 | 12/12 |
| card-sleeve | 12/12 | 12/12 |
| gusseted-pouch | 12/12 | 12/12 |
| snap-coin-pouch | 12/12 | 12/12 |

**Ten out of ten documents score full marks.** So does the committed baseline,
at 11 or 12. The metric is saturated; it is not measuring anything.

### The functional score separates them completely

| prompt | baseline | blind | loop |
|---|---|---|---|
| belt-template | 4/4 | **4/12** | **12/12** |
| bifold-wallet | 9/12 | **6/12** | **12/12** |
| card-sleeve | 4/4 | 4/4 | 4/4 |
| gusseted-pouch | 4/4 | 4/4 | **12/12** |
| snap-coin-pouch | 12/12 | **4/12** | **12/12** |

The denominators differ because a document with no fold cannot be scored on
folding, so the fair headline is the one that ignores them:

> **Of the documents that authored a fold, blind closed 0 of 3. Loop closed 4 of 4.**

Blind failures, all of them invisible in the JSON:

- **bifold-wallet** — worst clash **1.800 mm**, exactly the collider clearance,
  i.e. zero distance. The pockets are drawn overlapping the shell, so they are
  inside its leather before the fold starts. Worst stress pinned at 1.000 too.
- **snap-coin-pouch** — clash 1.793 mm, stress 1.000, and the fold did not
  settle.
- **belt-template** — the fold produced **no drape at all**.

### The finding that reverses the recommended order

**Every blind document had zero preflight errors and zero preflight warnings.**

So §3a, the repair loop — the change with the best published evidence and the
one this file put first — would have caught **none** of these. Preflight checks
boundary closure, seam-span lengths, hole counts and fold radius. It never asks
whether two pieces occupy the same leather, or whether the fold solves.

What caught all three was §3c, the functional harness. The order in §4 was
wrong: **build the measurement first.** The repair loop is still correct and is
now built, but it can only return findings the app is capable of having, and
before this the app was not capable of having these ones.

### What the loop agents learned that reading JSON cannot teach

Each of these was recovered from tool feedback, not from the document:

- **Sheet layout silently decides the clash score.** `drapeObstaclesForPiece`
  treats a piece's *document* position as its assembly position, and
  `applyPlacementTransform` adds ~24.5 mm of exploded offset per piece. A tidy
  nesting with 15 mm gaps still scores the baseline's 9/12; the cliff to a clean
  12/12 sits at about 23 mm. This is the convention `assembled-model-builder.ts`
  already documents — pieces are laid out apart and come together only when the
  seams place them — and the committed baseline violates it.
- **A tighter fold radius costs *more* mesh, not less.** `finePitch` is
  `zoneWidth / 4` and `zoneWidth` scales with the radius, so a small radius
  means a fine pitch. On a 1000 mm strap that crosses `MAX_CLOTH_VERTICES`
  (700) and `solveFoldDrapeData` returns null. Measured cliff: radius 4.5 mm
  null, 5.0 mm 644 vertices and settles.
- **The drape's thickness is not the document's.** On a 1000 mm document the
  `DEFAULT_THICKNESS_WORLD / scale` floor wins and the solve receives 3.03 mm
  rather than the 1.8 mm preview default.
- **Round-number edge spans fail the seam check.** `t = 0.3` instead of
  `95/310 = 0.30645…` is 2 mm out on a 310 mm gusset — over tolerance, and
  impossible to eyeball.

### Blind spots the agents found in the new harness

Reported as measured, because they bound what these numbers mean. All but the
hardware one are now closed — the second only in part — in the section below:

- Nothing checks that pieces do not **overlap in the flat cutting layout**.
- `seam-length-mismatch` is the only guard on seam correctness, so **any
  wrong-edge pairing whose lengths happen to match is invisible** — including a
  span written in the wrong direction.
- Nothing checks that stitch paths, holes or labels lie **inside** the piece
  boundary; both stitch runs moved clean off the leather still score 12/12.
- A crease that **stops short of both cut edges** — un-foldable — scores full
  marks, because region splitting treats a fold as an infinite line.
- Hardware markers are counted, never checked: two snaps stacked at one point
  score the same as a matched closing pair.
- `seam_connection.reversed` and a span's own `reversed` **compose into a
  double flip**, which twists the seam. Neither harness sees it, and the
  committed `swarm-snap-coin-pouch.json` baseline has it on both seams.

One scoring bug was found during the run and fixed: a drape that returned null
used to score full marks on stress and clash, because the maxima stayed at
their initialised zero. Both physical checks are now gated on the fold having
actually solved, which is what moved `blind-belt-template` from 10/12 to 4/12.

### Closing them

`ai-builder-functional-checks.ts` adds four checks, two points each, measured
against resolved geometry through the app's own resolvers rather than re-read
from the JSON. The existing five checks and their point values are untouched,
so the numbers above still compare.

| check | rule | measured with |
|---|---|---|
| `pieces-dont-overlap` | no two pieces share sheet area, outline minus cutouts | `booleanOpPolygons` intersection |
| `marks-on-leather` | every stitch hole, hardware marker and mark lands on the piece that owns it, ownership taken from `internalShapeIds` | `pointInPolygon` on the resolved chain |
| `folds-reach-cut-edges` | a crease that divides a piece must run edge to edge, judged where the fold's line actually crosses the boundary | `splitPieceByFolds` as the gate |
| `seams-mate-correctly` | a seam joining a piece to itself must be a reflection in one crease; the seam graph must reach every piece | `resolveSeamSide`, `solveSeamDrivenPlacements` |

What the corpus does with them:

| output | new checks failed | measured |
|---|---|---|
| `swarm-bifold-wallet` | `pieces-dont-overlap`, `marks-on-leather` | shell and left pocket share **6080 mm²**; 3 labels off, worst 10 mm |
| `swarm-snap-coin-pouch` | `seams-mate-correctly`, `folds-reach-cut-edges` | both side seams 70 mm from any crease — the double flip this file predicted; the fold stops **8 mm** short at each end |
| `blind-snap-coin-pouch` | `seams-mate-correctly` | both side seams 50 mm off; the reinforcement patch no seam reaches |
| `blind-belt-template` | `seams-mate-correctly` | buckle fold-back seam 90 mm from any crease |
| `loop-bifold-wallet` | `marks-on-leather` | 3 piece labels stamped 7 mm outside the pieces they name |
| the other ten | none | — |

The half of the wrong-edge blind spot that stays open: between two *different*
pieces, mating the wrong edge of equal length is a rigid re-seating, and on
axis-aligned rectangles it produces an assembly that is geometrically valid —
the piece simply ends up turned around. That is a semantic error no local
geometry can see, and the check says so rather than guessing.

---

## 6. After the engine fixes

The §5 run was scored before the drape mesher, the seam compiler and two
engine defects were fixed. Re-scored on the corrected build, with the four new
checks from §5 included:

| prompt | swarm | blind | loop |
|---|---|---|---|
| belt-template | 6/6 | 10/18 | **18/18** |
| bifold-wallet | 13/20 | 14/20 | **18/20** |
| card-sleeve | 10/10 | 10/10 | 10/10 |
| gusseted-pouch | 10/10 | 10/10 | **20/20** |
| snap-coin-pouch | 16/18 | 15/20 | **18/18** |

What still fails, and why it is worth having:

| output | fails |
|---|---|
| `blind-belt-template` | all three fold checks — its fold still does not solve |
| `blind-bifold-wallet` | folds-within-leather, folds-clear-other-pieces |
| `blind-snap-coin-pouch` | seams-mate-correctly, folds-within-leather |
| `loop-bifold-wallet` | marks-on-leather — 3 of 199 marks off the leather, worst 7 mm |
| `swarm-bifold-wallet` | pieces-dont-overlap (6080 mm² shared), marks-on-leather, folds-clear-other-pieces |
| `swarm-snap-coin-pouch` | folds-reach-cut-edges — its body fold stops 8 mm short at each end |

Two things to note.

**`swarm-snap-coin-pouch` no longer fails `seams-mate-correctly`.** It did
before, by 70 mm, because both of its seams set a span `reversed` *and* a
connection `reversed`, which composed into a no-op and twisted the seam. That
compiler defect is fixed, so the file is now correct as authored — and the
check found it independently of the agent that fixed it, which is the best
evidence either was right.

**The closed-loop arm is still ahead**, and by more than before: 84/86 against
blind's 59/88. But the gap is no longer only about feedback. Three of blind's
failures are the fold checks, and the mesher fix (`FOLD_DRAPE_FOLLOW_UPS` §2f)
moved those for everyone. The honest summary is that the harness improved and
the engine improved, and the loop arm was the only one that could see either.
