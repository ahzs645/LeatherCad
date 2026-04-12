import { describe, expect, it } from 'vitest'
import type { Shape, StitchHole } from '../cad/cad-types'
import {
  copySelectionToClipboard,
  parseClipboardPayload,
  pasteClipboardPayload,
  serializeClipboardPayload,
} from './shape-selection-ops'

describe('shape-selection-ops clipboard persistence', () => {
  it('preserves extracted box stitch sources and terminal stitch holes through clipboard round-trips', () => {
    const shapes: Shape[] = [
      {
        id: 'shape-1',
        type: 'line',
        layerId: 'layer-1',
        lineTypeId: 'cut',
        boxStitchSource: { extracted: true },
        start: { x: 0, y: 0 },
        end: { x: 40, y: 0 },
      },
    ]
    const stitchHoles: StitchHole[] = [
      {
        id: 'hole-1',
        shapeId: 'shape-1',
        point: { x: 20, y: 0 },
        angleDeg: 90,
        holeType: 'round',
        sequence: 0,
        endHole: true,
      },
    ]

    const payload = copySelectionToClipboard(
      shapes,
      stitchHoles,
      [],
      [],
      [],
      [],
      [],
      [],
      new Set(['shape-1']),
    )
    const serialized = serializeClipboardPayload(payload)
    const parsed = parseClipboardPayload(serialized)

    expect(parsed?.shapes[0]).toMatchObject({
      boxStitchSource: { extracted: true },
    })
    expect(parsed?.stitchHoles[0]?.endHole).toBe(true)

    const pasted = pasteClipboardPayload(parsed!, { x: 10, y: 5 }, 'layer-2')
    expect(pasted.shapes[0]).toMatchObject({
      boxStitchSource: { extracted: true },
    })
    expect(pasted.shapes[0]?.layerId).toBe('layer-2')
    expect(pasted.stitchHoles[0]?.endHole).toBe(true)
    expect(pasted.stitchHoles[0]?.point).toEqual({ x: 30, y: 5 })
  })
})
