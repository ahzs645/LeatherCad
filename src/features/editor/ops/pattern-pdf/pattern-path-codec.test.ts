import { describe, expect, it } from 'vitest'
import { decodePatternPaths, encodePatternPaths, pathDataToSegments, segmentsToPathData } from './pattern-path-codec'
import { hydrateVectorPaths, type PdfVectorPath } from './pdf-vector-paths'

const wavyEdge: PdfVectorPath = hydrateVectorPaths([
  {
    id: 'pocket',
    paint: 'stroke',
    strokeColor: '#000000',
    fillColor: null,
    subpaths: [
      {
        closed: true,
        segments: [
          { kind: 'line', from: { x: 0, y: 0 }, to: { x: 60, y: 0 } },
          {
            kind: 'cubic',
            from: { x: 60, y: 0 },
            c1: { x: 60, y: 20 },
            c2: { x: 40, y: 30 },
            to: { x: 40, y: 50 },
          },
          { kind: 'line', from: { x: 40, y: 50 }, to: { x: 0, y: 50 } },
        ],
      },
    ],
  },
])[0]

describe('pattern path codec', () => {
  it('writes segments as SVG path data', () => {
    const data = segmentsToPathData(wavyEdge.subpaths[0].segments, true)

    // The run closes with a real segment back to the start, the way `h` does
    // in a content stream, so the data carries it as well as the Z.
    expect(data).toBe('M0 0L60 0C60 20 40 30 40 50L0 50L0 0Z')
  })

  it('reads its own path data back', () => {
    const { segments, closed } = pathDataToSegments(segmentsToPathData(wavyEdge.subpaths[0].segments, true))

    expect(closed).toBe(true)
    expect(segments).toEqual(wavyEdge.subpaths[0].segments)
  })

  it('round-trips a page, rebuilding the polylines it does not store', () => {
    const page = { widthMm: 215.9, heightMm: 279.4 }

    const decoded = decodePatternPaths(encodePatternPaths([wavyEdge], page, 'example.pdf'))

    expect(decoded).toHaveLength(1)
    expect(decoded[0].paint).toBe('stroke')
    expect(decoded[0].strokeColor).toBe('#000000')
    expect(decoded[0].subpaths[0].closed).toBe(true)
    expect(decoded[0].subpaths[0].polyline).toEqual(wavyEdge.subpaths[0].polyline)
  })

  it('keeps the encoded form well under the size of the polylines it drops', () => {
    const page = { widthMm: 215.9, heightMm: 279.4 }

    const encoded = JSON.stringify(encodePatternPaths([wavyEdge], page)).length
    const withPolylines = JSON.stringify([wavyEdge]).length

    expect(encoded).toBeLessThan(withPolylines / 4)
  })
})
