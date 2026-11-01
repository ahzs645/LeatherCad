import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'

export type ContextMenuItem = {
  id: string
  label: string
  disabled?: boolean
  /** Items with the same group render together; a separator divides groups. */
  group?: string
  shortcut?: string
  /** Also offered as a button in the tool options bar while selecting. */
  bar?: boolean
  onSelect: () => void
}

type CanvasContextMenuProps = {
  open: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function CanvasContextMenu({ open, x, y, items, onClose }: CanvasContextMenuProps) {
  const t = useTranslate()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // Keep the menu on screen and move focus into it for keyboard use.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!open || !root) return
    const rect = root.getBoundingClientRect()
    const left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))
    const top = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))
    if (left !== position.left || top !== position.top) setPosition({ left, top })
    root.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true })
  }, [open, x, y, position.left, position.top])

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
      const buttons = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [])]
      if (buttons.length === 0) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? buttons.length - 1
          : event.key === 'ArrowDown' ? (current + 1) % buttons.length
            : (current - 1 + buttons.length) % buttons.length
      buttons[next].focus()
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose])

  if (!open || items.length === 0) return null

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label={t('Shape actions')}
      className="canvas-context-menu"
      style={{ left: position.left, top: position.top }}
    >
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 && item.group !== items[index - 1].group && <div role="separator" className="canvas-context-menu-separator" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
          >
            <span>{t(item.label)}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
