import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type { LeatherImageFill, LineType, Shape } from '../cad/cad-types'
import {
  buildLeatherImagePlacementBounds,
  clampLeatherImageFill,
  computeLeatherImageMmSize,
  createLeatherImageFillFromImage,
  fileToLeatherImageDataUrl,
  readLeatherImageNaturalSize,
  resolveSelectedClosedOutlineShapeIds,
} from '../ops/leather-image-fill-ops'

type UseLeatherImageFillActionsParams = {
  leatherImageFills: LeatherImageFill[]
  activeLeatherImageFill: LeatherImageFill | null
  shapes: Shape[]
  lineTypes: LineType[]
  selectedShapeIdSet: Set<string>
  setLeatherImageFills: Dispatch<SetStateAction<LeatherImageFill[]>>
  setActiveLeatherImageFillId: Dispatch<SetStateAction<string | null>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useLeatherImageFillActions({
  leatherImageFills,
  activeLeatherImageFill,
  shapes,
  lineTypes,
  selectedShapeIdSet,
  setLeatherImageFills,
  setActiveLeatherImageFillId,
  setStatus,
}: UseLeatherImageFillActionsParams) {
  const resolveSelectedAssignment = () =>
    resolveSelectedClosedOutlineShapeIds(shapes, lineTypes, selectedShapeIdSet)

  const handleImportLeatherImageFill = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      setStatus('Leather image import supports image files only')
      return
    }

    try {
      const imageDataUrl = await fileToLeatherImageDataUrl(file)
      const { width: bitmapWidth, height: bitmapHeight } = await readLeatherImageNaturalSize(imageDataUrl)
      const assignedShapeIds = resolveSelectedAssignment()
      const placementBounds = buildLeatherImagePlacementBounds(shapes, assignedShapeIds)
      const fill = createLeatherImageFillFromImage({
        name: file.name,
        imageDataUrl,
        bitmapWidth,
        bitmapHeight,
        placementBounds,
      })
      fill.assignedShapeIds = Array.from(assignedShapeIds)
      setLeatherImageFills((previous) => [clampLeatherImageFill(fill), ...previous])
      setActiveLeatherImageFillId(fill.id)
      setStatus(
        assignedShapeIds.size > 0
          ? `Leather image imported and assigned to ${assignedShapeIds.size} outline shape${assignedShapeIds.size === 1 ? '' : 's'}`
          : 'Leather image imported',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Leather image import failed: ${message}`)
    }
  }

  const handleUpdateLeatherImageFill = (fillId: string, patch: Partial<LeatherImageFill>) => {
    setLeatherImageFills((previous) =>
      previous.map((fill) => {
        if (fill.id !== fillId) {
          return fill
        }
        const next = { ...fill, ...patch }
        if (patch.dpi !== undefined) {
          const size = computeLeatherImageMmSize(next.bitmapWidth, next.bitmapHeight, patch.dpi || undefined)
          next.widthMm = size.widthMm
          next.heightMm = size.heightMm
        }
        return clampLeatherImageFill(next)
      }),
    )
  }

  const handleDeleteActiveLeatherImageFill = () => {
    if (!activeLeatherImageFill) {
      setStatus('No active leather image')
      return
    }
    setLeatherImageFills((previous) => previous.filter((fill) => fill.id !== activeLeatherImageFill.id))
    setActiveLeatherImageFillId(leatherImageFills.find((fill) => fill.id !== activeLeatherImageFill.id)?.id ?? null)
    setStatus('Leather image removed')
  }

  const handleAssignSelectedToActiveLeatherImageFill = () => {
    if (!activeLeatherImageFill) {
      setStatus('No active leather image')
      return
    }
    const assignedShapeIds = resolveSelectedAssignment()
    if (assignedShapeIds.size === 0) {
      setStatus('Select a closed outline before assigning a leather image')
      return
    }
    const placementBounds = buildLeatherImagePlacementBounds(shapes, assignedShapeIds)
    setLeatherImageFills((previous) =>
      previous.map((fill) =>
        fill.id === activeLeatherImageFill.id
          ? clampLeatherImageFill({
              ...fill,
              assignedShapeIds: Array.from(new Set([...fill.assignedShapeIds, ...assignedShapeIds])),
              ...(placementBounds && fill.assignedShapeIds.length === 0
                ? {
                    x: placementBounds.minX,
                    y: placementBounds.minY,
                    widthMm: placementBounds.width,
                    heightMm: placementBounds.height,
                  }
                : {}),
            })
          : fill,
      ),
    )
    setStatus(`Assigned leather image to ${assignedShapeIds.size} outline shape${assignedShapeIds.size === 1 ? '' : 's'}`)
  }

  const handleClearSelectedFromActiveLeatherImageFill = () => {
    if (!activeLeatherImageFill) {
      setStatus('No active leather image')
      return
    }
    const assignedShapeIds = resolveSelectedAssignment()
    if (assignedShapeIds.size === 0) {
      setStatus('Select a closed outline to clear its leather image')
      return
    }
    setLeatherImageFills((previous) =>
      previous.map((fill) =>
        fill.id === activeLeatherImageFill.id
          ? {
              ...fill,
              assignedShapeIds: fill.assignedShapeIds.filter((shapeId) => !assignedShapeIds.has(shapeId)),
            }
          : fill,
      ),
    )
    setStatus('Cleared leather image from selected outline')
  }

  return {
    handleImportLeatherImageFill,
    handleUpdateLeatherImageFill,
    handleDeleteActiveLeatherImageFill,
    handleAssignSelectedToActiveLeatherImageFill,
    handleClearSelectedFromActiveLeatherImageFill,
  }
}
