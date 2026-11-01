/** Window event asking the 2D canvas to change its view (detail: 'reset' | 'fit'). */
export const CANVAS_VIEW_EVENT = 'leathercad:view'

export function requestCanvasView(action: 'reset' | 'fit') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CANVAS_VIEW_EVENT, { detail: action }))
}
