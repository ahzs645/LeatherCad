import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

type ModalDialogFocusOptions<T extends HTMLElement> = {
  dialogRef: RefObject<T | null>
  open: boolean
  onClose: () => void
  closeOnEscape?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
}

const FOCUSABLE = 'button, [href], input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]'
let pendingRestore: { target: HTMLElement | null } | null = null

function isVisible(element: HTMLElement) {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

function visibleDialogs() {
  return [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(isVisible)
}

function focusableElements(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && isVisible(element))
}

/** Dialogs need tabIndex={-1}. Let this hook choose focus instead of autoFocus;
 * that preserves the launcher as a restoration target. */
export function useModalDialogFocus<T extends HTMLElement>({
  dialogRef, open, onClose, closeOnEscape = true, initialFocusRef,
}: ModalDialogFocusOptions<T>) {
  const behavior = useRef({ onClose, closeOnEscape, initialFocusRef })
  useLayoutEffect(() => {
    behavior.current = { onClose, closeOnEscape, initialFocusRef }
  }, [onClose, closeOnEscape, initialFocusRef])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previous = active && active !== document.body && !dialog.contains(active) ? active : pendingRestore?.target ?? null
    pendingRestore = null
    const isTopDialog = () => visibleDialogs().at(-1) === dialog
    const focusFirst = () => {
      const requested = behavior.current.initialFocusRef?.current
      const target = requested && dialog.contains(requested) && !requested.matches(':disabled') && isVisible(requested)
        ? requested : focusableElements(dialog)[0] ?? dialog
      target.focus()
    }
    if (isTopDialog()) focusFirst()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog()) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (behavior.current.closeOnEscape) behavior.current.onClose()
        return
      }
      if (event.key !== 'Tab') return
      const controls = focusableElements(dialog)
      const first = controls[0], last = controls.at(-1)
      if (!first || !last) { event.preventDefault(); dialog.focus(); return }
      const current = document.activeElement
      if (!controls.includes(current as HTMLElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && current === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault(); first.focus()
      }
    }
    const handleFocusIn = (event: FocusEvent) => {
      if (isTopDialog() && event.target instanceof Node && !dialog.contains(event.target)) focusFirst()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('focusin', handleFocusIn)
      const restoration = { target: previous }
      pendingRestore = restoration
      // A replacement dialog can mount in the same React commit. Restore only
      // after its effects, and never move focus behind a different open modal.
      queueMicrotask(() => {
        if (pendingRestore === restoration) pendingRestore = null
        if (!previous?.isConnected || previous.matches(':disabled')) return
        const nextDialog = visibleDialogs().at(-1)
        if (nextDialog && !nextDialog.contains(previous)) return
        previous.focus()
      })
    }
  }, [open, dialogRef])
}
