import { ConvexError, v } from 'convex/values'
import { parseCommunityProvenance } from '../src/features/editor/ops/community-provenance'

export const license = v.union(v.literal('CC0-1.0'), v.literal('CC-BY-4.0'), v.literal('CC-BY-NC-4.0'))
export const visibility = v.union(v.literal('public'), v.literal('private'))
export const cursor = v.union(v.string(), v.null())
export const remoteDocument = v.object({
  id: v.string(), name: v.string(), docJson: v.string(), createdAt: v.number(), updatedAt: v.number(), revision: v.number(),
})
export const patternSummary = v.object({
  id: v.string(), title: v.string(), description: v.string(), author: v.string(),
  license, attribution: v.string(), visibility, version: v.number(), publishedAt: v.number(), visibilityRevision: v.number(), retired: v.boolean(),
})
export const patternDetail = v.object({
  id: v.string(), title: v.string(), description: v.string(), author: v.string(),
  license, attribution: v.string(), visibility, version: v.number(), publishedAt: v.number(), visibilityRevision: v.number(), retired: v.boolean(), docJson: v.string(),
})
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isPoint(value: unknown): boolean {
  return isRecord(value) && typeof value.x === 'number' && Number.isFinite(value.x)
    && typeof value.y === 'number' && Number.isFinite(value.y)
}
function isStoredShape(value: unknown): value is Record<string, unknown> & { id: string; layerId: string } {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.layerId !== 'string' || typeof value.lineTypeId !== 'string') return false
  if (value.locked !== undefined && typeof value.locked !== 'boolean') return false
  if (value.opacity !== undefined && (typeof value.opacity !== 'number' || !Number.isFinite(value.opacity) || value.opacity < 0 || value.opacity > 1)) return false
  if (value.strokeWidthOverride !== undefined && (typeof value.strokeWidthOverride !== 'number' || !Number.isFinite(value.strokeWidthOverride) || value.strokeWidthOverride < 0)) return false
  if (value.type === 'ellipse') {
    return isPoint(value.center) && ['radiusX', 'radiusY'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] > 0)
      && ['rotationDeg', 'startAngleDeg', 'sweepDeg'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
      && typeof value.sweepDeg === 'number' && value.sweepDeg !== 0 && Math.abs(value.sweepDeg) <= 360
  }
  if (!isPoint(value.start) || !isPoint(value.end)) return false
  if (value.type === 'line') return true
  if (value.type === 'arc') return isPoint(value.mid)
  if (value.type === 'bezier') return isPoint(value.control)
  if (value.type === 'cubic') return isPoint(value.control1) && isPoint(value.control2)
  if (value.type !== 'text') return false
  return typeof value.text === 'string' && typeof value.fontFamily === 'string'
    && ['none', 'arch', 'ring'].includes(String(value.transform))
    && ['fontSizeMm', 'radiusMm', 'sweepDeg'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
}

export function validateDocumentJson(value: string): void {
  // Bound individual rows and paginated response payloads below Convex limits.
  if (new TextEncoder().encode(value).length > 512 * 1024) throw new ConvexError('This drawing is too large for cloud sync (512 KiB). Save it locally instead.')
  let doc: unknown
  try { doc = JSON.parse(value) } catch { throw new ConvexError('Drawing JSON is invalid') }
  if (!doc || typeof doc !== 'object' || !('objects' in doc) || !Array.isArray(doc.objects) || !('layers' in doc) || !Array.isArray(doc.layers)) {
    throw new ConvexError('Drawing must contain objects and layers')
  }
  const layerIds = new Set<string>(), shapeIds = new Set<string>()
  for (const layer of doc.layers as unknown[]) {
    if (!isRecord(layer) || typeof layer.id !== 'string' || !layer.id || layerIds.has(layer.id)
      || typeof layer.name !== 'string' || typeof layer.visible !== 'boolean' || typeof layer.locked !== 'boolean') {
      throw new ConvexError('Drawing contains an invalid or duplicate layer')
    }
    layerIds.add(layer.id)
  }
  if (layerIds.size === 0) throw new ConvexError('Drawing must contain at least one layer')
  try { parseCommunityProvenance('communityProvenance' in doc ? doc.communityProvenance : undefined) }
  catch { throw new ConvexError('Community source provenance is invalid') }
  for (const shape of doc.objects as unknown[]) {
    if (!isStoredShape(shape) || shapeIds.has(shape.id) || !layerIds.has(shape.layerId)) {
      throw new ConvexError('Drawing contains an invalid, unsupported, or duplicate shape')
    }
    shapeIds.add(shape.id)
  }
}
export function boundedText(value: string, name: string, max = 200): string {
  const text = value.trim()
  if (!text || text.length > max) throw new ConvexError(`${name} must contain 1–${max} characters`)
  return text
}
