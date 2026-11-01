import type { Shape, SketchGroup, StitchHole } from '../cad/cad-types'

export const MAX_GROUP_DEPTH = 32
export type GroupAccess = { visible: boolean; locked: boolean }

/** Invalid hierarchies fail closed while loading; import validation gives the error. */
export function buildGroupAccess(groups: SketchGroup[]): Record<string, GroupAccess> {
  const byId = new Map(groups.map(group => [group.id, group]))
  const result: Record<string, GroupAccess> = Object.create(null) as Record<string, GroupAccess>
  const visiting = new Set<string>()
  const visit = (id: string, depth: number): GroupAccess => {
    if (result[id]) return result[id]
    const group = byId.get(id)
    if (!group || visiting.has(id) || depth > MAX_GROUP_DEPTH) return { visible: false, locked: true }
    visiting.add(id)
    const parent = group.parentId ? visit(group.parentId, depth + 1) : { visible: true, locked: false }
    visiting.delete(id)
    return (result[id] = { visible: group.visible && parent.visible, locked: group.locked || parent.locked })
  }
  for (const group of groups) visit(group.id, 1)
  return result
}

export function validateGroupHierarchy(groups: SketchGroup[]): void {
  const byId = new Map(groups.map(group => [group.id, group]))
  if (byId.size !== groups.length) throw new Error('Duplicate sketch group IDs')
  for (const group of groups) {
    let current: SketchGroup | undefined = group
    const seen = new Set<string>()
    while (current) {
      if (seen.has(current.id)) throw new Error('Sketch group hierarchy contains a cycle')
      seen.add(current.id)
      if (seen.size > MAX_GROUP_DEPTH) throw new Error(`Sketch groups exceed ${MAX_GROUP_DEPTH} levels`)
      if (!current.parentId) break
      const parent: SketchGroup | undefined = byId.get(current.parentId)
      if (!parent) throw new Error(`Missing parent sketch group: ${current.parentId}`)
      current = parent
    }
  }
}

export function isShapeLocked(shape: Shape, access: Record<string, GroupAccess>): boolean {
  return shape.locked === true || (shape.groupId !== undefined && access[shape.groupId]?.locked === true)
}

/** Editing updaters cannot change/delete a locked object; document load/undo uses replacement arrays. */
export function protectLockedShapeUpdates(previous: Shape[], next: Shape[], groups: SketchGroup[], lockedLayers: ReadonlySet<string> = new Set()): Shape[] {
  const access = buildGroupAccess(groups)
  const protectedShapes = previous.filter(shape => isShapeLocked(shape, access) || lockedLayers.has(shape.layerId))
  if (!protectedShapes.length) return next
  const protectedById = new Map(protectedShapes.map(shape => [shape.id, shape]))
  const groupIds = new Set(groups.map(group => group.id))
  const result = next.map(shape => {
    const prior = protectedById.get(shape.id)
    if (!prior) return shape
    // Unlocking is an explicit attribute-only operation, never a geometry bypass.
    if (prior.locked && shape.locked === false) return { ...prior, locked: false }
    if (prior.groupId && !groupIds.has(prior.groupId) && !shape.groupId) return { ...prior, groupId: undefined }
    return prior
  })
  const ids = new Set(result.map(shape => shape.id))
  for (const shape of protectedShapes) {
    if (!ids.has(shape.id)) result.splice(Math.min(previous.indexOf(shape), result.length), 0, shape)
  }
  return result
}

/** Associated holes cannot be edited independently to bypass a protected path. */
export function protectLockedStitchUpdates(previous: StitchHole[], next: StitchHole[], shapes: Shape[], groups: SketchGroup[], lockedLayers: ReadonlySet<string> = new Set()): StitchHole[] {
  const access = buildGroupAccess(groups)
  const lockedIds = new Set(shapes.filter(shape => isShapeLocked(shape, access) || lockedLayers.has(shape.layerId)).map(shape => shape.id))
  if (!lockedIds.size) return next
  const lockedChains = new Set(previous.filter(hole => lockedIds.has(hole.shapeId) && hole.chainId).map(hole => hole.chainId))
  const protectedHole = (hole: StitchHole) => lockedIds.has(hole.shapeId) || Boolean(hole.chainId && lockedChains.has(hole.chainId))
  const previousById = new Map(previous.map(hole => [hole.id, hole]))
  const result = next.flatMap(hole => {
    const prior = previousById.get(hole.id)
    if (prior && protectedHole(prior)) return [prior]
    if (protectedHole(hole)) return prior ? [prior] : []
    return [hole]
  })
  const ids = new Set(result.map(hole => hole.id))
  for (const hole of previous) if (protectedHole(hole) && !ids.has(hole.id)) result.splice(Math.min(previous.indexOf(hole), result.length), 0, hole)
  return result
}
