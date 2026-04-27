import type {
  CatalogGroupPatch,
  CatalogItemPatch,
  CatalogRepositoryItem,
  CatalogRepositoryShop,
  CatalogShopPatch,
} from '../templates/catalog-repository'

type CatalogEditorPanelProps = {
  shop: CatalogRepositoryShop
  groupIndex: number
  item: CatalogRepositoryItem
  itemKey: string
  groupName: string
  imageUrl: string | null
  imageLoading: boolean
  imageError: string | null
  canEdit: boolean
  onImageSize: (itemKey: string, size: { width: number; height: number }) => void
  onUpdateShop: (shopId: string, patch: CatalogShopPatch) => void
  onUpdateGroup: (shopId: string, groupId: string, patch: CatalogGroupPatch) => void
  onUpdateItem: (shopId: string, groupId: string, itemId: string, patch: CatalogItemPatch) => void
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Image reader returned a non-string result'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

export function CatalogEditorPanel({
  shop,
  groupIndex,
  item,
  itemKey,
  groupName,
  imageUrl,
  imageLoading,
  imageError,
  canEdit,
  onImageSize,
  onUpdateShop,
  onUpdateGroup,
  onUpdateItem,
}: CatalogEditorPanelProps) {
  const group = shop.groups[groupIndex]
  const updateItem = (patch: CatalogItemPatch) => onUpdateItem(shop.id, group.id, item.id, patch)

  const handleImageImport = async (file: File | undefined) => {
    if (!file || !canEdit) {
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    updateItem({
      imageDataUrl: dataUrl,
      imageDpi: item.imageDpi ?? 300,
      imageScalePercent: item.imageScalePercent ?? 100,
      imageRotationDeg: item.imageRotationDeg ?? 0,
      imageCropMode: item.imageCropMode ?? 'original',
    })
  }

  return (
    <>
      <h4>{item.name}</h4>
      <p className="catalog-preview-detail-subtitle">Group: {groupName}</p>

      <div className="control-block">
        <h4>Shop</h4>
        <label className="field-row">
          <span>Name</span>
          <input type="text" value={shop.name} disabled={!canEdit} onChange={(event) => onUpdateShop(shop.id, { name: event.target.value })} />
        </label>
        <label className="field-row">
          <span>URL</span>
          <input type="url" value={shop.url} disabled={!canEdit} onChange={(event) => onUpdateShop(shop.id, { url: event.target.value })} />
        </label>
        <label className="field-row">
          <span>Memo</span>
          <textarea value={shop.memo} disabled={!canEdit} onChange={(event) => onUpdateShop(shop.id, { memo: event.target.value })} />
        </label>
      </div>

      <div className="control-block">
        <h4>Group</h4>
        <label className="field-row">
          <span>Name</span>
          <input
            type="text"
            value={group.name}
            disabled={!canEdit}
            onChange={(event) => onUpdateGroup(shop.id, group.id, { name: event.target.value })}
          />
        </label>
        <label className="field-row">
          <span>Memo</span>
          <textarea value={group.memo} disabled={!canEdit} onChange={(event) => onUpdateGroup(shop.id, group.id, { memo: event.target.value })} />
        </label>
      </div>

      <div className="control-block">
        <h4>Item</h4>
        <label className="field-row">
          <span>Name</span>
          <input type="text" value={item.name} disabled={!canEdit} onChange={(event) => updateItem({ name: event.target.value })} />
        </label>
        <label className="field-row">
          <span>Category</span>
          <input type="text" value={item.category} disabled={!canEdit} onChange={(event) => updateItem({ category: event.target.value })} />
        </label>
        <label className="field-row">
          <span>Unit Price</span>
          <input type="text" value={item.unitPrice} disabled={!canEdit} onChange={(event) => updateItem({ unitPrice: event.target.value })} />
        </label>
        <label className="field-row">
          <span>Unit Label</span>
          <input type="text" value={item.unitStr} disabled={!canEdit} onChange={(event) => updateItem({ unitStr: event.target.value })} />
        </label>
        <label className="field-row">
          <span>URL</span>
          <input type="url" value={item.url} disabled={!canEdit} onChange={(event) => updateItem({ url: event.target.value })} />
        </label>
        <label className="field-row">
          <span>Memo</span>
          <textarea value={item.memo} disabled={!canEdit} onChange={(event) => updateItem({ memo: event.target.value })} />
        </label>
      </div>

      {item.hasImage ? (
        <div className="catalog-preview-image-wrap">
          {imageUrl ? (
            <img
              className="catalog-preview-image"
              src={imageUrl}
              alt={`${item.name} thumbnail`}
              onLoad={(event) => {
                const image = event.currentTarget
                onImageSize(itemKey, { width: image.naturalWidth, height: image.naturalHeight })
              }}
            />
          ) : item.zipBmpBase64 ? (
            <p className="hint">{imageLoading ? 'Loading thumbnail…' : imageError || 'Thumbnail preview is unavailable for this item.'}</p>
          ) : (
            <p className="hint">Thumbnail payload is unavailable. Re-import the original `.ctlg` file to view it.</p>
          )}
        </div>
      ) : null}

      <div className="control-block">
        <h4>Image Calibration</h4>
        <label className="field-row">
          <span>Import Image</span>
          <input
            type="file"
            accept="image/*"
            disabled={!canEdit}
            onChange={(event) => {
              void handleImageImport(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        <label className="field-row">
          <span>DPI</span>
          <input type="number" min={1} max={2400} step={1} value={item.imageDpi ?? 300} disabled={!canEdit} onChange={(event) => updateItem({ imageDpi: Number(event.target.value) || null })} />
        </label>
        <label className="field-row">
          <span>Scale (%)</span>
          <input type="number" min={1} max={1000} step={1} value={item.imageScalePercent ?? 100} disabled={!canEdit} onChange={(event) => updateItem({ imageScalePercent: Number(event.target.value) || 100 })} />
        </label>
        <label className="field-row">
          <span>Ruler Length (mm)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={item.imageRulerLengthMm ?? ''}
            disabled={!canEdit}
            onChange={(event) => updateItem({ imageRulerLengthMm: event.target.value === '' ? null : Number(event.target.value) })}
          />
        </label>
        <label className="field-row">
          <span>Rotation</span>
          <input type="number" step={1} value={item.imageRotationDeg ?? 0} disabled={!canEdit} onChange={(event) => updateItem({ imageRotationDeg: Number(event.target.value) || 0 })} />
        </label>
        <label className="field-row">
          <span>Crop</span>
          <select className="action-select" value={item.imageCropMode ?? 'original'} disabled={!canEdit} onChange={(event) => updateItem({ imageCropMode: event.target.value as CatalogRepositoryItem['imageCropMode'] })}>
            <option value="original">Original</option>
            <option value="square">Square</option>
            <option value="max">Max fit</option>
          </select>
        </label>
        <div className="line-type-modal-actions">
          <button disabled={!canEdit} onClick={() => updateItem({ imageScalePercent: 100, imageRulerLengthMm: null, imageRotationDeg: 0, imageCropMode: 'original' })}>
            Reset Image
          </button>
          <button disabled={!canEdit} onClick={() => updateItem({ imageCropMode: 'square' })}>Square</button>
          <button disabled={!canEdit} onClick={() => updateItem({ imageCropMode: 'max' })}>Max</button>
        </div>
      </div>
    </>
  )
}
