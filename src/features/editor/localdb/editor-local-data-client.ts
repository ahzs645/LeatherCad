import type { AppDataClient } from './app-data-client'
import { createDataClient, type DataClientMode } from './data-client-factory'

const DEFAULT_MODE: DataClientMode = 'local'

let cachedClient: AppDataClient | null | undefined

export function getEditorLocalDataClient(): AppDataClient | null {
  if (cachedClient !== undefined) {
    return cachedClient
  }
  cachedClient = createDataClient(DEFAULT_MODE)
  return cachedClient
}

export async function withEditorLocalDataClient<T>(operation: (client: AppDataClient) => Promise<T>): Promise<T | null> {
  const client = getEditorLocalDataClient()
  if (!client) {
    return null
  }
  try {
    return await operation(client)
  } catch {
    return null
  }
}
