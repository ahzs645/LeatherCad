import type { FoldLine, PatternPiece, PieceEdgeRef, Point, SeamConnection } from '../cad/cad-types'
import type { PieceMeshData } from '../three/piece-mesh'

export type AssemblyDiagnosticSeverity = 'fatal' | 'error' | 'warning' | 'info'

export type AssemblyDiagnosticGate =
  | 'import-normalize'
  | 'draft-edit'
  | 'assembly-preflight'
  | 'fold-preflight'
  | 'simulation-qc'
  | 'manufacturing-export'

export type AssemblyDiagnosticEntityKind =
  | 'piece'
  | 'seam'
  | 'fold'
  | 'stitchHole'
  | 'layer'
  | 'shape'
  | 'notch'
  | 'hardware'

export type AssemblyDiagnostic = {
  id: string
  code: string
  severity: AssemblyDiagnosticSeverity
  gate: AssemblyDiagnosticGate
  message: string
  entityRefs: Array<{
    kind: AssemblyDiagnosticEntityKind
    id: string
    label?: string
  }>
  metrics?: Record<string, number | string | boolean>
  locations?: Array<{ x: number; y: number; z?: number; edgeIndex?: number; t?: number }>
  suggestedFixes?: Array<{
    action:
      | 'reverse-seam'
      | 'split-edge'
      | 'match-stitch-count'
      | 'assign-layer-order'
      | 'increase-fold-radius'
      | 'mark-on-fold'
      | 'delete-duplicate-seam'
    label: string
    confidence: number
  }>
  blocking: boolean
}

const DEFAULT_SEAM_LENGTH_TOLERANCE_MM = 1
const DEFAULT_MIN_FOLD_RADIUS_RATIO = 1.5

function pieceLabel(pieceById: Map<string, PatternPiece>, pieceId: string) {
  return pieceById.get(pieceId)?.name ?? pieceId
}

function diagnostic(params: Omit<AssemblyDiagnostic, 'blocking'> & { blocking?: boolean }): AssemblyDiagnostic {
  return {
    ...params,
    blocking: params.blocking ?? (params.severity === 'fatal' || params.severity === 'error'),
  }
}

export function buildPieceMeshMap(pieceMeshes: PieceMeshData[]) {
  return new Map(pieceMeshes.map((piece) => [piece.pieceId, piece]))
}

export function resolvePieceEdge(
  pieceMeshesById: Map<string, PieceMeshData>,
  ref: PieceEdgeRef,
) {
  const piece = pieceMeshesById.get(ref.pieceId)
  if (!piece || ref.edgeIndex < 0 || ref.edgeIndex >= piece.edges.length) {
    return null
  }
  return {
    piece,
    edge: piece.edges[ref.edgeIndex],
  }
}

export function buildSeamAssemblyDiagnostics(params: {
  patternPieces: PatternPiece[]
  pieceMeshes: PieceMeshData[]
  seamConnections: SeamConnection[]
  lengthToleranceMm?: number
}) {
  const { patternPieces, pieceMeshes, seamConnections } = params
  const lengthToleranceMm = params.lengthToleranceMm ?? DEFAULT_SEAM_LENGTH_TOLERANCE_MM
  const pieceById = new Map(patternPieces.map((piece) => [piece.id, piece]))
  const pieceMeshesById = buildPieceMeshMap(pieceMeshes)
  const diagnostics: AssemblyDiagnostic[] = []
  const sewnEdgeUsers = new Map<string, SeamConnection[]>()

  for (const connection of seamConnections) {
    const from = resolvePieceEdge(pieceMeshesById, connection.from)
    const to = resolvePieceEdge(pieceMeshesById, connection.to)

    if (!from || !to) {
      const missingRef = !from ? connection.from : connection.to
      diagnostics.push(diagnostic({
        id: `piece-edge-invalid-ref-${connection.id}`,
        code: 'piece.edge.invalid_ref',
        severity: 'fatal',
        gate: 'draft-edit',
        message: `Seam "${connection.id}" references an edge that no longer exists.`,
        entityRefs: [
          { kind: 'seam', id: connection.id },
          { kind: 'piece', id: missingRef.pieceId, label: pieceLabel(pieceById, missingRef.pieceId) },
        ],
        metrics: { edgeIndex: missingRef.edgeIndex },
        suggestedFixes: [{
          action: 'delete-duplicate-seam',
          label: 'Remove the stale seam connection',
          confidence: 0.7,
        }],
      }))
      continue
    }

    const deltaMm = Math.abs(from.edge.lengthMm - to.edge.lengthMm)
    if (deltaMm > lengthToleranceMm) {
      diagnostics.push(diagnostic({
        id: `seam-length-mismatch-${connection.id}`,
        code: 'seam.length_mismatch',
        severity: deltaMm > lengthToleranceMm * 4 ? 'error' : 'warning',
        gate: 'assembly-preflight',
        message: `Seam lengths differ by ${deltaMm.toFixed(1)} mm between "${from.piece.name}" and "${to.piece.name}".`,
        entityRefs: [
          { kind: 'seam', id: connection.id },
          { kind: 'piece', id: from.piece.pieceId, label: from.piece.name },
          { kind: 'piece', id: to.piece.pieceId, label: to.piece.name },
        ],
        metrics: {
          fromLengthMm: from.edge.lengthMm,
          toLengthMm: to.edge.lengthMm,
          deltaMm,
          toleranceMm: lengthToleranceMm,
        },
        locations: [
          { ...from.edge.midpoint, edgeIndex: connection.from.edgeIndex, t: 0.5 },
          { ...to.edge.midpoint, edgeIndex: connection.to.edgeIndex, t: 0.5 },
        ],
        blocking: deltaMm > lengthToleranceMm * 4,
      }))
    }

    if (connection.kind === 'sewn') {
      for (const ref of [connection.from, connection.to]) {
        const key = `${ref.pieceId}:${ref.edgeIndex}`
        const users = sewnEdgeUsers.get(key) ?? []
        users.push(connection)
        sewnEdgeUsers.set(key, users)
      }
    }
  }

  for (const [key, users] of sewnEdgeUsers) {
    if (users.length <= 1) {
      continue
    }
    const [pieceId, edgeIndex] = key.split(':')
    diagnostics.push(diagnostic({
      id: `seam-duplicate-connection-${pieceId}-${edgeIndex}`,
      code: 'seam.duplicate_connection',
      severity: 'error',
      gate: 'assembly-preflight',
      message: `"${pieceLabel(pieceById, pieceId)}" edge ${Number(edgeIndex) + 1} is sewn more than once.`,
      entityRefs: [
        { kind: 'piece', id: pieceId, label: pieceLabel(pieceById, pieceId) },
        ...users.map((connection) => ({ kind: 'seam' as const, id: connection.id })),
      ],
      metrics: { edgeIndex: Number(edgeIndex), seamCount: users.length },
      suggestedFixes: [{
        action: 'delete-duplicate-seam',
        label: 'Keep one seam connection for this edge',
        confidence: 0.8,
      }],
    }))
  }

  return diagnostics
}

function pointDistanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-9) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

export function buildFoldAssemblyDiagnostics(params: {
  foldLines: FoldLine[]
  pieceMeshes: PieceMeshData[]
  fallbackThicknessMm: number
}) {
  const diagnostics: AssemblyDiagnostic[] = []
  const { foldLines, pieceMeshes, fallbackThicknessMm } = params

  for (const foldLine of foldLines) {
    const thicknessMm = foldLine.thicknessMm ?? fallbackThicknessMm
    const radiusMm = foldLine.radiusMm ?? foldLine.bendRadiusMm
    const minRadiusMm = thicknessMm * DEFAULT_MIN_FOLD_RADIUS_RATIO
    if (typeof radiusMm === 'number' && Number.isFinite(radiusMm) && radiusMm > 0 && radiusMm < minRadiusMm) {
      diagnostics.push(diagnostic({
        id: `fold-radius-too-small-${foldLine.id}`,
        code: 'fold.radius_too_small',
        severity: radiusMm < thicknessMm ? 'error' : 'warning',
        gate: 'fold-preflight',
        message: `Fold radius is too tight for ${thicknessMm.toFixed(1)} mm leather.`,
        entityRefs: [{ kind: 'fold', id: foldLine.id, label: foldLine.name }],
        metrics: { radiusMm, thicknessMm, minRadiusMm },
        suggestedFixes: [{
          action: 'increase-fold-radius',
          label: `Increase radius to at least ${minRadiusMm.toFixed(1)} mm`,
          confidence: 0.75,
        }],
        blocking: radiusMm < thicknessMm,
      }))
    }

    for (const piece of pieceMeshes) {
      const onBoundary = piece.edges.some((edge) =>
        Math.max(
          pointDistanceToSegment(edge.start, foldLine.start, foldLine.end),
          pointDistanceToSegment(edge.end, foldLine.start, foldLine.end),
        ) <= 0.2,
      )
      if (onBoundary) {
        diagnostics.push(diagnostic({
          id: `fold-on-cut-boundary-${foldLine.id}-${piece.pieceId}`,
          code: 'fold.on_cut_boundary',
          severity: 'warning',
          gate: 'fold-preflight',
          message: `Fold line "${foldLine.name}" appears to lie on a cut boundary.`,
          entityRefs: [
            { kind: 'fold', id: foldLine.id, label: foldLine.name },
            { kind: 'piece', id: piece.pieceId, label: piece.name },
          ],
          suggestedFixes: [{
            action: 'mark-on-fold',
            label: 'Mark the piece as on-fold or move the fold line',
            confidence: 0.55,
          }],
        }))
      }
    }
  }

  return diagnostics
}

export function buildAssemblyDiagnostics(params: {
  patternPieces: PatternPiece[]
  pieceMeshes: PieceMeshData[]
  seamConnections: SeamConnection[]
  foldLines: FoldLine[]
  fallbackThicknessMm: number
}) {
  return [
    ...buildSeamAssemblyDiagnostics(params),
    ...buildFoldAssemblyDiagnostics(params),
  ]
}
