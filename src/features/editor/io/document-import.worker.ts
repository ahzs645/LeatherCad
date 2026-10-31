import { importSerializedDocument } from './document-import'
import { importDxfDocument, type DxfImportOptions } from './io-dxf-import'

self.onmessage = async (event: MessageEvent<{ raw: string; fileName: string; dxfOptions?: DxfImportOptions }>) => {
  try {
    const { raw, fileName, dxfOptions } = event.data
    const result = dxfOptions ? importDxfDocument(raw, dxfOptions) : await importSerializedDocument(raw, fileName)
    self.postMessage({ result })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not parse drawing' })
  }
}
