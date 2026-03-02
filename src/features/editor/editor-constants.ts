import type { HardwareKind, SnapSettings, Tool } from './cad/cad-types'
import type { DesktopRibbonTab, ExportRoleFilters, MobileOptionsTab } from './editor-types'

export const GRID_STEP = 100
export const GRID_EXTENT = 4000
export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 6
export const MOBILE_MEDIA_QUERY = '(max-width: 1100px)'
export const DEFAULT_FRONT_LAYER_COLOR = '#60a5fa'
export const DEFAULT_BACK_LAYER_COLOR = '#f97316'
export const STITCH_COLOR_DARK = '#f59e0b'
export const STITCH_COLOR_LIGHT = '#b45309'
export const FOLD_COLOR_DARK = '#ef4444'
export const FOLD_COLOR_LIGHT = '#dc2626'
export const DEFAULT_SEAM_ALLOWANCE_MM = 4
export const SUB_SKETCH_COPY_OFFSET_MM = 18

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enabled: true,
  grid: true,
  gridStep: 10,
  endpoints: true,
  midpoints: true,
  guides: true,
  hardware: true,
}

export const HARDWARE_PRESETS: Record<Exclude<HardwareKind, 'custom'>, { label: string; holeDiameterMm: number; spacingMm: number }> = {
  snap: { label: 'Snap', holeDiameterMm: 4, spacingMm: 0 },
  rivet: { label: 'Rivet', holeDiameterMm: 3, spacingMm: 0 },
  buckle: { label: 'Buckle', holeDiameterMm: 5, spacingMm: 18 },
}

export const DEFAULT_EXPORT_ROLE_FILTERS: ExportRoleFilters = {
  cut: true,
  stitch: true,
  fold: true,
  guide: true,
  mark: true,
}

export const HISTORY_LIMIT = 120
export const CLIPBOARD_PASTE_OFFSET = 12

export const TOOL_OPTIONS: Array<{ value: Tool; label: string }> = [
  { value: 'pan', label: 'Move' },
  { value: 'line', label: 'Line' },
  { value: 'arc', label: 'Arc' },
  { value: 'bezier', label: 'Bezier' },
  { value: 'fold', label: 'Fold' },
  { value: 'stitch-hole', label: 'Stitch Hole' },
  { value: 'hardware', label: 'Hardware' },
]

export const MOBILE_OPTIONS_TABS: Array<{ value: MobileOptionsTab; label: string }> = [
  { value: 'view', label: 'View' },
  { value: 'layers', label: 'Layers' },
  { value: 'file', label: 'File' },
]

export const DESKTOP_RIBBON_TABS: Array<{ value: DesktopRibbonTab; label: string }> = [
  { value: 'build', label: 'Build' },
  { value: 'edit', label: 'Edit' },
  { value: 'stitch', label: 'Stitch' },
  { value: 'layers', label: 'Layers' },
  { value: 'output', label: 'Output' },
  { value: 'view', label: 'View' },
]
