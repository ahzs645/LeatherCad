import { describe, it, expect } from 'vitest'
import { buildDxfFromShapes } from './io-dxf'
import type { LineShape } from '../cad/cad-types'

function makeLineShape(overrides: Partial<LineShape> = {}): LineShape {
  return {
    id: 'line-1',
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 20 },
    ...overrides,
  }
}

describe('buildDxfFromShapes', () => {
  it('returns valid DXF with 0 segments for empty shapes array', () => {
    const result = buildDxfFromShapes([])
    expect(result.segmentCount).toBe(0)
    expect(result.content).toContain('HEADER')
    expect(result.content).toContain('ENTITIES')
    expect(result.content).toContain('EOF')
  })

  it('produces correct segment count for a single line shape', () => {
    const result = buildDxfFromShapes([makeLineShape()])
    expect(result.segmentCount).toBe(1)
    expect(result.content).toContain('LINE')
  })

  it('negates Y coordinates when flipY is true', () => {
    const shape = makeLineShape({ start: { x: 5, y: 10 }, end: { x: 15, y: 20 } })
    const normal = buildDxfFromShapes([shape], { flipY: false })
    const flipped = buildDxfFromShapes([shape], { flipY: true })

    // In normal mode, y values should be positive (10, 20)
    expect(normal.content).toContain('10.000000')
    expect(normal.content).toContain('20.000000')

    // In flipped mode, y values should be negated (-10, -20)
    expect(flipped.content).toContain('-10.000000')
    expect(flipped.content).toContain('-20.000000')
  })

  it('uses AC1014 version code for r14', () => {
    const result = buildDxfFromShapes([], { version: 'r14' })
    expect(result.content).toContain('AC1014')
    expect(result.content).not.toContain('AC1009')
  })

  it('uses AC1009 version code for r12 (default)', () => {
    const result = buildDxfFromShapes([])
    expect(result.content).toContain('AC1009')
  })

  it('converts from mm to inches when unit is in', () => {
    const shape = makeLineShape({ start: { x: 25.4, y: 0 }, end: { x: 50.8, y: 0 } })
    const result = buildDxfFromShapes([shape], { unit: 'in' })
    // 25.4mm = 1 inch, 50.8mm = 2 inches
    expect(result.content).toContain('1.000000')
    expect(result.content).toContain('2.000000')
  })

  it('contains proper HEADER, ENTITIES, and EOF sections', () => {
    const result = buildDxfFromShapes([makeLineShape()])
    const content = result.content

    // Check section structure
    expect(content).toContain('SECTION')
    expect(content).toContain('HEADER')
    expect(content).toContain('ENDSEC')
    expect(content).toContain('ENTITIES')
    expect(content).toContain('EOF')

    // Verify HEADER comes before ENTITIES
    const headerIndex = content.indexOf('HEADER')
    const entitiesIndex = content.indexOf('ENTITIES')
    const eofIndex = content.indexOf('EOF')
    expect(headerIndex).toBeLessThan(entitiesIndex)
    expect(entitiesIndex).toBeLessThan(eofIndex)
  })

  it('includes $ACADVER and $INSUNITS in header', () => {
    const result = buildDxfFromShapes([], { unit: 'mm' })
    expect(result.content).toContain('$ACADVER')
    expect(result.content).toContain('$INSUNITS')
  })

  it('uses insert units code 1 for inches and 4 for mm', () => {
    const mmResult = buildDxfFromShapes([], { unit: 'mm' })
    const inResult = buildDxfFromShapes([], { unit: 'in' })

    // Check that the units code appears after $INSUNITS
    const mmLines = mmResult.content.split('\n')
    const inLines = inResult.content.split('\n')

    const mmInsUnitsIdx = mmLines.indexOf('$INSUNITS')
    const inInsUnitsIdx = inLines.indexOf('$INSUNITS')

    // code 70 follows, then the value
    expect(mmLines[mmInsUnitsIdx + 2]).toBe('4')
    expect(inLines[inInsUnitsIdx + 2]).toBe('1')
  })

  it('includes LTYPE table entries', () => {
    const result = buildDxfFromShapes([makeLineShape()])
    expect(result.content).toContain('LTYPE')
    expect(result.content).toContain('CONTINUOUS')
  })

  it('uses layer name from shape layerId', () => {
    const result = buildDxfFromShapes([makeLineShape({ layerId: 'MyLayer' })])
    expect(result.content).toContain('MyLayer')
  })
})
