import { describe, expect, it } from 'vitest'
import { looksLikeMeasurement, namePiecesFromLabels } from './pattern-piece-naming'
import type { PdfTextItem } from './pdf-vector-paths'

function label(text: string, x: number, y: number, rotationDeg = 0): PdfTextItem {
  return {
    text,
    position: { x, y },
    heightMm: 3.5,
    rotationDeg,
    widthMm: text.length * 3.5 * 0.6,
  }
}

describe('namePiecesFromLabels', () => {
  it('takes the label that belongs to one piece and leaves the sheet furniture', () => {
    // The wallet sheet: maker and title on both panels, the panel's own name
    // and its size below them.
    const names = namePiecesFromLabels(
      new Map([
        [
          'body',
          [
            label('MAKESUPPLY', 59, 102),
            label('KEYCHAIN SNAP WALLET TEMPLATE', 43, 106),
            label('MAIN BODY PANEL', 55, 110),
            label('4.25” x 3”', 62, 115),
          ],
        ],
        [
          'pocket',
          [
            label('MAKESUPPLY', 168, 121),
            label('KEYCHAIN SNAP WALLET TEMPLATE', 173, 138),
            label('CARD SLOT PANEL', 177, 125),
            label('4.25” x 2.75”', 181, 120),
          ],
        ],
      ]),
    )

    expect(names.get('body')).toBe('MAIN BODY PANEL')
    expect(names.get('pocket')).toBe('CARD SLOT PANEL')
  })

  it('joins a label split across lines, in reading order', () => {
    const names = namePiecesFromLabels(
      new Map([['tab', [label('ATTACHMENT', 149, 43), label('KEYCHAIN', 152, 39)]]]),
    )

    expect(names.get('tab')).toBe('KEYCHAIN ATTACHMENT')
  })

  it('reads a sideways label block down the block, not down the page', () => {
    // A sheet that turns a panel's label 90 degrees to fit it advances its
    // lines along x. Reading the page's way would return them shuffled.
    const names = namePiecesFromLabels(
      new Map([
        [
          'pocket',
          [
            // -90 is what the reader emits for a quarter turn: PDF space has
            // y running up, the document has it running down.
            label('MAKESUPPLY', 168, 121, -90),
            label('CARD SLOT', 177, 125, -90),
            label('PANEL', 181, 120, -90),
          ],
        ],
        ['back', [label('MAKESUPPLY', 20, 20)]],
      ]),
    )

    expect(names.get('pocket')).toBe('CARD SLOT PANEL')
  })

  it('gives no name to a piece whose only label is its size', () => {
    const names = namePiecesFromLabels(new Map([['panel', [label('100 x 70 mm', 10, 10)]]]))

    expect(names.has('panel')).toBe(false)
  })

  it('keeps a repeated line when only one piece carries it', () => {
    // "GUSSET" twice on the same piece is still that piece's name.
    const names = namePiecesFromLabels(
      new Map([
        ['gusset', [label('GUSSET', 10, 10)]],
        ['panel', [label('BACK PANEL', 90, 10)]],
      ]),
    )

    expect(names.get('gusset')).toBe('GUSSET')
    expect(names.get('panel')).toBe('BACK PANEL')
  })
})

describe('looksLikeMeasurement', () => {
  it('recognises the ways a sheet writes a size', () => {
    for (const line of ['4.25” x 3”', '100 x 70 mm', '2.75"', '108 × 128 mm', '10cm']) {
      expect(looksLikeMeasurement(line)).toBe(true)
    }
  })

  it('leaves words alone, including ones with a number in them', () => {
    for (const line of ['MAIN BODY PANEL', 'CARD SLOT PANEL', 'POCKET 2', 'Gusset A']) {
      expect(looksLikeMeasurement(line)).toBe(false)
    }
  })
})
