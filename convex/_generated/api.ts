/* Bootstrap component reference; regenerate against the selected deployment with convex codegen. */
import { componentsGeneric, makeFunctionReference, type FunctionReference } from 'convex/server'
import type { ComponentApi } from '@convex-dev/rate-limiter/_generated/component.js'
export const components = componentsGeneric() as unknown as { rateLimiter: ComponentApi<'rateLimiter'> }

export const internal = { cloudPublicationMaintenance: { retirePayloads: makeFunctionReference('cloudPublicationMaintenance:retirePayloads') as unknown as FunctionReference<'mutation', 'internal', { id: import('./dataModel').Id<'publishedPatterns'>; owner: string; cursor: string | null }, null> }, cloudAssetUpload: {
  claim: makeFunctionReference('cloudAssetUpload:claim') as unknown as FunctionReference<'mutation', 'internal', { id: AssetId; owner: string }, UploadReservation>,
  inspect: makeFunctionReference('cloudAssetUpload:inspect') as unknown as FunctionReference<'query', 'internal', { id: AssetId; owner: string }, UploadReservation | null>,
  finish: makeFunctionReference('cloudAssetUpload:finish') as unknown as FunctionReference<'mutation', 'internal', { id: AssetId; owner: string; storageId: StoredId; attempt: number }, null>,
  release: makeFunctionReference('cloudAssetUpload:release') as unknown as FunctionReference<'mutation', 'internal', { id: AssetId; owner: string; attempt: number }, null>,
}, cloudPrivateMaintenance: { purgeDrawing: makeFunctionReference('cloudPrivateMaintenance:purgeDrawing') as unknown as FunctionReference<'mutation', 'internal', { documentId: import('./dataModel').Id<'cloudDocuments'>; owner: string }, null> }, cloudAssetMaintenance: { collectOrphans: makeFunctionReference('cloudAssetMaintenance:collectOrphans') as unknown as FunctionReference<'mutation', 'internal', { cursor: string | null; pendingOnly?: boolean }, null> } }

type AssetId = import('./dataModel').Id<'cloudAssets'>
type StoredId = import('./dataModel').Id<'_storage'>
type UploadReservation = { owner: string; size: number; contentType: string; sha256: string; storageId: StoredId | null; attempt: number }
