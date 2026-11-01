/** Event the selection-geometry fields listen for; a listener calls preventDefault when it took focus. */
export const FOCUS_SELECTION_GEOMETRY_EVENT = 'leathercad:focus-selection-geometry'

function dispatchFocus() {
  return !window.dispatchEvent(new CustomEvent(FOCUS_SELECTION_GEOMETRY_EVENT, { cancelable: true }))
}

/**
 * Focus the numeric size/position fields (Enter with a selection, or the tool
 * bar's "Size & position"). Opens the inspector on its Inspect tab first when
 * the fields are not mounted, then retries while the lazy panel loads.
 */
export function requestSelectionGeometryFocus() {
  if (typeof window === 'undefined' || dispatchFocus()) return
  document.querySelector<HTMLButtonElement>('[data-testid="workbench-inspector-show"]')?.click()
  document.querySelector<HTMLButtonElement>('[data-testid="inspector-tab-inspect"]')?.click()
  let attempts = 0
  const retry = () => {
    attempts += 1
    if (dispatchFocus() || attempts >= 15) return
    window.setTimeout(retry, 80)
  }
  window.setTimeout(retry, 0)
}
