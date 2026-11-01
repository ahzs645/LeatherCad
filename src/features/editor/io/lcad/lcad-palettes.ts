import type { LineTypeRole } from '../../cad/cad-types'

/**
 * The reference editor's default palette (slots p1–p40). Each slot has a stroke
 * colour for the dark surface and one for the light surface. Drawings that do
 * not carry their own `palettes` refer to these slots by id.
 */
export type LcadPaletteSlot = { colorDark: string; colorLight: string; strokeDash: string; name: string }

const slot = (colorDark: string, colorLight: string, strokeDash = 'solid', name = ''): LcadPaletteSlot => ({ colorDark, colorLight, strokeDash, name })

export const LCAD_DEFAULT_PALETTE: readonly LcadPaletteSlot[] = [
  slot('#00ffff', '#00008b'), slot('#00ff00', '#006400'), slot('#ffffff', '#000000'), slot('#ffff00', '#bdb76b', 'dashed'),
  slot('#ee82ee', '#9400d3', 'dotted'), slot('#a0a0a0', '#707070', 'dash-dot'), slot('#a0a0a0', '#707070', 'dash-dot-dot'), slot('#ffa500', '#ff8c00'),
  slot('#a52a2a', '#e9967a', 'dashed'), slot('#ffc0cb', '#8b008b', 'dashed'), slot('#ff0000', '#ff0000'), slot('#66aaee', '#2266aa'),
  slot('#ffcc88', '#8b4513'), slot('#f0d060', '#c8922a'), slot('#66dd88', '#228844'), slot('#ff7777', '#cc2222'),
  slot('#bb88ee', '#662299'), slot('#bbbb44', '#6b8e23'), slot('#7777cc', '#2c2c8a'), slot('#88e0b0', '#4a8a6e'),
  slot('#aaccff', '#3366aa'), slot('#ffbbcc', '#aa3366'), slot('#ccffcc', '#33aa33'), slot('#ffeeaa', '#aa8833'),
  slot('#ccccff', '#5555aa'), slot('#ffdddd', '#aa5555', 'dashed'), slot('#aaeeff', '#3388aa', 'dashed'), slot('#ddffaa', '#669933', 'dashed'),
  slot('#eeddff', '#9966cc', 'dashed'), slot('#ffddaa', '#cc8833', 'dashed'), slot('#888888', '#444444', 'dotted'), slot('#cc88cc', '#663366', 'dotted'),
  slot('#88cc88', '#336633', 'dotted'), slot('#bb9966', '#664422', 'dash-dot'), slot('#9999cc', '#444477', 'dash-dot-dot'), slot('#cc9999', '#774444', 'center'),
  slot('#ffffff', '#d2691e', 'dotted', 'stitch holes'), slot('#ee82ee', '#ee82ee', 'dashed', 'boundary'), slot('#ffffff', '#000000', 'solid', 'scale'), slot('#ff00ff', '#ff40ff', 'solid', 'offset (temporary)'),
]

/** 1-based slot number for a default palette id such as `p3`, or undefined. */
export function lcadPaletteSlotNumber(paletteId: string): number | undefined {
  const match = /^p(\d{1,2})$/.exec(paletteId)
  if (!match) return undefined
  const value = Number(match[1])
  return value >= 1 && value <= LCAD_DEFAULT_PALETTE.length ? value : undefined
}

/** Line-type name: the palette's own name, else the slot (`Palette 3`, `Palette 37 · stitch holes`). */
export function lcadPaletteName(paletteId: string, explicitName?: string): string {
  if (explicitName?.trim()) return explicitName.trim()
  const number = lcadPaletteSlotNumber(paletteId)
  const name = number ? LCAD_DEFAULT_PALETTE[number - 1].name : ''
  if (number) return name ? `Palette ${number} · ${name}` : `Palette ${number}`
  return name || (paletteId ? `Imported ${paletteId}` : 'Imported')
}

/**
 * Line-type role for imported strokes. The reference has no roles; solid
 * strokes are treated as cut lines and patterned strokes as guides, and stitch
 * holes anchor to a stitch line so they stay visible and editable.
 */
export function lcadRoleFor(shapeType: unknown, strokeDash: string): LineTypeRole {
  if (shapeType === 'stitch_hole' || shapeType === 'stitch') return 'stitch'
  if (shapeType === 'dimension' || shapeType === 'distance') return 'mark'
  if (shapeType === 'centerline') return 'guide'
  return strokeDash === 'solid' ? 'cut' : 'guide'
}

/**
 * The reference stores text height as the cap height in mm and renders the
 * font at `fontSize / ratio`. These are its per-family ratios.
 */
const CAP_HEIGHT_RATIOS: Record<string, number> = {
  osaka: 0.7813, 'hiragino maru gothic pron': 0.787, 'hiraginosans-w0': 0.782, 'hiragino sans': 0.782,
  'hiramarupron-w4': 0.787, arial: 0.7188, helvetica: 0.7021, 'segoe script': 0.6948, segoescript: 0.6948,
}
const DEFAULT_CAP_HEIGHT_RATIO = 0.72

export function lcadCapHeightRatio(fontFamily: unknown): number {
  const key = (typeof fontFamily === 'string' ? fontFamily : '').replace(/["\\]/g, '').trim().toLowerCase()
  return CAP_HEIGHT_RATIOS[key] ?? DEFAULT_CAP_HEIGHT_RATIO
}
