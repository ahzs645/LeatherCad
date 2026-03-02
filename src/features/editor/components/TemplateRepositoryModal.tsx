import type { TemplateRepositoryEntry } from '../templates/template-repository'

type TemplateRepositoryModalProps = {
  open: boolean
  onClose: () => void
  templateRepository: TemplateRepositoryEntry[]
  selectedTemplateEntryId: string | null
  selectedTemplateEntry: TemplateRepositoryEntry | null
  onSelectTemplateEntry: (entryId: string) => void
  onSaveTemplate: () => void
  onExportRepository: () => void
  onImportRepository: () => void
  onLoadAsDocument: () => void
  onInsertIntoDocument: () => void
  onDeleteTemplate: (entryId: string) => void
}

export function TemplateRepositoryModal({
  open,
  onClose,
  templateRepository,
  selectedTemplateEntryId,
  selectedTemplateEntry,
  onSelectTemplateEntry,
  onSaveTemplate,
  onExportRepository,
  onImportRepository,
  onLoadAsDocument,
  onInsertIntoDocument,
  onDeleteTemplate,
}: TemplateRepositoryModalProps) {
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
      <div className="line-type-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="line-type-modal-header">
          <h2>Template Repository</h2>
          <button onClick={onClose}>Done</button>
        </div>
        <p className="hint">Save reusable patterns, import/export catalogs, or insert template pieces into the current document.</p>
        <div className="line-type-modal-actions">
          <button onClick={onSaveTemplate}>Save Current as Template</button>
          <button onClick={onExportRepository} disabled={templateRepository.length === 0}>
            Export Repository
          </button>
          <button onClick={onImportRepository}>Import Repository</button>
        </div>

        <div className="template-list">
          {templateRepository.length === 0 ? (
            <p className="hint">No templates saved yet.</p>
          ) : (
            templateRepository.map((entry) => (
              <label key={entry.id} className="template-item">
                <input
                  type="radio"
                  name="template-entry"
                  checked={selectedTemplateEntryId === entry.id}
                  onChange={() => onSelectTemplateEntry(entry.id)}
                />
                <span className="template-item-name">{entry.name}</span>
                <span className="template-item-meta">
                  {entry.doc.objects.length} shapes, {entry.doc.layers.length} layers
                </span>
              </label>
            ))
          )}
        </div>

        <div className="line-type-modal-actions">
          <button onClick={onLoadAsDocument} disabled={!selectedTemplateEntry}>
            Load as Document
          </button>
          <button onClick={onInsertIntoDocument} disabled={!selectedTemplateEntry}>
            Insert into Current
          </button>
          <button
            onClick={() => {
              if (selectedTemplateEntry) {
                onDeleteTemplate(selectedTemplateEntry.id)
              }
            }}
            disabled={!selectedTemplateEntry}
          >
            Delete Template
          </button>
        </div>
      </div>
    </div>
  )
}
