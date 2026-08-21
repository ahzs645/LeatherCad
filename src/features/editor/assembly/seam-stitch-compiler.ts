import type { SeamConnection, StitchHole } from '../cad/cad-types'
import type { StitchChain, StitchPair } from '../three/final-product-types'
import type { PieceMeshData, PieceOutlineEdge } from '../three/piece-mesh'
import { buildPieceMeshMap, type AssemblyDiagnostic } from './assembly-diagnostics'
import {
  flipStretch,
  resolveConnectionSide,
  sampleSide,
  type SeamSideStretch,
} from './seam-geometry'

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

function makeSideChain(id: string, holes: StitchHole[], lengthMm: number): StitchChain {
  const first = holes[0]
  const last = holes[holes.length - 1]
  const dx = last.point.x - first.point.x
  const dy = last.point.y - first.point.y
  const span = Math.hypot(dx, dy)
  return {
    id,
    holes,
    pointCount: holes.length,
    pitchMm: holes.length <= 1 ? lengthMm : lengthMm / (holes.length - 1),
    lengthMm,
    start: first.point,
    end: last.point,
    // Chord direction across the whole side; a multi-span or curved side has no
    // single edge direction to borrow.
    direction: span <= 1e-9 ? { x: 1, y: 0 } : { x: dx / span, y: dy / span },
    bounds: boundsForHoles(holes),
    explicit: true,
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

function sampleCountForConnection(connection: SeamConnection, leftLengthMm: number, rightLengthMm: number) {
  const spacingMm = Math.max(0.1, connection.stitchSpacingMm ?? DEFAULT_STITCH_SPACING_MM)
  const seamLengthMm = Math.max(leftLengthMm, rightLengthMm)
  // Degenerate geometry produces a non-finite length. Falling through with it
  // yields an empty hole array and takes the whole 3D preview down on the first
  // hole access, so clamp to the minimum sample count instead.
  if (!Number.isFinite(seamLengthMm) || seamLengthMm <= 0) {
    return MIN_EXPLICIT_SEAM_SAMPLES
  }
  return Math.max(MIN_EXPLICIT_SEAM_SAMPLES, Math.round(seamLengthMm / spacingMm) + 1)
}

function holeAlongSide(params: {
  id: string
  chainId: string
  connectionId: string
  stretches: SeamSideStretch[]
  lengthMm: number
  sequence: number
  count: number
}): StitchHole {
  const ratio = params.count <= 1 ? 0 : params.sequence / (params.count - 1)
  const { stretch, t } = sampleSide(params.stretches, params.lengthMm * ratio)
  const point = interpolateEdge(stretch.edge, t)
  const forward = stretch.t1 >= stretch.t0
  const direction = edgeDirection(stretch.edge, !forward)
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

    const left = resolveConnectionSide(pieceMeshesById, connection, 'from')
    const right = resolveConnectionSide(pieceMeshesById, connection, 'to')
    if (!left || !right) {
      continue
    }

    const count = sampleCountForConnection(connection, left.lengthMm, right.lengthMm)
    const leftChainId = `explicit-seam-${connection.id}-from`
    const rightChainId = `explicit-seam-${connection.id}-to`
    // Sewing runs the two sides against each other, so the second side is walked
    // end-to-start unless the seam says otherwise.
    const rightStretches = connection.reversed === true
      ? [...right.stretches].reverse().map(flipStretch)
      : right.stretches

    const leftHoles = Array.from({ length: count }, (_, index) =>
      holeAlongSide({
        id: `${leftChainId}-${index}`,
        chainId: leftChainId,
        connectionId: connection.id,
        stretches: left.stretches,
        lengthMm: left.lengthMm,
        sequence: index,
        count,
      }),
    )
    const rightHoles = Array.from({ length: count }, (_, index) =>
      holeAlongSide({
        id: `${rightChainId}-${index}`,
        chainId: rightChainId,
        connectionId: connection.id,
        stretches: rightStretches,
        lengthMm: right.lengthMm,
        sequence: index,
        count,
      }),
    )

    for (let index = 0; index < count; index += 1) {
      leftHoles[index].pairedHoleId = rightHoles[index].id
      rightHoles[index].pairedHoleId = leftHoles[index].id
    }

    const leftChain = makeSideChain(leftChainId, leftHoles, left.lengthMm)
    const rightChain = makeSideChain(rightChainId, rightHoles, right.lengthMm)
    chains.push(leftChain, rightChain)
    pairs.push({
      id: `explicit-stitch-pair-${connection.id}`,
      left: leftChain,
      right: rightChain,
      reversed: false,
      score: 1,
      rmsErrorMm: Math.abs(left.lengthMm - right.lengthMm),
      status: 'paired',
    })
  }

  return { chains, pairs, diagnostics }
}
