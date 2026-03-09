import type { DocFile, PatternPiece, PiecePlacement3D, Point, SeamConnection } from '../cad/cad-types'
import { detectOutlines } from '../ops/outline-detection'
import { buildPieceMeshes } from '../three/piece-mesh'

export type GarmentInterchangePiece = {
  id: string
  name: string
  layerId: string
  boundaryShapeId: string
  internalShapeIds: string[]
  quantity: number
  vertices: Point[]
  holes: Point[][]
  edges: Array<{
    index: number
    startIndex: number
    endIndex: number
    lengthMm: number
  }>
  placement3d: PiecePlacement3D
  metadata: {
    material?: string
    materialSide?: PatternPiece['materialSide']
    onFold: boolean
    mirrorPair?: boolean
    annotation?: string
    code?: string
  }
}

export type GarmentInterchangeDocument = {
  version: 1
  units: 'mm'
  metadata: {
    normalizedEdgeLoops: true
    curveSupport: 'quadratic-optional'
    source: 'LeatherCad'
  }
  pieces: GarmentInterchangePiece[]
  seams: SeamConnection[]
}

function defaultPlacement(pieceId: string): PiecePlacement3D {
  return {
    pieceId,
    translationMm: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    flipped: false,
  }
}

export function exportGarmentInterchangeDocument(doc: DocFile): GarmentInterchangeDocument {
  const chains = detectOutlines(doc.objects, doc.lineTypes)
  const chainsByShapeId = new Map<string, (typeof chains)[number]>()
  for (const chain of chains) {
    for (const shapeId of chain.shapeIds) {
      chainsByShapeId.set(shapeId, chain)
    }
  }

  const placementsByPieceId = new Map((doc.piecePlacements3d ?? []).map((placement) => [placement.pieceId, placement]))
  const pieceMeshes = buildPieceMeshes(doc.patternPieces ?? [], chainsByShapeId)
  const pieces = pieceMeshes.map((pieceMesh) => {
    const piece = (doc.patternPieces ?? []).find((entry) => entry.id === pieceMesh.pieceId)
    if (!piece) {
      throw new Error(`Missing pattern piece for mesh ${pieceMesh.pieceId}`)
    }

    return {
      id: piece.id,
      name: piece.name,
      layerId: piece.layerId,
      boundaryShapeId: piece.boundaryShapeId,
      internalShapeIds: [...piece.internalShapeIds],
      quantity: piece.quantity,
      vertices: pieceMesh.outer.map((point) => ({ ...point })),
      holes: pieceMesh.holes.map((hole) => hole.map((point) => ({ ...point }))),
      edges: pieceMesh.edges.map((edge) => ({
        index: edge.index,
        startIndex: edge.index,
        endIndex: (edge.index + 1) % pieceMesh.outer.length,
        lengthMm: edge.lengthMm,
      })),
      placement3d: placementsByPieceId.get(piece.id) ?? defaultPlacement(piece.id),
      metadata: {
        material: piece.material,
        materialSide: piece.materialSide,
        onFold: piece.onFold,
        mirrorPair: piece.mirrorPair,
        annotation: piece.annotation,
        code: piece.code,
      },
    } satisfies GarmentInterchangePiece
  })

  return {
    version: 1,
    units: 'mm',
    metadata: {
      normalizedEdgeLoops: true,
      curveSupport: 'quadratic-optional',
      source: 'LeatherCad',
    },
    pieces,
    seams: (doc.seamConnections ?? []).map((connection) => ({ ...connection })),
  }
}
