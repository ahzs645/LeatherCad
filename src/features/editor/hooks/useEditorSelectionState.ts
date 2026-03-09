import { useState } from 'react'
import type { ClipboardPayload } from '../ops/shape-selection-ops'

export function useEditorSelectionState() {
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([])
  const [selectedStitchHoleId, setSelectedStitchHoleId] = useState<string | null>(null)
  const [selectedHardwareMarkerId, setSelectedHardwareMarkerId] = useState<string | null>(null)
  const [clipboardPayload, setClipboardPayload] = useState<ClipboardPayload | null>(null)

  return {
    selectedShapeIds, setSelectedShapeIds,
    selectedStitchHoleId, setSelectedStitchHoleId,
    selectedHardwareMarkerId, setSelectedHardwareMarkerId,
    clipboardPayload, setClipboardPayload,
  }
}
