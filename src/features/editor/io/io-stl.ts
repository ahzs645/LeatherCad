import type { DocFile, Point, StitchHole } from '../cad/cad-types'
import { detectOutlines } from '../ops/outline-detection'
import { cleanRing, clipRings, inMaterial, offsetRings, orientNestedRings, regionsFromRings, signedArea, validateRing } from './stl-polygons'
import { createStlMeshBuilder, serializeAsciiStl, validateStlMesh, type StlMesh } from './stl-mesh'

export type StlExportOptions = {
  mode: 'pattern' | 'jig'
  thicknessMm: number
  stitchHoles: 'none' | 'round' | 'original'
  roundHoleDiameterMm: number
  jigBaseThicknessMm: number
  jigWallHeightMm: number
  jigMarginMm: number
  jigClearanceMm: number
  selectedShapeIds?: ReadonlySet<string>
}

export const DEFAULT_STL_EXPORT_OPTIONS: StlExportOptions = {
  mode: 'pattern', thicknessMm: 2, stitchHoles: 'round', roundHoleDiameterMm: 1,
  jigBaseThicknessMm: 2, jigWallHeightMm: 3, jigMarginMm: 5, jigClearanceMm: 0.3,
}

export type StlExportResult = {
  mesh: StlMesh
  warnings: string[]
  triangleCount: number
  outlineCount: number
  stitchHoleCount: number
  volumeMm3: number
  watertight: true
  dimensionsMm: { width: number; height: number; depth: number }
}

function positive(value: number, label: string, maximum = 1_000) {
  if (!Number.isFinite(value) || value <= 0 || value > maximum) throw new Error(`${label} must be greater than 0 and no more than ${maximum} mm.`)
}

function circle(center: Point, radius: number): Point[] {
  const segments = Math.max(24, Math.min(192, Math.ceil(2 * Math.PI * radius / 0.25)))
  return Array.from({ length: segments }, (_, index) => ({
    x: center.x + radius * Math.cos(index * 2 * Math.PI / segments),
    y: center.y + radius * Math.sin(index * 2 * Math.PI / segments),
  }))
}

function holeRing(hole: StitchHole, options: StlExportOptions): Point[] | null {
  if (options.stitchHoles === 'round') return circle(hole.point, options.roundHoleDiameterMm / 2)
  const shape = hole.renderShape ?? (hole.holeType === 'round' ? 'round' : 'slit')
  if (shape === 'round') {
    const diameter = hole.diameterMm ?? hole.widthMm ?? 1.2
    positive(diameter, 'Stitch hole diameter', 100)
    return circle(hole.point, diameter / 2)
  }
  const width = hole.widthMm ?? 1.1, length = hole.heightMm ?? 3.4
  if (width === 0) return null
  positive(width, 'Stitch hole width', 100)
  positive(length, 'Stitch hole length', 100)
  const angle = (hole.angleDeg + (hole.inverted ? -(hole.tiltDeg ?? 0) : hole.tiltDeg ?? 0)) * Math.PI / 180
  const local: Point[] = shape === 'diamond'
    ? [{ x: 0, y: -length / 2 }, { x: width / 2, y: 0 }, { x: 0, y: length / 2 }, { x: -width / 2, y: 0 }]
    : [{ x: -length / 2, y: -width / 2 }, { x: length / 2, y: -width / 2 }, { x: length / 2, y: width / 2 }, { x: -length / 2, y: width / 2 }]
  return local.map((point) => ({ x: hole.point.x + point.x * Math.cos(angle) - point.y * Math.sin(angle), y: hole.point.y + point.x * Math.sin(angle) + point.y * Math.cos(angle) }))
}

/** Builds a flat manufacturing mesh from closed visible cut outlines, in mm. */
export function buildStlExport(doc: DocFile, partial: Partial<StlExportOptions> = {}): StlExportResult {
  const options = { ...DEFAULT_STL_EXPORT_OPTIONS, ...partial }
  if (options.mode !== 'pattern' && options.mode !== 'jig') throw new Error('Choose a supported STL export mode.')
  if (!['none', 'round', 'original'].includes(options.stitchHoles)) throw new Error('Choose a supported stitch hole mode.')
  positive(options.mode === 'pattern' ? options.thicknessMm : options.jigBaseThicknessMm, 'Thickness')
  if (options.stitchHoles === 'round' && options.mode === 'pattern') positive(options.roundHoleDiameterMm, 'Round hole diameter', 100)
  const warnings: string[] = []
  const layers = new Map(doc.layers.map((layer) => [layer.id, layer]))
  const groups = new Map((doc.sketchGroups ?? []).map((group) => [group.id, group]))
  const styles = new Map(doc.lineTypes.map((type) => [type.id, type]))
  const visible = doc.objects.filter((shape) => {
    const style = styles.get(shape.lineTypeId), layer = layers.get(shape.layerId)
    return layer?.visible !== false && !layer?.ignored && style?.visible !== false &&
      (!shape.groupId || groups.get(shape.groupId)?.visible !== false)
  })
  const cutShapes = visible.filter((shape) => (!options.selectedShapeIds || options.selectedShapeIds.has(shape.id)) &&
    (styles.get(shape.lineTypeId)?.role ?? 'cut') === 'cut')
  const geometry = cutShapes.filter((shape) => shape.type !== 'text' && !(shape.type === 'line' && shape.stitchHoleMarker))
  if (cutShapes.some((shape) => shape.type === 'text')) warnings.push('Text is omitted. Convert lettering into closed cut outlines before exporting it as geometry.')
  if (!geometry.length) throw new Error('No visible cut outlines to export. Choose closed cut geometry or change the selection.')
  if (geometry.length > 2_000) throw new Error('Export at most 2,000 cut shapes at a time.')
  const chains = detectOutlines(geometry, doc.lineTypes, 0.001)
  const unclosed = chains.filter((chain) => !chain.isClosed)
  if (unclosed.length) throw new Error(`${unclosed.length} cut path(s) are open. Close their endpoints within 0.001 mm, or select only closed outlines.`)
  const rings = chains.map((chain) => cleanRing(chain.polygon))
  if (rings.flat().some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1_000_000 || Math.abs(point.y) > 1_000_000)) {
    throw new Error('Outline coordinates must be finite and within 1,000,000 mm of the document origin.')
  }
  rings.forEach(validateRing)
  let material = clipRings(orientNestedRings(rings))
  if (!material.length) throw new Error('The selected outlines contain no printable area.')
  let stitchHoleCount = 0
  if (options.mode === 'pattern' && options.stitchHoles !== 'none') {
    const visibleIds = new Set(visible.map((shape) => shape.id))
    const holes = (doc.stitchHoles ?? []).filter((hole) => visibleIds.has(hole.shapeId) && inMaterial(material, hole.point))
    if (holes.length > 1_000) throw new Error('Export at most 1,000 stitch holes at a time.')
    const holeRings = holes.map((hole) => holeRing(hole, options)).filter((ring): ring is Point[] => ring !== null)
    if (holeRings.length !== holes.length) warnings.push(`${holes.length - holeRings.length} zero-width stitch hole(s) were omitted. Use round holes to give them a printable width.`)
    // A hole must remain inside the material: an edge-crossing hole silently
    // becoming a notch is a different manufacturing operation.
    const outside = holeRings.filter((ring) => clipRings([ring], material, true).length > 0)
    if (outside.length) throw new Error(`${outside.length} stitch hole(s) cross an outline or cutout. Reduce their size or move them inward.`)
    material = clipRings(material, holeRings.map((ring) => signedArea(ring) > 0 ? ring : [...ring].reverse()), true)
    stitchHoleCount = holeRings.length
  }
  const builder = createStlMeshBuilder()
  let depth: number
  if (options.mode === 'pattern') {
    depth = options.thicknessMm
    const regions = regionsFromRings(material)
    builder.caps(regions, 0, false)
    builder.caps(regions, depth, true)
    builder.walls(material, 0, depth)
  } else {
    positive(options.jigWallHeightMm, 'Pocket depth')
    positive(options.jigMarginMm, 'Jig margin')
    if (!Number.isFinite(options.jigClearanceMm) || options.jigClearanceMm < 0 || options.jigClearanceMm > 100) throw new Error('Jig clearance must be between 0 and 100 mm.')
    if (options.jigMarginMm <= options.jigClearanceMm + 0.001) throw new Error('Jig margin must be greater than pocket clearance.')
    const points = material.flat()
    const x0 = Math.min(...points.map((point) => point.x)) - options.jigMarginMm
    const y0 = Math.min(...points.map((point) => point.y)) - options.jigMarginMm
    const x1 = Math.max(...points.map((point) => point.x)) + options.jigMarginMm
    const y1 = Math.max(...points.map((point) => point.y)) + options.jigMarginMm
    const plate = [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]]
    const pockets = clipRings(offsetRings(material, options.jigClearanceMm))
    const rim = clipRings(plate, pockets, true)
    depth = options.jigBaseThicknessMm + options.jigWallHeightMm
    builder.caps(regionsFromRings(plate), 0, false)
    builder.walls(plate, 0, depth)
    builder.caps(regionsFromRings(rim), depth, true)
    builder.caps(regionsFromRings(pockets), options.jigBaseThicknessMm, true)
    builder.walls(pockets.map((ring) => [...ring].reverse()), options.jigBaseThicknessMm, depth)
    warnings.push('The jig has a solid pocket floor. Stitch drilling, finger holes, edge rounding and text engraving are not included.')
  }
  const mesh = builder.mesh
  // STL uses a right-handed XY plane. Mirror document Y and flip every face
  // together, then place the complete model at a nonnegative print origin.
  const minX = Math.min(...mesh.vertices.map((point) => point.x))
  const minY = Math.min(...mesh.vertices.map((point) => point.y))
  const maxX = Math.max(...mesh.vertices.map((point) => point.x))
  const maxY = Math.max(...mesh.vertices.map((point) => point.y))
  mesh.vertices = mesh.vertices.map((point) => ({ x: point.x - minX, y: maxY - point.y, z: point.z }))
  mesh.triangles = mesh.triangles.map(([a, b, c]) => [a, c, b])
  const validation = validateStlMesh(mesh)
  return {
    mesh, warnings, triangleCount: mesh.triangles.length, outlineCount: chains.length,
    stitchHoleCount, ...validation,
    dimensionsMm: { width: maxX - minX, height: maxY - minY, depth },
  }
}

export function buildAsciiStl(doc: DocFile, options: Partial<StlExportOptions> = {}) {
  const result = buildStlExport(doc, options)
  return { ...result, content: serializeAsciiStl(result.mesh, `${doc.documentName ?? 'LeatherCad'}_mm`) }
}
