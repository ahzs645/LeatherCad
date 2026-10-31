import type { Point } from '../../cad/cad-types'
import { createStlMeshBuilder } from '../stl-mesh'
import { clipRings, intersectRings, regionsFromRings } from '../stl-polygons'
import type { ManufacturingFace } from './manufacturing-regions'

/** A union of XY regions extruded over Z intervals, with shared caps at every change in height. */
export function buildLevelMesh(faces: ManufacturingFace[], throughHoles: Point[][], engraving: Point[][], side: 'none' | 'top' | 'bottom', engravingDepth: number) {
  const solid = faces.filter((face) => !face.through && face.heightMm > 0)
  if (!solid.length) throw new Error('Manufacturing regions contain no printable material.')
  const heights = new Set([0, ...solid.map((face) => face.heightMm)])
  if (engraving.length && side !== 'none') {
    for (const face of solid) {
      // Reject depth only for faces actually touched by a glyph, rather than unrelated shallow faces.
      if (!intersectRings(engraving, face.rings).length) continue
      if (engravingDepth >= face.heightMm - 0.0001) throw new Error('Engraving depth must be less than the thickness of every engraved region.')
      heights.add(side === 'top' ? face.heightMm - engravingDepth : engravingDepth)
    }
  }
  const levels = [...heights].sort((a, b) => a - b)
  let vertexCount = 0
  const slabs = levels.slice(0, -1).map((bottom, i) => {
    const top = levels[i + 1], middle = (bottom + top) / 2
    let rings = clipRings(solid.filter((face) => face.heightMm > middle).flatMap((face) => {
      if (engraving.length && (side === 'top' && middle > face.heightMm - engravingDepth || side === 'bottom' && middle < engravingDepth)) return clipRings(face.rings, engraving, true)
      return face.rings
    }))
    if (throughHoles.length) rings = clipRings(rings, throughHoles, true)
    vertexCount += rings.reduce((count, ring) => count + ring.length, 0)
    if (vertexCount > 100_000) throw new Error('Manufacturing depth levels exceed the vertex budget. Simplify region depths, export fewer holes, or increase tolerance.')
    return { bottom, top, rings }
  })
  const extras = [...new Map(slabs.flatMap((slab) => slab.rings.flat()).map((p) => [`${p.x},${p.y}`, p])).values()]
  const builder = createStlMeshBuilder(extras)
  for (let i = 0; i < slabs.length; i++) {
    const { bottom, top, rings } = slabs[i]
    if (!rings.length) continue
    const below = slabs[i - 1]?.rings ?? [], above = slabs[i + 1]?.rings ?? []
    builder.caps(regionsFromRings(clipRings(rings, below, true)), bottom, false)
    builder.caps(regionsFromRings(clipRings(rings, above, true)), top, true)
    builder.walls(rings, bottom, top)
  }
  return builder.mesh
}
