import type { Shape } from './cad-types'

export function countShapesByLineType(shapes: Shape[]) {
  const counts: Record<string, number> = {}
  for (const shape of shapes) {
    counts[shape.lineTypeId] = (counts[shape.lineTypeId] ?? 0) + 1
  }
  return counts
}

export function applyLineTypeToShapeIds(shapes: Shape[], shapeIds: Set<string>, lineTypeId: string) {
  if (shapeIds.size === 0) {
    return shapes
  }

  return shapes.map((shape) =>
    shapeIds.has(shape.id)
      ? {
          ...shape,
          lineTypeId,
        }
      : shape,
  )
}

