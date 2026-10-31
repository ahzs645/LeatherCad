import { describe, expect, it, vi } from 'vitest'
import { importSvgAsShapes } from './io-svg'
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_GEOMETRY } from './import-budget'
import * as budget from './import-budget'

const importOptions = { layerId: 'layer-1', lineTypeId: 'lt-1' }

describe('importSvgAsShapes', () => {
  it('rejects an oversized file before invoking the DOM parser', () => {
    expect(() => importSvgAsShapes(' '.repeat(MAX_IMPORT_FILE_BYTES + 1), importOptions)).toThrow('50 MB')
  })
  it('rejects a polyline before expanding more than the geometry budget', () => {
    const points = '0,0 '.repeat(MAX_IMPORT_GEOMETRY + 2)
    expect(() => importSvgAsShapes(`<svg xmlns="http://www.w3.org/2000/svg"><polyline points="${points}" /></svg>`, importOptions)).toThrow('200,000')
  })
  it('rejects cumulative expansion across different elements instead of skipping an over-budget path', () => {
    // Exercise the real importer/catch boundary without allocating 200,000 DOM nodes.
    const guard = vi.spyOn(budget, 'assertImportGeometryBudget').mockImplementation((count) => { if (count > 5) throw new Error('expanded geometry budget') })
    try {
      expect(() => importSvgAsShapes('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/><path d="M20 20 L30 30 L40 20"/></svg>', importOptions)).toThrow('expanded geometry budget')
    } finally { guard.mockRestore() }
  })
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

  it('ignores empty path data without warnings or placeholder geometry', () => {
    const result = importSvgAsShapes(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="   " /></svg>',
      importOptions,
    )

    expect(result.warnings).toEqual([])
    expect(result.shapes).toEqual([])
  })

  it('skips malformed path data with a warning instead of importing corrupt geometry', () => {
    const result = importSvgAsShapes(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 L nope nope" /></svg>',
      importOptions,
    )

    expect(result.warnings).toEqual(['Skipped an unsupported path element'])
    expect(result.shapes).toEqual([])
  })

  it('drops malformed point-list coordinates and keeps only complete finite pairs', () => {
    const result = importSvgAsShapes(
      '<svg xmlns="http://www.w3.org/2000/svg"><polyline points="0,0 nope,10 20,20 30" /></svg>',
      importOptions,
    )

    expect(result.warnings).toEqual([])
    expect(result.shapes).toHaveLength(1)
    const shape = result.shapes[0]
    expect(shape.type).toBe('line')
    if (shape.type !== 'line') return
    expect(shape.start).toEqual({ x: 0, y: 0 })
    expect(shape.end).toEqual({ x: 20, y: 20 })
  })
})
