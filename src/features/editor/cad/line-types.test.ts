import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
  LINE_TYPE_PALETTE_SLOT_COUNT,
  createDefaultLineTypes,
  normalizeLineTypes,
  parseLineType,
  resolveLineTypeStrokeWidthMm,
  shouldIgnoreLineTypeInPrint,
} from './line-types'

describe('line type metadata', () => {
  it('adds stroke and print defaults to the base palette', () => {
    const lineTypes = createDefaultLineTypes()

    expect(lineTypes).toHaveLength(LINE_TYPE_PALETTE_SLOT_COUNT)
    expect(lineTypes.every((lineType) => lineType.strokeWidthMm === DEFAULT_LINE_TYPE_STROKE_WIDTH_MM)).toBe(true)
    expect(lineTypes.every((lineType) => lineType.ignoreInPrint === false)).toBe(true)
  })

  it('preserves source-app slots 1-10 and fills slots 11-40 as custom entries', () => {
    const lineTypes = createDefaultLineTypes()

    expect(lineTypes.slice(0, 10).map((lineType) => lineType.name)).toEqual([
      '1 - Cyan Solid',
      '2 - Green Solid',
      '3 - White Solid',
      '4 - Yellow Dashed',
      '5 - Magenta Dotted',
      '6 - White Dash Dot Dot',
      '7 - Gray Dotted',
      '8 - Orange Solid',
      '9 - Red Dashed',
      '10 - Pink Dashed',
    ])
    expect(lineTypes.slice(10)).toHaveLength(30)
    expect(lineTypes[10]).toMatchObject({ id: 'type-extra-11', name: '11 - Custom', role: 'cut', style: 'solid' })
    expect(lineTypes[39]).toMatchObject({ id: 'type-extra-40', name: '40 - Custom', role: 'cut', style: 'solid' })
  })

  it('parses and clamps stroke width metadata from documents', () => {
    const parsed = parseLineType(
      {
        id: 'guide',
        name: 'Guide',
        role: 'guide',
        style: 'dashed',
        color: '#abcdef',
        visible: true,
        strokeWidthMm: 99,
        ignoreInPrint: true,
      },
      0,
    )

    expect(parsed?.strokeWidthMm).toBe(20)
    expect(parsed?.ignoreInPrint).toBe(true)
  })

  it('normalizes older line types that do not carry metadata', () => {
    const [lineType] = normalizeLineTypes([
      {
        id: 'legacy',
        name: 'Legacy',
        role: 'cut',
        style: 'solid',
        color: '#000000',
        visible: true,
      },
    ])

    expect(resolveLineTypeStrokeWidthMm(lineType)).toBe(DEFAULT_LINE_TYPE_STROKE_WIDTH_MM)
    expect(shouldIgnoreLineTypeInPrint(lineType)).toBe(false)
  })
})
