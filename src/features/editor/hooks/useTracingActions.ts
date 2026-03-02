import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import type { TracingOverlay } from '../cad/cad-types'

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

    const sourceUrl = URL.createObjectURL(file)
    const overlayId = uid()
    const nextOverlay: TracingOverlay = {
      id: overlayId,
      name: file.name,
      kind: isPdf ? 'pdf' : 'image',
      sourceUrl,
      visible: true,
      locked: true,
      opacity: isPdf ? 0.6 : 0.75,
      scale: 1,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      width: 800,
      height: 800,
      isObjectUrl: true,
    }

    if (isImage) {
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
    }

    setTracingOverlays((previous) => [nextOverlay, ...previous])
    setActiveTracingOverlayId(overlayId)
    setShowTracingModal(true)
    setStatus(isPdf ? 'PDF tracing imported (vector preview box)' : 'Tracing image imported')
  }

  return {
    handleUpdateTracingOverlay,
    handleDeleteTracingOverlay,
    handleImportTracing,
  }
}
