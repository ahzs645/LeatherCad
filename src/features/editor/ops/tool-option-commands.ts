import type { Tool } from '../cad/cad-types'

export type Armed = Partial<Record<'length' | 'angle' | 'width' | 'height' | 'radius' | 'radiusX' | 'radiusY', number | null>>

/** Command to finish the shape in progress from the armed values, or null. */
export function buildArmedCommand(tool: Tool, armed: Armed): string | null {
  const mm = (value: number) => String(Number(value.toFixed(4)))
  if (tool === 'line' && armed.length && armed.length > 0) {
    // Angles count counter-clockwise from +X on screen; world Y points down.
    return typeof armed.angle === 'number' ? `@${mm(armed.length)}<${String(Number((-armed.angle).toFixed(4)))}` : mm(armed.length)
  }
  if (tool === 'rectangle' && armed.width && armed.height) return `@${mm(armed.width)},${mm(armed.height)}`
  if (tool === 'circle' && armed.radius && armed.radius > 0) return mm(armed.radius)
  if (tool === 'ellipse' && armed.radiusX && armed.radiusY) return `${mm(armed.radiusX)},${mm(armed.radiusY)}`
  return null
}

