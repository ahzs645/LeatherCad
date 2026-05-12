import { BUNDLED_CATALOG_SUMMARIES } from './catalog-builtins'
import { withEditorLocalDataClient } from '../localdb/editor-local-data-client'
import { safeLocalStorageGet, safeLocalStorageSet } from '../ops/safe-storage'

const CATALOG_REPOSITORY_STORAGE_KEY = 'leathercraft-catalog-repository-v1'
const BUNDLED_CATALOG_IMPORTED_AT = '2026-01-01T00:00:00.000Z'

export type CatalogRepositoryItem = {
  id: string
  name: string
  guid: string
  category: string
  unitPrice: string
  unitStr: string
  url: string
  memo: string
  hasImage: boolean
  imageDpi: number | null
  zipBmpBase64?: string
  imageDataUrl?: string
  imageScalePercent?: number
  imageRulerLengthMm?: number | null
  imageRotationDeg?: number
  imageCropMode?: 'original' | 'square' | 'max'
}

export type CatalogRepositoryGroup = {
  id: string
  name: string
  guid: string
  url: string
  memo: string
  items: CatalogRepositoryItem[]
}

export type CatalogRepositoryShop = {
  id: string
  name: string
  guid: string
  url: string
  memo: string
  shopVersion: number
  metaVersion: string
  sourceFileName: string
  importedAt: string
  groups: CatalogRepositoryGroup[]
  groupCount?: number
  itemCount?: number
  isBundled?: boolean
}

export type CatalogRepositorySortKey = 'name' | 'imported'
export type CatalogRepositoryMoveDirection = 'up' | 'down'

function cloneCatalogRepositoryShop(shop: CatalogRepositoryShop): CatalogRepositoryShop {
  if (typeof structuredClone === 'function') {
    return structuredClone(shop)
  }
  return JSON.parse(JSON.stringify(shop)) as CatalogRepositoryShop
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function buildFallbackId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`
}

function slugifyId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function parseCatalogItem(candidate: unknown, parentId: string, index: number): CatalogRepositoryItem | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const value = candidate as Record<string, unknown>
  const guid = asString(value.GUID).trim()
  const zipBmpBase64 = typeof value.zipbmp === 'string' ? value.zipbmp.trim() : ''
  const imageDataUrl = asString(value.ImageDataUrl).trim()
  const imageCalibration = typeof value.ImageCalibration === 'object' && value.ImageCalibration !== null
    ? value.ImageCalibration as Record<string, unknown>
    : {}
  return {
    id: guid || buildFallbackId(`${parentId}-item`, index),
    name: asString(value.Name).trim() || `Item ${index + 1}`,
    guid,
    category: asString(value.Category).trim(),
    unitPrice: asString(value.UnitPrice).trim(),
    unitStr: asString(value.UnitStr).trim(),
    url: asString(value.URL).trim(),
    memo: asString(value.Memo).trim().slice(0, 600),
    hasImage: zipBmpBase64.length > 0 || imageDataUrl.length > 0,
    imageDpi: parseOptionalNumber(value.dpi),
    zipBmpBase64: zipBmpBase64 || undefined,
    imageDataUrl: imageDataUrl || undefined,
    imageScalePercent: parseOptionalNumber(imageCalibration.scalePercent) ?? undefined,
    imageRulerLengthMm: parseOptionalNumber(imageCalibration.rulerLengthMm),
    imageRotationDeg: parseOptionalNumber(imageCalibration.rotationDeg) ?? undefined,
    imageCropMode:
      imageCalibration.cropMode === 'square' || imageCalibration.cropMode === 'max'
        ? imageCalibration.cropMode
        : 'original',
  }
}

function parseCatalogGroup(candidate: unknown, parentId: string, index: number): CatalogRepositoryGroup | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const value = candidate as Record<string, unknown>
  const guid = asString(value.GUID).trim()
  const groupId = guid || buildFallbackId(`${parentId}-group`, index)
  const rawItems = Array.isArray(value.Items) ? value.Items : []
  const items = rawItems
    .map((item, itemIndex) => parseCatalogItem(item, groupId, itemIndex))
    .filter((item): item is CatalogRepositoryItem => item !== null)

  return {
    id: groupId,
    name: asString(value.Name).trim() || `Group ${index + 1}`,
    guid,
    url: asString(value.URL).trim(),
    memo: asString(value.Memo).trim().slice(0, 600),
    items,
  }
}

function parseCatalogRepositoryShop(candidate: unknown): CatalogRepositoryShop | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const value = candidate as Partial<CatalogRepositoryShop>
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.guid !== 'string' ||
    typeof value.url !== 'string' ||
    typeof value.memo !== 'string' ||
    typeof value.shopVersion !== 'number' ||
    typeof value.metaVersion !== 'string' ||
    typeof value.sourceFileName !== 'string' ||
    typeof value.importedAt !== 'string' ||
    !Array.isArray(value.groups)
  ) {
    return null
  }
  if (value.groupCount !== undefined && typeof value.groupCount !== 'number') {
    return null
  }
  if (value.itemCount !== undefined && typeof value.itemCount !== 'number') {
    return null
  }
  if (value.isBundled !== undefined && typeof value.isBundled !== 'boolean') {
    return null
  }

  const groups = value.groups
    .filter((group): group is CatalogRepositoryGroup => {
      if (typeof group !== 'object' || group === null) {
        return false
      }
      const maybe = group as Partial<CatalogRepositoryGroup>
      if (
        typeof maybe.id !== 'string' ||
        typeof maybe.name !== 'string' ||
        typeof maybe.guid !== 'string' ||
        typeof maybe.url !== 'string' ||
        typeof maybe.memo !== 'string' ||
        !Array.isArray(maybe.items)
      ) {
        return false
      }
      return maybe.items.every((item) => {
        if (typeof item !== 'object' || item === null) {
          return false
        }
        const maybeItem = item as Partial<CatalogRepositoryItem>
        return (
          typeof maybeItem.id === 'string' &&
          typeof maybeItem.name === 'string' &&
          typeof maybeItem.guid === 'string' &&
          typeof maybeItem.category === 'string' &&
          typeof maybeItem.unitPrice === 'string' &&
          typeof maybeItem.unitStr === 'string' &&
          typeof maybeItem.url === 'string' &&
          typeof maybeItem.memo === 'string' &&
          typeof maybeItem.hasImage === 'boolean' &&
          (typeof maybeItem.imageDpi === 'number' || maybeItem.imageDpi === null) &&
          (typeof maybeItem.zipBmpBase64 === 'string' || maybeItem.zipBmpBase64 === undefined)
        )
      })
    })
    .map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item })),
    }))

  return {
    ...value,
    groups,
    groupCount: value.groupCount,
    itemCount: value.itemCount,
    isBundled: value.isBundled,
  } as CatalogRepositoryShop
}

function parseCatalogRoot(raw: string): {
  metaVersion: string
  shop: CatalogRepositoryShop
} {
  const normalizedRaw = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const parsed = JSON.parse(normalizedRaw) as unknown
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Catalog file must contain a JSON object')
  }

  const root = parsed as {
    meta?: {
      file_type?: unknown
      version?: unknown
    }
    shop?: unknown
  }

  const fileType = asString(root.meta?.file_type).trim()
  if (fileType !== 'LeathercraftCAD_Catalog_Data') {
    throw new Error(`Unsupported catalog file_type "${fileType || 'unknown'}"`)
  }

  if (typeof root.shop !== 'object' || root.shop === null) {
    throw new Error('Catalog file is missing the "shop" object')
  }
  const shopValue = root.shop as Record<string, unknown>
  const guid = asString(shopValue.GUID).trim()
  const shopId = guid || 'shop-unknown'
  const rawGroups = Array.isArray(shopValue.Items) ? shopValue.Items : []
  const groups = rawGroups
    .map((group, index) => parseCatalogGroup(group, shopId, index))
    .filter((group): group is CatalogRepositoryGroup => group !== null)

  if (groups.length === 0) {
    throw new Error('Catalog file has no valid groups or items')
  }

  return {
    metaVersion: asString(root.meta?.version).trim() || 'unknown',
    shop: {
      id: shopId,
      name: asString(shopValue.Name).trim() || 'Untitled shop',
      guid,
      url: asString(shopValue.URL).trim(),
      memo: asString(shopValue.Memo).trim().slice(0, 600),
      shopVersion: parseOptionalNumber(shopValue.Version) ?? 0,
      metaVersion: '',
      sourceFileName: '',
      importedAt: '',
      groups,
      groupCount: groups.length,
      itemCount: groups.reduce((count, group) => count + group.items.length, 0),
    },
  }
}

export function parseCatalogShopImport(raw: string, sourceFileName: string): CatalogRepositoryShop {
  const { metaVersion, shop } = parseCatalogRoot(raw)
  return {
    ...shop,
    metaVersion,
    sourceFileName,
    importedAt: new Date().toISOString(),
  }
}

export function serializeCatalogShop(shop: CatalogRepositoryShop): string {
  const payload = {
    meta: {
      file_type: 'LeathercraftCAD_Catalog_Data',
      version: shop.metaVersion || '1',
    },
    shop: {
      GUID: shop.guid,
      Name: shop.name,
      URL: shop.url,
      Memo: shop.memo,
      Version: shop.shopVersion,
      Items: shop.groups.map((group) => ({
        GUID: group.guid,
        Name: group.name,
        URL: group.url,
        Memo: group.memo,
        Items: group.items.map((item) => ({
          GUID: item.guid,
          Name: item.name,
          Category: item.category,
          UnitPrice: item.unitPrice,
          UnitStr: item.unitStr,
          URL: item.url,
          Memo: item.memo,
          dpi: item.imageDpi,
          ...(item.zipBmpBase64 ? { zipbmp: item.zipBmpBase64 } : {}),
          ...(item.imageDataUrl ? { ImageDataUrl: item.imageDataUrl } : {}),
          ImageCalibration: {
            scalePercent: item.imageScalePercent ?? 100,
            rulerLengthMm: item.imageRulerLengthMm ?? null,
            rotationDeg: item.imageRotationDeg ?? 0,
            cropMode: item.imageCropMode ?? 'original',
          },
        })),
      })),
    },
  }
  return JSON.stringify(payload, null, 2)
}

export function mergeCatalogShopImport(
  current: CatalogRepositoryShop[],
  importedShop: CatalogRepositoryShop,
): CatalogRepositoryShop[] {
  const byId = new Map(current.map((shop) => [shop.id, cloneCatalogRepositoryShop(shop)]))
  byId.set(importedShop.id, cloneCatalogRepositoryShop(importedShop))
  return Array.from(byId.values()).sort((left, right) => (left.importedAt > right.importedAt ? -1 : 1))
}

export function moveCatalogRepositoryShop(
  shops: CatalogRepositoryShop[],
  shopId: string,
  direction: CatalogRepositoryMoveDirection,
) {
  const index = shops.findIndex((shop) => shop.id === shopId)
  const nextIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || nextIndex < 0 || nextIndex >= shops.length) {
    return shops
  }
  const next = [...shops]
  const [shop] = next.splice(index, 1)
  next.splice(nextIndex, 0, shop)
  return next
}

export function sortCatalogRepository(shops: CatalogRepositoryShop[], sortKey: CatalogRepositorySortKey) {
  return [...shops].sort((left, right) =>
    sortKey === 'name' ? left.name.localeCompare(right.name) : right.importedAt.localeCompare(left.importedAt),
  )
}

export function loadCatalogRepository(): CatalogRepositoryShop[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = safeLocalStorageGet(CATALOG_REPOSITORY_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map(parseCatalogRepositoryShop)
      .filter((shop): shop is CatalogRepositoryShop => shop !== null)
      .map((shop) => cloneCatalogRepositoryShop(shop))
  } catch {
    return []
  }
}

export function loadBundledCatalogRepository(): CatalogRepositoryShop[] {
  return BUNDLED_CATALOG_SUMMARIES.map((summary) => ({
    id: `builtin-${slugifyId(summary.sourceFileName)}`,
    name: summary.name,
    guid: summary.guid,
    url: summary.url,
    memo: summary.memo,
    shopVersion: summary.shopVersion,
    metaVersion: summary.metaVersion,
    sourceFileName: summary.sourceFileName,
    importedAt: BUNDLED_CATALOG_IMPORTED_AT,
    groups: [],
    groupCount: summary.groupCount,
    itemCount: summary.itemCount,
    isBundled: true,
  }))
}

export function saveCatalogRepository(shops: CatalogRepositoryShop[]) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    const serializableShops: CatalogRepositoryShop[] = shops.map((shop) => ({
      ...shop,
      groups: shop.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          zipBmpBase64: undefined,
        })),
      })),
    }))
    safeLocalStorageSet(CATALOG_REPOSITORY_STORAGE_KEY, JSON.stringify(serializableShops))
    void withEditorLocalDataClient((client) => client.catalogRepository.replaceAll(serializableShops))
  } catch {
    // Catalog files can be large; keep runtime behavior resilient when storage quota is exceeded.
  }
}

export async function loadCatalogRepositoryFromLocalDb(): Promise<CatalogRepositoryShop[]> {
  const shops = await withEditorLocalDataClient((client) => client.catalogRepository.list())
  if (!shops || shops.length === 0) {
    return loadCatalogRepository()
  }
  return shops
    .map(parseCatalogRepositoryShop)
    .filter((shop): shop is CatalogRepositoryShop => shop !== null)
    .map((shop) => cloneCatalogRepositoryShop(shop))
}

export function getCatalogItemCount(shop: CatalogRepositoryShop): number {
  if (typeof shop.itemCount === 'number') {
    return shop.itemCount
  }
  return shop.groups.reduce((count, group) => count + group.items.length, 0)
}

export type CatalogShopPatch = Partial<Pick<CatalogRepositoryShop, 'name' | 'url' | 'memo' | 'shopVersion'>>
export type CatalogGroupPatch = Partial<Pick<CatalogRepositoryGroup, 'name' | 'url' | 'memo'>>
export type CatalogItemPatch = Partial<
  Pick<
    CatalogRepositoryItem,
    | 'name'
    | 'category'
    | 'unitPrice'
    | 'unitStr'
    | 'url'
    | 'memo'
    | 'imageDpi'
    | 'imageDataUrl'
    | 'imageScalePercent'
    | 'imageRulerLengthMm'
    | 'imageRotationDeg'
    | 'imageCropMode'
  >
>

export function updateCatalogShop(
  shops: CatalogRepositoryShop[],
  shopId: string,
  patch: CatalogShopPatch,
): CatalogRepositoryShop[] {
  return shops.map((shop) => {
    if (shop.id !== shopId || shop.isBundled) {
      return shop
    }
    return {
      ...shop,
      ...patch,
      name: patch.name?.trim() || shop.name,
      url: patch.url ?? shop.url,
      memo: patch.memo ?? shop.memo,
      shopVersion: typeof patch.shopVersion === 'number' && Number.isFinite(patch.shopVersion)
        ? patch.shopVersion
        : shop.shopVersion,
    }
  })
}

export function updateCatalogGroup(
  shops: CatalogRepositoryShop[],
  shopId: string,
  groupId: string,
  patch: CatalogGroupPatch,
): CatalogRepositoryShop[] {
  return shops.map((shop) => {
    if (shop.id !== shopId || shop.isBundled) {
      return shop
    }
    return {
      ...shop,
      groups: shop.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              ...patch,
              name: patch.name?.trim() || group.name,
              url: patch.url ?? group.url,
              memo: patch.memo ?? group.memo,
            }
          : group,
      ),
    }
  })
}

export function updateCatalogItem(
  shops: CatalogRepositoryShop[],
  shopId: string,
  groupId: string,
  itemId: string,
  patch: CatalogItemPatch,
): CatalogRepositoryShop[] {
  return shops.map((shop) => {
    if (shop.id !== shopId || shop.isBundled) {
      return shop
    }
    return {
      ...shop,
      groups: shop.groups.map((group) => {
        if (group.id !== groupId) {
          return group
        }
        return {
          ...group,
          items: group.items.map((item) => {
            if (item.id !== itemId) {
              return item
            }
            const imageDataUrl = patch.imageDataUrl ?? item.imageDataUrl
            return {
              ...item,
              ...patch,
              name: patch.name?.trim() || item.name,
              category: patch.category ?? item.category,
              unitPrice: patch.unitPrice ?? item.unitPrice,
              unitStr: patch.unitStr ?? item.unitStr,
              url: patch.url ?? item.url,
              memo: patch.memo ?? item.memo,
              imageDpi: patch.imageDpi === undefined ? item.imageDpi : patch.imageDpi,
              imageDataUrl,
              hasImage: item.hasImage || Boolean(imageDataUrl),
              imageScalePercent:
                typeof patch.imageScalePercent === 'number' && Number.isFinite(patch.imageScalePercent)
                  ? Math.max(1, Math.min(1000, patch.imageScalePercent))
                  : item.imageScalePercent,
              imageRulerLengthMm:
                patch.imageRulerLengthMm === undefined
                  ? item.imageRulerLengthMm
                  : patch.imageRulerLengthMm,
              imageRotationDeg:
                typeof patch.imageRotationDeg === 'number' && Number.isFinite(patch.imageRotationDeg)
                  ? patch.imageRotationDeg
                  : item.imageRotationDeg,
              imageCropMode: patch.imageCropMode ?? item.imageCropMode,
            }
          }),
        }
      }),
    }
  })
}
