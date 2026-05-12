import type { AppDataClient, LocalDbExport } from './app-data-client'
import { getEditorLocalDataClient } from './editor-local-data-client'

export async function exportLocalData(client: AppDataClient | null = getEditorLocalDataClient()): Promise<LocalDbExport> {
  if (!client) {
    return {
      documents: [],
      settings: {},
      templateRepository: [],
      catalogRepository: [],
    }
  }
  return client.exportAll()
}

export async function importLocalData(data: LocalDbExport, client: AppDataClient | null = getEditorLocalDataClient()) {
  if (!client) {
    return
  }

  await Promise.all([
    Promise.all(
      data.documents.map((document) =>
        client.documents.save({
          id: document.id,
          name: document.name,
          doc: document.doc,
        }),
      ),
    ),
    Promise.all(Object.entries(data.settings).map(([key, value]) => client.settings.set(key, value))),
    client.templateRepository.replaceAll(data.templateRepository),
    client.catalogRepository.replaceAll(data.catalogRepository),
  ])
}

export async function pushLocalDataToCloud(localClient: AppDataClient, cloudClient: AppDataClient) {
  const exported = await localClient.exportAll()
  await importLocalData(exported, cloudClient)
}
