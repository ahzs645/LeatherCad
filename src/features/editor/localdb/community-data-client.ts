import { hydrateCloudDocument, serializeCloudDocument } from './cloud-asset-client'
import { parseImportedJsonDocument } from '../editor-json-import'
import { checkedCloudPage, type CloudPage, type CommunityDataClient, type PublishedPattern, type PublishedPatternSummary } from './cloud-types'
import type { ConvexTransport } from './convex-transport'
import { readAllCloudPages } from './convex-data-client'

type RemotePattern = PublishedPatternSummary & { docJson: string }
export function createCommunityDataClient(transport: ConvexTransport): CommunityDataClient {
  const snapshots = new Map<string, Pick<PublishedPatternSummary, 'version' | 'visibilityRevision'>>()
  const remember = <T extends PublishedPatternSummary>(pattern: T): T => {
    snapshots.set(pattern.id, { version: pattern.version, visibilityRevision: pattern.visibilityRevision ?? 0 })
    return pattern
  }
  const listPublicPage = async (cursor: string | null = null, search = '') => {
    const result = checkedCloudPage(await transport.query<CloudPage<PublishedPatternSummary>>(search.trim() ? 'community:searchPublic' : 'community:listPublic', search.trim() ? { cursor, search: search.trim() } : { cursor }))
    return { ...result, page: result.page.map(remember) }
  }
  const listMinePage = async (cursor: string | null = null) => {
    const result = checkedCloudPage(await transport.query<CloudPage<PublishedPatternSummary>>('community:listMine', { cursor }))
    return { ...result, page: result.page.map(remember) }
  }
  return {
    listPublicPage, listMinePage,
    listPublic: () => readAllCloudPages(cursor => listPublicPage(cursor)),
    listMine: () => readAllCloudPages(cursor => listMinePage(cursor)),
    get: async (id, version) => {
      const pattern = await transport.query<RemotePattern | null>('community:get', { id, version: version ?? null })
      if (!pattern) return null
      const { docJson, ...metadata } = pattern
      remember(pattern)
      return { ...metadata, doc: parseImportedJsonDocument(await hydrateCloudDocument(docJson, transport, { id: pattern.id, version: pattern.version })).doc } satisfies PublishedPattern
    },
    publish: async ({ doc, ...metadata }) => remember(await transport.mutation('community:publish', {
      ...metadata, expectedVisibilityRevision: metadata.expectedVisibilityRevision ?? (metadata.id ? snapshots.get(metadata.id)?.visibilityRevision : undefined), id: metadata.id ?? null, expectedVersion: metadata.expectedVersion ?? null, docJson: await serializeCloudDocument(doc, transport),
    })),
    retire: async snapshot => { await transport.mutation('community:retire', { id: snapshot.id, expectedVersion: snapshot.version, expectedVisibilityRevision: snapshot.visibilityRevision ?? 0 }) },
    setVisibility: async (id, visibility, snapshot = snapshots.get(id)) => {
      await transport.mutation('community:setVisibility', { id, visibility, expectedVersion: snapshot?.version ?? null, expectedVisibilityRevision: snapshot?.visibilityRevision ?? 0 })
      if (snapshot) snapshots.set(id, { ...snapshot, visibilityRevision: (snapshot.visibilityRevision ?? 0) + 1 })
    },
  }
}
