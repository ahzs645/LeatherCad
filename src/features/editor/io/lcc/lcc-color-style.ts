import type { LineTypeRole, LineTypeStyle, Point } from '../../cad/cad-types'

export const LCC_COLOR_MAP: Record<string, string> = {
  aqua: '#00ffff',
  black: '#000000',
  blue: '#0000ff',
  brown: '#8b4513',
  cyan: '#00ffff',
  darkgray: '#a9a9a9',
  fuchsia: '#ff00ff',
  gray: '#808080',
  green: '#008000',
  lightgray: '#d3d3d3',
  lime: '#00ff00',
  magenta: '#ff00ff',
  maroon: '#800000',
  navy: '#000080',
  olive: '#808000',
  orange: '#ff8c00',
  pink: '#ffc0cb',
  purple: '#800080',
  red: '#ff0000',
  silver: '#c0c0c0',
  teal: '#008080',
  violet: '#ee82ee',
  white: '#ffffff',
  yellow: '#ffff00',
}

export function resolveLccColor(name: string): string {
  return LCC_COLOR_MAP[name.toLowerCase()] ?? '#ffffff'
}

export function resolveLccDash(dash: string): LineTypeStyle {
  const lower = dash.toLowerCase()
  if (lower === 'dash') return 'dashed'
  if (lower === 'dot') return 'dotted'
  if (lower === 'dashdot' || lower === 'dashdotdot') return 'dash-dot-dot'
  return 'solid'
}

const LAYER_ROLE_MAP: Record<number, LineTypeRole> = {
  0: 'cut',
  1: 'fold',
  2: 'mark',
  3: 'stitch',
  4: 'guide',
}

export function layerRole(layerIndex: number): LineTypeRole {
  return LAYER_ROLE_MAP[layerIndex] ?? 'cut'
}

export function pt(coords: [number, number]): Point {
  return { x: coords[0], y: coords[1] }
}

export function midpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

export function parseLccFloat(value: string | number | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const REVERSE_COLOR_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(LCC_COLOR_MAP).map(([name, hex]) => [hex.toLowerCase(), name.charAt(0).toUpperCase() + name.slice(1)]),
)

export function hexToLccColor(hex: string): string {
  return REVERSE_COLOR_MAP[hex.toLowerCase()] ?? 'White'
}

export function styleToLccDash(style: LineTypeStyle): string {
  if (style === 'dashed') return 'Dash'
  if (style === 'dotted') return 'Dot'
  if (style === 'dash-dot-dot') return 'DashDotDot'
  return 'Solid'
}
