import type { Point } from '../cad/cad-types'
import type { CommandParseResult } from './tool-types'

const VECTOR_PATTERN = /^(@)?(.+)(,|<)(.+)$/

export function parseNumber(text: string) {
  if (!text.trim()) {
    return Number.NaN
  }

  const parsed = Number(text.trim())
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function parseVector(referencePoint: Point, command: string): CommandParseResult {
  const normalized = command.replace(/\s+/g, '')
  const match = normalized.match(VECTOR_PATTERN)
  if (!match) {
    return { ok: false, message: 'Wrong input. Use x,y | @x,y | r<deg | @r<deg' }
  }

  const relative = match[1] !== undefined
  const xRaw = parseNumber(match[2])
  const yRaw = parseNumber(match[4])
  if (!Number.isFinite(xRaw) || !Number.isFinite(yRaw)) {
    return { ok: false, message: 'Wrong input. Numeric values are required.' }
  }

  const isPolar = match[3] === '<'
  let x = xRaw
  let y = yRaw
  if (isPolar) {
    const angle = (yRaw / 180) * Math.PI
    x = xRaw * Math.cos(angle)
    y = xRaw * Math.sin(angle)
  }

  if (relative) {
    x += referencePoint.x
    y += referencePoint.y
  }

  return {
    ok: true,
    point: { x, y },
  }
}
