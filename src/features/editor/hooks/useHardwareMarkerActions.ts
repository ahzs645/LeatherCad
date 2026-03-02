import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { HardwareMarker } from '../cad/cad-types'

type UseHardwareMarkerActionsParams = {
  selectedHardwareMarker: HardwareMarker | null
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useHardwareMarkerActions(params: UseHardwareMarkerActionsParams) {
  const { selectedHardwareMarker, setHardwareMarkers, setSelectedHardwareMarkerId, setStatus } = params

  const handleDeleteSelectedHardwareMarker = useCallback(() => {
    if (!selectedHardwareMarker) {
      setStatus('No hardware marker selected')
      return
    }

    const markerId = selectedHardwareMarker.id
    setHardwareMarkers((previous) => previous.filter((marker) => marker.id !== markerId))
    setSelectedHardwareMarkerId(null)
    setStatus('Deleted hardware marker')
  }, [selectedHardwareMarker, setHardwareMarkers, setSelectedHardwareMarkerId, setStatus])

  const handleUpdateSelectedHardwareMarker = useCallback(
    (patch: Partial<HardwareMarker>) => {
      if (!selectedHardwareMarker) {
        return
      }

      setHardwareMarkers((previous) =>
        previous.map((marker) =>
          marker.id === selectedHardwareMarker.id
            ? {
                ...marker,
                ...patch,
              }
            : marker,
        ),
      )
    },
    [selectedHardwareMarker, setHardwareMarkers],
  )

  return {
    handleDeleteSelectedHardwareMarker,
    handleUpdateSelectedHardwareMarker,
  }
}
