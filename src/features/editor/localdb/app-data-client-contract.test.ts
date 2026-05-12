import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { DocFile } from '../cad/cad-types'
import type { AppDataClient } from './app-data-client'
import { createDexieDataClient } from './dexie-data-client'
import { exportLocalData, importLocalData, pushLocalDataToCloud } from './local-data-migration'

function makeDoc(documentName: string): DocFile {
  return {
    version: 1,
    units: 'mm',
    documentName,
    layers: [{ id: 'layer-1', name: 'Main', visible: true, locked: false }],
    activeLayerId: 'layer-1',
    sketchGroups: [],
    activeSketchGroupId: null,
    lineTypes: [],
    activeLineTypeId: 'cut',
    objects: [],
    foldLines: [],
    stitchHoles: [],
    constraints: [],
    patternPieces: [],
    pieceInterfaces: [],
    assemblyConnections: [],
    pieceGrainlines: [],
    pieceLabels: [],
    piecePlacementLabels: [],
    piecePlacements3d: [],
    seamConnections: [],
    seamAllowances: [],
    pieceNotches: [],
    hardwareMarkers: [],
    snapSettings: null,
    showAnnotations: true,
    tracingOverlays: [],
    backdrops: [],
    projectMemo: '',
    stitchAlwaysShapeIds: [],
    stitchThreadColor: '#111111',
    threePreviewSettings: null,
    avatars: [],
    threeTextureSource: null,
    threeTextureShapeIds: [],
    leatherImageFills: [],
    activeLeatherImageFillId: null,
    showCanvasRuler: true,
    showDimensions: true,
    dimensionLines: [],
    printAreas: [],
  }
}

function requireClient(client: AppDataClient | null): AppDataClient {
  if (!client) {
    throw new Error('Expected IndexedDB-backed client to be available')
  }
  return client
}

export function runAppDataClientContractTests(createClient: () => AppDataClient) {
  it('creates, lists, updates, gets, and soft-deletes project documents', async () => {
    const client = createClient()
    const created = await client.documents.create({ id: 'project-1', name: 'Wallet', doc: makeDoc('Wallet') })

    expect(created).toMatchObject({ id: 'project-1', name: 'Wallet' })
    expect((await client.documents.list()).map((document) => document.id)).toEqual(['project-1'])

    const saved = await client.documents.save({ id: 'project-1', name: 'Updated Wallet', doc: makeDoc('Updated Wallet') })
    expect(saved.createdAt).toBe(created.createdAt)
    expect(saved.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
    expect((await client.documents.get('project-1'))?.name).toBe('Updated Wallet')

    await client.documents.delete('project-1')
    expect(await client.documents.get('project-1')).toBeNull()
    expect(await client.documents.list()).toEqual([])
  })

  it('stores settings, autosave snapshots, template repository, and catalog repository', async () => {
    const client = createClient()
    const doc = makeDoc('Autosaved')
    await client.settings.set('mode', 'local')
    await client.documents.writeAutoSaveSnapshot(JSON.stringify(doc))
    await client.templateRepository.replaceAll([
      {
        id: 'template-1',
        name: 'Template',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        doc,
      },
    ])
    await client.catalogRepository.replaceAll([
      {
        id: 'shop-1',
        name: 'Shop',
        guid: 'guid-1',
        url: '',
        memo: '',
        shopVersion: 1,
        metaVersion: '1',
        sourceFileName: 'shop.json',
        importedAt: '2026-01-01T00:00:00.000Z',
        groups: [],
      },
    ])

    expect(await client.settings.get('mode')).toBe('local')
    expect(JSON.parse((await client.documents.getAutoSaveSnapshot()) ?? '{}')).toMatchObject({ documentName: 'Autosaved' })
    expect(await client.templateRepository.hasSavedEntries()).toBe(true)
    expect((await client.templateRepository.list()).map((entry) => entry.id)).toEqual(['template-1'])
    expect((await client.catalogRepository.list()).map((shop) => shop.id)).toEqual(['shop-1'])
  })
}

describe('Dexie AppDataClient contract', () => {
  let index = 0
  runAppDataClientContractTests(() => {
    index += 1
    return requireClient(createDexieDataClient({ databaseName: `leathercad-test-${Date.now()}-${index}` }))
  })

  it('exports, imports, and pushes local data through AppDataClient', async () => {
    const source = requireClient(createDexieDataClient({ databaseName: 'leathercad-test-export-source' }))
    const target = requireClient(createDexieDataClient({ databaseName: 'leathercad-test-export-target' }))
    const cloud = requireClient(createDexieDataClient({ databaseName: 'leathercad-test-export-cloud' }))

    await source.documents.create({ id: 'project-1', name: 'Wallet', doc: makeDoc('Wallet') })
    await source.settings.set('sync', 'ready')

    const exported = await exportLocalData(source)
    await importLocalData(exported, target)
    await pushLocalDataToCloud(source, cloud)

    expect((await target.documents.get('project-1'))?.name).toBe('Wallet')
    expect(await target.settings.get('sync')).toBe('ready')
    expect((await cloud.documents.get('project-1'))?.name).toBe('Wallet')
  })
})
