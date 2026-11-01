import type { DocFile, Point, StitchHole, TextShape } from '../cad/cad-types'
import { clipRings, inMaterial, intersectRings, offsetRings, orientNestedRings, signedArea } from './stl-polygons'
import { serializeAsciiStl, validateStlMesh, type StlMesh } from './stl-mesh'
import { DEFAULT_MANUFACTURING_SETTINGS, parseManufacturingSettings, type ManufacturingSettings } from './manufacturing/manufacturing-settings'
import { manufacturingCircle } from './manufacturing/manufacturing-curves'
import { manufacturingOutlines } from './manufacturing/manufacturing-outlines'
import { partitionManufacturingFaces, ringArea, type ManufacturingFace } from './manufacturing/manufacturing-regions'
import { buildLevelMesh } from './manufacturing/manufacturing-level-mesh'
import { buildFinishedPattern } from './manufacturing/manufacturing-finishing'
import { manufacturingTextRings } from './manufacturing/manufacturing-text'
import { manufacturingFontBuffer } from './manufacturing/manufacturing-font-data'
import { loadFontFromBuffer } from '../ops/opentype-ops'
import { buildGroupAccess } from '../ops/shape-access'

export type StlExportOptions = ManufacturingSettings & { selectedShapeIds?: ReadonlySet<string>; engravingFontKey?: string }
export const DEFAULT_STL_EXPORT_OPTIONS = DEFAULT_MANUFACTURING_SETTINGS
export type StlExportResult = {
  mesh: StlMesh; warnings: string[]; triangleCount: number; outlineCount: number; stitchHoleCount: number
  volumeMm3: number; watertight: true; dimensionsMm: { width: number; height: number; depth: number }
  faces: ManufacturingFace[]; toleranceMm: number; settings: ManufacturingSettings
}
export type StlExportPlan = {
  settings: ManufacturingSettings; warnings: string[]; faces: ManufacturingFace[]
  material: Point[][]; printable: Point[][]; footprint: Point[][]; holeRings: Point[][]; engraving: Point[][]
  outlineCount: number; stitchHoleCount: number
}

function positive(value: number, label: string, maximum = 100) {
  if (!Number.isFinite(value) || value <= 0 || value > maximum) throw new Error(`${label} must be greater than 0 and no more than ${maximum} mm.`)
}

function holeRing(hole: StitchHole, options: ManufacturingSettings, forceRound?: number, geometryToleranceMm = options.toleranceMm): Point[] | null {
  if (forceRound !== undefined || options.stitchHoles === 'round') return manufacturingCircle(hole.point, (forceRound ?? options.roundHoleDiameterMm) / 2, geometryToleranceMm / 2)
  const shape = hole.renderShape ?? (hole.holeType === 'round' ? 'round' : 'slit')
  if (shape === 'round') {
    const diameter = hole.diameterMm ?? hole.widthMm ?? 1.2
    positive(diameter, 'Stitch hole diameter')
    return manufacturingCircle(hole.point, diameter / 2, geometryToleranceMm / 2)
  }
  const kind = shape === 'diamond' ? 'diamond' : shape === 'flat' ? 'flat' : 'french'
  const width = options.holeSizeOverrides ? options[`${kind}WidthMm`] : hole.widthMm ?? 1.1
  const length = options.holeSizeOverrides ? options[`${kind}LengthMm`] : hole.heightMm ?? 3.4
  if (width === 0) return null
  positive(width, 'Stitch hole width'); positive(length, 'Stitch hole length')
  const angle = (hole.angleDeg + (hole.inverted ? -(hole.tiltDeg ?? 0) : hole.tiltDeg ?? 0)) * Math.PI / 180
  const local: Point[] = shape === 'diamond'
    ? [{ x: 0, y: -length / 2 }, { x: width / 2, y: 0 }, { x: 0, y: length / 2 }, { x: -width / 2, y: 0 }]
    : [{ x: -length / 2, y: -width / 2 }, { x: length / 2, y: -width / 2 }, { x: length / 2, y: width / 2 }, { x: -length / 2, y: width / 2 }]
  return local.map((point) => ({ x: hole.point.x + point.x * Math.cos(angle) - point.y * Math.sin(angle), y: hole.point.y + point.x * Math.sin(angle) + point.y * Math.cos(angle) }))
}

function rectangle(x0: number, y0: number, x1: number, y1: number): Point[][] {
  return [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]]
}

/** All dimensions are mm. Flattening reserves half the tolerance for Boolean rounding/offsets. */
export function prepareStlExport(doc: DocFile, partial: Partial<StlExportOptions> = {}): StlExportPlan {
  const settings = parseManufacturingSettings({ ...DEFAULT_MANUFACTURING_SETTINGS, ...doc.manufacturing, ...partial })
  const geometryToleranceMm = settings.edgeFinish !== 'none' && (settings.mode === 'jig' || settings.regions.length > 0 || settings.textEngrave !== 'none') ? settings.toleranceMm / 2 : settings.toleranceMm
  const warnings: string[] = []
  const layers = new Map(doc.layers.map((layer) => [layer.id, layer]))
  const groups = buildGroupAccess(doc.sketchGroups ?? [])
  const styles = new Map(doc.lineTypes.map((type) => [type.id, type]))
  const visible = doc.objects.filter((shape) => shape.opacity !== 0 && layers.get(shape.layerId)?.visible !== false && !layers.get(shape.layerId)?.ignored && styles.get(shape.lineTypeId)?.visible !== false && (!shape.groupId || groups[shape.groupId]?.visible !== false))
  const scoped = visible.filter((shape) => !partial.selectedShapeIds || partial.selectedShapeIds.has(shape.id))
  const geometry = scoped.filter((shape) => shape.type !== 'text' && !(shape.type === 'line' && shape.stitchHoleMarker) && settings.targetRoles.includes(styles.get(shape.lineTypeId)?.role ?? 'cut'))
  if (!geometry.length) throw new Error('No visible cut outlines to export. Choose closed geometry in the target line roles or change the selection.')
  if (geometry.length > 2000) throw new Error('Export at most 2,000 shapes at a time.')
  const rings = manufacturingOutlines(geometry, geometryToleranceMm)
  if (rings.flat().some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 1_000_000 || Math.abs(p.y) > 1_000_000)) throw new Error('Outline coordinates must be finite and within 1,000,000 mm of the document origin.')
  const material = clipRings(orientNestedRings(rings))
  if (!material.length) throw new Error('The selected outlines contain no printable area.')
  const sourceBoundaries = rings.map((ring) => [signedArea(ring) > 0 ? ring : [...ring].reverse()])
  let faces: ManufacturingFace[]
  let footprint = material
  if (settings.mode === 'pattern') faces = partitionManufacturingFaces(material, sourceBoundaries, settings.thicknessMm)
  else {
    const points = material.flat(), xs = points.map((p) => p.x), ys = points.map((p) => p.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    footprint = settings.jigOuterMode === 'offset' ? clipRings(offsetRings(material, settings.jigMarginMm, geometryToleranceMm / 2))
      : settings.jigOuterMode === 'dimensions' ? rectangle(cx - settings.jigWidthMm / 2, cy - settings.jigHeightMm / 2, cx + settings.jigWidthMm / 2, cy + settings.jigHeightMm / 2)
        : rectangle(x0 - settings.jigMarginMm, y0 - settings.jigMarginMm, x1 + settings.jigMarginMm, y1 + settings.jigMarginMm)
    const pockets = clipRings(offsetRings(material, settings.jigClearanceMm, geometryToleranceMm / 2))
    if (!pockets.length) throw new Error('Negative jig clearance removes every pocket. Reduce the interference fit.')
    if (pockets.filter((ring) => signedArea(ring) > 0).length < material.filter((ring) => signedArea(ring) > 0).length) warnings.push('Pocket offsets merged nearby pockets or removed a narrow pocket. Inspect the preview before printing.')
    if (clipRings(pockets, footprint, true).length || ringArea(clipRings(footprint, pockets, true)) < 0.0001) throw new Error('Jig dimensions or margin must leave material outside every pocket. Increase the outside size or reduce clearance.')
    const total = settings.jigBaseThicknessMm + settings.jigWallHeightMm
    faces = partitionManufacturingFaces(footprint, [pockets, ...sourceBoundaries], total)
    for (const face of faces) if (inMaterial(pockets, face.at)) face.heightMm = settings.jigBaseThicknessMm
    if (settings.jigClearanceMm < 0) warnings.push('Negative pocket clearance creates an interference fit. Calibrate material and printer shrinkage before use.')
  }
  for (const override of settings.regions) {
    const face = faces.find((candidate) => inMaterial(candidate.rings, override.at))
    if (!face) { warnings.push(`Manufacturing region ${override.id} no longer matches the drawing. Reassign or remove it.`); continue }
    // Keep a surviving assignment's stable identity/anchor after contour edits.
    face.id = override.id; face.at = { ...override.at }
    face.heightMm = override.heightMm; face.through = override.through || override.heightMm === 0
  }
  const printable = clipRings(faces.filter((face) => !face.through && face.heightMm > 0).flatMap((face) => face.rings))
  const visibleIds = new Set(visible.map((shape) => shape.id))
  const holes = (doc.stitchHoles ?? []).filter((hole) => visibleIds.has(hole.shapeId) && inMaterial(material, hole.point))
  if (holes.length > 1000) throw new Error('Export at most 1,000 stitch holes at a time.')
  const useHoles = settings.mode === 'pattern' ? settings.stitchHoles !== 'none' : settings.jigStitchThrough
  let holeVertices = 0
  const candidates = useHoles ? holes.map((hole) => {
    const ring = holeRing(hole, settings, settings.mode === 'jig' ? settings.jigStitchDiameterMm : undefined, geometryToleranceMm)
    holeVertices += ring?.length ?? 0
    if (holeVertices > 50_000) throw new Error('Stitch holes exceed 50,000 sampled vertices. Export fewer holes or increase curve tolerance.')
    return ring
  }).filter((ring): ring is Point[] => ring !== null) : []
  if (useHoles && candidates.length !== holes.length) warnings.push(`${holes.length - candidates.length} zero-width stitch hole(s) were omitted. Use round holes to give them a printable width.`)
  const holeRings = candidates.filter((ring) => intersectRings([ring], printable).length > 0)
  if (holeRings.length < candidates.length) warnings.push(`${candidates.length - holeRings.length} stitch hole(s) inside through regions were omitted because their material was already removed.`)
  if (holeRings.some((ring) => clipRings([ring], printable, true).length)) throw new Error('Stitch hole(s) cross an outline or cutout. Reduce their size or move them inward.')
  const stitchHoleCount = holeRings.length
  if (settings.mode === 'jig') for (const hole of settings.fingerHoles) {
    const ring = manufacturingCircle(hole, hole.diameterMm / 2, geometryToleranceMm / 2)
    holeVertices += ring.length
    if (holeVertices > 50_000) throw new Error('Jig holes exceed 50,000 sampled vertices. Export fewer holes or increase curve tolerance.')
    if (clipRings([ring], footprint, true).length) throw new Error('A finger hole crosses the outside of the jig. Move it inside or reduce its diameter.')
    if (!intersectRings([ring], printable).length) { warnings.push(`Finger hole ${hole.id} lies in a through region; its material is already removed.`); continue }
    if (clipRings([ring], printable, true).length) warnings.push(`Finger hole ${hole.id} intersects an existing through cut. Inspect its open boundary in the preview.`)
    holeRings.push(ring)
  }
  const texts = scoped.filter((shape): shape is TextShape => shape.type === 'text')
  let fontKey = partial.engravingFontKey
  if (!fontKey && settings.engravingFont && settings.textEngrave !== 'none') {
    fontKey = 'manufacturing-document-font'
    loadFontFromBuffer(manufacturingFontBuffer(settings.engravingFont), fontKey)
  }
  const rawEngraving = settings.textEngrave === 'none' ? [] : manufacturingTextRings(texts, fontKey, geometryToleranceMm)
  const engravingMaterial = clipRings(printable, holeRings, true)
  const engraving = intersectRings(rawEngraving, engravingMaterial)
  if (rawEngraving.length && !engraving.length) warnings.push('Text engraving lies outside the remaining material and was omitted.')
  else if (rawEngraving.length && clipRings(rawEngraving, engravingMaterial, true).length) warnings.push('Text engraving crosses a cut boundary. Only portions over the remaining material are engraved.')
  if (texts.length && settings.textEngrave === 'none') warnings.push('Text is omitted. Enable engraving and load its font, or convert lettering into closed outlines.')
  return { settings, warnings, faces, material, printable, footprint, holeRings, engraving, outlineCount: rings.length, stitchHoleCount }
}

export function requiresSolidFinishing(plan: StlExportPlan) {
  return plan.settings.edgeFinish !== 'none' && (plan.settings.mode === 'jig' || plan.engraving.length > 0 || new Set(plan.faces.filter(face => !face.through && face.heightMm > 0).map(face => face.heightMm)).size > 1)
}

function simpleStlMesh(plan: StlExportPlan) {
  const { settings, faces, printable, holeRings, engraving } = plan
  if (requiresSolidFinishing(plan)) throw new Error('Combined finishing requires the asynchronous solid modeller. Use buildStlExportAsync.')
  if (settings.edgeFinish !== 'none') {
    const height = faces.find(face => !face.through && face.heightMm > 0)?.heightMm ?? 0
    return buildFinishedPattern(clipRings(printable, holeRings, true), height, settings.edgeSizeMm, settings.edgeFinish, settings.filletSteps, settings.toleranceMm)
  }
  return buildLevelMesh(faces, holeRings, engraving, settings.textEngrave, settings.textDepthMm)
}

export function completeStlExport(plan: StlExportPlan, mesh: StlMesh): StlExportResult {
  const { settings, warnings, faces, outlineCount, stitchHoleCount } = plan
  if (!mesh.vertices.length) throw new Error('Manufacturing operations removed all printable material.')
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, depth = 0
  for (const p of mesh.vertices) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); depth = Math.max(depth, p.z) }
  mesh.vertices = mesh.vertices.map((p) => ({ x: p.x - minX, y: maxY - p.y, z: p.z }))
  mesh.triangles = mesh.triangles.map(([a, b, c]) => [a, c, b])
  const validation = validateStlMesh(mesh)
  return { mesh, warnings, triangleCount: mesh.triangles.length, outlineCount, stitchHoleCount, ...validation,
    dimensionsMm: { width: maxX - minX, height: maxY - minY, depth }, faces, toleranceMm: settings.toleranceMm, settings }
}

export function buildStlExport(doc: DocFile, options: Partial<StlExportOptions> = {}): StlExportResult {
  const plan = prepareStlExport(doc, options)
  return completeStlExport(plan, simpleStlMesh(plan))
}

export async function buildStlExportAsync(doc: DocFile, options: Partial<StlExportOptions> = {}): Promise<StlExportResult> {
  const plan = prepareStlExport(doc, options)
  if (!requiresSolidFinishing(plan)) return completeStlExport(plan, simpleStlMesh(plan))
  const { buildCombinedFinishedMesh } = await import('./manufacturing/manufacturing-solid-finishing').catch(() => {
    throw new Error('The solid finishing engine could not load. Save the drawing and reload to try again.')
  })
  return completeStlExport(plan, await buildCombinedFinishedMesh(plan))
}

export function buildAsciiStl(doc: DocFile, options: Partial<StlExportOptions> = {}) {
  const result = buildStlExport(doc, options)
  return { ...result, content: serializeAsciiStl(result.mesh, `${doc.documentName ?? 'LeatherCad'}_mm`) }
}

export async function buildAsciiStlAsync(doc: DocFile, options: Partial<StlExportOptions> = {}) {
  const result = await buildStlExportAsync(doc, options)
  return { ...result, content: serializeAsciiStl(result.mesh, `${doc.documentName ?? 'LeatherCad'}_mm`) }
}
