import { importSerializedDocument, type DocumentImportResult } from './document-import'
import type { DxfImportOptions, DxfImportResult } from './io-dxf-import'
import { assertImportTextBudget } from './import-budget'

function abortError() { return new DOMException('Import canceled', 'AbortError') }

/** Each operation owns a disposable worker, so cancellation stops CPU work. */
async function parseInWorker<T>(raw: string, fileName: string, signal: AbortSignal, dxfOptions?: DxfImportOptions): Promise<T> {
  assertImportTextBudget(raw)
  if (signal.aborted) throw abortError()
  if (typeof Worker === 'undefined') {
    // Nonbrowser test/SSR environments. Production browsers use the worker.
    const result = dxfOptions
      ? (await import('./io-dxf-import')).importDxfDocument(raw, dxfOptions)
      : await importSerializedDocument(raw, fileName)
    if (signal.aborted) throw abortError()
    return result as T
  }
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(new URL('./document-import.worker.ts', import.meta.url), { type: 'module' })
    const finish = (error?: Error, value?: T) => {
      signal.removeEventListener('abort', onAbort)
      worker.terminate()
      if (error) reject(error)
      else resolve(value!)
    }
    const onAbort = () => finish(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    worker.onmessage = (event: MessageEvent<{ result?: T; error?: string }>) => finish(event.data.error ? new Error(event.data.error) : undefined, event.data.result)
    worker.onerror = () => finish(new Error('Drawing import worker failed. The current document was not changed.'))
    worker.postMessage({ raw, fileName, dxfOptions })
  })
}

export const parseDocumentFile = (raw: string, fileName: string, signal: AbortSignal) => parseInWorker<DocumentImportResult>(raw, fileName, signal)
export const parseDxfFile = (raw: string, fileName: string, options: DxfImportOptions, signal: AbortSignal) => parseInWorker<DxfImportResult>(raw, fileName, signal, options)
