import type { LineType, LineTypeRole, LineTypeStyle } from './cad-types'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const MIN_LINE_TYPE_STROKE_WIDTH_MM = 0.1
const MAX_LINE_TYPE_STROKE_WIDTH_MM = 20

export const CUT_LINE_TYPE_ID = 'type-cut'
export const STITCH_LINE_TYPE_ID = 'type-stitch'
export const FOLD_LINE_TYPE_ID = 'type-fold'
export const GUIDE_LINE_TYPE_ID = 'type-guide'
export const MARK_LINE_TYPE_ID = 'type-mark'
export const STITCH_WHITE_DASH_DOT_DOT_LINE_TYPE_ID = 'type-stitch-white-dash-dot-dot'
export const STITCH_GRAY_DOTTED_LINE_TYPE_ID = 'type-stitch-gray-dotted'
export const STITCH_ORANGE_SOLID_LINE_TYPE_ID = 'type-stitch-orange-solid'
export const STITCH_RED_DASHED_LINE_TYPE_ID = 'type-stitch-red-dashed'
export const STITCH_PINK_DASHED_LINE_TYPE_ID = 'type-stitch-pink-dashed'

export const DEFAULT_ACTIVE_LINE_TYPE_ID = CUT_LINE_TYPE_ID
export const DEFAULT_LINE_TYPE_STROKE_WIDTH_MM = 0.8

// Source-app v2.0.7 expanded the palette from 10 to 40 slots. Indices 1–10 keep their
// historical labels; 11–40 are generic role-cut/style-solid placeholders that the user
// can rename/recolor like the originals.
export const LINE_TYPE_PALETTE_SLOT_COUNT = 40

function extraLineTypeId(slot: number) {
  return `type-extra-${String(slot).padStart(2, '0')}`
}

const EXTRA_PALETTE_HUES = [
  '#34d399',
  '#60a5fa',
  '#a78bfa',
  '#fb7185',
  '#facc15',
  '#fbbf24',
  '#4ade80',
  '#38bdf8',
  '#c084fc',
  '#f472b6',
  '#fda4af',
  '#fcd34d',
  '#86efac',
  '#7dd3fc',
  '#a5b4fc',
  '#fda4af',
  '#fde68a',
  '#bbf7d0',
  '#bae6fd',
  '#c4b5fd',
  '#f5d0fe',
  '#fed7aa',
  '#fef08a',
  '#bef264',
  '#67e8f9',
  '#93c5fd',
  '#d8b4fe',
  '#f0abfc',
  '#fb923c',
  '#fcd34d',
]

function buildExtraLineTypes(): LineType[] {
  const extras: LineType[] = []
  for (let slot = 11; slot <= LINE_TYPE_PALETTE_SLOT_COUNT; slot += 1) {
    const color = EXTRA_PALETTE_HUES[(slot - 11) % EXTRA_PALETTE_HUES.length]
    extras.push({
      id: extraLineTypeId(slot),
      name: `${slot} - Custom`,
      role: 'cut',
      style: 'solid',
      color,
      visible: true,
      strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
      ignoreInPrint: false,
    })
  }
  return extras
}

const BASE_LINE_TYPES: LineType[] = [
  {
    id: CUT_LINE_TYPE_ID,
    name: '1 - Cyan Solid',
    role: 'cut',
    style: 'solid',
    color: '#22d3ee',
    colorLight: '#0e7490',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: STITCH_LINE_TYPE_ID,
    name: '2 - Green Solid',
    role: 'stitch',
    style: 'solid',
    color: '#22c55e',
    colorLight: '#15803d',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: FOLD_LINE_TYPE_ID,
    name: '3 - White Solid',
    role: 'fold',
    style: 'solid',
    color: '#f8fafc',
    colorLight: '#1f1b16',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: GUIDE_LINE_TYPE_ID,
    name: '4 - Yellow Dashed',
    role: 'guide',
    style: 'dashed',
    color: '#eab308',
    colorLight: '#a16207',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: MARK_LINE_TYPE_ID,
    name: '5 - Magenta Dotted',
    role: 'mark',
    style: 'dotted',
    color: '#d946ef',
    colorLight: '#a21caf',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: STITCH_WHITE_DASH_DOT_DOT_LINE_TYPE_ID,
    name: '6 - White Dash Dot Dot',
    role: 'stitch',
    style: 'dash-dot-dot',
    color: '#f8fafc',
    colorLight: '#1f1b16',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: STITCH_GRAY_DOTTED_LINE_TYPE_ID,
    name: '7 - Gray Dotted',
    role: 'stitch',
    style: 'dotted',
    color: '#d4d4d8',
    colorLight: '#52525b',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: STITCH_ORANGE_SOLID_LINE_TYPE_ID,
    name: '8 - Orange Solid',
    role: 'stitch',
    style: 'solid',
    color: '#f59e0b',
    colorLight: '#c2410c',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: STITCH_RED_DASHED_LINE_TYPE_ID,
    name: '9 - Red Dashed',
    role: 'stitch',
    style: 'dashed',
    color: '#ef4444',
    colorLight: '#b91c1c',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: STITCH_PINK_DASHED_LINE_TYPE_ID,
    name: '10 - Pink Dashed',
    role: 'stitch',
    style: 'dashed',
    color: '#f9a8d4',
    colorLight: '#be185d',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  ...buildExtraLineTypes(),
]

function cloneLineType(lineType: LineType): LineType {
  return normalizeLineTypeDefaults(lineType)
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback
  }

  const candidate = value.trim()
  if (HEX_COLOR_PATTERN.test(candidate)) {
    return candidate.toLowerCase()
  }

  return fallback
}

function isLineTypeRole(value: unknown): value is LineTypeRole {
  return value === 'cut' || value === 'stitch' || value === 'fold' || value === 'guide' || value === 'mark'
}

function isLineTypeStyle(value: unknown): value is LineTypeStyle {
  return value === 'solid' || value === 'dashed' || value === 'dotted' || value === 'dash-dot-dot'
}

function fallbackLineTypeAt(index: number) {
  return BASE_LINE_TYPES[Math.min(index, BASE_LINE_TYPES.length - 1)]
}

export function resolveLineTypeStrokeWidthMm(lineType: Pick<LineType, 'strokeWidthMm'> | undefined) {
  const candidate = lineType?.strokeWidthMm
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
    return DEFAULT_LINE_TYPE_STROKE_WIDTH_MM
  }
  return Math.min(MAX_LINE_TYPE_STROKE_WIDTH_MM, Math.max(MIN_LINE_TYPE_STROKE_WIDTH_MM, candidate))
}

export function shouldIgnoreLineTypeInPrint(lineType: Pick<LineType, 'ignoreInPrint'> | undefined) {
  return lineType?.ignoreInPrint === true
}

export function normalizeLineTypeDefaults(lineType: LineType): LineType {
  return {
    ...lineType,
    strokeWidthMm: resolveLineTypeStrokeWidthMm(lineType),
    ignoreInPrint: shouldIgnoreLineTypeInPrint(lineType),
  }
}

export function createDefaultLineTypes() {
  return BASE_LINE_TYPES.map(cloneLineType)
}

export function parseLineType(value: unknown, index: number): LineType | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const fallback = fallbackLineTypeAt(index)
  const candidate = value as {
    id?: unknown
    name?: unknown
    role?: unknown
    style?: unknown
    color?: unknown
    colorLight?: unknown
    visible?: unknown
    strokeWidthMm?: unknown
    ignoreInPrint?: unknown
  }

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }

  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : fallback.name,
    role: isLineTypeRole(candidate.role) ? candidate.role : fallback.role,
    style: isLineTypeStyle(candidate.style) ? candidate.style : fallback.style,
    color: normalizeHexColor(candidate.color, fallback.color),
    ...(typeof candidate.colorLight === 'string' && HEX_COLOR_PATTERN.test(candidate.colorLight.trim())
      ? { colorLight: candidate.colorLight.trim().toLowerCase() }
      : {}),
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    strokeWidthMm: resolveLineTypeStrokeWidthMm(
      typeof candidate.strokeWidthMm === 'number' ? { strokeWidthMm: candidate.strokeWidthMm } : fallback,
    ),
    ignoreInPrint:
      typeof candidate.ignoreInPrint === 'boolean'
        ? candidate.ignoreInPrint
        : shouldIgnoreLineTypeInPrint(fallback),
  }
}

export function normalizeLineTypes(candidates: LineType[]) {
  const seen = new Set<string>()
  const result: LineType[] = []

  for (const lineType of candidates) {
    if (seen.has(lineType.id)) {
      continue
    }
    seen.add(lineType.id)
    result.push(cloneLineType(lineType))
  }

  if (result.length === 0) {
    return createDefaultLineTypes()
  }

  return result
}

export function resolveActiveLineTypeId(lineTypes: LineType[], preferredId: unknown) {
  if (typeof preferredId === 'string' && lineTypes.some((lineType) => lineType.id === preferredId)) {
    return preferredId
  }
  return lineTypes[0]?.id ?? DEFAULT_ACTIVE_LINE_TYPE_ID
}

export function resolveShapeLineTypeId(
  lineTypes: LineType[],
  preferredId: unknown,
  fallbackId = DEFAULT_ACTIVE_LINE_TYPE_ID,
) {
  if (typeof preferredId === 'string' && lineTypes.some((lineType) => lineType.id === preferredId)) {
    return preferredId
  }
  if (lineTypes.some((lineType) => lineType.id === fallbackId)) {
    return fallbackId
  }
  return lineTypes[0]?.id ?? DEFAULT_ACTIVE_LINE_TYPE_ID
}

export function lineTypeStrokeDasharray(style: LineTypeStyle) {
  if (style === 'dash-dot-dot') {
    return '12 5 2 5 2 5'
  }
  if (style === 'dashed') {
    return '10 6'
  }
  if (style === 'dotted') {
    return '2 6'
  }
  return undefined
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const digits = match[1].length === 3 ? match[1].split('').map((digit) => digit + digit).join('') : match[1]
  return [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16)) as [number, number, number]
}

function rgbToHex(rgb: [number, number, number]) {
  return `#${rgb.map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0')).join('')}`
}

const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)

/** WCAG relative luminance of a hex colour (0 black – 1 white). */
export function relativeLuminance(color: string) {
  const rgb = hexToRgb(color)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((channel) => toLinear(channel / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Luminance at or below which a stroke already reads on the light surface. */
const LIGHT_SURFACE_MAX_LUMINANCE = 0.3
/** Luminance a pale stroke is darkened to. */
const LIGHT_SURFACE_TARGET_LUMINANCE = 0.1

/**
 * A stroke colour that reads on a light drawing surface, for colours chosen for
 * the dark one. Near-white and pale strokes are pulled down to a dark ink of the
 * same hue (white becomes near-black); colours that already contrast stay as
 * they are.
 */
export function adaptStrokeColorForLightSurface(color: string) {
  const rgb = hexToRgb(color)
  if (!rgb) return color
  const luminance = relativeLuminance(color)
  if (luminance <= LIGHT_SURFACE_MAX_LUMINANCE) return color
  const max = Math.max(...rgb), min = Math.min(...rgb)
  if (max - min < 40) return '#1f1b16'
  // Luminance scales roughly with the 2.2 power of a uniform channel scale.
  const factor = (LIGHT_SURFACE_TARGET_LUMINANCE / luminance) ** (1 / 2.2)
  return rgbToHex([rgb[0] * factor, rgb[1] * factor, rgb[2] * factor])
}

/** The colour a line type draws with on the given drawing surface. */
export function lineTypeColorForSurface(lineType: Pick<LineType, 'color' | 'colorLight'>, surface: 'light' | 'dark') {
  if (surface === 'dark') return lineType.color
  return lineType.colorLight ?? adaptStrokeColorForLightSurface(lineType.color)
}
