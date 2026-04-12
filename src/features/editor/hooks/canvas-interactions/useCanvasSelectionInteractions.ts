import type { Dispatch, SetStateAction } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { HardwareMarker, StitchHole } from '../../cad/cad-types'

type UseCanvasSelectionInteractionsParams = {
  tool: string
  stitchHoles: StitchHole[]
  hardwareMarkers: HardwareMarker[]
  selectedStitchHoleId: string | null
  selectedHardwareMarkerId: string | null
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setStatus: (status: string) => void
}

export function useCanvasSelectionInteractions({
  tool,
  stitchHoles,
  hardwareMarkers,
  selectedStitchHoleId,
  selectedHardwareMarkerId,
  setSelectedShapeIds,
  setSelectedStitchHoleId,
  setSelectedHardwareMarkerId,
  setStatus,
}: UseCanvasSelectionInteractionsParams) {
  const handleStitchHolePointerDown = (event: ReactPointerEvent<SVGElement>, stitchHoleId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const stitchHole = stitchHoles.find((entry) => entry.id === stitchHoleId)
    if (!stitchHole) {
      return
    }

    event.stopPropagation()
    setSelectedShapeIds([])
    const nextId = selectedStitchHoleId === stitchHoleId ? null : stitchHoleId
    setSelectedStitchHoleId(nextId)
    setStatus(nextId ? `Stitch hole ${stitchHole.sequence + 1} selected` : 'Stitch-hole selection cleared')
  }

  const handleHardwarePointerDown = (event: ReactPointerEvent<SVGGElement>, markerId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const marker = hardwareMarkers.find((entry) => entry.id === markerId)
    if (!marker) {
      return
    }

    event.stopPropagation()
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    const nextId = selectedHardwareMarkerId === markerId ? null : markerId
    setSelectedHardwareMarkerId(nextId)
    setStatus(nextId ? `Hardware marker selected: ${marker.label}` : 'Hardware marker selection cleared')
  }

  return {
    handleStitchHolePointerDown,
    handleHardwarePointerDown,
  }
}
