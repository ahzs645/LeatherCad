import { hydrateCloudDocument, serializeCloudDocument } from './cloud-asset-client'
import type { AppDataClient, StoredEditorDocument } from './app-data-client'
import { parseImportedJsonDocument } from '../editor-json-import'
import { createConvexTransport, type ConvexConnectionOptions, type ConvexTransport } from './convex-transport'

type RemoteDocument = Omit<StoredEditorDocument, 'doc'> & { docJson: string; revision: number }
type Page<T> = { page: T[]; continueCursor: string; isDone: boolean }
export type ConvexDataClientOptions = ConvexConnectionOptions | { transport: ConvexTransport }

export async function readAllCloudPages<T>(query: (cursor: string | null) => Promise<Page<T>>): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | null = null
  const seen = new Set<string>()
  for (let pageIndex = 0; pageIndex < 2_000; pageIndex += 1) {
    const result = await query(cursor)
    if (!result || !Array.isArray(result.page) || typeof result.isDone !== 'boolean' || typeof result.continueCursor !== 'string') {
      throw new Error('Cloud returned an invalid page')
    }
    rows.push(...result.page)
    if (result.isDone) return rows
    if (!result.continueCursor || seen.has(result.continueCursor)) throw new Error('Cloud pagination did not advance')
    seen.add(result.continueCursor)
    cursor = result.continueCursor
  }
  throw new Error('Cloud library exceeds this operation’s page limit')
}

export function createConvexDataClient(options?: ConvexDataClientOptions): AppDataClient {
  const url = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (!options && !url) throw new Error('Cloud is not configured')
  const transport = options && 'transport' in options ? options.transport : createConvexTransport(options ?? { url: url! })
  const revisions = new Map<string, number>()
  const decode = async (record: RemoteDocument, rememberRevision = true): Promise<StoredEditorDocument> => {
    if (!record || typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.docJson !== 'string'
      || !Number.isFinite(record.revision) || !Number.isFinite(record.createdAt) || !Number.isFinite(record.updatedAt)) {
      throw new Error('Cloud drawing metadata is invalid')
    }
    if (rememberRevision || !revisions.has(record.id)) revisions.set(record.id, record.revision)
    return {
      id: record.id, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt,
      doc: parseImportedJsonDocument(await hydrateCloudDocument(record.docJson, transport), { preserveShapeIds: true }).doc,
    }
  }
  const setting = {
    get: (key: string) => transport.query<string | null>('cloudSettings:get', { key }),
    set: async (key: string, value: string) => { await transport.mutation('cloudSettings:set', { key, value }) },
  }
  const readRepository = async <T>(key: string): Promise<T[]> => {
    const raw = await setting.get(key)
    if (!raw) return []
    const entries: unknown = JSON.parse(raw)
    if (!Array.isArray(entries)) throw new Error('Cloud library data is invalid')
    return entries as T[]
  }
  const client: AppDataClient = {
    documents: {
      list: async () => {
        const rows = await readAllCloudPages<RemoteDocument>((cursor) => transport.query('cloudDocuments:list', { cursor }))
        const result: StoredEditorDocument[] = []
        for (const row of rows) result.push(await decode(row, false))
        return result
      },
      get: async (id) => {
        const result = await transport.query<RemoteDocument | null>('cloudDocuments:get', { id })
        return result ? decode(result) : null
      },
      create: async (input) => decode(await transport.mutation<RemoteDocument>('cloudDocuments:create', {
        id: input.id ?? crypto.randomUUID(), name: input.name, docJson: await serializeCloudDocument(input.doc, transport),
      })),
      save: async (input) => {
        return decode(await transport.mutation<RemoteDocument>('cloudDocuments:save', {
          id: input.id, name: input.name ?? input.doc.documentName ?? 'Untitled project',
          docJson: await serializeCloudDocument(input.doc, transport), expectedRevision: revisions.get(input.id) ?? null,
        }))
      },
      delete: async (id) => { await transport.mutation('cloudDocuments:remove', { id, expectedRevision: revisions.get(id) ?? null }) },
      getAutoSaveSnapshot: () => setting.get('autosave'),
      writeAutoSaveSnapshot: async (serializedDoc) => {
        parseImportedJsonDocument(serializedDoc)
        await setting.set('autosave', serializedDoc)
      },
      clearAutoSaveSnapshot: async () => { await transport.mutation('cloudSettings:remove', { key: 'autosave' }) },
    },
    settings: { get: (key) => setting.get(`setting:${key}`), set: (key, value) => setting.set(`setting:${key}`, value) },
    templateRepository: {
      list: () => readRepository('templates'), replaceAll: (entries) => setting.set('templates', JSON.stringify(entries)),
      hasSavedEntries: async () => (await readRepository('templates')).length > 0,
    },
    catalogRepository: { list: () => readRepository('catalog'), replaceAll: (shops) => setting.set('catalog', JSON.stringify(shops)) },
    exportAll: async () => {
      const [documents, settings, templateRepository, catalogRepository] = await Promise.all([
        client.documents.list(),
        readAllCloudPages<{ key: string; value: string }>((cursor) => transport.query('cloudSettings:list', { cursor })),
        client.templateRepository.list(), client.catalogRepository.list(),
      ])
      return {
        documents,
        settings: Object.fromEntries(settings.filter(({ key }) => key.startsWith('setting:')).map(({ key, value }) => [key.slice(8), value])),
        templateRepository, catalogRepository,
      }
    },
  }
  return client
}
