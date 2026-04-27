import { describe, expect, it } from 'vitest'
import {
  moveCatalogRepositoryShop,
  parseCatalogShopImport,
  serializeCatalogShop,
  sortCatalogRepository,
  updateCatalogGroup,
  updateCatalogItem,
  updateCatalogShop,
  type CatalogRepositoryShop,
} from './catalog-repository'

function shop(id: string, name: string, importedAt: string): CatalogRepositoryShop {
  return {
    id,
    name,
    guid: id,
    url: '',
    memo: '',
    shopVersion: 1,
    metaVersion: '1',
    sourceFileName: `${id}.ctlg`,
    importedAt,
    groups: [],
    groupCount: 0,
    itemCount: 0,
  }
}

describe('catalog repository ordering', () => {
  it('moves a shop up or down without mutating the original list', () => {
    const shops = [
      shop('alpha', 'Alpha', '2026-01-02T00:00:00.000Z'),
      shop('bravo', 'Bravo', '2026-01-03T00:00:00.000Z'),
      shop('charlie', 'Charlie', '2026-01-04T00:00:00.000Z'),
    ]

    expect(moveCatalogRepositoryShop(shops, 'bravo', 'up').map((item) => item.id)).toEqual([
      'bravo',
      'alpha',
      'charlie',
    ])
    expect(moveCatalogRepositoryShop(shops, 'bravo', 'down').map((item) => item.id)).toEqual([
      'alpha',
      'charlie',
      'bravo',
    ])
    expect(shops.map((item) => item.id)).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('returns the original list when a move cannot be applied', () => {
    const shops = [
      shop('alpha', 'Alpha', '2026-01-02T00:00:00.000Z'),
      shop('bravo', 'Bravo', '2026-01-03T00:00:00.000Z'),
    ]

    expect(moveCatalogRepositoryShop(shops, 'alpha', 'up')).toBe(shops)
    expect(moveCatalogRepositoryShop(shops, 'missing', 'down')).toBe(shops)
  })

  it('sorts shops by name and newest import time', () => {
    const shops = [
      shop('wallet', 'Wallet Shop', '2026-01-03T00:00:00.000Z'),
      shop('strap', 'Strap Shop', '2026-01-05T00:00:00.000Z'),
      shop('apron', 'Apron Shop', '2026-01-02T00:00:00.000Z'),
    ]

    expect(sortCatalogRepository(shops, 'name').map((item) => item.id)).toEqual(['apron', 'strap', 'wallet'])
    expect(sortCatalogRepository(shops, 'imported').map((item) => item.id)).toEqual([
      'strap',
      'wallet',
      'apron',
    ])
    expect(shops.map((item) => item.id)).toEqual(['wallet', 'strap', 'apron'])
  })
})

describe('catalog export', () => {
  it('serializes a shop back to browser-safe ctlg JSON', () => {
    const original: CatalogRepositoryShop = {
      ...shop('shop-1', 'Tool Shop', '2026-01-02T00:00:00.000Z'),
      url: 'https://example.test',
      memo: 'Shop memo',
      metaVersion: '2',
      groups: [
        {
          id: 'group-1',
          guid: 'group-1',
          name: 'Awls',
          url: '',
          memo: 'Group memo',
          items: [
            {
              id: 'item-1',
              guid: 'item-1',
              name: 'Scratch Awl',
              category: 'Tools',
              unitPrice: '12.50',
              unitStr: 'each',
              url: 'https://example.test/awl',
              memo: 'Item memo',
              hasImage: true,
              imageDpi: 300,
              zipBmpBase64: 'AAA=',
            },
          ],
        },
      ],
      groupCount: 1,
      itemCount: 1,
    }

    const serialized = serializeCatalogShop(original)
    const parsed = JSON.parse(serialized) as {
      meta: { file_type: string; version: string }
      shop: { Items: Array<{ Items: Array<{ zipbmp?: string; dpi: number | null }> }> }
    }

    expect(parsed.meta.file_type).toBe('LeathercraftCAD_Catalog_Data')
    expect(parsed.meta.version).toBe('2')
    expect(parsed.shop.Items[0].Items[0].zipbmp).toBe('AAA=')
    expect(parsed.shop.Items[0].Items[0].dpi).toBe(300)

    const imported = parseCatalogShopImport(serialized, 'tool-shop.ctlg')
    expect(imported.name).toBe('Tool Shop')
    expect(imported.groups[0].items[0].name).toBe('Scratch Awl')
  })

  it('round-trips browser image calibration metadata', () => {
    const original: CatalogRepositoryShop = {
      ...shop('shop-1', 'Tool Shop', '2026-01-02T00:00:00.000Z'),
      groups: [
        {
          id: 'group-1',
          guid: 'group-1',
          name: 'Patterns',
          url: '',
          memo: '',
          items: [
            {
              id: 'item-1',
              guid: 'item-1',
              name: 'Wallet',
              category: 'Pattern',
              unitPrice: '5',
              unitStr: 'each',
              url: '',
              memo: '',
              hasImage: true,
              imageDpi: 300,
              imageDataUrl: 'data:image/png;base64,AAAA',
              imageScalePercent: 125,
              imageRulerLengthMm: 50,
              imageRotationDeg: 90,
              imageCropMode: 'square',
            },
          ],
        },
      ],
    }

    const imported = parseCatalogShopImport(serializeCatalogShop(original), 'tool-shop.ctlg')
    const item = imported.groups[0].items[0]
    expect(item.imageDataUrl).toBe('data:image/png;base64,AAAA')
    expect(item.imageScalePercent).toBe(125)
    expect(item.imageRulerLengthMm).toBe(50)
    expect(item.imageRotationDeg).toBe(90)
    expect(item.imageCropMode).toBe('square')
  })
})

describe('catalog editing', () => {
  it('updates shop, group, and item metadata without touching bundled catalogs', () => {
    const editable: CatalogRepositoryShop = {
      ...shop('shop-1', 'Tool Shop', '2026-01-02T00:00:00.000Z'),
      groups: [
        {
          id: 'group-1',
          guid: 'group-1',
          name: 'Old Group',
          url: '',
          memo: '',
          items: [
            {
              id: 'item-1',
              guid: 'item-1',
              name: 'Old Item',
              category: '',
              unitPrice: '',
              unitStr: '',
              url: '',
              memo: '',
              hasImage: false,
              imageDpi: null,
            },
          ],
        },
      ],
    }
    const bundled = { ...shop('builtin-shop', 'Bundled', '2026-01-01T00:00:00.000Z'), isBundled: true }

    const renamed = updateCatalogShop([editable, bundled], 'shop-1', { name: 'New Shop' })
    const grouped = updateCatalogGroup(renamed, 'shop-1', 'group-1', { name: 'New Group' })
    const itemed = updateCatalogItem(grouped, 'shop-1', 'group-1', 'item-1', {
      name: 'New Item',
      category: 'Pattern',
      imageDataUrl: 'data:image/png;base64,AAAA',
      imageScalePercent: 150,
      imageCropMode: 'max',
    })
    const untouched = updateCatalogShop(itemed, 'builtin-shop', { name: 'Changed' })

    expect(untouched[0].name).toBe('New Shop')
    expect(untouched[0].groups[0].name).toBe('New Group')
    expect(untouched[0].groups[0].items[0]).toMatchObject({
      name: 'New Item',
      category: 'Pattern',
      hasImage: true,
      imageScalePercent: 150,
      imageCropMode: 'max',
    })
    expect(untouched[1].name).toBe('Bundled')
  })
})
