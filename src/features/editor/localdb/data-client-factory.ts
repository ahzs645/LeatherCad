import type { AppDataClient } from './app-data-client'
import { createConvexDataClient } from './convex-data-client'
import { createDexieDataClient } from './dexie-data-client'

export type DataClientMode = 'local' | 'convex'

export function createDataClient(mode: DataClientMode): AppDataClient | null {
  if (mode === 'convex') {
    return createConvexDataClient()
  }
  return createDexieDataClient()
}
