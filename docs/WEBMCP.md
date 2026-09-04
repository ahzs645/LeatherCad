# LeatherCad on WebMCP

LeatherCad publishes thirteen tools to `document.modelContext`, so a person and
their agent can work on the same leather pattern at the same time: the agent
draws, measures, checks and costs the pattern; the person watches it happen on
the canvas and takes the knife to the result.

![The Agent tools panel beside a wallet pattern an agent has just drawn, checked and costed](assets/webmcp-session.png)

Everything below is in this repository. The implementation is
[`src/features/editor/webmcp/`](../src/features/editor/webmcp/), the tests are
beside it, and the browser test that drives the tools the way an agent drives
them is [`e2e/webmcp-agent.spec.ts`](../e2e/webmcp-agent.spec.ts).

## Why leather pattern CAD is a strong fit for WebMCP

A CAD canvas is the worst possible surface for an agent working through pixels,
and one of the best for an agent working through tools.

Through the UI, "make the card slot 4mm shorter" is a chain of drags at
sub-millimetre precision against a zoomable, panning viewport, and the agent has
no way to confirm it landed — a screenshot of two nearly identical rectangles
does not tell you whether the boundary still closes. Every step is a guess, and
a wrong guess is invisible until leather is cut.

Through WebMCP, the same request is one call with a number in it, and — this is
the part that matters — the agent can **read the result back as geometry**.
LeatherCad already resolves outlines into closed chains, builds piece meshes and
scores whether a document can actually be cut, sewn and folded. Those resolvers
are what the read tools return. So the loop closes:

> draw → measure what the app actually made → check it → fix it → cost it

An agent can be wrong and then find out it was wrong, in the same turn, before a
person spends £90 of veg tan finding out for it.

The second reason is that leatherwork is *already* a two-party job. The maker
has the taste and the hands; the arithmetic — nesting yield, hide count, thread
length, stitch pitch across a curve — is exactly the tedious, checkable part
that wants delegating. WebMCP puts the agent on the same document rather than in
a chat window beside it.

## What people and agents can do together that was hard before

- **Describe a piece and get real geometry.** "A 190 × 95 wallet body, 8mm
  corners, saddle stitch 4mm in at a 7-spi pitch" is one `create_pattern_piece`
  call and comes back as a closed outline with 130-odd correctly spaced holes.
  Previously this was either hand-drafting or a text prompt into a generator
  that could not tell you whether its output closed.
- **Ask the app whether the pattern actually works.** `check_pattern` runs the
  project's own geometry checks — pieces overlapping on the hide, stitch holes
  drawn off the piece they belong to, a crease that stops short of the cut edge
  so the piece cannot fold, a seam whose two sides do not mate — and returns
  which failed and why. An agent that writes geometry and then scores itself is
  a different thing from an agent that writes geometry and hopes.
- **Cost the job before cutting.** `estimate_material` multiplies pieces by
  quantity, allows for nesting waste, converts to square feet and square
  decimetres, works out how many hides and what they cost, and measures the
  thread from the real stitch runs in the document. That conversation used to
  happen on paper, after the pattern was finished.
- **Iterate out loud, in one workspace.** The agent highlights the piece it is
  about to change (`select_pattern_pieces`), the person sees it light up on the
  canvas, and every call the agent made — arguments and result — is listed in
  the Agent tools panel. Nothing happens to the document invisibly.
- **Finish the job.** `export_pattern` hands back an SVG or DXF for a cutter, a
  PDF to print and trace, or the editable project JSON.

## How WebMCP is implemented

Registration is one effect, in
[`useWebMcpBridge.ts`](../src/features/editor/webmcp/useWebMcpBridge.ts):

```js
document.modelContext.registerTool({
  name: 'create_pattern_piece',
  description: 'Add a leather pattern piece to the open document from its dimensions...',
  inputSchema: { type: 'object', properties: { /* ... */ }, required: ['shape', 'name', 'width_mm'] },
  execute: async (input) => { /* ... */ },
}, { signal: controller.signal })
```

Tools are registered once on mount and unregistered by aborting that signal,
which is how the spec asks for teardown. `document.modelContext` is
feature-detected: in a browser without it the app behaves exactly as before, and
the panel says why the tools are not live.

The pieces behind that:

| File | What it is |
|---|---|
| `webmcp-api.ts` | The slice of the browser API we depend on, declared and feature-detected |
| `webmcp-input.ts` | Defensive argument reading — a model can send `"42"` where the schema says number, and a bad call must answer rather than throw |
| `webmcp-shapes.ts` | Parametric outlines (rounded panel, strap, card slot, disc) and the parallel stitch line inside them |
| `webmcp-document.ts` | Turns a tool call into an `AiBuilderDocumentV1`, the app's existing declarative document format |
| `webmcp-merge.ts` | Merges a compiled fragment into the open document: fresh ids, references rewritten, layers reconciled by name |
| `webmcp-measure.ts` | Measures resolved geometry — piece meshes, cut area, perimeter, stitch runs |
| `webmcp-material.ts` | Hide count, waste, cost and thread length |
| `webmcp-tools-*.ts` | The tool definitions, as pure functions of a bridge interface |
| `webmcp-tools.ts` | Wraps every tool so a failure is an answer, and records the call |
| `webmcp-activity.ts` | The call log the UI reads |
| `WebMcpPanel.tsx` | What the person sees: status, tool list, and every call the agent made |

Three decisions are worth calling out.

**Writes go through the app's own compiler, not around it.** A tool call becomes
an `AiBuilderDocumentV1` and is compiled by `compileAiBuilderDocument` — the same
path the app's AI Builder already used. An agent cannot write geometry the rest
of the app cannot read, and a malformed document comes back as validation errors
naming the field, not as a broken canvas.

**Reads are measured, not echoed.** `list_pattern_pieces` reports what
`resolvePatternPieceChains` and `buildPieceMeshes` made of the document, so a
piece whose boundary failed to close reports as unresolved rather than
reporting the dimensions the model asked for.

**A write is visible.** Every tool call lands in the panel with its arguments
and its result, the agent's new shapes become the canvas selection, the view
fits itself to the geometry once the write has landed — an agent drawing
off-screen has shown the person nothing — and the editor's own status bar
reports the change the way it reports the user's edits.

There is also a small guard that this work made necessary: LeatherCad loads a
demo document on startup if the canvas is blank, and it does so across a dynamic
import. An agent calling a tool inside that gap used to have its work replaced
by the demo. The startup load now re-checks that the canvas is still blank at
the moment it applies (`onlyWhenBlank` in `useFileActions`).

## The tools

### Reading

| Tool | What it answers |
|---|---|
| `get_pattern_overview` | Name, counts, total leather area, total stitch run. The first call to make |
| `list_pattern_pieces` | Per piece: measured size, position on the sheet, cut area, perimeter, cutouts, stitch holes, and whether the boundary resolved |
| `check_pattern` | Whether the pattern can be cut, sewn and folded, check by check, plus compiler preflight |
| `estimate_material` | Hides, waste, cost and thread from the pattern and the stock you name |
| `describe_pattern_format` | The document schema, for writing a whole pattern by hand |

### Writing

| Tool | What it does |
|---|---|
| `create_pattern_piece` | A piece from dimensions — `rounded_rect`, `strap`, `card_slot`, `circle` — with an optional saddle-stitch line inset from the cut edge. Auto-placed clear of existing work |
| `add_stitch_line` | A run of holes along a line or an arc, at a given pitch |
| `apply_pattern_json` | A whole pattern document, merged or (explicitly) replacing |
| `select_pattern_pieces` | Highlights pieces on the canvas and brings them into view, so the person can follow along |
| `clear_document` | Empties the document to start over. Destructive, and described as such |
| `rename_document` | Renames the open pattern |
| `undo_last_change` | The same undo the person has on Ctrl+Z |
| `export_pattern` | Downloads SVG, PDF, DXF or JSON |

## Trying it

Open the app in ChatGPT's in-app browser, or in Chrome with
`chrome://flags/#enable-webmcp-testing` enabled. The Agent tools panel in the
bottom-left corner says whether the tools registered.

A session that shows the whole loop:

1. *"What's on the canvas?"* → `get_pattern_overview`
2. *"Start a bifold: a 190 by 95 body with 8mm corners, saddle stitched 4mm in
   at 3.85mm pitch, and two card slots 92 by 60 with a 14mm scoop."* →
   three `create_pattern_piece` calls
3. *"Does that actually work?"* → `check_pattern`
4. *"How much 3.2mm veg tan, if a side is 24 square feet at £180?"* →
   `estimate_material`
5. *"Give me the DXF."* → `export_pattern`

## Running the tests

```sh
pnpm test                                     # unit suite, including the WebMCP tools
pnpm vitest run src/features/editor/webmcp/   # just this feature
pnpm test:e2e --project=chromium webmcp-agent # the tools driven in a real browser
```

The e2e spec installs a stub `document.modelContext` before the app loads —
no shipping browser has WebMCP without a flag — and then everything after that
is the real thing: the tools registered are the tools the app publishes, and
calling one runs it against the live editor and the canvas on screen.
