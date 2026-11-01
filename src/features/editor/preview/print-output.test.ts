import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LineShape, LineType, Shape, StitchHole } from '../cad/cad-types'
import { buildPrintPlan, resolvePrintCalibrationDpi } from './print-preview'
import { buildPrintableHtml, openPrintTilesWindow } from './print-output'

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

const shapes: LineShape[] = [
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
      shapes: shapes.map(shape => ({ ...shape, opacity: 0.4 })),
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
    expect(html).toContain('opacity="0.4"')
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


const outputOptions = () => ({ shapes: [shapes[0]], stitchHoles: [] as StitchHole[], foldLines: [], lineTypesById: { cut: cutLineType },
  printPlan: buildPrintPlan([shapes[0]], { paper: 'a4', marginMm: 10, overlapMm: 10, tileX: 2, tileY: 1, scalePercent: 100 })!,
  printInColor: true, printStitchAsDots: false, lineThicknessScalePercent: 100, showIgnoredLineTypes: false, printRulerInside: false, calibrationXPercent: 100, calibrationYPercent: 100 })
afterEach(() => vi.restoreAllMocks())

describe('calibrated printable output and safe preparation', () => {
  it('honors output calibration when the supplied plan used defaults, without a second geometry scale', () => {
    const options = outputOptions()
    const html = buildPrintableHtml({ ...options, calibrationXPercent: 110, calibrationYPercent: 90 })
    const document = new DOMParser().parseFromString(html, 'text/html')
    const inner = [...document.querySelectorAll('.print-svg > svg')].map(svg => (svg.getAttribute('viewBox') ?? '').split(' ').map(Number))
    expect(inner[0][2]).toBeCloseTo(190 / 1.1, 10)
    expect(inner[0][3]).toBeCloseTo(277 / 0.9, 10)
    expect((inner[0][0] + inner[0][2] - inner[1][0]) * 1.1).toBeCloseTo(10, 10)
    expect(document.querySelector('.print-svg > svg > g')?.getAttribute('transform')).toBeNull()
  })

  it('escapes user text/font attributes and rejects paint URLs or injected color markup', () => {
    const options = outputOptions()
    const text: Shape = { id: 'text', type: 'text', layerId: 'main', lineTypeId: 'cut', start: { x: 1, y: 2 }, end: { x: 30, y: 2 }, fontSizeMm: 2.5, fontFamily: 'Arial" onload="bad()', text: '<script>bad()</script>', transform: 'none', radiusMm: 20, sweepDeg: 90 }
    const html = buildPrintableHtml({ ...options, shapes: [text], lineTypesById: { cut: { ...cutLineType, color: 'url(https://unrequested.test/paint)' } } })
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.querySelector('script')).toBeNull()
    const label = document.querySelector('.print-svg > svg > g text')!
    expect(label.getAttribute('onload')).toBeNull()
    expect(label.getAttribute('fill')).toBe('#111827')
    expect(label.getAttribute('font-size')).toBe('2.5')
    expect(label.textContent).toBe('<script>bad()</script>')
    expect(html).not.toContain('https://unrequested.test')
  })

  it('rejects excessive repeated drawings and curved glyph expansions before opening a popup', () => {
    const options = outputOptions(), open = vi.spyOn(window, 'open')
    options.printPlan = buildPrintPlan(options.shapes, { paper: 'a4', marginMm: 10, overlapMm: 10, tileX: 25, tileY: 25, scalePercent: 100 })!
    options.shapes = Array.from({ length: 200000 }, () => shapes[0])
    expect(() => openPrintTilesWindow(options)).toThrow('processing budget')
    expect(open).not.toHaveBeenCalled()
    const text: Shape = { id: 'text', type: 'text', layerId: 'main', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, text: 'A'.repeat(100000), fontFamily: 'sans-serif', fontSizeMm: 4, transform: 'arch', radiusMm: 10, sweepDeg: 180 }
    expect(() => buildPrintableHtml({ ...outputOptions(), shapes: [text] })).toThrow('processing budget')
  })

  it('bounds ruler iteration even when large source coordinates cannot advance by 10mm', () => {
    const options = outputOptions(), distant: Shape = { ...shapes[0], start: { x: 1e20, y: 1e20 }, end: { x: 1e20 + 100, y: 1e20 } }
    const plan = buildPrintPlan([distant], { paper: 'a4', marginMm: 10, overlapMm: 10, tileX: 1, tileY: 1, scalePercent: 100 })!
    expect(buildPrintableHtml({ ...options, shapes: [distant], printPlan: plan, printRulerInside: true }).length).toBeLessThan(30000)
  })

  it('opens a writable blank window, severs its opener, and fills the prepared drawing', () => {
    const popup = { opener: {}, document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    expect(openPrintTilesWindow(outputOptions())).toBe(true)
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(popup.opener).toBeNull()
    expect(popup.document.write).toHaveBeenCalledWith(expect.stringContaining('class="print-page"'))
    expect(popup.close).not.toHaveBeenCalled()
  })
})
