/**
 * Adding a compiled fragment to the document the user already has open.
 *
 * An agent adding a card slot to a wallet must not blow away the wallet, so
 * every WebMCP write is a merge rather than a load. The fragment arrives with
 * ids the compiler generated from the agent's entity names, which would collide
 * the second time the same tool is called, so everything is re-identified here
 * and the references between them — a piece's boundary shape, a stitch hole's
 * shape, a seam's two pieces — are rewritten to match.
 *
 * Layers are reconciled by name instead of by id: an agent that asks twice for
 * work on the "Agent" layer gets one layer, which is what a person looking at
 * the layer list expects.
 *
 * Line types are left alone. The compiler emits the canonical ids
 * (`type-cut`, `type-stitch`, ...) that every LeatherCad document already
 * carries, so a merged fragment picks up the document's own cut and stitch
 * styling rather than importing a second copy of it.
 */

import { uid } from '../cad/cad-geometry'
import type {
  DocFile,
  FoldLine,
  HardwareMarker,
  Layer,
  LegacySeamAllowance,
  PatternPiece,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  StitchHole,
} from '../cad/cad-types'

export type MergeTargets = {
  layers: Layer[]
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  patternPieces: PatternPiece[]
  seamAllowances: PieceSeamAllowance[]
  seamConnections: SeamConnection[]
  hardwareMarkers: HardwareMarker[]
}

export type MergeResult = MergeTargets & {
  insertedShapeIds: string[]
  insertedPieceIds: string[]
  activeLayerId: string | null
}

/**
 * A document can carry the pre-piece seam allowance shape, which has no piece
 * to hang off and so cannot be merged into one. Those are dropped rather than
 * guessed at.
 */
export function isPieceSeamAllowance(
  entry: PieceSeamAllowance | LegacySeamAllowance,
): entry is PieceSeamAllowance {
  return typeof (entry as PieceSeamAllowance).pieceId === 'string'
}

function remapShape(shape: Shape, id: string, layerId: string): Shape {
  return { ...shape, id, layerId }
}

export function mergeCompiledDocument(current: MergeTargets, incoming: DocFile): MergeResult {
  const layersByName = new Map(current.layers.map((layer) => [layer.name.toLowerCase(), layer]))
  const layerIdMap = new Map<string, string>()
  const addedLayers: Layer[] = []

  for (const layer of incoming.layers) {
    const existing = layersByName.get(layer.name.toLowerCase())
    if (existing) {
      layerIdMap.set(layer.id, existing.id)
      continue
    }
    const created: Layer = {
      ...layer,
      id: uid(),
      visible: true,
      locked: false,
      stackLevel: current.layers.length + addedLayers.length,
    }
    layersByName.set(created.name.toLowerCase(), created)
    layerIdMap.set(layer.id, created.id)
    addedLayers.push(created)
  }

  const fallbackLayerId =
    addedLayers[0]?.id ?? current.layers[0]?.id ?? uid()
  const resolveLayerId = (layerId: string) => layerIdMap.get(layerId) ?? fallbackLayerId

  const shapeIdMap = new Map<string, string>()
  const insertedShapes = incoming.objects.map((shape) => {
    const nextId = uid()
    shapeIdMap.set(shape.id, nextId)
    return remapShape(shape, nextId, resolveLayerId(shape.layerId))
  })

  const pieceIdMap = new Map<string, string>()
  const insertedPieces: PatternPiece[] = (incoming.patternPieces ?? []).map((piece) => {
    const nextId = uid()
    pieceIdMap.set(piece.id, nextId)
    return {
      ...piece,
      id: nextId,
      layerId: resolveLayerId(piece.layerId),
      boundaryShapeId: shapeIdMap.get(piece.boundaryShapeId) ?? piece.boundaryShapeId,
      internalShapeIds: piece.internalShapeIds
        .map((shapeId) => shapeIdMap.get(shapeId))
        .filter((shapeId): shapeId is string => typeof shapeId === 'string'),
    }
  })

  const baseSequence = current.stitchHoles.reduce(
    (highest, hole) => Math.max(highest, hole.sequence),
    0,
  )
  const insertedStitchHoles: StitchHole[] = (incoming.stitchHoles ?? [])
    .filter((hole) => shapeIdMap.has(hole.shapeId))
    .map((hole, index) => ({
      ...hole,
      id: uid(),
      shapeId: shapeIdMap.get(hole.shapeId) as string,
      sequence: baseSequence + index + 1,
    }))

  const insertedFoldLines: FoldLine[] = incoming.foldLines.map((foldLine) => ({
    ...foldLine,
    id: uid(),
    ...(foldLine.pieceId ? { pieceId: pieceIdMap.get(foldLine.pieceId) ?? foldLine.pieceId } : {}),
  }))

  const insertedSeamAllowances = (incoming.seamAllowances ?? [])
    .filter(isPieceSeamAllowance)
    .filter((entry) => pieceIdMap.has(entry.pieceId))
    .map((entry) => ({
      ...entry,
      id: uid(),
      pieceId: pieceIdMap.get(entry.pieceId) as string,
    }))

  const insertedSeamConnections: SeamConnection[] = (incoming.seamConnections ?? [])
    .filter(
      (connection) => pieceIdMap.has(connection.from.pieceId) && pieceIdMap.has(connection.to.pieceId),
    )
    .map((connection) => ({
      ...connection,
      id: uid(),
      from: { ...connection.from, pieceId: pieceIdMap.get(connection.from.pieceId) as string },
      to: { ...connection.to, pieceId: pieceIdMap.get(connection.to.pieceId) as string },
    }))

  const insertedHardwareMarkers: HardwareMarker[] = (incoming.hardwareMarkers ?? []).map((marker) => ({
    ...marker,
    id: uid(),
    layerId: resolveLayerId(marker.layerId),
  }))

  return {
    layers: [...current.layers, ...addedLayers],
    shapes: [...current.shapes, ...insertedShapes],
    foldLines: [...current.foldLines, ...insertedFoldLines],
    stitchHoles: [...current.stitchHoles, ...insertedStitchHoles],
    patternPieces: [...current.patternPieces, ...insertedPieces],
    seamAllowances: [...current.seamAllowances, ...insertedSeamAllowances],
    seamConnections: [...current.seamConnections, ...insertedSeamConnections],
    hardwareMarkers: [...current.hardwareMarkers, ...insertedHardwareMarkers],
    insertedShapeIds: insertedShapes.map((shape) => shape.id),
    insertedPieceIds: insertedPieces.map((piece) => piece.id),
    activeLayerId: addedLayers[0]?.id ?? layerIdMap.values().next().value ?? null,
  }
}
