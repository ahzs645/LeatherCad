import type { Manifold } from 'manifold-3d'
import type { Point } from '../../cad/cad-types'
import type { StlExportPlan } from '../io-stl'
import { createStlMeshBuilder, type StlMesh } from '../stl-mesh'
import { clipRings, intersectRings, offsetRings, regionsFromRings } from '../stl-polygons'
import { buildFinishedPrism } from './manufacturing-finishing'
import { buildLevelMesh } from './manufacturing-level-mesh'
import { createManufacturingSolidSession, loadManufacturingSolidKernel } from './manufacturing-solid-kernel'

function prism(rings: Point[][], bottom: number, top: number): StlMesh {
  const builder = createStlMeshBuilder(rings.flat())
  builder.caps(regionsFromRings(rings), bottom, false)
  builder.caps(regionsFromRings(rings), top, true)
  builder.walls(rings, bottom, top)
  return builder.mesh
}

/** Finishing subtracts closed 3D cutter solids. Shared steps and lettering are
 * resolved by the solid modeller, rather than sewing intersecting triangle fans. */
export async function buildCombinedFinishedMesh(plan: StlExportPlan): Promise<StlMesh> {
  const { settings: s, faces, holeRings, engraving, warnings } = plan
  if (s.edgeFinish === 'none') throw new Error('Choose an edge finish before combining manufacturing operations.')
  const solidFaces = faces.filter(face => !face.through && face.heightMm > 0)
  if (!solidFaces.length) throw new Error('Manufacturing regions contain no printable material.')
  const heights = [...new Set(solidFaces.map(face => face.heightMm))].sort((a, b) => a - b)
  if (heights.length > 64) throw new Error('Combined finishing supports at most 64 distinct heights. Group similar region depths or export a selection.')
  const radius = s.edgeSizeMm, tolerance = s.toleranceMm / 2
  const printable = clipRings(plan.printable, holeRings, true)
  const stock = s.mode === 'jig' ? plan.footprint : printable
  const inset = offsetRings(stock, -radius, tolerance / 2)
  if (!inset.length) throw new Error('Edge finishing would remove the body. Reduce its edge size.')
  const bottomBand = clipRings(stock, inset, true)
  if (s.mode === 'jig') {
    const pockets = offsetRings(plan.material, s.jigClearanceMm, tolerance / 2)
    if (clipRings(pockets, inset, true).length || holeRings.some(ring => clipRings([ring], inset, true).length)) throw new Error('Edge finishing reaches a jig pocket or bore. Reduce edge size or increase the outside margin to preserve fit dimensions.')
  }
  for (const face of solidFaces) {
    if (face.heightMm <= radius + 0.0001 && intersectRings(face.rings, bottomBand).length) throw new Error('Edge size reaches through a thin region. Reduce edge size or increase the remaining thickness.')
  }
  const points = stock.flat()
  const origin = points.reduce((p, next) => ({ x: Math.min(p.x, next.x), y: Math.min(p.y, next.y) }), { x: Infinity, y: Infinity })
  const session = createManufacturingSolidSession(await loadManufacturingSolidKernel(), origin, s.toleranceMm)
  const { fromMesh, track, release, replace } = session
  const cut = (body: Manifold, cutter: Manifold) => {
    if (cutter.isEmpty()) { release(cutter); return body }
    const next = replace(body, body.subtract(cutter)); release(cutter); return next
  }
  const edgeCutter = (rings: Point[][], side: 'top' | 'bottom', z: number): Manifold => {
    const sharp = fromMesh(prism(rings, 0, radius))
    const rounded = fromMesh(buildFinishedPrism(rings, radius, radius, s.edgeFinish as 'chamfer' | 'fillet', s.filletSteps, tolerance, { top: side === 'top', bottom: side === 'bottom' }))
    let cutter = track(sharp.subtract(rounded)); release(sharp); release(rounded)
    if (z !== 0) cutter = replace(cutter, cutter.translate(0, 0, z))
    return cutter
  }
  try {
    let body = fromMesh(buildLevelMesh(faces, holeRings, [], 'none', s.textDepthMm))
    body = cut(body, edgeCutter(stock, 'bottom', 0))
    let engravingMeetsFinish = engraving.length > 0 && s.textEngrave === 'bottom' && intersectRings(engraving, bottomBand).length > 0
    for (const height of heights) {
      const levelFaces = solidFaces.filter(face => face.heightMm === height)
      const exposed = clipRings(levelFaces.flatMap(face => face.rings), holeRings, true)
      const upper = s.mode === 'jig' ? stock : clipRings(solidFaces.filter(face => face.heightMm >= height).flatMap(face => face.rings), holeRings, true)
      const band = clipRings(upper, offsetRings(upper, -radius, tolerance / 2), true)
      if (!intersectRings(exposed, band).length) continue
      if (height <= radius + 0.0001) throw new Error('Edge size reaches through a finished region. Reduce edge size or increase thickness.')
      if (height <= radius * 2 + 0.0001 && intersectRings(exposed, bottomBand).length) throw new Error('Edge size must be less than half the thickness where top and bottom finishes meet.')
      const neighbors = offsetRings(exposed, Math.max(0.0002, s.toleranceMm / 100), tolerance / 4)
      for (const lower of solidFaces) {
        if (lower.heightMm >= height || height - lower.heightMm > radius + 0.0001) continue
        if (intersectRings(neighbors, lower.rings).length) throw new Error('Edge size exceeds an adjacent height step. Reduce edge size or increase the step depth.')
      }
      let cutter = edgeCutter(upper, 'top', height - radius)
      const mask = fromMesh(prism(exposed, height - radius, height))
      cutter = replace(cutter, cutter.intersect(mask)); release(mask)
      body = cut(body, cutter)
      if (engraving.length && s.textEngrave === 'top' && intersectRings(engraving, intersectRings(exposed, band)).length) engravingMeetsFinish = true
    }
    if (engraving.length && s.textEngrave !== 'none') {
      for (const face of solidFaces) {
        const glyphs = clipRings(intersectRings(engraving, face.rings), holeRings, true)
        if (!glyphs.length) continue
        if (s.textDepthMm >= face.heightMm - 0.0001) throw new Error('Engraving depth must be less than the thickness of every engraved region.')
        const epsilon = Math.max(0.0001, s.toleranceMm / 100)
        const bottom = s.textEngrave === 'top' ? face.heightMm - s.textDepthMm : -epsilon
        const top = s.textEngrave === 'top' ? face.heightMm + epsilon : s.textDepthMm
        body = cut(body, fromMesh(prism(glyphs, bottom, top)))
      }
    }
    if (engravingMeetsFinish) warnings.push('Engraving crosses a finished edge. Recess depth is measured from the flat face plane and clipped to the finished body.')
    body = replace(body, body.simplify(Math.min(s.toleranceMm / 100, 0.00001)))
    return session.toMesh(body)
  } finally { session.dispose() }
}
