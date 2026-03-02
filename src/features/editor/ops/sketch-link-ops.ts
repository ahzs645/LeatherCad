import type { Point, Shape, SketchGroup } from '../cad/cad-types'
import { computeBoundsFromShapes } from './pattern-ops'

type LinkMode = NonNullable<SketchGroup['linkMode']>

const DEFAULT_LINK_MODE: LinkMode = 'copy'
const LINKED_SHAPE_ID_PREFIX = '__linked__'

function sanitizeLinkMode(value: SketchGroup['linkMode']): LinkMode {
  if (value === 'mirror-x' || value === 'mirror-y' || value === 'copy') {
    return value
  }
  return DEFAULT_LINK_MODE
}

function sanitizeLinkOffset(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

type ShapeBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function transformPoint(point: Point, bounds: ShapeBounds, mode: LinkMode, offsetX: number, offsetY: number): Point {
  let nextX = point.x
  let nextY = point.y
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  if (mode === 'mirror-x') {
    nextX = centerX - (point.x - centerX)
  } else if (mode === 'mirror-y') {
    nextY = centerY - (point.y - centerY)
  }

  return {
    x: nextX + offsetX,
    y: nextY + offsetY,
  }
}

function toLinkedShapeId(groupId: string, sourceShapeId: string) {
  return `${LINKED_SHAPE_ID_PREFIX}${groupId}::${sourceShapeId}`
}

function projectShape(
  shape: Shape,
  group: SketchGroup,
  bounds: ShapeBounds,
  mode: LinkMode,
  offsetX: number,
  offsetY: number,
): Shape {
  if (shape.type === 'line') {
    return {
      id: toLinkedShapeId(group.id, shape.id),
      type: 'line',
      layerId: group.layerId,
      lineTypeId: shape.lineTypeId,
      groupId: group.id,
      start: transformPoint(shape.start, bounds, mode, offsetX, offsetY),
      end: transformPoint(shape.end, bounds, mode, offsetX, offsetY),
    }
  }

  if (shape.type === 'arc') {
    return {
      id: toLinkedShapeId(group.id, shape.id),
      type: 'arc',
      layerId: group.layerId,
      lineTypeId: shape.lineTypeId,
      groupId: group.id,
      start: transformPoint(shape.start, bounds, mode, offsetX, offsetY),
      mid: transformPoint(shape.mid, bounds, mode, offsetX, offsetY),
      end: transformPoint(shape.end, bounds, mode, offsetX, offsetY),
    }
  }

  return {
    id: toLinkedShapeId(group.id, shape.id),
    type: 'bezier',
    layerId: group.layerId,
    lineTypeId: shape.lineTypeId,
    groupId: group.id,
    start: transformPoint(shape.start, bounds, mode, offsetX, offsetY),
    control: transformPoint(shape.control, bounds, mode, offsetX, offsetY),
    end: transformPoint(shape.end, bounds, mode, offsetX, offsetY),
  }
}

export function sanitizeSketchGroupLinks(sketchGroups: SketchGroup[]): SketchGroup[] {
  const sketchGroupIdSet = new Set(sketchGroups.map((group) => group.id))
  let changed = false

  const nextGroups = sketchGroups.map((group) => {
    const validBaseGroupId =
      typeof group.baseGroupId === 'string' &&
      group.baseGroupId.length > 0 &&
      group.baseGroupId !== group.id &&
      sketchGroupIdSet.has(group.baseGroupId)
        ? group.baseGroupId
        : undefined

    if (!validBaseGroupId) {
      if (
        group.baseGroupId === undefined &&
        group.linkMode === undefined &&
        group.linkOffsetX === undefined &&
        group.linkOffsetY === undefined
      ) {
        return group
      }

      changed = true
      return {
        ...group,
        baseGroupId: undefined,
        linkMode: undefined,
        linkOffsetX: undefined,
        linkOffsetY: undefined,
      }
    }

    const nextLinkMode = sanitizeLinkMode(group.linkMode)
    const nextOffsetX = sanitizeLinkOffset(group.linkOffsetX)
    const nextOffsetY = sanitizeLinkOffset(group.linkOffsetY)

    if (
      group.baseGroupId === validBaseGroupId &&
      group.linkMode === nextLinkMode &&
      group.linkOffsetX === nextOffsetX &&
      group.linkOffsetY === nextOffsetY
    ) {
      return group
    }

    changed = true
    return {
      ...group,
      baseGroupId: validBaseGroupId,
      linkMode: nextLinkMode,
      linkOffsetX: nextOffsetX,
      linkOffsetY: nextOffsetY,
    }
  })

  return changed ? nextGroups : sketchGroups
}

export function buildLinkedProjectionShapes(shapes: Shape[], sketchGroups: SketchGroup[]): Shape[] {
  if (shapes.length === 0 || sketchGroups.length === 0) {
    return []
  }

  const sourceShapesByGroupId = new Map<string, Shape[]>()
  for (const shape of shapes) {
    if (!shape.groupId) {
      continue
    }

    const existing = sourceShapesByGroupId.get(shape.groupId)
    if (existing) {
      existing.push(shape)
    } else {
      sourceShapesByGroupId.set(shape.groupId, [shape])
    }
  }

  const linkedShapes: Shape[] = []

  for (const sketchGroup of sketchGroups) {
    if (!sketchGroup.baseGroupId) {
      continue
    }

    const sourceShapes = sourceShapesByGroupId.get(sketchGroup.baseGroupId) ?? []
    if (sourceShapes.length === 0) {
      continue
    }

    const bounds = computeBoundsFromShapes(sourceShapes)
    if (!bounds) {
      continue
    }

    const linkMode = sanitizeLinkMode(sketchGroup.linkMode)
    const linkOffsetX = sanitizeLinkOffset(sketchGroup.linkOffsetX)
    const linkOffsetY = sanitizeLinkOffset(sketchGroup.linkOffsetY)

    linkedShapes.push(
      ...sourceShapes.map((shape) =>
        projectShape(
          shape,
          sketchGroup,
          bounds,
          linkMode,
          linkOffsetX,
          linkOffsetY,
        ),
      ),
    )
  }

  return linkedShapes
}
