import { BufferGeometry, Group, Line, LineBasicMaterial, Vector2, Vector3 } from 'three'

export function addPanelOutline(
  points: Vector2[],
  group: Group,
  color: string,
  yOffset: number,
  pivot?: Vector2 | null,
) {
  if (points.length < 2) {
    return
  }

  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  const outlinePoints = points.map((point) => new Vector3(point.x - offsetX, yOffset + 0.004, point.y - offsetY))
  outlinePoints.push(new Vector3(points[0].x - offsetX, yOffset + 0.004, points[0].y - offsetY))

  const outline = new Line(
    new BufferGeometry().setFromPoints(outlinePoints),
    new LineBasicMaterial({ color }),
  )
  group.add(outline)
}
