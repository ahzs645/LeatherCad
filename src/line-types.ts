import type { LineType, LineTypeRole, LineTypeStyle } from './cad-types'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export const CUT_LINE_TYPE_ID = 'type-cut'
export const STITCH_LINE_TYPE_ID = 'type-stitch'
export const FOLD_LINE_TYPE_ID = 'type-fold'
export const GUIDE_LINE_TYPE_ID = 'type-guide'
export const MARK_LINE_TYPE_ID = 'type-mark'

export const DEFAULT_ACTIVE_LINE_TYPE_ID = CUT_LINE_TYPE_ID

const BASE_LINE_TYPES: LineType[] = [
  {
    id: CUT_LINE_TYPE_ID,
    name: 'Cut',
    role: 'cut',
    style: 'solid',
    color: '#e2e8f0',
    visible: true,
  },
  {
    id: STITCH_LINE_TYPE_ID,
    name: 'Stitch',
    role: 'stitch',
    style: 'dotted',
    color: '#f59e0b',
    visible: true,
  },
  {
    id: FOLD_LINE_TYPE_ID,
    name: 'Fold Guide',
    role: 'fold',
    style: 'dashed',
    color: '#ef4444',
    visible: true,
  },
  {
    id: GUIDE_LINE_TYPE_ID,
    name: 'Guide',
    role: 'guide',
    style: 'dashed',
    color: '#22d3ee',
    visible: true,
  },
  {
    id: MARK_LINE_TYPE_ID,
    name: 'Mark',
    role: 'mark',
    style: 'dotted',
    color: '#a78bfa',
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
  return value === 'solid' || value === 'dashed' || value === 'dotted'
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
  if (style === 'dashed') {
    return '10 6'
  }
  if (style === 'dotted') {
    return '2 6'
  }
  return undefined
}

