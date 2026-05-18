import { useEffect, useRef, useState } from 'react'
import type {
  TemplateRepositoryEntry,
  TemplateRepositoryFolder,
  TemplateRepositoryMoveDirection,
  TemplateRepositorySortKey,
} from '../templates/template-repository'
import {
  getCatalogItemCount,
  type CatalogGroupPatch,
  type CatalogItemPatch,
  type CatalogRepositoryItem,
  type CatalogRepositoryMoveDirection,
  type CatalogRepositoryShop,
  type CatalogRepositorySortKey,
  type CatalogShopPatch,
} from '../templates/catalog-repository'
import { decodeCatalogZipBmpToObjectUrl } from '../templates/catalog-image-preview'
import { PRESET_META } from '../data/sample-doc-meta'
import { CatalogEditorPanel } from './CatalogEditorPanel'

type TemplateRepositoryTab = 'templates' | 'catalog' | 'presets'
type CatalogItemSort = 'group' | 'name' | 'category' | 'image'

type TemplateRepositoryModalProps = {
  open: boolean
  onClose: () => void
  templateRepository: TemplateRepositoryEntry[]
  templateRepositoryFolders: TemplateRepositoryFolder[]
  catalogRepository: CatalogRepositoryShop[]
  selectedTemplateEntryId: string | null
  selectedTemplateEntry: TemplateRepositoryEntry | null
  selectedTemplateFolderId: string | null
  selectedCatalogShopId: string | null
  selectedPresetId: string
  onSelectTemplateEntry: (entryId: string) => void
  onSelectTemplateFolder: (folderId: string | null) => void
  onSelectCatalogShop: (shopId: string) => void
  onSelectPreset: (presetId: string) => void
  onSaveTemplate: () => void
  onExportRepository: () => void
  onImportRepository: () => void
  onImportCatalog: () => void
  onExportCatalog: (shopId: string) => void
  onLoadPreset: () => void
  onLoadAsDocument: () => void
  onInsertIntoDocument: () => void
  onSeparateIntoShapes: () => void
  onStampAlongSelectedShape?: () => void
  onFlipTemplate?: (entryId: string, axis: 'horizontal' | 'vertical') => void
  onDeleteTemplate: (entryId: string) => void
  onMoveTemplate: (entryId: string, direction: TemplateRepositoryMoveDirection) => void
  onSortTemplates: (sortKey: TemplateRepositorySortKey) => void
  onCreateTemplateFolder: () => void
  onRenameTemplateFolder: (folderId: string) => void
  onDeleteTemplateFolder: (folderId: string) => void
  onMoveTemplateToFolder: (entryId: string, folderId: string | null) => void
  onDeleteCatalogShop: (shopId: string) => void
  onMoveCatalogShop: (shopId: string, direction: CatalogRepositoryMoveDirection) => void
  onSortCatalogShops: (sortKey: CatalogRepositorySortKey) => void
  onUpdateCatalogShop: (shopId: string, patch: CatalogShopPatch) => void
  onUpdateCatalogGroup: (shopId: string, groupId: string, patch: CatalogGroupPatch) => void
  onUpdateCatalogItem: (shopId: string, groupId: string, itemId: string, patch: CatalogItemPatch) => void
}

type CatalogPreviewEntry = {
  key: string
  groupIndex: number
  itemIndex: number
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
  templateRepositoryFolders,
  catalogRepository,
  selectedTemplateEntryId,
  selectedTemplateEntry,
  selectedTemplateFolderId,
  selectedCatalogShopId,
  selectedPresetId,
  onSelectTemplateEntry,
  onSelectTemplateFolder,
  onSelectCatalogShop,
  onSelectPreset,
  onSaveTemplate,
  onExportRepository,
  onImportRepository,
  onImportCatalog,
  onExportCatalog,
  onLoadPreset,
  onLoadAsDocument,
  onInsertIntoDocument,
  onSeparateIntoShapes,
  onStampAlongSelectedShape,
  onFlipTemplate,
  onDeleteTemplate,
  onMoveTemplate,
  onSortTemplates,
  onCreateTemplateFolder,
  onRenameTemplateFolder,
  onDeleteTemplateFolder,
  onMoveTemplateToFolder,
  onDeleteCatalogShop,
  onMoveCatalogShop,
  onSortCatalogShops,
  onUpdateCatalogShop,
  onUpdateCatalogGroup,
  onUpdateCatalogItem,
}: TemplateRepositoryModalProps) {
  const [activeTab, setActiveTab] = useState<TemplateRepositoryTab>('templates')
  const [selectedCatalogItemKey, setSelectedCatalogItemKey] = useState<string | null>(null)
  const [catalogPreviewImageUrlsByKey, setCatalogPreviewImageUrlsByKey] = useState<Record<string, string>>({})
  const [catalogPreviewImageErrorsByKey, setCatalogPreviewImageErrorsByKey] = useState<Record<string, string>>({})
  const [catalogPreviewImageSizesByKey, setCatalogPreviewImageSizesByKey] = useState<
    Record<string, { width: number; height: number }>
  >({})
  const [catalogItemSort, setCatalogItemSort] = useState<CatalogItemSort>('group')
  const catalogPreviewImageObjectUrlsRef = useRef<Set<string>>(new Set())
  const catalogPreviewImagePendingRef = useRef<Set<string>>(new Set())
  const selectedCatalogShop = catalogRepository.find((shop) => shop.id === selectedCatalogShopId) ?? null
  const selectedTemplateFolder =
    selectedTemplateFolderId === null
      ? null
      : templateRepositoryFolders.find((folder) => folder.id === selectedTemplateFolderId) ?? null
  const filteredTemplateRepository = templateRepository.filter(
    (entry) => (entry.parentFolderId ?? null) === selectedTemplateFolderId,
  )
  const selectedCatalogShopGroupCount =
    selectedCatalogShop === null
      ? 0
      : typeof selectedCatalogShop.groupCount === 'number'
        ? selectedCatalogShop.groupCount
        : selectedCatalogShop.groups.length
  const selectedCatalogShopItemCount = selectedCatalogShop === null ? 0 : getCatalogItemCount(selectedCatalogShop)
  const catalogPreviewItems: CatalogPreviewEntry[] = (() => {
    if (!selectedCatalogShop) {
      return []
    }
    const entries = selectedCatalogShop.groups.flatMap((group, groupIndex) =>
      group.items.map((item, itemIndex) => ({
        key: `${group.id}:${item.id}:${itemIndex}`,
        groupIndex,
        itemIndex,
        groupName: group.name,
        item,
      })),
    )
    return entries.sort((left, right) => {
      if (catalogItemSort === 'name') {
        return left.item.name.localeCompare(right.item.name)
      }
      if (catalogItemSort === 'category') {
        return (
          (left.item.category || '').localeCompare(right.item.category || '') ||
          left.item.name.localeCompare(right.item.name)
        )
      }
      if (catalogItemSort === 'image') {
        return Number(right.item.hasImage) - Number(left.item.hasImage) || left.item.name.localeCompare(right.item.name)
      }
      return left.groupIndex - right.groupIndex || left.itemIndex - right.itemIndex
    })
  })()
  const resolvedSelectedCatalogItemKey =
    selectedCatalogItemKey && catalogPreviewItems.some((entry) => entry.key === selectedCatalogItemKey)
      ? selectedCatalogItemKey
      : catalogPreviewItems[0]?.key ?? null
  const selectedCatalogPreviewItem =
    resolvedSelectedCatalogItemKey === null
      ? null
      : catalogPreviewItems.find((entry) => entry.key === resolvedSelectedCatalogItemKey) ?? null
  const selectedCatalogPreviewImagePayload = selectedCatalogPreviewItem?.item.zipBmpBase64 ?? null

  useEffect(() => {
    const createdObjectUrls = catalogPreviewImageObjectUrlsRef.current
    const pending = catalogPreviewImagePendingRef.current
    return () => {
      pending.clear()
      createdObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
      createdObjectUrls.clear()
    }
  }, [])

  useEffect(() => {
    if (!selectedCatalogPreviewItem || !selectedCatalogPreviewImagePayload) {
      return
    }

    if (catalogPreviewImageUrlsByKey[selectedCatalogPreviewItem.key] || catalogPreviewImagePendingRef.current.has(selectedCatalogPreviewItem.key)) {
      return
    }

    catalogPreviewImagePendingRef.current.add(selectedCatalogPreviewItem.key)

    void decodeCatalogZipBmpToObjectUrl(selectedCatalogPreviewImagePayload)
      .then((objectUrl) => {
        if (!catalogPreviewImagePendingRef.current.has(selectedCatalogPreviewItem.key)) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        catalogPreviewImagePendingRef.current.delete(selectedCatalogPreviewItem.key)
        catalogPreviewImageObjectUrlsRef.current.add(objectUrl)
        setCatalogPreviewImageUrlsByKey((previous) => ({
          ...previous,
          [selectedCatalogPreviewItem.key]: objectUrl,
        }))
        setCatalogPreviewImageErrorsByKey((previous) => {
          if (!(selectedCatalogPreviewItem.key in previous)) {
            return previous
          }
          const next = { ...previous }
          delete next[selectedCatalogPreviewItem.key]
          return next
        })
      })
      .catch((error) => {
        if (!catalogPreviewImagePendingRef.current.has(selectedCatalogPreviewItem.key)) {
          return
        }
        catalogPreviewImagePendingRef.current.delete(selectedCatalogPreviewItem.key)
        setCatalogPreviewImageErrorsByKey((previous) => ({
          ...previous,
          [selectedCatalogPreviewItem.key]: error instanceof Error ? error.message : 'Failed to decode thumbnail image',
        }))
      })
  }, [catalogPreviewImageUrlsByKey, selectedCatalogPreviewImagePayload, selectedCatalogPreviewItem])

  const selectedCatalogPreviewImageUrl =
    selectedCatalogPreviewItem === null
      ? null
      : selectedCatalogPreviewItem.item.imageDataUrl ?? catalogPreviewImageUrlsByKey[selectedCatalogPreviewItem.key] ?? null
  const isCatalogPreviewImageLoading =
    selectedCatalogPreviewItem !== null &&
    Boolean(selectedCatalogPreviewItem.item.zipBmpBase64) &&
    !selectedCatalogPreviewImageUrl &&
    !catalogPreviewImageErrorsByKey[selectedCatalogPreviewItem.key]
  const catalogPreviewImageError =
    selectedCatalogPreviewItem === null ? null : catalogPreviewImageErrorsByKey[selectedCatalogPreviewItem.key] ?? null

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
              <button onClick={() => onSortTemplates('name')} disabled={templateRepository.length < 2}>
                Sort A-Z
              </button>
              <button onClick={() => onSortTemplates('updated')} disabled={templateRepository.length < 2}>
                Sort Newest
              </button>
              <button onClick={onCreateTemplateFolder}>New Folder</button>
              <button
                onClick={() => {
                  if (selectedTemplateFolderId) {
                    onRenameTemplateFolder(selectedTemplateFolderId)
                  }
                }}
                disabled={!selectedTemplateFolderId}
              >
                Rename Folder
              </button>
              <button
                onClick={() => {
                  if (selectedTemplateFolderId) {
                    onDeleteTemplateFolder(selectedTemplateFolderId)
                  }
                }}
                disabled={!selectedTemplateFolderId}
              >
                Delete Folder
              </button>
            </div>

            <div className="template-folder-layout">
              <div className="template-folder-tree" role="tree" aria-label="Template folders">
                <button
                  type="button"
                  className={`template-folder-item${selectedTemplateFolderId === null ? ' active' : ''}`}
                  onClick={() => onSelectTemplateFolder(null)}
                >
                  Repository Root
                  <span>{templateRepository.filter((entry) => (entry.parentFolderId ?? null) === null).length}</span>
                </button>
                {templateRepositoryFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className={`template-folder-item${selectedTemplateFolderId === folder.id ? ' active' : ''}`}
                    onClick={() => onSelectTemplateFolder(folder.id)}
                  >
                    {folder.name}
                    <span>{templateRepository.filter((entry) => (entry.parentFolderId ?? null) === folder.id).length}</span>
                  </button>
                ))}
              </div>
              <div className="template-list">
              {templateRepository.length === 0 ? (
                <p className="hint">No templates saved yet.</p>
              ) : filteredTemplateRepository.length === 0 ? (
                <p className="hint">
                  No templates in {selectedTemplateFolder ? `"${selectedTemplateFolder.name}"` : 'the repository root'}.
                </p>
              ) : (
                filteredTemplateRepository.map((entry) => (
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
            </div>

            <div className="line-type-modal-actions">
              <button
                onClick={() => {
                  if (selectedTemplateEntry) {
                    onMoveTemplate(selectedTemplateEntry.id, 'up')
                  }
                }}
                disabled={!selectedTemplateEntry}
              >
                Move Up
              </button>
              <button
                onClick={() => {
                  if (selectedTemplateEntry) {
                    onMoveTemplate(selectedTemplateEntry.id, 'down')
                  }
                }}
                disabled={!selectedTemplateEntry}
              >
                Move Down
              </button>
              <label className="field-row template-folder-move">
                <span>Move to folder</span>
                <select
                  value={selectedTemplateEntry?.parentFolderId ?? ''}
                  disabled={!selectedTemplateEntry}
                  onChange={(event) => {
                    if (!selectedTemplateEntry) {
                      return
                    }
                    onMoveTemplateToFolder(selectedTemplateEntry.id, event.target.value || null)
                  }}
                >
                  <option value="">Repository Root</option>
                  {templateRepositoryFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={onLoadAsDocument} disabled={!selectedTemplateEntry}>
                Load as Document
              </button>
              <button onClick={onInsertIntoDocument} disabled={!selectedTemplateEntry}>
                Insert into Current
              </button>
              <button onClick={onSeparateIntoShapes} title="Explode an inserted template into individual shapes">
                Separate Template Into Shapes
              </button>
              {onStampAlongSelectedShape ? (
                <button
                  onClick={onStampAlongSelectedShape}
                  disabled={!selectedTemplateEntry}
                  title="Stamp this template along the currently selected host shape, rotating each copy to the local tangent"
                >
                  Stamp Along Selected Shape…
                </button>
              ) : null}
              <button
                onClick={() => {
                  if (selectedTemplateEntry && onFlipTemplate) {
                    onFlipTemplate(selectedTemplateEntry.id, 'horizontal')
                  }
                }}
                disabled={!selectedTemplateEntry || !onFlipTemplate}
                title="Mirror this template's shapes left↔right"
              >
                Flip Horizontal
              </button>
              <button
                onClick={() => {
                  if (selectedTemplateEntry && onFlipTemplate) {
                    onFlipTemplate(selectedTemplateEntry.id, 'vertical')
                  }
                }}
                disabled={!selectedTemplateEntry || !onFlipTemplate}
                title="Mirror this template's shapes top↔bottom"
              >
                Flip Vertical
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
            <div className="line-type-modal-actions">
              <button onClick={onImportCatalog}>Import Catalog</button>
              <button
                onClick={() => {
                  if (selectedCatalogShop) {
                    onExportCatalog(selectedCatalogShop.id)
                  }
                }}
                disabled={!selectedCatalogShop || selectedCatalogShop.groups.length === 0}
              >
                Export Catalog
              </button>
              <button onClick={() => onSortCatalogShops('name')} disabled={catalogRepository.length < 2}>
                Sort A-Z
              </button>
              <button onClick={() => onSortCatalogShops('imported')} disabled={catalogRepository.length < 2}>
                Sort Newest
              </button>
              <button
                onClick={() => {
                  if (selectedCatalogShop) {
                    onMoveCatalogShop(selectedCatalogShop.id, 'up')
                  }
                }}
                disabled={!selectedCatalogShop || selectedCatalogShop.isBundled}
              >
                Move Up
              </button>
              <button
                onClick={() => {
                  if (selectedCatalogShop) {
                    onMoveCatalogShop(selectedCatalogShop.id, 'down')
                  }
                }}
                disabled={!selectedCatalogShop || selectedCatalogShop.isBundled}
              >
                Move Down
              </button>
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
            <div className="catalog-split-layout">
              <div className="catalog-split-shops">
                <h3 className="catalog-split-heading">Shops</h3>
                <div className="catalog-split-shops-list">
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
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="catalog-split-preview">
                {!selectedCatalogShop ? (
                  <p className="hint">Select a shop to browse its items.</p>
                ) : catalogPreviewItems.length === 0 ? (
                  <p className="hint">
                    This catalog only includes summary metadata. Import the source `.ctlg` file to preview individual items.
                  </p>
                ) : (
                  <>
                    <h3 className="catalog-split-heading">
                      {selectedCatalogShop.name}
                      <span className="catalog-split-heading-meta">
                        {selectedCatalogShopGroupCount} groups, {selectedCatalogShopItemCount} items
                      </span>
                    </h3>
                    <div className="line-type-modal-actions">
                      <label className="field-row">
                        <span>Item sort</span>
                        <select
                          className="action-select"
                          value={catalogItemSort}
                          onChange={(event) => setCatalogItemSort(event.target.value as CatalogItemSort)}
                        >
                          <option value="group">Group order</option>
                          <option value="name">Name</option>
                          <option value="category">Category</option>
                          <option value="image">Images first</option>
                        </select>
                      </label>
                    </div>
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
                            <CatalogEditorPanel
                              shop={selectedCatalogShop}
                              groupIndex={selectedCatalogPreviewItem.groupIndex}
                              item={selectedCatalogPreviewItem.item}
                              itemKey={selectedCatalogPreviewItem.key}
                              groupName={selectedCatalogPreviewItem.groupName}
                              imageUrl={selectedCatalogPreviewImageUrl}
                              imageLoading={isCatalogPreviewImageLoading}
                              imageError={catalogPreviewImageError}
                              canEdit={!selectedCatalogShop.isBundled}
                              onImageSize={(key, size) =>
                                setCatalogPreviewImageSizesByKey((previous) => ({
                                  ...previous,
                                  [key]: size,
                                }))
                              }
                              onUpdateShop={onUpdateCatalogShop}
                              onUpdateGroup={onUpdateCatalogGroup}
                              onUpdateItem={onUpdateCatalogItem}
                            />
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
                              <dt>Preview</dt>
                              <dd>
                                {catalogPreviewImageSizesByKey[selectedCatalogPreviewItem.key]
                                  ? `${catalogPreviewImageSizesByKey[selectedCatalogPreviewItem.key].width} x ${
                                      catalogPreviewImageSizesByKey[selectedCatalogPreviewItem.key].height
                                    } px`
                                  : selectedCatalogPreviewItem.item.hasImage
                                    ? 'Pending'
                                    : 'N/A'}
                              </dd>
                              <dt>Source</dt>
                              <dd>{selectedCatalogShop.sourceFileName || 'Unknown'}</dd>
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
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="line-type-modal-subtitle">Workspace Presets</h3>
            <p className="hint">Load a starter layout into the current document.</p>
            <div className="line-type-modal-actions">
              <select
                aria-label="Workspace preset"
                className="preset-select"
                value={selectedPresetId}
                onChange={(event) => onSelectPreset(event.target.value)}
              >
                {PRESET_META.map((preset) => (
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
