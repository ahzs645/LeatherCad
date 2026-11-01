import { useSyncExternalStore } from 'react'
import { DESKTOP_TOOL_ICON_ITEMS } from '../editor-constants'
import type { DisplayUnit } from './unit-ops'
import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

export const INTERFACE_PREFERENCES_KEY = 'leathercad.interface-preferences.v1'
export type WheelMode = 'auto' | 'zoom' | 'pan'
export type InterfacePreferences = {
  wheelMode: WheelMode
  trackpadSensitivity: number
  toolOrder: string[]
  toolLabels: boolean
  displayUnit: DisplayUnit
  edgePickRadiusPx: number
  touchPickRadiusPx: number
  /** Top/left edge rulers around the drafting surface. */
  edgeRulers: boolean
  /** Display-only: rulers and coordinate fields count Y upward. Shape data is unchanged. */
  invertYAxis: boolean
  /** Hint bubble with the active tool and its next step. */
  toolHints: boolean
  /** The first-run screen tour has been finished or dismissed. */
  tourCompleted: boolean
  /** Side of the canvas that holds the touch modifier pad, or hidden. */
  modifierPad: 'left' | 'right' | 'off'
  /**
   * Drafting surface: follows the app theme by default (dark theme gives the
   * reference editor's dark surface); light or dark force it. Stored under a new
   * name because the earlier field was written automatically, not chosen.
   */
  canvasSurface: 'theme' | 'light' | 'dark'
}
const defaultOrder = DESKTOP_TOOL_ICON_ITEMS.map(item => item.value)
export const DEFAULT_INTERFACE_PREFERENCES: InterfacePreferences = {
  wheelMode: 'auto', trackpadSensitivity: 1, toolOrder: defaultOrder,
  toolLabels: false, displayUnit: 'mm', edgePickRadiusPx: 12, touchPickRadiusPx: 24,
  edgeRulers: true, invertYAxis: false, toolHints: true, tourCompleted: false, modifierPad: 'left',
  canvasSurface: 'theme',
}
const listeners = new Set<() => void>()
let snapshot: InterfacePreferences | undefined
function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
export function normalizeInterfacePreferences(value: unknown): InterfacePreferences {
  const input = value && typeof value === 'object' ? value as Partial<InterfacePreferences> : {}
  const order = Array.isArray(input.toolOrder) ? input.toolOrder.filter((id): id is string => typeof id === 'string' && defaultOrder.includes(id as typeof defaultOrder[number])) : []
  return {
    wheelMode: input.wheelMode === 'zoom' || input.wheelMode === 'pan' ? input.wheelMode : 'auto',
    trackpadSensitivity: bounded(input.trackpadSensitivity, 1, 0.25, 2),
    toolOrder: [...new Set([...order, ...defaultOrder])],
    toolLabels: input.toolLabels === true,
    displayUnit: input.displayUnit === 'in' ? 'in' : 'mm',
    edgePickRadiusPx: bounded(input.edgePickRadiusPx, 12, 1, 40),
    touchPickRadiusPx: bounded(input.touchPickRadiusPx, 24, 1, 40),
    edgeRulers: input.edgeRulers !== false,
    invertYAxis: input.invertYAxis === true,
    toolHints: input.toolHints !== false,
    tourCompleted: input.tourCompleted === true,
    modifierPad: input.modifierPad === 'right' || input.modifierPad === 'off' ? input.modifierPad : 'left',
    canvasSurface: input.canvasSurface === 'light' || input.canvasSurface === 'dark' ? input.canvasSurface : 'theme',
  }
}
export function getInterfacePreferences() {
  if (!snapshot) {
    try { snapshot = normalizeInterfacePreferences(JSON.parse(safeLocalStorageGet(INTERFACE_PREFERENCES_KEY) ?? 'null')) }
    catch { snapshot = normalizeInterfacePreferences(null) }
  }
  return snapshot
}
function handleStorage(event: StorageEvent) {
  if (event.key !== INTERFACE_PREFERENCES_KEY && event.key !== null) return
  snapshot = undefined
  for (const listener of listeners) listener()
}
export function subscribeInterfacePreferences(listener: () => void) {
  if (!listeners.size && typeof window !== 'undefined') window.addEventListener('storage', handleStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size && typeof window !== 'undefined') window.removeEventListener('storage', handleStorage)
  }
}
export function updateInterfacePreferences(patch: Partial<InterfacePreferences>) {
  const next = normalizeInterfacePreferences({ ...getInterfacePreferences(), ...patch })
  if (JSON.stringify(next) === JSON.stringify(getInterfacePreferences())) return
  snapshot = next
  safeLocalStorageSet(INTERFACE_PREFERENCES_KEY, JSON.stringify(next))
  for (const listener of listeners) listener()
}
export function useInterfacePreferences() {
  return useSyncExternalStore(subscribeInterfacePreferences, getInterfacePreferences, getInterfacePreferences)
}
