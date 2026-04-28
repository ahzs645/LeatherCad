import type { SeamConnection, StitchHole } from '../cad/cad-types'
import type { StitchChain, StitchPair } from '../three/final-product-types'
import type { PieceMeshData, PieceOutlineEdge } from '../three/piece-mesh'
import { buildPieceMeshMap, resolvePieceEdge, type AssemblyDiagnostic } from './assembly-diagnostics'

const DEFAULT_STITCH_SPACING_MM = 4
const MIN_EXPLICIT_SEAM_SAMPLES = 2

export type CompiledExplicitSeams = {
  chains: StitchChain[]
  pairs: StitchPair[]
  diagnostics: AssemblyDiagnostic[]
}

function interpolateEdge(edge: PieceOutlineEdge, t: number) {
  return {
    x: edge.start.x + (edge.end.x - edge.start.x) * t,
    y: edge.start.y + (edge.end.y - edge.start.y) * t,
  }
}

function edgeDirection(edge: PieceOutlineEdge, reversed: boolean) {
  const dx = reversed ? edge.start.x - edge.end.x : edge.end.x - edge.start.x
  const dy = reversed ? edge.start.y - edge.end.y : edge.end.y - edge.start.y
  const length = Math.hypot(dx, dy)
  if (length <= 1e-9) {
    return { x: 1, y: 0 }
  }
  return { x: dx / length, y: dy / length }
}

function makeHole(params: {
  id: string
  chainId: string
  connectionId: string
  edge: PieceOutlineEdge
  sequence: number
  count: number
  reversed: boolean
}): StitchHole {
  const rawT = params.count <= 1 ? 0 : params.sequence / (params.count - 1)
  const t = params.reversed ? 1 - rawT : rawT
  const point = interpolateEdge(params.edge, t)
  const direction = edgeDirection(params.edge, params.reversed)
  return {
    id: params.id,
    shapeId: `explicit-seam-${params.connectionId}`,
    chainId: params.chainId,
    connectionId: params.connectionId,
    point,
    angleDeg: (Math.atan2(direction.y, direction.x) * 180) / Math.PI,
    holeType: 'round',
    sequence: params.sequence,
  }
}

function boundsForHoles(holes: StitchHole[]) {
  return {
    minX: Math.min(...holes.map((hole) => hole.point.x)),
    maxX: Math.max(...holes.map((hole) => hole.point.x)),
    minY: Math.min(...holes.map((hole) => hole.point.y)),
    maxY: Math.max(...holes.map((hole) => hole.point.y)),
  }
}

function makeChain(params: {
  id: string
  holes: StitchHole[]
  edge: PieceOutlineEdge
  reversed: boolean
}): StitchChain {
  const direction = edgeDirection(params.edge, params.reversed)
  return {
    id: params.id,
    holes: params.holes,
    pointCount: params.holes.length,
    pitchMm: params.holes.length <= 1 ? params.edge.lengthMm : params.edge.lengthMm / (params.holes.length - 1),
    lengthMm: params.edge.lengthMm,
    start: params.holes[0].point,
    end: params.holes[params.holes.length - 1].point,
    direction,
    bounds: boundsForHoles(params.holes),
    explicit: true,
  }
}

function sampleCountForConnection(connection: SeamConnection, leftLengthMm: number, rightLengthMm: number) {
  const spacingMm = Math.max(0.1, connection.stitchSpacingMm ?? DEFAULT_STITCH_SPACING_MM)
  const seamLengthMm = Math.max(leftLengthMm, rightLengthMm)
  return Math.max(MIN_EXPLICIT_SEAM_SAMPLES, Math.round(seamLengthMm / spacingMm) + 1)
}

export function compileExplicitSeams(params: {
  pieceMeshes: PieceMeshData[]
  seamConnections: SeamConnection[]
}): CompiledExplicitSeams {
  const pieceMeshesById = buildPieceMeshMap(params.pieceMeshes)
  const chains: StitchChain[] = []
  const pairs: StitchPair[] = []
  const diagnostics: AssemblyDiagnostic[] = []

  for (const connection of params.seamConnections) {
    if (connection.kind !== 'sewn' && connection.kind !== 'hinge') {
      continue
    }

    const left = resolvePieceEdge(pieceMeshesById, connection.from)
    const right = resolvePieceEdge(pieceMeshesById, connection.to)
    if (!left || !right) {
      continue
    }

    const count = sampleCountForConnection(connection, left.edge.lengthMm, right.edge.lengthMm)
    const leftChainId = `explicit-seam-${connection.id}-from`
    const rightChainId = `explicit-seam-${connection.id}-to`
    const rightReversed = connection.reversed === true

    const leftHoles = Array.from({ length: count }, (_, index) =>
      makeHole({
        id: `${leftChainId}-${index}`,
        chainId: leftChainId,
        connectionId: connection.id,
        edge: left.edge,
        sequence: index,
        count,
        reversed: false,
      }),
    )
    const rightHoles = Array.from({ length: count }, (_, index) =>
      makeHole({
        id: `${rightChainId}-${index}`,
        chainId: rightChainId,
        connectionId: connection.id,
        edge: right.edge,
        sequence: index,
        count,
        reversed: rightReversed,
      }),
    )

    for (let index = 0; index < count; index += 1) {
      leftHoles[index].pairedHoleId = rightHoles[index].id
      rightHoles[index].pairedHoleId = leftHoles[index].id
    }

    const leftChain = makeChain({ id: leftChainId, holes: leftHoles, edge: left.edge, reversed: false })
    const rightChain = makeChain({ id: rightChainId, holes: rightHoles, edge: right.edge, reversed: rightReversed })
    chains.push(leftChain, rightChain)
    pairs.push({
      id: `explicit-stitch-pair-${connection.id}`,
      left: leftChain,
      right: rightChain,
      reversed: false,
      score: 1,
      rmsErrorMm: Math.abs(left.edge.lengthMm - right.edge.lengthMm),
      status: 'paired',
    })
  }

  return { chains, pairs, diagnostics }
}
