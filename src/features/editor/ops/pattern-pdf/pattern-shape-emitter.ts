/** Preserve authored PDF cubic controls as editable native curves. */
import type { LineShape, Shape } from '../../cad/cad-types'
import type { PdfPathSegment } from './pdf-vector-paths'
import type { PatternSide } from './pattern-outline-sides'

/** Retained for older callers; native emission requires no fitting tolerance. */
export type ShapeEmitOptions = { toleranceMm: number; maxSubdivisions: number }
export const DEFAULT_SHAPE_EMIT_OPTIONS: ShapeEmitOptions = { toleranceMm: 0.05, maxSubdivisions: 5 }

export function sideToShapes(
  side: PatternSide,
  params: { idPrefix: string; layerId: string; lineTypeId: string },
  options: Partial<ShapeEmitOptions> = {},
): Shape[] {
  void options
  const shapes: Shape[] = []
  let emitted = 0
  const base = () => ({ id: `${params.idPrefix}-${++emitted}`, layerId: params.layerId, lineTypeId: params.lineTypeId })
  let run: Extract<PdfPathSegment, { kind: 'line' }>[] = []
  const flushRun = () => {
    if (!run.length) return
    shapes.push({ ...base(), type: 'line', start: { ...run[0].from }, end: { ...run[run.length - 1].to } } satisfies LineShape)
    run = []
  }
  for (const segment of side.segments) {
    if (segment.kind === 'line') { run.push(segment); continue }
    flushRun()
    shapes.push({ ...base(), type: 'cubic', start: { ...segment.from }, control1: { ...segment.c1 }, control2: { ...segment.c2 }, end: { ...segment.to } })
  }
  flushRun()
  return shapes
}
