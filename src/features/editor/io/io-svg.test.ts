import { describe, expect, it } from 'vitest'
import { importSvgAsShapes } from './io-svg'

const importOptions = { layerId: 'layer-1', lineTypeId: 'lt-1' }

describe('importSvgAsShapes', () => {
  it('imports SVG text as editable text shapes', () => {
    const result = importSvgAsShapes(
      '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20" font-size="5" font-family="Arial">Hello</text></svg>',
      importOptions,
    )

    expect(result.warnings).toEqual([])
    expect(result.shapes).toHaveLength(1)
    const shape = result.shapes[0]
    expect(shape.type).toBe('text')
    if (shape.type !== 'text') return
    expect(shape.text).toBe('Hello')
    expect(shape.fontFamily).toBe('Arial')
    expect(shape.fontSizeMm).toBe(5)
    expect(shape.start).toEqual({ x: 10, y: 20 })
    expect(shape.end.x).toBeGreaterThan(shape.start.x)
  })

  it('applies nested translate transforms to line geometry', () => {
    const result = importSvgAsShapes(
      [
        '<svg xmlns="http://www.w3.org/2000/svg">',
        '  <g transform="translate(5,10)">',
        '    <line x1="0" y1="1" x2="10" y2="1" transform="translate(2,3)" />',
        '  </g>',
        '</svg>',
      ].join(''),
      importOptions,
    )

    expect(result.warnings).toEqual([])
    expect(result.shapes).toHaveLength(1)
    const shape = result.shapes[0]
    expect(shape.type).toBe('line')
    if (shape.type !== 'line') return
    expect(shape.start).toEqual({ x: 7, y: 14 })
    expect(shape.end).toEqual({ x: 17, y: 14 })
  })

  it('applies viewBox scaling before transform translation', () => {
    const result = importSvgAsShapes(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="100mm" viewBox="0 0 100 50"><line x1="10" y1="5" x2="20" y2="5" transform="translate(5,0)" /></svg>',
      importOptions,
    )

    const shape = result.shapes[0]
    expect(shape.type).toBe('line')
    if (shape.type !== 'line') return
    expect(shape.start).toEqual({ x: 30, y: 10 })
    expect(shape.end).toEqual({ x: 50, y: 10 })
  })

  it('applies rotation transforms to imported text baselines', () => {
    const result = importSvgAsShapes(
      '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20" font-size="4" transform="rotate(90 10 20)">A</text></svg>',
      importOptions,
    )

    const shape = result.shapes[0]
    expect(shape.type).toBe('text')
    if (shape.type !== 'text') return
    expect(shape.start.x).toBeCloseTo(10)
    expect(shape.start.y).toBeCloseTo(20)
    expect(shape.end.x).toBeCloseTo(10)
    expect(shape.end.y).toBeGreaterThan(20)
  })
})
