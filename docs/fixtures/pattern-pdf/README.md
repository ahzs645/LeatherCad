# Pattern PDF fixtures

Output of `pnpm pattern:pdf <file.pdf>` — see
`src/features/editor/ops/pattern-pdf/README.md` for what the import does.

Three files per template:

- `*.paths.json` — the vector geometry pdf.js read off the page, as SVG path
  data in millimetres. Replaying this is how `pattern-pdf-import.test.ts` runs
  the analysis against a real sheet without needing pdf.js's browser build.
  Flattened polylines are not stored; they are rebuilt from the curves on load.
- `*.report.json` — what the analysis found: pieces and their sizes, stitch runs
  with hole counts and pitch, hardware holes, paired seams, and any warnings.
- `*.doc.json` — a LeatherCad project built from that analysis, with the pieces
  placed in 3D from their seams. Open it with **Open** in the editor.

The wallet's `doc.json` is not only test data: the app ships it as a preset, so
`src/features/editor/data/imported-pattern-presets.ts` imports this exact file.
There is one copy of it on purpose — regenerating the fixture updates the
sample the Template Repository loads. Moving or renaming it breaks that import.

Regenerate a fixture by re-running the import over the same PDF. The files are
derived, so nothing here should be edited by hand.

## makesupply-keychain-snap-wallet

MAKESUPPLY's free Keychain Snap Wallet template (US Letter sheet, 2019),
published for personal use at <https://makesupply-leather.com>. The source PDFs
are deliberately not in this repository — download them from MAKESUPPLY to
regenerate these files. What is committed is the geometry the importer read off
the sheet.

It is here as test data — a real published sheet exercises the import in ways a
synthetic one cannot: a maker's logo that must not be read as a piece, a stitch
run that turns two corners, a pocket whose free edge is a single long curve, and
a keychain tab whose only clue that it folds is that its two three-hole runs
match.
