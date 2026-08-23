# Pattern PDF import

Reads a leathercraft template PDF as pattern geometry: which pieces are on the
sheet, where the stitching runs, at what pitch, and which runs get sewn to each
other.

The existing PDF importer rasterises a page into a tracing overlay you draw over
by hand. This one keeps the vectors. A published template already *is* CAD data —
Illustrator paths at exact dimensions with every punch mark placed — and the only
thing missing is the labelling: nothing in the file says which path is a piece,
which discs are stitch holes, or which edge meets which.

## The stages

Each stage is a pure function over the previous one's output, so any of them can
be tested, replaced, or run on stored data without a PDF.

| Module | Job |
| --- | --- |
| `pdf-vector-paths` | pdf.js operator list → flattened paths in millimetres |
| `pdf-vector-source` | the pdf.js plumbing around it |
| `pattern-separation` | paths → pieces, cutouts, punch marks, ignored artwork |
| `pattern-outline-sides` | a piece's segments → the sides a person would name |
| `stitch-pattern-detection` | punch marks → stitch runs, in sewing order |
| `stitch-seam-matching` | runs → the pairs that get sewn together |
| `pattern-fold-inference` | runs and pairs → where the piece folds |
| `pattern-piece-naming` | the type printed on a piece → what to call it |
| `pattern-pdf-analysis` | all of the above, tied together |
| `pattern-shape-emitter` | outline sides → editable lines and arcs |
| `pattern-doc-builder` | analysis → a LeatherCad project |
| `pattern-assembly-placement` | project → pieces placed in 3D from its seams |
| `pattern-path-codec` | extracted paths ↔ a compact file |
| `pattern-pdf-import` | the browser's entry point: all of it, plus a one-line summary |

## How the labelling is recovered

**Pieces** are the closed paths enclosing more than 400 mm². That threshold is
what keeps a maker's logo, a glyph, and a callout arrow off the pattern. A closed
path inside another is a cutout of it, not a piece of its own.

**Punch marks** are the closed paths small enough to be a punch *and* round
enough to be one — roundness measured as 4πA/P², so a glyph counter and a long
slot are rejected at the size a snap hole passes.

**Stitch runs** come from walking the marks nearest-neighbour with a turn limit.
Distance alone joins two rows that pass close at a corner; the turn limit is what
keeps a run going straight through instead of hopping the gap. The pitch estimate
— the median nearest-neighbour distance over the piece — is what tells a 5 mm step
along a row from a 9 mm jump across one. Marks left out of every run are hardware:
snap, rivet, and post holes.

**Seams** are pairs of runs with the same hole count, the same length, and the
same sequence of turns. A maker punches both sides of a seam with the same chisel
in the same passes, so the two sides agree to the micrometre; matching the *signed*
turn profile is what stops a mirrored run from pairing with one it could never be
sewn to, and it also reports which end of one run meets which end of the other. A
pair on the same piece is a fold rather than a seam.

**Names** come from the sheet, which labels its own pieces. The difficulty is
that a piece carries more type than its name: the maker's mark and the pattern
title are printed on every piece, and the piece's size sits under them. Two rules
separate them — a line printed on more than one piece is nobody's name, and a
line that is only a measurement is a dimension — and what survives is joined in
reading order, which is how "KEYCHAIN" over "ATTACHMENT" comes back whole. The
rest of the type is kept too, as text on a guide line type: piece labels on their
piece, and the sheet's own notes ("print at 100%") on a layer of their own. The
baseline angle comes with it — sheets turn a panel's label sideways to fit it,
and laid out flat those four lines land on top of each other.

**Folds** are the one thing inferred rather than read, because sheets do not draw
them. Two runs on one piece that pair can only meet if the piece folds, and the
axis they meet across is the fold. Separately, a run that stops before it closes
leaves everything past its open ends unsewn; if that leftover is a real share of
the piece rather than seam allowance, it is a flap and it hinges across the line
joining those ends.

## Running it

In the editor: **Output → Pattern PDF**. The sheet replaces the open document,
because it brings its own pieces, layers, and seams, and the status line says
what came off it — piece count, pitch, seams — so you can tell at a glance
whether the import understood the template. Anything it could not resolve is
logged rather than swallowed.

From the command line, over any PDF:

```bash
node scripts/import-pattern-pdf.mjs <pattern.pdf> --name "Card Case"
# or: pnpm pattern:pdf <pattern.pdf> --name "Card Case"
```

Writes three files to `docs/fixtures/pattern-pdf/`:

- `*.paths.json` — the extracted geometry, for replaying without pdf.js
- `*.report.json` — pieces, runs, pitch, seams, and any warnings
- `*.doc.json` — a LeatherCad project, pieces placed, openable with **Open**

The script loads the app's TypeScript through Vite's SSR pipeline rather than
duplicating any of it. The app already talks to pdf.js's legacy build (see
`ops/pdfjs.ts`), which is also the one that runs under Node, so the two paths
read a sheet through exactly the same code.

## Testing

`pattern-pdf-wallet.test.ts` runs everything downstream of the reader against a
real template — MAKESUPPLY's free Keychain Snap Wallet, replayed from its stored
path file — and asserts what a maker would measure: 5 mm pitch, 1.1 mm holes, 45
of them down each side of the one seam, two snap holes, a seam that closes to
under half a millimetre when the pocket is folded onto the body, and the three
pieces coming through under the names the sheet gives them. The other tests
are synthetic, and each covers the case its stage is easy to get wrong: mirrored
runs that must not pair, parallel rows that must not merge, a side broken at three
anchors that is still one side.
