import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { uid } from '../cad/cad-geometry'
import type { TracingOverlay } from '../cad/cad-types'

if (GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl
}

type UseTracingActionsParams = {
  setTracingOverlays: Dispatch<SetStateAction<TracingOverlay[]>>
  setActiveTracingOverlayId: Dispatch<SetStateAction<string | null>>
  setShowTracingModal: Dispatch<SetStateAction<boolean>>
  setStatus: Dispatch<SetStateAction<string>>
}

type PdfRenderResult = {
  renderUrl: string
  pageCount: number
  pageNumber: number
  width: number
  height: number
}

function clampPdfPage(requested: number, pageCount: number) {
  return Math.max(1, Math.min(pageCount, Math.round(requested)))
}

async function renderPdfPage(source: string | Uint8Array, requestedPage: number): Promise<PdfRenderResult> {
  const loadingTask = typeof source === 'string' ? getDocument(source) : getDocument({ data: source })
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

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (!value) {
          reject(new Error('Could not encode rendered PDF page'))
          return
        }
        resolve(value)
      }, 'image/png')
    })

    return {
      renderUrl: URL.createObjectURL(blob),
      pageCount,
      pageNumber,
      width: viewport.width,
      height: viewport.height,
    }
  } finally {
    await document.destroy()
  }
}

export function useTracingActions(params: UseTracingActionsParams) {
  const {
    setTracingOverlays,
    setActiveTracingOverlayId,
    setShowTracingModal,
    setStatus,
  } = params

  const handleUpdateTracingOverlay = (overlayId: string, patch: Partial<TracingOverlay>) => {
    setTracingOverlays((previous) =>
      previous.map((overlay) =>
        overlay.id === overlayId
          ? {
              ...overlay,
              ...patch,
            }
          : overlay,
      ),
    )
  }

  const handleDeleteTracingOverlay = (overlayId: string) => {
    setTracingOverlays((previous) => previous.filter((overlay) => overlay.id !== overlayId))
    setStatus('Tracing overlay removed')
  }

  const handleSetPdfTracingPage = async (overlay: TracingOverlay, requestedPage: number) => {
    if (overlay.kind !== 'pdf' || !overlay.pdfSourceUrl) {
      return
    }

    try {
      setStatus('Rendering PDF page...')
      const rendered = await renderPdfPage(overlay.pdfSourceUrl, requestedPage)
      setTracingOverlays((previous) =>
        previous.map((entry) =>
          entry.id === overlay.id
            ? {
                ...entry,
                sourceUrl: rendered.renderUrl,
                width: rendered.width,
                height: rendered.height,
                pdfPageNumber: rendered.pageNumber,
                pdfPageCount: rendered.pageCount,
              }
            : entry,
        ),
      )
      setStatus(`PDF page ${rendered.pageNumber}/${rendered.pageCount} rendered`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`PDF page render failed: ${message}`)
    }
  }

  const handleImportTracing = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) {
      setStatus('Tracing import supports image files and PDFs only')
      return
    }

    const overlayId = uid()
    if (isImage) {
      const sourceUrl = URL.createObjectURL(file)
      const nextOverlay: TracingOverlay = {
        id: overlayId,
        name: file.name,
        kind: 'image',
        sourceUrl,
        visible: true,
        locked: true,
        opacity: 0.75,
        scale: 1,
        rotationDeg: 0,
        offsetX: 0,
        offsetY: 0,
        width: 800,
        height: 800,
        isObjectUrl: true,
      }

      try {
        const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image()
          image.onload = () => {
            resolve({
              width: image.naturalWidth || 800,
              height: image.naturalHeight || 800,
            })
          }
          image.onerror = () => reject(new Error('Could not read image'))
          image.src = sourceUrl
        })
        nextOverlay.width = size.width
        nextOverlay.height = size.height
      } catch {
        // Keep fallback dimensions for failed metadata reads.
      }

      setTracingOverlays((previous) => [nextOverlay, ...previous])
      setActiveTracingOverlayId(overlayId)
      setShowTracingModal(true)
      setStatus('Tracing image imported')
      return
    }

    try {
      setStatus('Loading PDF tracing...')
      const pdfSourceUrl = URL.createObjectURL(file)
      const pdfBytes = new Uint8Array(await file.arrayBuffer())
      const firstPage = await renderPdfPage(pdfBytes, 1)
      let importPage = firstPage.pageNumber
      if (firstPage.pageCount > 1) {
        const input = Number(
          window.prompt(`PDF has ${firstPage.pageCount} pages. Import which page?`, String(firstPage.pageNumber)),
        )
        if (Number.isFinite(input)) {
          importPage = clampPdfPage(input, firstPage.pageCount)
        }
      }

      const rendered = importPage === firstPage.pageNumber ? firstPage : await renderPdfPage(pdfBytes, importPage)
      const nextOverlay: TracingOverlay = {
        id: overlayId,
        name: file.name,
        kind: 'pdf',
        sourceUrl: rendered.renderUrl,
        pdfSourceUrl,
        pdfPageNumber: rendered.pageNumber,
        pdfPageCount: rendered.pageCount,
        visible: true,
        locked: true,
        opacity: 0.6,
        scale: 1,
        rotationDeg: 0,
        offsetX: 0,
        offsetY: 0,
        width: rendered.width,
        height: rendered.height,
        isObjectUrl: true,
      }

      setTracingOverlays((previous) => [nextOverlay, ...previous])
      setActiveTracingOverlayId(overlayId)
      setShowTracingModal(true)
      setStatus(`PDF tracing imported (page ${rendered.pageNumber}/${rendered.pageCount})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`PDF tracing import failed: ${message}`)
    }
  }

  return {
    handleUpdateTracingOverlay,
    handleDeleteTracingOverlay,
    handleSetPdfTracingPage,
    handleImportTracing,
  }
}
