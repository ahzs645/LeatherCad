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

const BASE_LINE_TYPES: LineType[] = [
  {
    id: CUT_LINE_TYPE_ID,
    name: '1 - Cyan Solid',
    role: 'cut',
    style: 'solid',
    color: '#22d3ee',
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
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
  {
    id: STITCH_PINK_DASHED_LINE_TYPE_ID,
    name: '0 - Pink Dashed',
    role: 'stitch',
    style: 'dashed',
    color: '#f9a8d4',
    visible: true,
    strokeWidthMm: DEFAULT_LINE_TYPE_STROKE_WIDTH_MM,
    ignoreInPrint: false,
  },
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
