import { useEffect, useRef } from 'react'

export type ContextMenuItem = {
  id: string
  label: string
  disabled?: boolean
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
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || items.length === 0) return null

  return (
    <div
      ref={rootRef}
      role="menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        background: 'var(--panel-bg, #0f172a)',
        color: 'var(--panel-fg, #e2e8f0)',
        border: '1px solid var(--panel-border, rgba(148, 163, 184, 0.3))',
        borderRadius: 6,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
        padding: 4,
        minWidth: 180,
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '6px 10px',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? 0.5 : 1,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
