import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { canvasToTracingPngDataUrl, dataUrlToUint8Array } from './tracing-asset-ops'

if (GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl
}

export type PdfRenderResult = {
  renderDataUrl: string
  pageCount: number
  pageNumber: number
  width: number
  height: number
}

export function clampPdfPage(requested: number, pageCount: number) {
  return Math.max(1, Math.min(pageCount, Math.round(requested)))
}

export async function renderPdfPageToTracingImage(
  source: string | Uint8Array,
  requestedPage: number,
): Promise<PdfRenderResult> {
  const loadingTask =
    typeof source === 'string' && source.startsWith('data:')
      ? getDocument({ data: dataUrlToUint8Array(source) })
      : typeof source === 'string'
        ? getDocument(source)
        : getDocument({ data: source })
  const document = await loadingTask.promise

  try {
    const pageCount = Math.max(1, document.numPages)
    const pageNumber = clampPdfPage(requestedPage, pageCount)
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = window.document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to render PDF page')
    }

    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    await page.render({ canvasContext: context, viewport, canvas }).promise

    return {
      renderDataUrl: canvasToTracingPngDataUrl(canvas),
      pageCount,
      pageNumber,
      width: viewport.width,
      height: viewport.height,
    }
  } finally {
    await document.destroy()
  }
}
