import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_INTERFACE_PREFERENCES, getInterfacePreferences, INTERFACE_PREFERENCES_KEY, normalizeInterfacePreferences, subscribeInterfacePreferences, updateInterfacePreferences } from './interface-preferences'
import { navigateWithWheel } from './wheel-navigation'
import { loadEditorPreferences, saveEditorPreferences } from './editor-prefs'
import { parseStitchAutoPitchSettings } from './stitch-auto-pitch-settings'

beforeEach(() => {
  localStorage.clear()
  updateInterfacePreferences(DEFAULT_INTERFACE_PREFERENCES)
})
describe('interface preferences and navigation', () => {
  it('keeps valid unique tool IDs and adds tools introduced by newer versions', () => {
    const normalized = normalizeInterfacePreferences({ toolOrder: ['line', 'line', 'deleted-tool'], trackpadSensitivity: 99, edgePickRadiusPx: Number.NaN })
    expect(normalized.toolOrder[0]).toBe('line')
    expect(new Set(normalized.toolOrder).size).toBe(DEFAULT_INTERFACE_PREFERENCES.toolOrder.length)
    expect(normalized.toolOrder).not.toContain('deleted-tool')
    expect(normalized.trackpadSensitivity).toBe(2)
    expect(normalized.edgePickRadiusPx).toBe(12)
  })
  it('persists input choices and observes changes from another browser tab', () => {
    const unsubscribe = subscribeInterfacePreferences(() => {})
    updateInterfacePreferences({ wheelMode: 'pan', displayUnit: 'in' })
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_KEY)!)).toMatchObject({ wheelMode: 'pan', displayUnit: 'in' })
    localStorage.setItem(INTERFACE_PREFERENCES_KEY, JSON.stringify({ wheelMode: 'zoom' }))
    window.dispatchEvent(new StorageEvent('storage', { key: INTERFACE_PREFERENCES_KEY }))
    expect(getInterfacePreferences().wheelMode).toBe('zoom')
    unsubscribe()
  })
  it('preserves unrelated preferences across successive partial changes', () => {
    saveEditorPreferences({ pinSideBar: true, notchDepthMm: 7 })
    saveEditorPreferences({ reverseZoomDirection: true })
    saveEditorPreferences({ notchDepthMm: 3 })
    expect(loadEditorPreferences()).toMatchObject({ pinSideBar: true, notchDepthMm: 3, reverseZoomDirection: true })
  })
  it('preserves the chosen even-count mode when preferences reload', () => {
    expect(parseStitchAutoPitchSettings({ defaultMode: 'set-num' })?.defaultMode).toBe('set-num')
  })
  const viewport = { x: 10, y: 20, scale: 2 }
  const anchor = { x: 110, y: 120, height: 600 }
  const event = { deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false, metaKey: false }
  it('uses two-axis pixel deltas for trackpad panning in Auto mode', () => {
    expect(navigateWithWheel(viewport, { ...event, deltaX: 7, deltaY: 12 }, DEFAULT_INTERFACE_PREFERENCES, anchor)).toEqual({ x: 3, y: 8, scale: 2 })
    expect(navigateWithWheel(viewport, event, DEFAULT_INTERFACE_PREFERENCES, anchor).scale).toBeLessThan(2)
  })
  it('anchors smooth reversible zoom without changing the world point under the cursor', () => {
    const prefs = { wheelMode: 'zoom' as const, trackpadSensitivity: 1 }
    const zoomed = navigateWithWheel(viewport, event, prefs, anchor)
    expect((anchor.x - zoomed.x) / zoomed.scale).toBeCloseTo(50)
    expect((anchor.y - zoomed.y) / zoomed.scale).toBeCloseTo(50)
    const restored = navigateWithWheel(zoomed, { ...event, deltaY: -100 }, prefs, anchor)
    expect(restored.x).toBeCloseTo(viewport.x)
    expect(restored.scale).toBeCloseTo(viewport.scale)
  })
  it('zooms for pinch/Ctrl even when Pan is selected; clamps extreme deltas', () => {
    const next = navigateWithWheel(viewport, { ...event, ctrlKey: true, deltaY: -1e9 }, { wheelMode: 'pan', trackpadSensitivity: 2 }, anchor)
    expect(next.scale).toBeGreaterThan(2)
    expect(next.scale).toBeLessThan(5)
    expect(navigateWithWheel(viewport, { ...event, deltaY: Number.NaN }, DEFAULT_INTERFACE_PREFERENCES, anchor)).toBe(viewport)
  })
  it('converts line/page wheel units and applies sensitivity to pan deltas', () => {
    expect(navigateWithWheel(viewport, { ...event, deltaMode: 1, deltaY: 2 }, { wheelMode: 'pan', trackpadSensitivity: 0.5 }, anchor).y).toBe(4)
    expect(navigateWithWheel(viewport, { ...event, deltaMode: 2, deltaY: 1 }, { wheelMode: 'pan', trackpadSensitivity: 1 }, anchor).y).toBe(-580)
  })
})
