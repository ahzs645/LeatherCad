# The importer against 70 real pattern PDFs

**Date:** 2026-08-27 · **Branch:** `claude/fold-solver-roadmap-xzt51z`
**Corpus:** 70 leathercraft pattern PDFs from a shared Drive folder — wallets,
bags, pouches, watch straps, and several Japanese sheets. 69 imported (one is a
zip). Not committed: they are other people's patterns. The scripts to
reproduce this are in the session scratchpad; the numbers are here.

Until now this repo had **one** imported fixture, and several notes in
[`FOLD_DRAPE_FOLLOW_UPS.md`](./FOLD_DRAPE_FOLLOW_UPS.md) say plainly that one
fixture is one data point. This is the first time the importer has been run at
any scale.

## The result

Every PDF was imported at its **page 1** with `pnpm pattern:pdf`.

| gate | result |
|---|---|
| had vector geometry on the page | 68/69 (99%) |
| yielded ≥1 pattern piece | 29/69 (42%) |
| yielded ≥2 pattern pieces | 26/69 (38%) |
| found any stitch holes | 17/69 (25%) |
| stitch **pitch** physically plausible (2–8 mm) | 7/69 (10%) |
| **a seam joining two different pieces** | **0/69 (0%)** |
| **a `doc.json` carrying any `seamConnection`** | **0/69 (0%)** |

The analysis reported 188 "seams" across the corpus. **Every one is a fold** —
a run paired with another run on the *same* piece. Not one pairing joined two
pieces, so nothing in this corpus assembles.

## Why the shipped fixture works and these mostly do not

`makesupply-keychain-snap-wallet` is a **single-page, print-ready vector PDF
whose stitch holes are drawn as real geometry**: 4.97 mm pitch, 5.1 SPI,
1.13 mm holes, 96 holes in 4 runs, 3 pieces, 2 seams. That is a narrow input
class, and most of this corpus is not in it.

Three distinct failure modes, which want three different fixes:

**1. Wrong page.** The importer takes page 1; these run 2–10 pages and often
open with a cover or cutting instructions. `A067_tri_fold_wallet` yields
nothing on pages 1–3 and **2 pieces with 2 paired runs on page 4**. This is the
cheapest to fix: sweep pages and keep the best, or let the caller pick.

**2. Pieces but no stitching.** `long-wallet-pattern` finds **14 pieces and 0
holes**; `flap-card-wallet` finds 7 pieces, 0 holes, and warns *"no run on this
piece pairs with one on another, so nothing joins it to the assembly"* for
every piece. Without runs there is nothing to pair, so there are no seams.

**3. Noise read as stitching — the one that should worry us.** The importer
does not only miss; it sometimes produces confident, entirely fictitious
output, and nothing downstream flags it:

| pattern | reported pitch | SPI | hole ⌀ | "seams" |
|---|---|---|---|---|
| `AccordionWallet` | 0.034 mm | **744.6** | 0.27 mm | 49 |
| `Valet_Tray` | 0.19 mm | **132.5** | — | 24 |
| `Jockey Pocket` | 0.35 mm | **71.8** | — | 42 |
| `leather_basket` | 0.46 mm | **55.3** | — | 62 |

Real hand stitching is 3–5 mm and 5–7 SPI. These are curve fragments being
paired with each other. `AccordionWallet` looks like the corpus's best result
until you read the pitch.

A correction to an earlier pass of this measurement: a first cut of the
plausibility gate required both pitch *and* hole diameter to be sane and
reported only 2/69. That was wrong. The Castillo patterns (key slip, knife
slip, phone sling, sunglasses case) have genuinely good pitch — 3.61, 6.22,
3.77, 5.39 mm — with hole diameter 0.048 mm, because they draw stitch
positions as thin marks rather than punched circles. Diameter is a separate
signal from pitch and should not veto it. The honest count is **7**.

## What it looks like

`RoseLeatherCraft_Trifoldcardwallet` is the corpus's best case: 4 pieces, 208
holes, 5.44 mm pitch, and it renders. See `docs/images/corpus/`. The four
pieces are cut correctly, with outlines, thickness and stitch runs along their
edges — and they lie **flat and separate on the ground**, because no seam
connects them. That picture is the whole finding: the renderer is fine, and
there is simply nothing telling it how the pieces join.

Not everything renders. `Cross_Body_Inlay_Bag` (4 pieces, 5 folds, 62 holes,
7.02 mm pitch) **failed to bring up the 3D canvas within 30 s, twice**, through
the same harness that renders the shipped fixture and the trifold above. Not
yet isolated, and worth isolating — it is the only document seen to do this.

## What this changes

- **Item 3 of the roadmap** (couple the pieces) is not the binding constraint
  for imported patterns. Nothing gets far enough to need it.
- The seam-pairing step is where the pipeline actually stops, and it has never
  been measured against more than one sheet.
- The importer needs a **confidence signal**. A pattern reporting 744 SPI
  should be rejected, not compiled into a document and handed to the app as
  though it were a wallet. A pitch outside roughly 2–8 mm and a hole diameter
  outside roughly 0.5–3 mm are enough to catch every false positive above.
- Page selection is worth fixing first: it is cheap, and it is the only
  failure mode demonstrated to be recoverable.
