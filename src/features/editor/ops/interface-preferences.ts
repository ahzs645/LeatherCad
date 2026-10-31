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
}
const defaultOrder = DESKTOP_TOOL_ICON_ITEMS.map(item => item.value)
export const DEFAULT_INTERFACE_PREFERENCES: InterfacePreferences = {
  wheelMode: 'auto', trackpadSensitivity: 1, toolOrder: defaultOrder,
  toolLabels: false, displayUnit: 'mm', edgePickRadiusPx: 12, touchPickRadiusPx: 24,
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
