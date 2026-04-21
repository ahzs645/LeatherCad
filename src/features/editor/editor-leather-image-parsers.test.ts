import { describe, expect, it } from 'vitest'
import { parseLeatherImageFill } from './editor-leather-image-parsers'

describe('parseLeatherImageFill', () => {
  it('normalizes embedded leather image fill metadata', () => {
    const fill = parseLeatherImageFill({
      id: 'leather-1',
      name: 'grain.png',
      imageDataUrl: 'data:image/png;base64,AA==',
      bitmapWidth: 100,
      bitmapHeight: 80,
      x: 5,
      y: 6,
      widthMm: 40,
      heightMm: 32,
      rotationDeg: 15,
      crop: { x: -10, y: 4, width: 200, height: 20 },
      assignedShapeIds: ['a', 'a', 2],
      visible: true,
      opacity: 2,
      dpi: 144,
    })

    expect(fill?.crop).toEqual({ x: 0, y: 4, width: 100, height: 20 })
    expect(fill?.assignedShapeIds).toEqual(['a'])
    expect(fill?.opacity).toBe(1)
    expect(fill?.dpi).toBe(144)
  })
})
