import { useState } from 'react'

type FontListModalProps = {
  open: boolean
  fonts: string[]
  onAdd: (fontFamily: string) => void
  onRemove: (fontFamily: string) => void
  onRename: (oldFontFamily: string, newFontFamily: string) => void
  onDuplicate: (fontFamily: string) => void
  onImport: (raw: string) => void
  onExport: () => string
  onSelect: (fontFamily: string) => void
  onClose: () => void
}

export function FontListModal({
  open,
  fonts,
  onAdd,
  onRemove,
  onRename,
  onDuplicate,
  onImport,
  onExport,
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

  const handleExport = () => {
    const blob = new Blob([onExport()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'leathercad-font-list.json'
    link.click()
    URL.revokeObjectURL(url)
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
          <button onClick={handleExport}>Export</button>
          <label className="button-like">
            Import
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void file.text().then(onImport)
              }}
            />
          </label>
        </div>

        <ul className="help-list">
          {fonts.length === 0 ? <li>No fonts added yet.</li> : null}
          {fonts.map((font) => (
            <li key={font} style={{ fontFamily: font }}>
              {font}{' '}
              <button onClick={() => onSelect(font)}>Use</button>{' '}
              <button
                onClick={() => {
                  const next = window.prompt('Font family', font)
                  if (next) onRename(font, next)
                }}
              >
                Rename
              </button>{' '}
              <button onClick={() => onDuplicate(font)}>Duplicate</button>{' '}
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
