import { describe, expect, it } from 'vitest'
import { Euler, Matrix4, Vector3 } from 'three'
import type { PiecePlacement3D, SeamConnection } from '../cad/cad-types'
import { resolvePatternPieceChains } from '../ops/pattern-piece-ops'
import { SEAMED_PATTERN_PRESETS } from '../data/seamed-sample-patterns'
import { buildPieceMeshes, type PieceMeshData } from './piece-mesh'
import { solveSeamDrivenPlacements } from './seam-driven-placement'

function meshesFor(presetId: string) {
  const preset = SEAMED_PATTERN_PRESETS.find((entry) => entry.id === presetId)!
  const { byShapeId } = resolvePatternPieceChains(preset.doc.objects, preset.doc.lineTypes)
  return {
    meshes: buildPieceMeshes(preset.doc.patternPieces ?? [], byShapeId),
    seams: preset.doc.seamConnections ?? [],
  }
}

/**
 * Reproduce what the viewport does with a placement: rotate about the piece
 * centroid, then translate. Working in document millimetres, so the viewport's
 * scale and centring drop out.
 */
function placePoint(point: { x: number; y: number }, placement: PiecePlacement3D, mesh: PieceMeshData) {
  const flat = new Vector3(point.x, 0, point.y)
  const centroid = mesh.outer.reduce<Vector3>(
    (sum, entry) => sum.add(new Vector3(entry.x / mesh.outer.length, 0, entry.y / mesh.outer.length)),
    new Vector3(),
  )
  const rotation = new Matrix4().makeRotationFromEuler(
    new Euler(
      (placement.rotationDeg.x * Math.PI) / 180,
      (placement.rotationDeg.y * Math.PI) / 180,
      (placement.rotationDeg.z * Math.PI) / 180,
      'XYZ',
    ),
  )
  return flat
    .sub(centroid)
    .applyMatrix4(rotation)
    .add(centroid)
    .add(new Vector3(placement.translationMm.x, placement.translationMm.y, -placement.translationMm.z))
}

function edgeEnds(mesh: PieceMeshData, shapeId: string) {
  const segment = mesh.shapeSegments.find((entry) => entry.shapeId === shapeId)!
  const first = mesh.edges.find((edge) => edge.index === segment.firstEdgeIndex)!
  const last = mesh.edges.find((edge) => edge.index === segment.lastEdgeIndex)!
  return { start: first.start, end: last.end }
}

describe('solveSeamDrivenPlacements', () => {
  it('returns nothing to place when there are no pieces', () => {
    expect(solveSeamDrivenPlacements({ pieceMeshes: [], seamConnections: [] })).toEqual({
      placements: [],
      unplacedPieceIds: [],
      skippedSeamIds: [],
      diagnostics: [],
    })
  })

  it('holds the largest piece fixed and hangs the rest off it', () => {
    const { meshes, seams } = meshesFor('card-case')
    const result = solveSeamDrivenPlacements({ pieceMeshes: meshes, seamConnections: seams })

    const back = result.placements.find((entry) => entry.pieceId === 'card-case-back')!
    expect(back.translationMm).toEqual({ x: 0, y: 0, z: -0 })
    expect(back.rotationDeg.x).toBeCloseTo(0, 6)
    expect(back.rotationDeg.y).toBeCloseTo(0, 6)
    expect(back.rotationDeg.z).toBeCloseTo(0, 6)
    expect(result.unplacedPieceIds).toEqual([])
  })

  it('closes every seam that a rigid piece can close', () => {
    for (const presetId of ['card-case', 'boxed-pouch', 'dice-cup', 'tote-bag']) {
      const { meshes, seams } = meshesFor(presetId)
      const result = solveSeamDrivenPlacements({ pieceMeshes: meshes, seamConnections: seams })

      expect(result.unplacedPieceIds, presetId).toEqual([])
      for (const diagnostic of result.diagnostics) {
        if (diagnostic.requiresCrease) {
          continue
        }
        expect(diagnostic.residualGapMm, `${presetId} ${diagnostic.seamId}`).toBeLessThan(0.01)
      }
    }
  })

  it('says when a seam needs the piece to crease rather than pretending it closed', () => {
    const { meshes, seams } = meshesFor('boxed-pouch')
    const result = solveSeamDrivenPlacements({ pieceMeshes: meshes, seamConnections: seams })

    // The gusset is a straight 380mm strip; each panel's run is the same length
    // but turns two corners, so no rigid placement brings both ends together.
    // The gusset is the largest piece, so it is the root and the panels hang
    // off it — the diagnostic names whichever piece the solve placed.
    const frontSeam = result.diagnostics.find((entry) => entry.seamId.endsWith('seam-front-gusset'))!
    expect(frontSeam.requiresCrease).toBe(true)
    expect(frontSeam.residualGapMm).toBeGreaterThan(1)

    // The straight-seam patterns claim no creases.
    const { meshes: toteMeshes, seams: toteSeams } = meshesFor('tote-bag')
    const tote = solveSeamDrivenPlacements({ pieceMeshes: toteMeshes, seamConnections: toteSeams })
    expect(tote.diagnostics.some((entry) => entry.requiresCrease)).toBe(false)
  })

  it('lays the card case out flat, with the pocket beside the back rather than on it', () => {
    const { meshes, seams } = meshesFor('card-case')
    const result = solveSeamDrivenPlacements({ pieceMeshes: meshes, seamConnections: seams })

    const pocketMesh = meshes.find((mesh) => mesh.pieceId === 'card-case-pocket')!
    const pocketPlacement = result.placements.find((entry) => entry.pieceId === 'card-case-pocket')!
    const backMesh = meshes.find((mesh) => mesh.pieceId === 'card-case-back')!

    const placed = pocketMesh.outer.map((point) => placePoint(point, pocketPlacement, pocketMesh))
    // Flat: nothing leaves the plane at an assembly angle of zero.
    for (const point of placed) {
      expect(Math.abs(point.y)).toBeLessThan(1e-6)
    }

    // The pocket ends up on the far side of the seam from the back's body.
    const backCentroidX = backMesh.outer.reduce((sum, p) => sum + p.x, 0) / backMesh.outer.length
    const pocketCentroidX = placed.reduce((sum, p) => sum + p.x, 0) / placed.length
    expect(pocketCentroidX).not.toBeCloseTo(backCentroidX, 0)
  })

  it('lifts pieces out of the plane as the assembly angle opens', () => {
    const { meshes, seams } = meshesFor('boxed-pouch')

    const flat = solveSeamDrivenPlacements({ pieceMeshes: meshes, seamConnections: seams })
    const standing = solveSeamDrivenPlacements({
      pieceMeshes: meshes,
      seamConnections: seams,
      options: { assemblyAngleDeg: 90 },
    })

    const height = (result: ReturnType<typeof solveSeamDrivenPlacements>) => {
      let maxY = 0
      for (const placement of result.placements) {
        const mesh = meshes.find((entry) => entry.pieceId === placement.pieceId)!
        for (const point of mesh.outer) {
          maxY = Math.max(maxY, Math.abs(placePoint(point, placement, mesh).y))
        }
      }
      return maxY
    }

    expect(height(flat)).toBeLessThan(1e-6)
    expect(height(standing)).toBeGreaterThan(50)
  })

  it('stacks a lining onto its panel instead of into it', () => {
    // Folded flat onto the panel, a zero-thickness sheet lands in the panel's
    // own plane: two layers sewn together occupy one slab and render as one
    // piece of leather. They should sit a thickness apart.
    const { meshes, seams } = meshesFor('card-case')

    const flat = solveSeamDrivenPlacements({
      pieceMeshes: meshes,
      seamConnections: seams,
      options: { assemblyAngleDeg: 180, materialThicknessMm: 0 },
    })
    const stacked = solveSeamDrivenPlacements({
      pieceMeshes: meshes,
      seamConnections: seams,
      options: { assemblyAngleDeg: 180, materialThicknessMm: 2 },
    })

    const pocketFlat = flat.placements.find((entry) => entry.pieceId !== flat.placements[0].pieceId)!
    const pocketStacked = stacked.placements.find((entry) => entry.pieceId === pocketFlat.pieceId)!
    expect(pocketFlat.translationMm.y).toBeCloseTo(0, 6)
    expect(pocketStacked.translationMm.y).toBeCloseTo(2, 6)
    // Only the height moves; the seam still meets where it met.
    expect(pocketStacked.translationMm.x).toBeCloseTo(pocketFlat.translationMm.x, 6)
    expect(pocketStacked.translationMm.z).toBeCloseTo(pocketFlat.translationMm.z, 6)
  })

  it('does not report the stacking lift as a seam that failed to close', () => {
    // The lift is deliberate. Counting it would put a one-thickness gap on
    // every stacked seam and read as an assembly that does not close.
    const { meshes, seams } = meshesFor('card-case')
    const gapsAt = (materialThicknessMm: number) =>
      solveSeamDrivenPlacements({
        pieceMeshes: meshes,
        seamConnections: seams,
        options: { assemblyAngleDeg: 180, materialThicknessMm },
      }).diagnostics.map((entry) => entry.residualGapMm)

    expect(gapsAt(2)).toEqual(gapsAt(0))
  })

  it('does not lift a piece the seam lays out edge to edge', () => {
    // At angle 0 the pieces are a flat net, side by side on the bench. Nothing
    // is stacked on anything, so nothing is lifted.
    const { meshes, seams } = meshesFor('card-case')

    const result = solveSeamDrivenPlacements({
      pieceMeshes: meshes,
      seamConnections: seams,
      options: { assemblyAngleDeg: 0, materialThicknessMm: 2 },
    })

    for (const placement of result.placements) {
      expect(placement.translationMm.y).toBeCloseTo(0, 6)
    }
  })

  it('lifts a standing piece by half a thickness on its way over', () => {
    // Quarter turn: the piece is on edge, half way between lying beside its
    // parent and lying on it. Its centroid rises tens of millimetres from the
    // rotation alone, so the thickness has to be read as the difference the
    // thickness makes rather than as the height itself.
    const { meshes, seams } = meshesFor('card-case')
    const solveAt = (materialThicknessMm: number) =>
      solveSeamDrivenPlacements({
        pieceMeshes: meshes,
        seamConnections: seams,
        options: { assemblyAngleDeg: 90, materialThicknessMm },
      })

    const bare = solveAt(0)
    const thick = solveAt(2)

    const moved = thick.placements.filter((entry) => {
      const before = bare.placements.find((other) => other.pieceId === entry.pieceId)!
      return Math.abs(entry.translationMm.y - before.translationMm.y) > 1e-6
    })
    expect(moved.length).toBeGreaterThan(0)
    for (const placement of moved) {
      const before = bare.placements.find((other) => other.pieceId === placement.pieceId)!
      expect(placement.translationMm.y - before.translationMm.y).toBeCloseTo(1, 6)
    }
  })

  it('starts a multi-span seam at the first stretch of the run', () => {
    const { meshes, seams } = meshesFor('boxed-pouch')
    const result = solveSeamDrivenPlacements({ pieceMeshes: meshes, seamConnections: seams })

    const gussetMesh = meshes.find((mesh) => mesh.pieceId === 'pouch-gusset')!
    const gussetPlacement = result.placements.find((entry) => entry.pieceId === 'pouch-gusset')!
    const frontMesh = meshes.find((mesh) => mesh.pieceId === 'pouch-front')!
    const frontPlacement = result.placements.find((entry) => entry.pieceId === 'pouch-front')!

    // The gusset's leading corner lands on one end of the panel run, even though
    // the far end cannot also meet without a crease.
    const gussetTop = edgeEnds(gussetMesh, 'pouch-gusset-top')
    const runStart = edgeEnds(frontMesh, 'pouch-front-left').start
    const runEnd = edgeEnds(frontMesh, 'pouch-front-right').end

    const placedGussetStart = placePoint(gussetTop.start, gussetPlacement, gussetMesh)
    const placedGussetEnd = placePoint(gussetTop.end, gussetPlacement, gussetMesh)
    const placedRunStart = placePoint(runStart, frontPlacement, frontMesh)
    const placedRunEnd = placePoint(runEnd, frontPlacement, frontMesh)

    const nearestToRunStart = Math.min(
      placedGussetStart.distanceTo(placedRunStart),
      placedGussetEnd.distanceTo(placedRunStart),
    )
    const nearestToRunEnd = Math.min(
      placedGussetStart.distanceTo(placedRunEnd),
      placedGussetEnd.distanceTo(placedRunEnd),
    )
    expect(Math.min(nearestToRunStart, nearestToRunEnd)).toBeLessThan(0.01)
  })

  it('leaves pieces no seam reaches alone, and says which they were', () => {
    const { meshes, seams } = meshesFor('card-case')
    const orphan: PieceMeshData = {
      ...meshes[0],
      pieceId: 'orphan',
      name: 'Orphan',
    }

    const result = solveSeamDrivenPlacements({
      pieceMeshes: [...meshes, orphan],
      seamConnections: seams,
    })

    expect(result.unplacedPieceIds).toEqual(['orphan'])
    expect(result.placements.some((entry) => entry.pieceId === 'orphan')).toBe(false)
  })

  it('skips a seam whose side no longer resolves, and names it', () => {
    const { meshes } = meshesFor('card-case')
    const broken: SeamConnection = {
      id: 'seam-broken',
      from: { pieceId: 'card-case-back', edgeIndex: 0 },
      to: { pieceId: 'does-not-exist', edgeIndex: 0 },
      kind: 'sewn',
    }

    const result = solveSeamDrivenPlacements({ pieceMeshes: meshes, seamConnections: [broken] })

    expect(result.skippedSeamIds).toEqual(['seam-broken'])
    expect(result.unplacedPieceIds).toContain('card-case-pocket')
  })

  it('honours an explicit root piece', () => {
    const { meshes, seams } = meshesFor('card-case')
    const result = solveSeamDrivenPlacements({
      pieceMeshes: meshes,
      seamConnections: seams,
      options: { rootPieceId: 'card-case-pocket' },
    })

    const pocket = result.placements.find((entry) => entry.pieceId === 'card-case-pocket')!
    expect(pocket.rotationDeg.y).toBeCloseTo(0, 6)
    expect(pocket.translationMm.x).toBeCloseTo(0, 6)
  })
})
