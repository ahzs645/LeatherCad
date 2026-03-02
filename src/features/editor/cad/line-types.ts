import type { LineType, LineTypeRole, LineTypeStyle } from './cad-types'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

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

const BASE_LINE_TYPES: LineType[] = [
  {
    id: CUT_LINE_TYPE_ID,
    name: '1 - Cyan Solid',
    role: 'cut',
    style: 'solid',
    color: '#22d3ee',
    visible: true,
  },
  {
    id: STITCH_LINE_TYPE_ID,
    name: '2 - Green Solid',
    role: 'stitch',
    style: 'solid',
    color: '#22c55e',
    visible: true,
  },
  {
    id: FOLD_LINE_TYPE_ID,
    name: '3 - White Solid',
    role: 'fold',
    style: 'solid',
    color: '#f8fafc',
    visible: true,
  },
  {
    id: GUIDE_LINE_TYPE_ID,
    name: '4 - Yellow Dashed',
    role: 'guide',
    style: 'dashed',
    color: '#eab308',
    visible: true,
  },
  {
    id: MARK_LINE_TYPE_ID,
    name: '5 - Magenta Dotted',
    role: 'mark',
    style: 'dotted',
    color: '#d946ef',
    visible: true,
  },
  {
    id: STITCH_WHITE_DASH_DOT_DOT_LINE_TYPE_ID,
    name: '6 - White Dash Dot Dot',
    role: 'stitch',
    style: 'dash-dot-dot',
    color: '#f8fafc',
    visible: true,
  },
  {
    id: STITCH_GRAY_DOTTED_LINE_TYPE_ID,
    name: '7 - Gray Dotted',
    role: 'stitch',
    style: 'dotted',
    color: '#d4d4d8',
    visible: true,
  },
  {
    id: STITCH_ORANGE_SOLID_LINE_TYPE_ID,
    name: '8 - Orange Solid',
    role: 'stitch',
    style: 'solid',
    color: '#f59e0b',
    visible: true,
  },
  {
    id: STITCH_RED_DASHED_LINE_TYPE_ID,
    name: '9 - Red Dashed',
    role: 'stitch',
    style: 'dashed',
    color: '#ef4444',
    visible: true,
  },
  {
    id: STITCH_PINK_DASHED_LINE_TYPE_ID,
    name: '0 - Pink Dashed',
    role: 'stitch',
    style: 'dashed',
    color: '#f9a8d4',
    visible: true,
  },
]

function cloneLineType(lineType: LineType): LineType {
  return { ...lineType }
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
