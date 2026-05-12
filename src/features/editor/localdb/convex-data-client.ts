import type { AppDataClient } from './app-data-client'

function notImplemented(): never {
  throw new Error('Convex data client is not implemented yet')
}

export function createConvexDataClient(): AppDataClient {
  return {
    documents: {
      list: async () => notImplemented(),
      get: async () => notImplemented(),
      create: async () => notImplemented(),
      save: async () => notImplemented(),
      delete: async () => notImplemented(),
      getAutoSaveSnapshot: async () => notImplemented(),
      writeAutoSaveSnapshot: async () => notImplemented(),
      clearAutoSaveSnapshot: async () => notImplemented(),
    },
    settings: {
      get: async () => notImplemented(),
      set: async () => notImplemented(),
    },
    templateRepository: {
      list: async () => notImplemented(),
      replaceAll: async () => notImplemented(),
      hasSavedEntries: async () => notImplemented(),
    },
    catalogRepository: {
      list: async () => notImplemented(),
      replaceAll: async () => notImplemented(),
    },
    exportAll: async () => notImplemented(),
  }
}
