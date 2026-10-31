import { parseImportedJsonDocument } from '../editor-json-import'
import type { CommunityDataClient, PublishedPattern, PublishedPatternSummary } from './cloud-types'
import type { ConvexTransport } from './convex-transport'
import { readAllCloudPages } from './convex-data-client'

type RemotePattern = PublishedPatternSummary & { docJson: string }
export function createCommunityDataClient(transport: ConvexTransport): CommunityDataClient {
  return {
    listPublic: () => readAllCloudPages((cursor) => transport.query('community:listPublic', { cursor })),
    listMine: () => readAllCloudPages((cursor) => transport.query('community:listMine', { cursor })),
    get: async (id, version) => {
      const pattern = await transport.query<RemotePattern | null>('community:get', { id, version: version ?? null })
      if (!pattern) return null
      const { docJson, ...metadata } = pattern
      return { ...metadata, doc: parseImportedJsonDocument(docJson).doc } satisfies PublishedPattern
    },
    publish: ({ doc, ...metadata }) => transport.mutation('community:publish', {
      ...metadata, id: metadata.id ?? null, expectedVersion: metadata.expectedVersion ?? null, docJson: JSON.stringify(doc),
    }),
    setVisibility: async (id, visibility) => { await transport.mutation('community:setVisibility', { id, visibility }) },
  }
}
