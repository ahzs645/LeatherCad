import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
  createDefaultLineTypes,
  normalizeLineTypes,
  parseLineType,
  resolveLineTypeStrokeWidthMm,
  shouldIgnoreLineTypeInPrint,
} from './line-types'

describe('line type metadata', () => {
  it('adds stroke and print defaults to the base palette', () => {
    const lineTypes = createDefaultLineTypes()

    expect(lineTypes).not.toHaveLength(0)
    expect(lineTypes.every((lineType) => lineType.strokeWidthMm === DEFAULT_LINE_TYPE_STROKE_WIDTH_MM)).toBe(true)
    expect(lineTypes.every((lineType) => lineType.ignoreInPrint === false)).toBe(true)
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
