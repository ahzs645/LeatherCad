import { useSyncExternalStore } from 'react'
import { safeLocalStorageGet, safeLocalStorageSet } from '../ops/safe-storage'
import type { DockLayoutState, WorkspaceMode, WorkbenchRibbonTab } from './workbench-types'

const KEY = 'leathercad.workspace-preset.v1'
const EVENT = 'leathercad-workspace-preset-change'
export type WorkspacePresetId = 'custom' | 'drafting' | 'assembly' | 'printing' | 'canvas'
export const WORKSPACE_PRESETS: Record<Exclude<WorkspacePresetId, 'custom'>, { label: string; mode: WorkspaceMode; ribbon: WorkbenchRibbonTab; layout: DockLayoutState }> = {
  drafting: { label: 'Drafting', mode: '2d', ribbon: 'draft', layout: { browserWidth: 240, inspectorWidth: 320, peekWidth: 320, splitWidth: null, inspectorOpen: true, activeInspectorTab: 'inspect' } },
  assembly: { label: 'Assembly', mode: 'both', ribbon: 'piece', layout: { browserWidth: 240, inspectorWidth: 340, peekWidth: 360, splitWidth: null, inspectorOpen: true, activeInspectorTab: 'preview3d' } },
  printing: { label: 'Printing', mode: '2d', ribbon: 'output', layout: { browserWidth: 220, inspectorWidth: 340, peekWidth: 320, splitWidth: null, inspectorOpen: true, activeInspectorTab: 'document' } },
  canvas: { label: 'Canvas first', mode: '2d', ribbon: 'draft', layout: { browserWidth: 220, inspectorWidth: 320, peekWidth: 320, splitWidth: null, inspectorOpen: false, activeInspectorTab: 'inspect' } },
}
export function getWorkspacePreset(): WorkspacePresetId {
  const stored = safeLocalStorageGet(KEY)
  return stored && Object.hasOwn(WORKSPACE_PRESETS, stored) ? stored as WorkspacePresetId : 'custom'
}
export function selectWorkspacePreset(preset: WorkspacePresetId) {
  if (preset !== 'custom' && !Object.hasOwn(WORKSPACE_PRESETS, preset)) return
  safeLocalStorageSet(KEY, preset)
  window.dispatchEvent(new Event(EVENT))
}
export function subscribeWorkspacePreset(listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) listener() }
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('storage', onStorage) }
}
export function useWorkspacePreset() {
  return useSyncExternalStore(subscribeWorkspacePreset, getWorkspacePreset, () => 'custom' as const)
}
