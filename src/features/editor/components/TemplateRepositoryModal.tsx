import { useState } from 'react'
import type { TemplateRepositoryEntry } from '../templates/template-repository'
import { getCatalogItemCount, type CatalogRepositoryShop } from '../templates/catalog-repository'

type TemplateRepositoryTab = 'templates' | 'catalog'

type TemplateRepositoryModalProps = {
  open: boolean
  onClose: () => void
  templateRepository: TemplateRepositoryEntry[]
  catalogRepository: CatalogRepositoryShop[]
  selectedTemplateEntryId: string | null
  selectedTemplateEntry: TemplateRepositoryEntry | null
  selectedCatalogShopId: string | null
  onSelectTemplateEntry: (entryId: string) => void
  onSelectCatalogShop: (shopId: string) => void
  onSaveTemplate: () => void
  onExportRepository: () => void
  onImportRepository: () => void
  onImportCatalog: () => void
  onLoadAsDocument: () => void
  onInsertIntoDocument: () => void
  onDeleteTemplate: (entryId: string) => void
  onDeleteCatalogShop: (shopId: string) => void
}

export function TemplateRepositoryModal({
  open,
  onClose,
  templateRepository,
  catalogRepository,
  selectedTemplateEntryId,
  selectedTemplateEntry,
  selectedCatalogShopId,
  onSelectTemplateEntry,
  onSelectCatalogShop,
  onSaveTemplate,
  onExportRepository,
  onImportRepository,
  onImportCatalog,
  onLoadAsDocument,
  onInsertIntoDocument,
  onDeleteTemplate,
  onDeleteCatalogShop,
}: TemplateRepositoryModalProps) {
  const [activeTab, setActiveTab] = useState<TemplateRepositoryTab>('templates')

  if (!open) {
    return null
  }

  const selectedCatalogShop = catalogRepository.find((shop) => shop.id === selectedCatalogShopId) ?? null

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
        <div className="template-repository-tabs" role="tablist" aria-label="Template repository tabs">
          <button
            className={activeTab === 'templates' ? 'active' : ''}
            role="tab"
            aria-selected={activeTab === 'templates'}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button
            className={activeTab === 'catalog' ? 'active' : ''}
            role="tab"
            aria-selected={activeTab === 'catalog'}
            onClick={() => setActiveTab('catalog')}
          >
            Catalog
          </button>
        </div>

        {activeTab === 'templates' ? (
          <>
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
          </>
        ) : (
          <>
            <h3 className="line-type-modal-subtitle">Leather Catalog (.ctlg)</h3>
            <div className="line-type-modal-actions">
              <button onClick={onImportCatalog}>Import Catalog</button>
              <button
                onClick={() => {
                  if (selectedCatalogShop) {
                    onDeleteCatalogShop(selectedCatalogShop.id)
                  }
                }}
                disabled={!selectedCatalogShop || selectedCatalogShop.isBundled}
              >
                Delete Catalog
              </button>
            </div>
            <div className="template-list">
              {catalogRepository.length === 0 ? (
                <p className="hint">No catalogs available yet.</p>
              ) : (
                catalogRepository.map((shop) => {
                  const itemCount = getCatalogItemCount(shop)
                  const groupCount = typeof shop.groupCount === 'number' ? shop.groupCount : shop.groups.length
                  return (
                    <label key={shop.id} className="template-item">
                      <input
                        type="radio"
                        name="catalog-shop"
                        checked={selectedCatalogShopId === shop.id}
                        onChange={() => onSelectCatalogShop(shop.id)}
                      />
                      <span className="template-item-name">{shop.name}</span>
                      <span className="template-item-meta">
                        {groupCount} groups, {itemCount} items
                        {shop.sourceFileName ? ` - ${shop.sourceFileName}` : ''}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
