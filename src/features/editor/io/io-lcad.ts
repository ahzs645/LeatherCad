import { uid } from '../cad/cad-geometry'
import type { Backdrop, DimensionLine, DocFile, Layer, LineType, LineTypeRole, Shape, SketchGroup, StitchHole } from '../cad/cad-types'
import { parseImportedJsonDocument } from '../editor-json-import'
import { numberField, pointValue, primitiveShapes, recordValue, type LcadRecord, type ShapeBase } from './lcad/lcad-geometry'
import { importLcadStitchParameters } from './lcad/lcad-stitches'
import { parseCommunityProvenance } from '../ops/community-provenance'
import { validateGroupHierarchy } from '../ops/shape-access'
import { resolveLineTypeStrokeWidthMm } from '../cad/line-types'
import { assertImportGeometryBudget, assertImportLayerBudget, assertImportTextBudget, assertImportTreeBudget } from './import-budget'

export type LcadImportResult = {
  doc: DocFile
  warnings: string[]
  summary: { shapeCount: number; stitchHoleCount: number; layerCount: number }
}

const stringValue = (value: unknown, fallback: string) => typeof value === 'string' && value.length > 0 ? value : fallback
const idValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const styleValue = (value: unknown): LineType['style'] => value === 'dashed' || value === 'dotted' || value === 'dash-dot-dot' ? value : value === 'dash-dot' || value === 'center' ? 'dash-dot-dot' : 'solid'
const widthValue = (record: LcadRecord): number | undefined => {
  if (record.strokeWidth === undefined) return undefined
  const width = numberField(record, 'strokeWidth')
  if (width < 0 || width > 20) throw new Error('Unsupported .lcad stroke width: expected 0–20 mm')
  return width
}

export function isLcadDocument(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const candidate = value as LcadRecord
  return candidate.version === 2 && Array.isArray(candidate.shapes) && !candidate.meta
}

/** Geometry coordinates are always mm in the reference; unit_for_view is display only. */
export function importLcadDocument(raw: string): LcadImportResult {
  assertImportTextBudget(raw)
  const input = recordValue(JSON.parse(raw.replace(/^\uFEFF/, '')), 'document')
  assertImportTreeBudget(input)
  if (input.sealed !== undefined) throw new Error('Sealed .lcad containers are not supported; the current document was not changed')
  if (input.version !== 2 || !Array.isArray(input.shapes)) throw new Error('Unsupported .lcad document: expected version 2 with a shapes array')
  if (input.shapes.length > 100_000) throw new Error('.lcad document exceeds the supported shape limit')
  assertImportLayerBudget(Array.isArray(input.layers) ? input.layers.length : 0)
  const extension = input.leathercad === undefined ? undefined : recordValue(input.leathercad, 'LeatherCad extension')
  if (extension && extension.version !== 1) throw new Error('Unsupported LeatherCad .lcad extension version; source attribution cannot be preserved safely')
  const communityProvenance = parseCommunityProvenance(extension?.communityProvenance)
  const warnings = new Set<string>()
  const layers: Layer[] = (Array.isArray(input.layers) ? input.layers : []).map((value, index) => {
    const layer = recordValue(value, 'layer')
    return { id: stringValue(layer.id, `layer-${index}`), name: stringValue(layer.name, `Layer ${index + 1}`), visible: layer.visible !== false, locked: layer.locked === true, independent: layer.independent === true, stackLevel: index }
  })
  if (layers.length === 0) layers.push({ id: uid(), name: 'Layer 1', visible: true, locked: false })
  if (new Set(layers.map(layer => layer.id)).size !== layers.length) throw new Error('Duplicate .lcad layer IDs')
  const layerIds = new Set(layers.map(layer => layer.id))
  const activeLayerId = layerIds.has(String(input.activeLayerId)) ? String(input.activeLayerId) : layers[0].id
  const lineTypes: LineType[] = []
  const styles = new Map<string, string>()
  const paletteRecords = new Map<string, LcadRecord>()
  for (const value of Array.isArray(input.palettes) ? input.palettes : []) {
    const palette = recordValue(value, 'palette')
    paletteRecords.set(idValue(palette.id), palette)
  }
  const styleFor = (source: LcadRecord): string => {
    const palette = paletteRecords.get(idValue(source.paletteId))
    const role: LineTypeRole = source.type === 'stitch_hole' || source.type === 'stitch' ? 'stitch' : source.type === 'centerline' ? 'guide' : source.type === 'dimension' || source.type === 'distance' ? 'mark' : 'cut'
    const color = stringValue(source.strokeColor, stringValue(palette?.colorLight, '#1a1a1a'))
    const style = styleValue(source.strokeDash ?? palette?.strokeDash)
    const visible = palette?.visible !== false
    const width = palette ? widthValue(palette) : undefined
    const key = JSON.stringify([source.paletteId ?? '', color, style, role, visible, width])
    let id = styles.get(key)
    if (!id) {
      id = uid()
      styles.set(key, id)
      lineTypes.push({ id, name: stringValue(palette?.name, `Imported ${idValue(source.paletteId) || role}`), role, color, style, visible, ...(width === undefined ? {} : { strokeWidthMm: width }) })
    }
    return id
  }
  const objects: Shape[] = [], stitchHoles: StitchHole[] = [], backdrops: Backdrop[] = [], dimensionLines: DimensionLine[] = []
  const appendShapes = (shapes: Shape[]) => {
    assertImportGeometryBudget(objects.length + shapes.length + stitchHoles.length + dimensionLines.length)
    objects.push(...shapes)
  }
  const sketchGroups: SketchGroup[] = []
  const groupIds = new Set<string>()
  for (const value of Array.isArray(input.groups) ? input.groups : []) {
    const group = recordValue(value, 'group'), id = stringValue(group.id, uid())
    if (groupIds.has(id)) throw new Error('Duplicate .lcad group IDs')
    groupIds.add(id)
    const member = input.shapes.find(value => value && typeof value === 'object' && (value as LcadRecord).groupId === id) as LcadRecord | undefined
    const layerId = member && layerIds.has(idValue(member.layerId)) ? idValue(member.layerId) : activeLayerId
    sketchGroups.push({ id, layerId, name: stringValue(group.name, `Group ${sketchGroups.length + 1}`), visible: group.visible !== false, locked: group.locked === true, parentId: idValue(group.parentId) || undefined })
  }
  validateGroupHierarchy(sketchGroups)
  const ids = new Set<string>()
  const convert = (value: unknown, inherited?: LcadRecord, depth = 0) => {
    if (depth > 16) throw new Error('.lcad path nesting exceeds the supported limit')
    const original = recordValue(value, 'shape'), source = { ...inherited, ...original }
    const id = stringValue(source.id, uid())
    if (ids.has(id)) throw new Error(`Duplicate .lcad shape ID: ${id}`)
    ids.add(id)
    const layerId = layerIds.has(idValue(source.layerId)) ? idValue(source.layerId) : activeLayerId
    if (source.layerId && !layerIds.has(idValue(source.layerId))) warnings.add('Shapes on missing layers were assigned to the active layer')
    const lineTypeId = styleFor(source)
    const sourceGroup = typeof source.groupId === 'string' ? sketchGroups.find(group => group.id === source.groupId && group.layerId === layerId) : undefined
    if (source.groupId && !sourceGroup) warnings.add('Shapes referencing a missing group or a group on another layer are imported without that group; editor sketch groups are layer-scoped')
    const palette = paletteRecords.get(idValue(source.paletteId))
    const paletteWidth = palette ? widthValue(palette) : undefined
    const sourceWidth = widthValue(source)
    // Palette controls enforce a minimum width; keep hairline/zero geometry as
    // an explicit shape override rather than silently widening the drawing.
    const strokeWidthOverride = sourceWidth ?? (paletteWidth !== undefined && resolveLineTypeStrokeWidthMm({ strokeWidthMm: paletteWidth }) !== paletteWidth ? paletteWidth : undefined)
    const opacity = source.alpha === undefined && palette?.alpha === undefined ? undefined : numberField(source, 'alpha', palette?.alpha as number | undefined)
    if (opacity !== undefined && (opacity < 0 || opacity > 1)) throw new Error('Invalid .lcad alpha: expected 0–1')
    if (source.locked !== undefined && typeof source.locked !== 'boolean') throw new Error('Invalid .lcad shape lock')
    const base: ShapeBase = { id, layerId, lineTypeId, groupId: sourceGroup?.id, arrowStart: source.arrowStart === true || undefined, arrowEnd: source.arrowEnd === true || undefined, strokeWidthOverride, locked: source.locked, opacity }
    if (source.type === 'path') {
      let hasGeometry = false
      if (Array.isArray(source.contours) && source.contours.length > 0) {
        for (const contour of source.contours) {
          if (!Array.isArray(contour)) throw new Error('Invalid .lcad path contour')
          for (const part of contour) convert({ ...recordValue(part, 'contour segment'), id: uid() }, { ...source, type: undefined }, depth + 1)
          hasGeometry ||= contour.length > 0
        }
      } else if (Array.isArray(source.polys)) {
        for (const polygon of source.polys) {
          if (!Array.isArray(polygon) || polygon.length < 3) throw new Error('Invalid .lcad path polygon')
          const points = polygon.map(pointValue)
          assertImportGeometryBudget(objects.length + points.length)
          for (let index = 0; index < points.length; index += 1) appendShapes([{ ...base, id: `${id}:${objects.length}`, type: 'line', start: points[index], end: points[(index + 1) % points.length] }])
          hasGeometry = true
        }
      }
      if (!hasGeometry) throw new Error('Unsupported .lcad path without editable contours or polygons')
      if (source.fillOn || source.leather || (source.fillColor && source.fillColor !== 'none')) warnings.add('Filled source paths are imported as editable outlines')
      return
    }
    if (source.type === 'stitch_hole') {
      const point = { x: numberField(source, 'cx'), y: numberField(source, 'cy') }
      const parameters = importLcadStitchParameters(source)
      const anchorId = `${id}:anchor`
      appendShapes([{ ...base, id: anchorId, type: 'line', stitchHoleMarker: true, start: point, end: point }])
      stitchHoles.push({ id, shapeId: anchorId, chainId: idValue(source.runId) || undefined, sequence: Math.max(0, Math.round(numberField(source, 'seq', 0))), point, ...parameters, endHole: source.endHole === true })
      return
    }
    if (source.type === 'tracing_image') {
      const image = stringValue(source.imageData, '')
      if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(image)) throw new Error('Unsupported .lcad tracing image: embed PNG, JPEG or WebP data before importing')
      const width = numberField(source, 'width'), height = numberField(source, 'height')
      if (!(width > 0 && height > 0)) throw new Error('Invalid .lcad tracing image size')
      backdrops.push({ id, name: stringValue(source.sourceFile, 'Imported tracing'), bitmapDataUrl: image, bitmapWidth: numberField(source, 'srcWidthPx', width), bitmapHeight: numberField(source, 'srcHeightPx', height), leftTop: { x: numberField(source, 'x'), y: numberField(source, 'y') }, width, height, angleDeg: (numberField(source, 'rotation', 0) * 180) / Math.PI, dpi: numberField(source, 'dpi', 300), visible: true, locked: source.locked === true, opacity: Math.max(0, Math.min(1, numberField(source, 'alpha', 0.6))) })
      return
    }
    if (source.type === 'dimension') {
      if (source.kind && source.kind !== 'linear') throw new Error(`Unsupported .lcad dimension kind: ${idValue(source.kind) || 'unknown'}`)
      dimensionLines.push({ id, layerId, lineTypeId, start: { x: numberField(source, 'x1'), y: numberField(source, 'y1') }, end: { x: numberField(source, 'x2'), y: numberField(source, 'y2') }, offsetMm: numberField(source, 'offsetDist', 8), text: typeof source.textOverride === 'string' ? source.textOverride : undefined })
      return
    }
    const converted = primitiveShapes(source, base)
    if (source.type === 'bezier' && (source.closed === true || (Array.isArray(source.points) && source.points.length > 4))) warnings.add('Multi-segment or closed Bézier chains are imported as separate editable curve segments')
    if (source.type === 'distance') warnings.add('Distance-tool shapes are imported as marked lines')
    if (source.type === 'stitch') warnings.add('Decorative stitch strokes are imported as stitch-role centerlines; repeated dash geometry is not imported')
    appendShapes(converted)
  }
  for (const shape of input.shapes) convert(shape)
  if (lineTypes.length === 0) styleFor({ type: 'line' })
  if (input.unit_for_view === 'inch') warnings.add('Source inch display units were converted to mm display; geometry remains in its original millimetres')
  if (Array.isArray(input.provenance) && input.provenance.length > 0) warnings.add('Source provenance is not imported; keep the original .lcad file for attribution and publication history')
  if (input.recording && typeof input.recording === 'object' && Array.isArray((input.recording as LcadRecord).steps) && ((input.recording as LcadRecord).steps as unknown[]).length > 0) warnings.add('Source editing recordings are not imported')
  const parsed = parseImportedJsonDocument(JSON.stringify({ version: 1, units: 'mm', documentName: typeof input.name === 'string' ? input.name : undefined, layers, activeLayerId, lineTypes, activeLineTypeId: lineTypes[0].id, objects, sketchGroups, foldLines: [], stitchHoles, backdrops, dimensionLines, communityProvenance, projectMemo: typeof input.memo === 'string' ? input.memo : '', snapSettings: { enabled: input.snapEnabled !== false, grid: true, gridStep: typeof input.gridSpacing === 'number' && input.gridSpacing > 0 ? input.gridSpacing : 5, endpoints: true, midpoints: true, guides: true, hardware: true }, showDimensions: dimensionLines.length > 0 }))
  return { doc: parsed.doc, warnings: [...warnings], summary: { shapeCount: parsed.doc.objects.length, stitchHoleCount: parsed.doc.stitchHoles?.length ?? 0, layerCount: parsed.doc.layers.length } }
}

export { exportLcadDocument } from './lcad/lcad-export'
