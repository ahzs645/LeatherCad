import { useEffect, useRef } from 'react'

type ProjectMemoModalProps = {
  open: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
}

export function ProjectMemoModal({ open, onClose, value, onChange }: ProjectMemoModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    textareaRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-memo-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Project memo"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="project-memo-modal-header">
          <h2>Project Memo</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="project-memo-label" htmlFor="project-memo-modal-input">
          Notes
        </label>
        <textarea
          ref={textareaRef}
          id="project-memo-modal-input"
          className="project-memo-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Global project notes for this pattern..."
        />
      </section>
    </div>
  )
}
