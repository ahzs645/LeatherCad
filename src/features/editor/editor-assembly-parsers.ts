import { clamp } from './cad/cad-geometry'
import type { AssemblyConnection, PieceEdgeSpan, PieceInterface } from './cad/cad-types'

export function parsePieceEdgeSpan(value: unknown): PieceEdgeSpan | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<PieceEdgeSpan>
  if (
    typeof candidate.pieceId !== 'string' ||
    typeof candidate.edgeIndex !== 'number' ||
    typeof candidate.t0 !== 'number' ||
    typeof candidate.t1 !== 'number'
  ) {
    return null
  }
  return {
    pieceId: candidate.pieceId,
    edgeIndex: Math.max(0, Math.round(candidate.edgeIndex)),
    t0: clamp(candidate.t0, 0, 1),
    t1: clamp(candidate.t1, 0, 1),
    reversed: candidate.reversed === true,
  }
}

export function parsePieceInterface(value: unknown): PieceInterface | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<PieceInterface>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.pieceId !== 'string' ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.spans)
  ) {
    return null
  }
  const spans = candidate.spans
    .map(parsePieceEdgeSpan)
    .filter((span): span is PieceEdgeSpan => span !== null)
  if (spans.length === 0) {
    return null
  }
  return {
    id: candidate.id,
    pieceId: candidate.pieceId,
    name: candidate.name.trim() || candidate.id,
    role:
      candidate.role === 'fold' ||
      candidate.role === 'hardware' ||
      candidate.role === 'slot' ||
      candidate.role === 'glue' ||
      candidate.role === 'edge-finish'
        ? candidate.role
        : 'seam',
    spans,
    side:
      candidate.side === 'grain' || candidate.side === 'flesh' || candidate.side === 'either'
        ? candidate.side
        : undefined,
    allowanceMm:
      typeof candidate.allowanceMm === 'number' && Number.isFinite(candidate.allowanceMm)
        ? Math.max(0, candidate.allowanceMm)
        : undefined,
    easeRatio:
      typeof candidate.easeRatio === 'number' && Number.isFinite(candidate.easeRatio)
        ? Math.max(0, candidate.easeRatio)
        : undefined,
  }
}

export function parseAssemblyConnection(value: unknown): AssemblyConnection | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<AssemblyConnection>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.fromInterfaceId !== 'string' ||
    typeof candidate.toInterfaceId !== 'string'
  ) {
    return null
  }
  return {
    id: candidate.id,
    fromInterfaceId: candidate.fromInterfaceId,
    toInterfaceId: candidate.toInterfaceId,
    kind:
      candidate.kind === 'fold-hinge' ||
      candidate.kind === 'glued' ||
      candidate.kind === 'riveted' ||
      candidate.kind === 'snap' ||
      candidate.kind === 'buckle' ||
      candidate.kind === 'aligned'
        ? candidate.kind
        : 'sewn',
    stitchSpacingMm:
      typeof candidate.stitchSpacingMm === 'number' && Number.isFinite(candidate.stitchSpacingMm)
        ? Math.max(0.1, Math.abs(candidate.stitchSpacingMm))
        : undefined,
    hardwareMarkerIds: Array.isArray(candidate.hardwareMarkerIds)
      ? candidate.hardwareMarkerIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    layerOffsetMm:
      typeof candidate.layerOffsetMm === 'number' && Number.isFinite(candidate.layerOffsetMm)
        ? candidate.layerOffsetMm
        : undefined,
    toleranceMm:
      typeof candidate.toleranceMm === 'number' && Number.isFinite(candidate.toleranceMm)
        ? Math.max(0, candidate.toleranceMm)
        : undefined,
  }
}
