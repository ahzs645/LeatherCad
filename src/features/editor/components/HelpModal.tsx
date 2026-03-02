type HelpModalProps = {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }}
      role="presentation"
    >
      <div
        className="help-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        <div className="line-type-modal-header">
          <h2 id="help-modal-title">Help</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <ul className="help-list">
          <li>Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Cmd/Ctrl+C/X/V clipboard, Delete removes selection.</li>
          <li>Mobile: use 2D / 3D / Split buttons to focus workspace.</li>
        </ul>
      </div>
    </div>
  )
}
