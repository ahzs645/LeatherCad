import { BUNDLED_CATALOG_SUMMARIES } from './catalog-builtins'
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
  return {
    id: guid || buildFallbackId(`${parentId}-item`, index),
    name: asString(value.Name).trim() || `Item ${index + 1}`,
    guid,
    category: asString(value.Category).trim(),
    unitPrice: asString(value.UnitPrice).trim(),
    unitStr: asString(value.UnitStr).trim(),
    url: asString(value.URL).trim(),
    memo: asString(value.Memo).trim().slice(0, 600),
    hasImage: zipBmpBase64.length > 0,
    imageDpi: parseOptionalNumber(value.dpi),
    zipBmpBase64: zipBmpBase64 || undefined,
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

export function mergeCatalogShopImport(
  current: CatalogRepositoryShop[],
  importedShop: CatalogRepositoryShop,
): CatalogRepositoryShop[] {
  const byId = new Map(current.map((shop) => [shop.id, cloneCatalogRepositoryShop(shop)]))
  byId.set(importedShop.id, cloneCatalogRepositoryShop(importedShop))
  return Array.from(byId.values()).sort((left, right) => (left.importedAt > right.importedAt ? -1 : 1))
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
  } catch {
    // Catalog files can be large; keep runtime behavior resilient when storage quota is exceeded.
  }
}

export function getCatalogItemCount(shop: CatalogRepositoryShop): number {
  if (typeof shop.itemCount === 'number') {
    return shop.itemCount
  }
  return shop.groups.reduce((count, group) => count + group.items.length, 0)
}
