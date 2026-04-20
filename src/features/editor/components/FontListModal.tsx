import { useState } from 'react'

type FontListModalProps = {
  open: boolean
  fonts: string[]
  onAdd: (fontFamily: string) => void
  onRemove: (fontFamily: string) => void
  onSelect: (fontFamily: string) => void
  onClose: () => void
}

export function FontListModal({
  open,
  fonts,
  onAdd,
  onRemove,
  onSelect,
  onClose,
}: FontListModalProps) {
  const [draft, setDraft] = useState('')

  if (!open) {
    return null
  }

  const handleAdd = () => {
    const value = draft.trim()
    if (!value) return
    onAdd(value)
    setDraft('')
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Edit font list">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Edit Font List</h3>
        <p>
          Add CSS font-family names (e.g. <code>Helvetica, sans-serif</code>). The list is
          persisted per-browser and shown in text-tool font pickers.
        </p>

        <label className="field-row">
          <span>New font family</span>
          <input
            type="text"
            value={draft}
            placeholder="Helvetica, sans-serif"
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAdd()
              }
            }}
          />
        </label>
        <div className="modal-actions">
          <button onClick={handleAdd} disabled={!draft.trim()}>Add</button>
        </div>

        <ul className="help-list">
          {fonts.length === 0 ? <li>No fonts added yet.</li> : null}
          {fonts.map((font) => (
            <li key={font} style={{ fontFamily: font }}>
              {font}{' '}
              <button onClick={() => onSelect(font)}>Use</button>{' '}
              <button onClick={() => onRemove(font)}>Remove</button>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
