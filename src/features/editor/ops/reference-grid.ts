import type { DisplayUnit } from './unit-ops'

/**
 * Drawing-surface grid and edge-ruler math, matching the Leathercraft CAD web
 * editor's drafting surface: a 1-2-5 tick ladder chosen so one tick is at least
 * 10 screen pixels, a heavier line every 5 ticks (every 4 for inches) and the
 * heaviest every 10 ticks (every 8 for inches).
 */

const MM_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]
const INCH_TICKS = [1 / 128, 1 / 64, 1 / 32, 1 / 16, 1 / 8, 0.25, 0.5, 1, 2, 4, 8, 24]
const MM_PER_INCH = 25.4
const MIN_TICK_SCREEN_PX = 10

export type TickLadder = {
  /** Distance between adjacent ticks, in millimetres. */
  tickMm: number
  smallEvery: number
  largeEvery: number
}

export type TickKind = 'axis' | 'major' | 'small' | 'minor'

export function referenceTickLadder(scale: number, unit: DisplayUnit): TickLadder {
  const inch = unit === 'in'
  const ladder = inch ? INCH_TICKS : MM_TICKS
  const factor = inch ? MM_PER_INCH : 1
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  let tickMm = ladder[ladder.length - 1] * factor
  for (const step of ladder) {
    if (step * factor * safeScale >= MIN_TICK_SCREEN_PX) {
      tickMm = step * factor
      break
    }
  }
  return { tickMm, smallEvery: inch ? 4 : 5, largeEvery: inch ? 8 : 10 }
}

export function classifyTick(index: number, ladder: TickLadder): TickKind {
  if (index === 0) return 'axis'
  if (index % ladder.largeEvery === 0) return 'major'
  if (index % ladder.smallEvery === 0) return 'small'
  return 'minor'
}

/** Tick indices whose world position falls within [minMm, maxMm]. */
export function tickIndexRange(minMm: number, maxMm: number, ladder: TickLadder, limit = 4000) {
  const first = Math.ceil(minMm / ladder.tickMm - 1e-9)
  const last = Math.floor(maxMm / ladder.tickMm + 1e-9)
  return { first, last: Math.min(last, first + limit) }
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = a
  let y = b
  while (y) {
    const next = y
    y = x % y
    x = next
  }
  return x
}

/** Inch label as a mixed fraction down to 1/64" (e.g. `1 1/4"`), else 3 decimals. */
export function formatInchFraction(valueMm: number) {
  const inches = valueMm / MM_PER_INCH
  const sign = inches < 0 ? '-' : ''
  const absolute = Math.abs(inches)
  let whole = Math.floor(absolute)
  const remainder = absolute - whole
  let best = { num: 0, den: 1, err: remainder }
  for (const den of [2, 4, 8, 16, 32, 64]) {
    const num = Math.round(remainder * den)
    const err = Math.abs(remainder - num / den)
    if (err < best.err) best = { num, den, err }
  }
  if (best.err > 0.5 / 64) return `${sign}${absolute.toFixed(3)}"`
  const divisor = greatestCommonDivisor(best.num, best.den) || 1
  let num = best.num / divisor
  const den = best.den / divisor
  if (num === den) {
    whole += 1
    num = 0
  }
  if (num === 0 && whole === 0) return '0"'
  if (num === 0) return `${sign}${whole}"`
  if (whole === 0) return `${sign}${num}/${den}"`
  return `${sign}${whole} ${num}/${den}"`
}

/** Ruler label: integers from 10 up, one decimal from 1, two below; inch fractions. */
export function formatRulerLabel(valueMm: number, unit: DisplayUnit) {
  if (Math.abs(valueMm) < 1e-9) return '0'
  if (unit === 'in') return formatInchFraction(valueMm)
  const absolute = Math.abs(valueMm)
  const decimals = absolute >= 10 ? 0 : absolute >= 1 ? 1 : 2
  return Number(valueMm.toFixed(decimals)).toString()
}

export type SurfacePalette = {
  background: string
  minor: string
  small: string
  major: string
  axis: string
  rulerBackground: string
  rulerBorder: string
  rulerText: string
  rulerTickMinor: string
  rulerTickSmall: string
  rulerTickMajor: string
  rulerCursor: string
  rulerSelectionFill: string
  rulerSelectionEdge: string
  rulerOriginOn: string
  rulerOriginOff: string
}

export const SURFACE_PALETTES: Record<'dark' | 'light', SurfacePalette> = {
  dark: {
    background: '#1a1a1a',
    minor: 'rgba(216, 212, 204, 0.11)',
    small: 'rgba(216, 212, 204, 0.21)',
    major: 'rgba(216, 212, 204, 0.31)',
    axis: 'rgba(216, 212, 204, 0.45)',
    rulerBackground: '#1f1f24',
    rulerBorder: '#444444',
    rulerText: '#bbbbbb',
    rulerTickMinor: '#555555',
    rulerTickSmall: '#777777',
    rulerTickMajor: '#999999',
    rulerCursor: '#ff8800',
    rulerSelectionFill: 'rgba(0, 200, 255, 0.20)',
    rulerSelectionEdge: 'rgba(0, 200, 255, 0.6)',
    rulerOriginOn: '#22c08a',
    rulerOriginOff: '#666666',
  },
  light: {
    background: '#ffffff',
    minor: 'rgba(0, 0, 0, 0.07)',
    small: 'rgba(0, 0, 0, 0.13)',
    major: 'rgba(0, 0, 0, 0.19)',
    axis: 'rgba(0, 0, 0, 0.28)',
    rulerBackground: '#f1f2f4',
    rulerBorder: '#c9ccd2',
    rulerText: '#4b5563',
    rulerTickMinor: '#b6bac2',
    rulerTickSmall: '#8f949d',
    rulerTickMajor: '#6b7280',
    rulerCursor: '#ea7600',
    rulerSelectionFill: 'rgba(0, 150, 220, 0.16)',
    rulerSelectionEdge: 'rgba(0, 150, 220, 0.55)',
    rulerOriginOn: '#139a6c',
    rulerOriginOff: '#9ca3af',
  },
}

/** Width/height of the edge rulers in CSS pixels. */
export const EDGE_RULER_SIZE_PX = 22
