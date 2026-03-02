import { useMemo, useState } from 'react'
import type { TemplateRepositoryEntry } from '../templates/template-repository'
import { getCatalogItemCount, type CatalogRepositoryItem, type CatalogRepositoryShop } from '../templates/catalog-repository'
import { PRESET_DOCS } from '../data/sample-doc'

type TemplateRepositoryTab = 'templates' | 'catalog' | 'presets'

type TemplateRepositoryModalProps = {
  open: boolean
  onClose: () => void
  templateRepository: TemplateRepositoryEntry[]
  catalogRepository: CatalogRepositoryShop[]
  selectedTemplateEntryId: string | null
  selectedTemplateEntry: TemplateRepositoryEntry | null
  selectedCatalogShopId: string | null
  selectedPresetId: string
  onSelectTemplateEntry: (entryId: string) => void
  onSelectCatalogShop: (shopId: string) => void
  onSelectPreset: (presetId: string) => void
  onSaveTemplate: () => void
  onExportRepository: () => void
  onImportRepository: () => void
  onImportCatalog: () => void
  onLoadPreset: () => void
  onLoadAsDocument: () => void
  onInsertIntoDocument: () => void
  onDeleteTemplate: (entryId: string) => void
  onDeleteCatalogShop: (shopId: string) => void
}

type CatalogPreviewEntry = {
  key: string
  groupName: string
  item: CatalogRepositoryItem
}

function joinCatalogItemDetails(item: CatalogRepositoryItem): string {
  const details: string[] = []
  if (item.category) {
    details.push(item.category)
  }
  const priceWithUnit = [item.unitPrice, item.unitStr].filter((value) => value.trim().length > 0).join(' ')
  if (priceWithUnit) {
    details.push(priceWithUnit)
  }
  if (item.hasImage) {
    details.push(item.imageDpi ? `image @ ${item.imageDpi} dpi` : 'image included')
  }
  return details.join(' · ')
}

export function TemplateRepositoryModal({
  open,
  onClose,
  templateRepository,
  catalogRepository,
  selectedTemplateEntryId,
  selectedTemplateEntry,
  selectedCatalogShopId,
  selectedPresetId,
  onSelectTemplateEntry,
  onSelectCatalogShop,
  onSelectPreset,
  onSaveTemplate,
  onExportRepository,
  onImportRepository,
  onImportCatalog,
  onLoadPreset,
  onLoadAsDocument,
  onInsertIntoDocument,
  onDeleteTemplate,
  onDeleteCatalogShop,
}: TemplateRepositoryModalProps) {
  const [activeTab, setActiveTab] = useState<TemplateRepositoryTab>('templates')
  const [selectedCatalogItemKey, setSelectedCatalogItemKey] = useState<string | null>(null)
  const selectedCatalogShop = catalogRepository.find((shop) => shop.id === selectedCatalogShopId) ?? null
  const selectedCatalogShopGroupCount =
    selectedCatalogShop === null
      ? 0
      : typeof selectedCatalogShop.groupCount === 'number'
        ? selectedCatalogShop.groupCount
        : selectedCatalogShop.groups.length
  const selectedCatalogShopItemCount = selectedCatalogShop === null ? 0 : getCatalogItemCount(selectedCatalogShop)
  const catalogPreviewItems = useMemo<CatalogPreviewEntry[]>(() => {
    if (!selectedCatalogShop) {
      return []
    }
    return selectedCatalogShop.groups.flatMap((group) =>
      group.items.map((item, itemIndex) => ({
        key: `${group.id}:${item.id}:${itemIndex}`,
        groupName: group.name,
        item,
      })),
    )
  }, [selectedCatalogShop])
  const resolvedSelectedCatalogItemKey =
    selectedCatalogItemKey && catalogPreviewItems.some((entry) => entry.key === selectedCatalogItemKey)
      ? selectedCatalogItemKey
      : catalogPreviewItems[0]?.key ?? null
  const selectedCatalogPreviewItem =
    resolvedSelectedCatalogItemKey === null
      ? null
      : catalogPreviewItems.find((entry) => entry.key === resolvedSelectedCatalogItemKey) ?? null

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
          <button
            className={activeTab === 'presets' ? 'active' : ''}
            role="tab"
            aria-selected={activeTab === 'presets'}
            onClick={() => setActiveTab('presets')}
          >
            Presets
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
        ) : activeTab === 'catalog' ? (
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
            <h3 className="line-type-modal-subtitle">Catalog Item Preview</h3>
            {!selectedCatalogShop ? (
              <p className="hint">Select a catalog to preview its items.</p>
            ) : (
              <>
                <p className="hint">
                  {selectedCatalogShop.name} • {selectedCatalogShopGroupCount} groups • {selectedCatalogShopItemCount} items
                </p>
                {catalogPreviewItems.length === 0 ? (
                  <p className="hint">
                    This catalog only includes summary metadata. Import the source `.ctlg` file to preview individual items.
                  </p>
                ) : (
                  <div className="catalog-preview-layout">
                    <div className="catalog-preview-item-list" role="listbox" aria-label="Catalog items">
                      {catalogPreviewItems.map((entry) => {
                        const itemDetails = joinCatalogItemDetails(entry.item)
                        return (
                          <button
                            key={entry.key}
                            type="button"
                            className={`catalog-preview-item-chip ${resolvedSelectedCatalogItemKey === entry.key ? 'active' : ''}`}
                            onClick={() => setSelectedCatalogItemKey(entry.key)}
                            aria-selected={resolvedSelectedCatalogItemKey === entry.key}
                          >
                            <span className="catalog-preview-item-chip-name">{entry.item.name}</span>
                            <span className="catalog-preview-item-chip-meta">
                              {entry.groupName}
                              {itemDetails ? ` • ${itemDetails}` : ''}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="catalog-preview-detail">
                      {selectedCatalogPreviewItem ? (
                        <>
                          <h4>{selectedCatalogPreviewItem.item.name}</h4>
                          <p className="catalog-preview-detail-subtitle">Group: {selectedCatalogPreviewItem.groupName}</p>
                          <dl className="catalog-preview-detail-grid">
                            <dt>Category</dt>
                            <dd>{selectedCatalogPreviewItem.item.category || 'Uncategorized'}</dd>
                            <dt>Price / Unit</dt>
                            <dd>
                              {[selectedCatalogPreviewItem.item.unitPrice, selectedCatalogPreviewItem.item.unitStr]
                                .filter((value) => value.trim().length > 0)
                                .join(' ') || 'Not specified'}
                            </dd>
                            <dt>Image</dt>
                            <dd>
                              {selectedCatalogPreviewItem.item.hasImage
                                ? selectedCatalogPreviewItem.item.imageDpi
                                  ? `Included (${selectedCatalogPreviewItem.item.imageDpi} dpi)`
                                  : 'Included'
                                : 'No image'}
                            </dd>
                            <dt>GUID</dt>
                            <dd>{selectedCatalogPreviewItem.item.guid || 'N/A'}</dd>
                          </dl>
                          {selectedCatalogPreviewItem.item.memo ? (
                            <p className="catalog-preview-detail-memo">{selectedCatalogPreviewItem.item.memo}</p>
                          ) : null}
                          {selectedCatalogPreviewItem.item.url ? (
                            <a href={selectedCatalogPreviewItem.item.url} target="_blank" rel="noreferrer">
                              Open product URL
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <p className="hint">No items to preview in this catalog.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <h3 className="line-type-modal-subtitle">Workspace Presets</h3>
            <p className="hint">Load a starter layout into the current document.</p>
            <div className="line-type-modal-actions">
              <select className="preset-select" value={selectedPresetId} onChange={(event) => onSelectPreset(event.target.value)}>
                {PRESET_DOCS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <button onClick={onLoadPreset}>Load Preset</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
