import { ShapeUtils, Vector2 } from 'three'
import type { Point } from '../../cad/cad-types'
import { clipRings, inMaterial, intersectRings, regionsFromRings, signedArea } from '../stl-polygons'

export type ManufacturingFace = { id: string; at: Point; rings: Point[][]; heightMm: number; through: boolean }

export function ringArea(rings: Point[][]) { return rings.reduce((sum, ring) => sum + signedArea(ring), 0) }

function interiorPoint(rings: Point[][]): Point {
  for (const region of regionsFromRings(rings)) {
    const vertices = [region.outer, ...region.holes].flat()
    const triangles = ShapeUtils.triangulateShape(region.outer.map((p) => new Vector2(p.x, p.y)), region.holes.map((ring) => ring.map((p) => new Vector2(p.x, p.y))))
    for (const [a, b, c] of triangles) {
      const point = { x: (vertices[a].x + vertices[b].x + vertices[c].x) / 3, y: (vertices[a].y + vertices[b].y + vertices[c].y) / 3 }
      if (inMaterial(rings, point)) return point
    }
  }
  throw new Error('Could not select an interior point for a manufacturing region.')
}

export function partitionManufacturingFaces(material: Point[][], boundaries: Point[][][], heightMm: number): ManufacturingFace[] {
  let cells = [material]
  for (const boundary of boundaries) {
    cells = cells.flatMap((cell) => {
      const inside = intersectRings(cell, boundary), outside = clipRings(cell, boundary, true)
      if (!inside.length || !outside.length) return [cell]
      return [inside, outside]
    })
    if (cells.length > 200) throw new Error('The drawing creates more than 200 manufacturing faces. Simplify or export a selection.')
  }
  return cells.flatMap((cell) => regionsFromRings(cell).map((region) => {
    const rings = [region.outer, ...region.holes], at = interiorPoint(rings)
    const id = `face:${at.x.toFixed(4)},${at.y.toFixed(4)}:${ringArea(rings).toFixed(4)}`
    return { id, at, rings, heightMm, through: false }
  }))
}
