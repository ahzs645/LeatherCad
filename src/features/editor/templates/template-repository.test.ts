import { describe, expect, it } from 'vitest'
import type { DocFile } from '../cad/cad-types'
import {
  moveTemplateRepositoryEntry,
  sortTemplateRepository,
  type TemplateRepositoryEntry,
} from './template-repository'

const minimalDoc: DocFile = {
  version: 1,
  units: 'mm',
  layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false }],
  activeLayerId: 'layer-1',
  lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', style: 'solid', color: '#000000', visible: true }],
  activeLineTypeId: 'cut',
  objects: [],
  foldLines: [],
}

function entry(id: string, name: string, updatedAt: string): TemplateRepositoryEntry {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    doc: minimalDoc,
  }
}

describe('template repository ordering', () => {
  it('moves an entry up or down without mutating the original list', () => {
    const entries = [
      entry('strap', 'Strap', '2026-01-02T00:00:00.000Z'),
      entry('wallet', 'Wallet', '2026-01-03T00:00:00.000Z'),
      entry('pouch', 'Pouch', '2026-01-04T00:00:00.000Z'),
    ]

    expect(moveTemplateRepositoryEntry(entries, 'wallet', 'up').map((item) => item.id)).toEqual([
      'wallet',
      'strap',
      'pouch',
    ])
    expect(moveTemplateRepositoryEntry(entries, 'wallet', 'down').map((item) => item.id)).toEqual([
      'strap',
      'pouch',
      'wallet',
    ])
    expect(entries.map((item) => item.id)).toEqual(['strap', 'wallet', 'pouch'])
  })

  it('returns the original list when a move cannot be applied', () => {
    const entries = [
      entry('strap', 'Strap', '2026-01-02T00:00:00.000Z'),
      entry('wallet', 'Wallet', '2026-01-03T00:00:00.000Z'),
    ]

    expect(moveTemplateRepositoryEntry(entries, 'strap', 'up')).toBe(entries)
    expect(moveTemplateRepositoryEntry(entries, 'missing', 'down')).toBe(entries)
  })

  it('sorts templates by name and newest update time', () => {
    const entries = [
      entry('wallet', 'Wallet', '2026-01-03T00:00:00.000Z'),
      entry('strap', 'Strap', '2026-01-05T00:00:00.000Z'),
      entry('apron', 'Apron', '2026-01-02T00:00:00.000Z'),
    ]

    expect(sortTemplateRepository(entries, 'name').map((item) => item.id)).toEqual(['apron', 'strap', 'wallet'])
    expect(sortTemplateRepository(entries, 'updated').map((item) => item.id)).toEqual([
      'strap',
      'wallet',
      'apron',
    ])
    expect(entries.map((item) => item.id)).toEqual(['wallet', 'strap', 'apron'])
  })
})
