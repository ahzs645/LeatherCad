import { describe, expect, it } from 'vitest'
import type { LineType, Shape, StitchHole } from '../cad/cad-types'
import { buildPrintPlan, resolvePrintCalibrationDpi } from './print-preview'
import { buildPrintableHtml } from './print-output'

const cutLineType: LineType = {
  id: 'cut',
  name: 'Cut',
  role: 'cut',
  style: 'solid',
  color: '#000000',
  visible: true,
  strokeWidthMm: 1,
}

const guideLineType: LineType = {
  id: 'guide',
  name: 'Guide',
  role: 'guide',
  style: 'dashed',
  color: '#ff0000',
  visible: true,
  strokeWidthMm: 0.5,
  ignoreInPrint: true,
}

const shapes: Shape[] = [
  { id: 'cut-shape', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 20, y: 0 } },
  { id: 'guide-shape', type: 'line', layerId: 'layer', lineTypeId: 'guide', start: { x: 0, y: 5 }, end: { x: 20, y: 5 } },
]

const stitchHoles: StitchHole[] = [
  {
    id: 'hole-1',
    shapeId: 'cut-shape',
    point: { x: 10, y: 0 },
    angleDeg: 0,
    holeType: 'slit',
    sequence: 0,
    widthMm: 0.8,
    heightMm: 3,
    renderShape: 'slit',
  },
]

describe('buildPrintableHtml', () => {
  it('reports active DPI from print calibration', () => {
    expect(resolvePrintCalibrationDpi(100)).toBe(96)
    expect(resolvePrintCalibrationDpi(125)).toBe(120)
  })

  it('applies line thickness scaling and hides ignored line types by default', () => {
    const printPlan = buildPrintPlan(shapes, { paper: 'letter', marginMm: 8, overlapMm: 4, tileX: 1, tileY: 1, scalePercent: 100 })
    const html = buildPrintableHtml({
      shapes,
      stitchHoles: [],
      foldLines: [],
      lineTypesById: { cut: cutLineType, guide: guideLineType },
      printPlan: printPlan!,
      printInColor: true,
      printStitchAsDots: false,
      lineThicknessScalePercent: 200,
      showIgnoredLineTypes: false,
      printRulerInside: false,
      calibrationXPercent: 100,
      calibrationYPercent: 100,
    })

    expect(html).toContain('stroke-width="2"')
    expect(html).toContain('active DPI 96 x 96')
    expect(html).not.toContain('data-non-print')
    expect(html).not.toContain('y1="5"')
  })

  it('can show ignored line types as muted planning lines', () => {
    const printPlan = buildPrintPlan(shapes, { paper: 'letter', marginMm: 8, overlapMm: 4, tileX: 1, tileY: 1, scalePercent: 100 })
    const html = buildPrintableHtml({
      shapes,
      stitchHoles: [],
      foldLines: [],
      lineTypesById: { cut: cutLineType, guide: guideLineType },
      printPlan: printPlan!,
      printInColor: true,
      printStitchAsDots: false,
      lineThicknessScalePercent: 100,
      showIgnoredLineTypes: true,
      printRulerInside: false,
      calibrationXPercent: 100,
      calibrationYPercent: 100,
    })

    expect(html).toContain('data-non-print="true"')
    expect(html).toContain('opacity="0.35"')
  })

  it('prints stitch-hole primitives instead of only dashed stitch paths', () => {
    const printPlan = buildPrintPlan(shapes, { paper: 'letter', marginMm: 8, overlapMm: 4, tileX: 1, tileY: 1, scalePercent: 100 })
    const html = buildPrintableHtml({
      shapes,
      stitchHoles,
      foldLines: [],
      lineTypesById: { cut: cutLineType, guide: guideLineType },
      printPlan: printPlan!,
      printInColor: true,
      printStitchAsDots: true,
      lineThicknessScalePercent: 100,
      showIgnoredLineTypes: false,
      printRulerInside: false,
      calibrationXPercent: 100,
      calibrationYPercent: 100,
    })

    expect(html).toContain('data-type="stitch-hole"')
    expect(html).toContain('<circle')
  })
})
