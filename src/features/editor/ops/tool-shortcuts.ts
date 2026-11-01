import type { Tool } from '../cad/cad-types'

/**
 * Single-key tool shortcuts. Letters follow the Leathercraft CAD web editor
 * where both apps share a tool (A select, L line, R rectangle, E circle,
 * Shift+E ellipse, V arc, B Bézier, T text, P stitch, # dimension); the
 * LeatherCad-only tools use free letters.
 */
type ToolShortcut = { key: string; shift: boolean; tool: Tool }

export const TOOL_SHORTCUTS: readonly ToolShortcut[] = [
  { key: 'a', shift: false, tool: 'pan' },
  { key: 'l', shift: false, tool: 'line' },
  { key: 'l', shift: true, tool: 'polyline' },
  { key: 'r', shift: false, tool: 'rectangle' },
  { key: 'e', shift: false, tool: 'circle' },
  { key: 'e', shift: true, tool: 'ellipse' },
  { key: 'v', shift: false, tool: 'arc' },
  { key: 'b', shift: false, tool: 'bezier' },
  { key: 'b', shift: true, tool: 'cubic' },
  { key: 'f', shift: false, tool: 'fold' },
  { key: 'f', shift: true, tool: 'freehand' },
  { key: 'p', shift: false, tool: 'stitch-hole' },
  { key: 'h', shift: false, tool: 'hardware' },
  { key: 'w', shift: false, tool: 'seam' },
  { key: 'w', shift: true, tool: 'seam-multi' },
  { key: 'u', shift: false, tool: 'piece-notch' },
  { key: 't', shift: false, tool: 'text' },
  { key: 'c', shift: false, tool: 'cut-line' },
  { key: '#', shift: true, tool: 'dimension' },
]

export function toolForKey(key: string, shiftKey: boolean): Tool | null {
  if (key === '#') return 'dimension'
  const lower = key.length === 1 ? key.toLowerCase() : ''
  if (!lower) return null
  const match = TOOL_SHORTCUTS.find(entry => entry.key === lower && entry.shift === shiftKey && entry.key !== '#')
  return match?.tool ?? null
}

export function toolShortcutLabel(tool: Tool): string | null {
  const entry = TOOL_SHORTCUTS.find(item => item.tool === tool)
  if (!entry) return null
  if (entry.key === '#') return '#'
  return entry.shift ? `Shift+${entry.key.toUpperCase()}` : entry.key.toUpperCase()
}

/** Short next-step guidance shown while a tool is idle (before the first click). */
export const TOOL_IDLE_HINTS: Record<Tool, string> = {
  pan: 'Click to select, drag a box to select several',
  line: 'Click the start point',
  polyline: 'Click the first point',
  rectangle: 'Click the first corner',
  circle: 'Click the centre',
  ellipse: 'Click the centre',
  arc: 'Click the start point',
  bezier: 'Click the start point',
  cubic: 'Click the start point',
  fold: 'Click the start of the fold line',
  'stitch-hole': 'Click to place a stitch hole',
  hardware: 'Click to place hardware',
  seam: 'Click the first seam edge',
  'seam-multi': 'Click the first seam edge',
  'piece-notch': 'Click a piece edge to place a notch',
  text: 'Click where the text goes',
  freehand: 'Drag to draw',
  'cut-line': 'Click the start point',
  dimension: 'Click the first point',
}
