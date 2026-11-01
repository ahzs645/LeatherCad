import type { Point, Shape } from '../../cad/cad-types'
import { uid } from '../../cad/cad-geometry'

const TOKEN = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi

/** SVG endpoint-arc parameters to an analytic ellipse interval. */
function arc(start: Point, end: Point, rx: number, ry: number, rotationDeg: number, large: number, sweep: number, base: { id: string; layerId: string; lineTypeId: string }): Shape | null {
  if (Math.hypot(end.x - start.x, end.y - start.y) < 1e-12) return null
  rx = Math.abs(rx); ry = Math.abs(ry)
  if (!rx || !ry) return { ...base, type: 'line', start, end }
  const rotation = rotationDeg * Math.PI / 180, cosine = Math.cos(rotation), sine = Math.sin(rotation)
  const x = cosine * (start.x - end.x) / 2 + sine * (start.y - end.y) / 2
  const y = -sine * (start.x - end.x) / 2 + cosine * (start.y - end.y) / 2
  const fit = x * x / (rx * rx) + y * y / (ry * ry)
  if (fit > 1) { const scale = Math.sqrt(fit); rx *= scale; ry *= scale }
  const numerator = rx * rx * ry * ry - rx * rx * y * y - ry * ry * x * x
  const denominator = rx * rx * y * y + ry * ry * x * x
  const coefficient = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator))
  const cx = coefficient * rx * y / ry, cy = -coefficient * ry * x / rx
  const center = { x: cosine * cx - sine * cy + (start.x + end.x) / 2, y: sine * cx + cosine * cy + (start.y + end.y) / 2 }
  const startAngle = Math.atan2((y - cy) / ry, (x - cx) / rx)
  let delta = Math.atan2((-y - cy) / ry, (-x - cx) / rx) - startAngle
  if (sweep === 1 && delta < 0) delta += Math.PI * 2
  if (sweep === 0 && delta > 0) delta -= Math.PI * 2
  return { ...base, type: 'ellipse', center, radiusX: rx, radiusY: ry, rotationDeg, startAngleDeg: startAngle * 180 / Math.PI, sweepDeg: delta * 180 / Math.PI }
}

/** Parse standard SVG path commands without rasterization or browser path APIs. */
export function parseNativeSvgPath(data: string, layerId: string, lineTypeId: string): Shape[] {
  if (data.length > 10_000_000) throw new Error('SVG path exceeds the 10 MB limit.')
  const tokens = data.match(TOKEN) ?? []
  if (data.replace(TOKEN, '').replace(/[\s,]/g, '') || tokens.length > 200_000) throw new Error('Malformed or over-limit SVG path.')
  let index = 0, command = '', previous = ''
  let current: Point = { x: 0, y: 0 }, origin: Point = current, control: Point | null = null
  const shapes: Shape[] = []
  const number = () => {
    const token = tokens[index++]
    if (token === undefined || /^[a-z]$/i.test(token) || !Number.isFinite(Number(token))) throw new Error('Missing finite SVG path coordinate.')
    return Number(token)
  }
  const point = (relative: boolean): Point => { const x = number(), y = number(); return { x: x + (relative ? current.x : 0), y: y + (relative ? current.y : 0) } }
  const base = () => ({ id: uid(), layerId, lineTypeId })
  const line = (end: Point) => { if (Math.hypot(end.x - current.x, end.y - current.y) > 1e-12) shapes.push({ ...base(), type: 'line', start: { ...current }, end }); current = end }
  while (index < tokens.length) {
    if (/^[a-z]$/i.test(tokens[index])) command = tokens[index++]
    if (!command) throw new Error('SVG path must begin with a command.')
    const relative = command === command.toLowerCase(), upper = command.toUpperCase()
    if (!previous && upper !== 'M') throw new Error('SVG path must begin with a move.')
    if (upper === 'M') {
      current = point(relative); origin = { ...current }; control = null; previous = upper; command = relative ? 'l' : 'L'; continue
    }
    if (upper === 'Z') { line({ ...origin }); control = null; previous = upper; command = ''; continue }
    if (upper === 'L') { line(point(relative)); control = null }
    else if (upper === 'H') { line({ x: number() + (relative ? current.x : 0), y: current.y }); control = null }
    else if (upper === 'V') { line({ x: current.x, y: number() + (relative ? current.y : 0) }); control = null }
    else if (upper === 'C' || upper === 'S') {
      const control1: Point = upper === 'C' ? point(relative) : (previous === 'C' || previous === 'S') && control ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y } : { ...current }
      const control2 = point(relative), end = point(relative)
      shapes.push({ ...base(), type: 'cubic', start: { ...current }, control1, control2, end }); current = end; control = control2
    } else if (upper === 'Q' || upper === 'T') {
      const nextControl: Point = upper === 'Q' ? point(relative) : (previous === 'Q' || previous === 'T') && control ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y } : { ...current }
      const end = point(relative)
      shapes.push({ ...base(), type: 'bezier', start: { ...current }, control: nextControl, end }); current = end; control = nextControl
    } else if (upper === 'A') {
      const rx = number(), ry = number(), rotation = number(), large = number(), sweep = number(), end = point(relative)
      if (![large, sweep].every((flag) => flag === 0 || flag === 1)) throw new Error('SVG arc flags must be 0 or 1.')
      const curve = arc(current, end, rx, ry, rotation, large, sweep, base())
      if (curve) shapes.push(curve)
      current = end; control = null
    } else throw new Error('Unsupported SVG path command.')
    previous = upper
  }
  return shapes
}
