import { describe, expect, it } from 'vitest'
import {
  moveCatalogRepositoryShop,
  sortCatalogRepository,
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
