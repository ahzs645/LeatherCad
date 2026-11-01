import type { Point } from '../../cad/cad-types'
import { serializeAsciiStl, validateStlMesh, type StlMesh } from '../stl-mesh'
import { clipRings, inMaterial } from '../stl-polygons'
import { manufacturingCircle } from './manufacturing-curves'
import { buildLevelMesh } from './manufacturing-level-mesh'
import { partitionManufacturingFaces } from './manufacturing-regions'
import { PRINTER_FIT_CALIBRATION_CHECKLIST, PRINTER_FIT_CALIBRATION_MANIFEST, PRINTER_FIT_CLEARANCES, PRINTER_FIT_HOLE_DIAMETERS, type PrinterFitCalibrationManifest } from './manufacturing-calibration-manifest'
export type { PrinterFitCalibrationManifest } from './manufacturing-calibration-manifest'
export type PrinterFitCalibrationDownload = { content: string; checklist: string; manifest: PrinterFitCalibrationManifest }

const rectangle = (x: number, y: number, width: number, height: number): Point[] => [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]
const DIGITS: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' }
function label(text: string, centerX: number, y: number): Point[][] {
  const width = 1.8, height = 3.6, stroke = 0.4, gap = 0.4
  const length = [...text].reduce((n, c) => n + (c === '.' ? stroke : width) + gap, -gap)
  let x = centerX - length / 2
  const rings: Point[][] = []
  for (const char of text) {
    if (char === '.') { rings.push(rectangle(x, y + height - stroke, stroke, stroke)); x += stroke + gap; continue }
    const segments = {
      a: rectangle(x, y, width, stroke), b: rectangle(x + width - stroke, y, stroke, height / 2),
      c: rectangle(x + width - stroke, y + height / 2, stroke, height / 2), d: rectangle(x, y + height - stroke, width, stroke),
      e: rectangle(x, y + height / 2, stroke, height / 2), f: rectangle(x, y, stroke, height / 2),
      g: rectangle(x, y + (height - stroke) / 2, width, stroke),
    }
    for (const segment of DIGITS[char] ?? '') rings.push(segments[segment as keyof typeof segments])
    x += width + gap
  }
  return clipRings(rings)
}

/** Authored calibration geometry. This does not certify a printer or material. */
export function buildPrinterFitCalibration(): PrinterFitCalibrationDownload & { mesh: StlMesh; volumeMm3: number } {
  const plate = [[{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 60 }, { x: 3, y: 60 }, { x: 0, y: 57 }]]
  const pockets = PRINTER_FIT_CLEARANCES.map((clearance, i) => rectangle(10 + i * 10 - 4 - clearance, 25 - clearance, 8 + 2 * clearance, 10 + 2 * clearance))
  const bar = rectangle(5, 54, 20, 3)
  const faces = partitionManufacturingFaces(plate, [...pockets.map(ring => [ring]), [bar]], 5)
  for (const face of faces) {
    if (inMaterial([bar], face.at)) face.heightMm = 6
    else if (pockets.some(pocket => inMaterial([pocket], face.at))) face.heightMm = 2
  }
  const plug = [rectangle(80, 0, 8, 10)], pin = [manufacturingCircle({ x: 84, y: 22 }, 1.5, 0.0025)]
  faces.push(...partitionManufacturingFaces(plug, [], 5), ...partitionManufacturingFaces(pin, [], 8))
  const holes = PRINTER_FIT_HOLE_DIAMETERS.map((diameter, i) => manufacturingCircle({ x: 10 + i * 10, y: 9 }, diameter / 2, 0.0025))
  const labels = clipRings([
    ...PRINTER_FIT_HOLE_DIAMETERS.flatMap((diameter, i) => label(diameter.toFixed(1), 10 + i * 10, 15)),
    ...PRINTER_FIT_CLEARANCES.flatMap((clearance, i) => label(clearance.toFixed(2), 10 + i * 10, 43)),
    ...label('20', 15, 49), ...label('8', 84, 3),
  ])
  const mesh = buildLevelMesh(faces, holes, labels, 'top', 0.35)
  mesh.vertices = mesh.vertices.map(p => ({ x: p.x, y: 60 - p.y, z: p.z }))
  mesh.triangles = mesh.triangles.map(([a, b, c]) => [a, c, b])
  const { volumeMm3 } = validateStlMesh(mesh)
  return { mesh, volumeMm3, content: serializeAsciiStl(mesh, 'LeatherCad_printer_fit_gauge_mm'), checklist: PRINTER_FIT_CALIBRATION_CHECKLIST, manifest: structuredClone(PRINTER_FIT_CALIBRATION_MANIFEST) }
}
