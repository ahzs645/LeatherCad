import type { Viewport } from '../cad/cad-types'
import { MAX_ZOOM, MIN_ZOOM } from '../editor-constants'
import type { InterfacePreferences } from './interface-preferences'

export type NavigationWheel = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey'>
/** Device detection is deliberately limited to Auto. Users can choose Pan or
 * Zoom for hardware whose browser reports indistinguishable wheel deltas. */
export function wheelLooksLikeTrackpad(event: NavigationWheel) {
  return event.deltaMode === 0 && (event.deltaX !== 0 || Math.abs(event.deltaY) < 50 || !Number.isInteger(event.deltaY))
}
export function navigateWithWheel(previous: Viewport, event: NavigationWheel, prefs: Pick<InterfacePreferences, 'wheelMode' | 'trackpadSensitivity'>, anchor: { x: number; y: number; height: number }, reverseZoom = false): Viewport {
  if (!Number.isFinite(event.deltaX) || !Number.isFinite(event.deltaY)) return previous
  const pixels = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? anchor.height : 1
  const dx = event.deltaX * pixels * prefs.trackpadSensitivity
  const dy = event.deltaY * pixels * prefs.trackpadSensitivity
  if (dx === 0 && dy === 0) return previous
  const forceZoom = event.ctrlKey || event.metaKey
  const pan = !forceZoom && (prefs.wheelMode === 'pan' || (prefs.wheelMode === 'auto' && wheelLooksLikeTrackpad(event)))
  if (pan) return { ...previous, x: previous.x - dx, y: previous.y - dy }
  const delta = dy || dx
  const strength = forceZoom ? 0.01 : 0.002
  const exponent = Math.min(0.7, Math.max(-0.7, -delta * strength * (reverseZoom ? -1 : 1)))
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, previous.scale * Math.exp(exponent)))
  const worldX = (anchor.x - previous.x) / previous.scale
  const worldY = (anchor.y - previous.y) / previous.scale
  return { x: anchor.x - worldX * scale, y: anchor.y - worldY * scale, scale }
}
