import { describe, expect, it } from 'vitest'
import { OPS } from 'pdfjs-dist'
import {
  buildVectorPaths,
  dehydrateVectorPaths,
  hydrateVectorPaths,
  PT_TO_MM,
  type PdfOperatorList,
  type PdfPageBox,
} from './pdf-vector-paths'

/** US Letter, the box the wallet template is drawn on. */
const LETTER: PdfPageBox = [0, 0, 612, 792]

const MOVE_TO = 0
const LINE_TO = 1
const CURVE_TO = 2
const CLOSE_PATH = 4

function ops(entries: Array<[number, unknown]>): PdfOperatorList {
  return { fnArray: entries.map(([fn]) => fn), argsArray: entries.map(([, args]) => args) }
}

/** A 72pt (= 1 inch) square starting at the page's bottom-left corner. */
function unitSquare(paintOp: number) {
  return ops([
    [OPS.setStrokeRGBColor, ['#112233']],
    [
      OPS.constructPath,
      [
        paintOp,
        [new Float32Array([MOVE_TO, 0, 0, LINE_TO, 72, 0, LINE_TO, 72, 72, LINE_TO, 0, 72, CLOSE_PATH])],
      ],
    ],
  ])
}

describe('buildVectorPaths', () => {
  it('reads PDF points as millimetres with y running down from the page top', () => {
    const [path] = buildVectorPaths(unitSquare(OPS.stroke), LETTER)

    expect(path.paint).toBe('stroke')
    expect(path.strokeColor).toBe('#112233')
    expect(path.subpaths).toHaveLength(1)
    // (0,0) in PDF space is the bottom-left, so it lands at the bottom in a
    // y-down document: full page height, and one inch is 25.4 mm.
    expect(path.subpaths[0].polyline[0]).toEqual({ x: 0, y: 792 * PT_TO_MM })
    expect(path.subpaths[0].polyline[1].x).toBeCloseTo(25.4, 6)
    expect(path.subpaths[0].polyline[2].y).toBeCloseTo(792 * PT_TO_MM - 25.4, 6)
  })

  it('applies the transform stack and restores it', () => {
    const list = ops([
      [OPS.save, null],
      [OPS.transform, [1, 0, 0, 1, 100, 200]],
      [OPS.constructPath, [OPS.stroke, [new Float32Array([MOVE_TO, 0, 0, LINE_TO, 10, 0])]]],
      [OPS.restore, null],
      [OPS.constructPath, [OPS.stroke, [new Float32Array([MOVE_TO, 0, 0, LINE_TO, 10, 0])]]],
    ])

    const [shifted, unshifted] = buildVectorPaths(list, LETTER)

    expect(shifted.subpaths[0].polyline[0].x).toBeCloseTo(100 * PT_TO_MM, 6)
    expect(unshifted.subpaths[0].polyline[0].x).toBeCloseTo(0, 6)
  })

  it('closes a filled subpath the author left open', () => {
    const open = ops([
      [OPS.setFillRGBColor, ['#000000']],
      [OPS.constructPath, [OPS.fill, [new Float32Array([MOVE_TO, 0, 0, LINE_TO, 72, 0, LINE_TO, 72, 72])]]],
    ])

    const [path] = buildVectorPaths(open, LETTER)

    // Illustrator emits stitch-hole discs exactly this way. Reading them as
    // open paths would lose every hole on the sheet.
    expect(path.subpaths[0].closed).toBe(true)
    expect(path.subpaths[0].segments).toHaveLength(3)
  })

  it('keeps a stroked subpath open when the author left it open', () => {
    const open = ops([
      [OPS.constructPath, [OPS.stroke, [new Float32Array([MOVE_TO, 0, 0, LINE_TO, 72, 0])]]],
    ])

    expect(buildVectorPaths(open, LETTER)[0].subpaths[0].closed).toBe(false)
  })

  it('keeps clip paths out of the geometry but keeps them identifiable', () => {
    const [path] = buildVectorPaths(unitSquare(OPS.endPath), LETTER)

    expect(path.paint).toBe('none')
  })

  it('flattens a cubic to chords while keeping the authored curve', () => {
    const list = ops([
      [
        OPS.constructPath,
        [OPS.stroke, [new Float32Array([MOVE_TO, 0, 0, CURVE_TO, 0, 40, 40, 72, 72, 72])]],
      ],
    ])

    const [path] = buildVectorPaths(list, LETTER)
    const [subpath] = path.subpaths

    expect(subpath.segments).toHaveLength(1)
    expect(subpath.segments[0].kind).toBe('cubic')
    expect(subpath.polyline.length).toBeGreaterThan(8)
    // Every chord end sits on the curve, so the run stays inside the hull.
    for (const point of subpath.polyline) {
      expect(point.x).toBeGreaterThanOrEqual(-1e-9)
      expect(point.x).toBeLessThanOrEqual(72 * PT_TO_MM + 1e-9)
    }
  })

  it('rebuilds dropped polylines from the segments they came from', () => {
    const original = buildVectorPaths(unitSquare(OPS.stroke), LETTER)

    const restored = hydrateVectorPaths(dehydrateVectorPaths(original))

    expect(restored[0].subpaths[0].polyline).toEqual(original[0].subpaths[0].polyline)
  })
})
