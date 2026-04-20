import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import type { Backdrop } from '../cad/cad-types'
import {
  clearBackdropHistory,
  computeBackdropMmSize,
  fileToDataUrl,
  popBackdropRedo,
  popBackdropUndo,
  pushBackdropUndo,
  readImageNaturalSize,
} from '../ops/backdrop-ops'

type UseBackdropActionsParams = {
  backdrops: Backdrop[]
  setBackdrops: Dispatch<SetStateAction<Backdrop[]>>
  activeBackdropId: string | null
  setActiveBackdropId: Dispatch<SetStateAction<string | null>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useBackdropActions({
  backdrops,
  setBackdrops,
  activeBackdropId,
  setActiveBackdropId,
  setStatus,
}: UseBackdropActionsParams) {
  const handleImportBackdrop = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus('Backdrop import supports image files only')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      const { width: bitmapWidth, height: bitmapHeight } = await readImageNaturalSize(dataUrl)
      const { width, height } = computeBackdropMmSize(bitmapWidth, bitmapHeight, undefined)
      const backdrop: Backdrop = {
        id: uid(),
        name: file.name,
        bitmapDataUrl: dataUrl,
        bitmapWidth,
        bitmapHeight,
        leftTop: { x: 0, y: 0 },
        width,
        height,
        angleDeg: 0,
        dpi: undefined,
        fullPath: file.name,
        visible: true,
        locked: false,
        opacity: 1,
      }
      setBackdrops((previous) => [backdrop, ...previous])
      setActiveBackdropId(backdrop.id)
      setStatus(`Backdrop imported (${bitmapWidth}×${bitmapHeight} px)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Backdrop import failed: ${message}`)
    }
  }

  const handleDeleteActiveBackdrop = () => {
    if (!activeBackdropId) {
      setStatus('No active backdrop')
      return
    }
    clearBackdropHistory(activeBackdropId)
    setBackdrops((previous) => previous.filter((backdrop) => backdrop.id !== activeBackdropId))
    setActiveBackdropId(null)
    setStatus('Backdrop removed')
  }

  const handleUpdateBackdrop = (backdropId: string, patch: Partial<Backdrop>) => {
    setBackdrops((previous) =>
      previous.map((backdrop) => {
        if (backdrop.id !== backdropId) return backdrop
        pushBackdropUndo(backdrop)
        const next = { ...backdrop, ...patch }
        if (patch.dpi !== undefined) {
          const size = computeBackdropMmSize(next.bitmapWidth, next.bitmapHeight, patch.dpi || undefined)
          next.width = size.width
          next.height = size.height
        }
        return next
      }),
    )
  }

  const handleBackdropUndo = (backdropId: string) => {
    setBackdrops((previous) =>
      previous.map((backdrop) => {
        if (backdrop.id !== backdropId) return backdrop
        const reverted = popBackdropUndo(backdrop)
        return reverted ?? backdrop
      }),
    )
  }

  const handleBackdropRedo = (backdropId: string) => {
    setBackdrops((previous) =>
      previous.map((backdrop) => {
        if (backdrop.id !== backdropId) return backdrop
        const forward = popBackdropRedo(backdrop)
        return forward ?? backdrop
      }),
    )
  }

  return {
    handleImportBackdrop,
    handleDeleteActiveBackdrop,
    handleUpdateBackdrop,
    handleBackdropUndo,
    handleBackdropRedo,
    activeBackdrop: backdrops.find((backdrop) => backdrop.id === activeBackdropId) ?? null,
  }
}
