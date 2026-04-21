import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import type { TracingOverlay } from '../cad/cad-types'
import { fileToTracingDataUrl, readTracingImageNaturalSize } from '../ops/tracing-asset-ops'
import { renderPdfPageToTracingImage } from '../ops/tracing-pdf-render'

type UseTracingActionsParams = {
  setTracingOverlays: Dispatch<SetStateAction<TracingOverlay[]>>
  setActiveTracingOverlayId: Dispatch<SetStateAction<string | null>>
  setShowTracingModal: Dispatch<SetStateAction<boolean>>
  setStatus: Dispatch<SetStateAction<string>>
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
      const rendered = await renderPdfPageToTracingImage(overlay.pdfSourceUrl, requestedPage)
      setTracingOverlays((previous) =>
        previous.map((entry) =>
          entry.id === overlay.id
            ? {
                ...entry,
                sourceUrl: rendered.renderDataUrl,
                width: rendered.width,
                height: rendered.height,
                pdfPageNumber: rendered.pageNumber,
                pdfPageCount: rendered.pageCount,
                isObjectUrl: false,
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
      let sourceUrl = ''
      try {
        sourceUrl = await fileToTracingDataUrl(file)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        setStatus(`Tracing image import failed: ${message}`)
        return
      }
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
        isObjectUrl: false,
      }

      try {
        const size = await readTracingImageNaturalSize(sourceUrl)
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
      const pdfSourceUrl = await fileToTracingDataUrl(file)
      const rendered = await renderPdfPageToTracingImage(pdfSourceUrl, 1)
      const nextOverlay: TracingOverlay = {
        id: overlayId,
        name: file.name,
        kind: 'pdf',
        sourceUrl: rendered.renderDataUrl,
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
        isObjectUrl: false,
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
