import { describe, expect, it } from 'vitest'
import type { LineType, Shape } from '../cad/cad-types'
import {
  computeLeatherImageMmSize,
  createLeatherImageFillFromImage,
  resolveSelectedClosedOutlineShapeIds,
} from './leather-image-fill-ops'

const cutLineType: LineType = {
  id: 'cut',
  name: 'Cut',
  role: 'cut',
  style: 'solid',
  color: '#000000',
  visible: true,
}

describe('leather image fill ops', () => {
  it('sizes imported images from DPI', () => {
    expect(computeLeatherImageMmSize(300, 150, 300)).toEqual({ widthMm: 25.4, heightMm: 12.7 })
  })

  it('creates a fill with a full-image crop', () => {
    const fill = createLeatherImageFillFromImage({
      name: 'grain.png',
      imageDataUrl: 'data:image/png;base64,AA==',
      bitmapWidth: 320,
      bitmapHeight: 200,
    })

    expect(fill.crop).toEqual({ x: 0, y: 0, width: 320, height: 200 })
    expect(fill.assignedShapeIds).toEqual([])
  })

  it('expands a selected edge to its whole closed outline', () => {
    const shapes: Shape[] = [
      { id: 'a', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { id: 'b', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
      { id: 'c', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
      { id: 'd', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
    ]

    const selectedIds = resolveSelectedClosedOutlineShapeIds(shapes, [cutLineType], new Set(['a']))

    expect(Array.from(selectedIds).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})
