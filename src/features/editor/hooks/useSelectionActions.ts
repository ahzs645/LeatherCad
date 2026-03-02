import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { HardwareMarker, ParametricConstraint, SeamAllowance, Shape, StitchHole } from '../cad/cad-types'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import {
  copySelectionToClipboard,
  moveSelectionByOneStep,
  moveSelectionToEdge,
  pasteClipboardPayload,
  type ClipboardPayload,
} from '../ops/shape-selection-ops'
import { CLIPBOARD_PASTE_OFFSET } from '../editor-constants'

type UseSelectionActionsParams = {
  selectedShapeIdSet: Set<string>
  selectedHardwareMarkerId: string | null
  shapes: Shape[]
  stitchHoles: StitchHole[]
  activeLayerId: string | null
  clipboardPayload: ClipboardPayload | null
  pasteCountRef: MutableRefObject<number>
  setClipboardPayload: Dispatch<SetStateAction<ClipboardPayload | null>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSeamAllowances: Dispatch<SetStateAction<SeamAllowance[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useSelectionActions(params: UseSelectionActionsParams) {
  const {
    selectedShapeIdSet,
    selectedHardwareMarkerId,
    shapes,
    stitchHoles,
    activeLayerId,
    clipboardPayload,
    pasteCountRef,
    setClipboardPayload,
    setShapes,
    setStitchHoles,
    setSeamAllowances,
    setConstraints,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setHardwareMarkers,
    setStatus,
  } = params

  const handleCopySelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to copy')
      return
    }
    const payload = copySelectionToClipboard(shapes, stitchHoles, selectedShapeIdSet)
    setClipboardPayload(payload)
    setStatus(`Copied ${payload.shapes.length} shape${payload.shapes.length === 1 ? '' : 's'} to clipboard`)
  }, [selectedShapeIdSet, shapes, stitchHoles, setClipboardPayload, setStatus])

  const handleDeleteSelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      if (selectedHardwareMarkerId) {
        setHardwareMarkers((previous) => previous.filter((marker) => marker.id !== selectedHardwareMarkerId))
        setSelectedHardwareMarkerId(null)
        setStatus('Deleted selected hardware marker')
        return
      }
      setStatus('No selected shapes to delete')
      return
    }
    const deleteCount = selectedShapeIdSet.size
    setShapes((previous) => previous.filter((shape) => !selectedShapeIdSet.has(shape.id)))
    setStitchHoles((previous) => previous.filter((hole) => !selectedShapeIdSet.has(hole.shapeId)))
    setSeamAllowances((previous) => previous.filter((entry) => !selectedShapeIdSet.has(entry.shapeId)))
    setConstraints((previous) =>
      previous.filter((entry) => {
        if (selectedShapeIdSet.has(entry.shapeId)) {
          return false
        }
        return entry.type === 'edge-offset' ? true : !selectedShapeIdSet.has(entry.referenceShapeId)
      }),
    )
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
    setStatus(`Deleted ${deleteCount} selected shape${deleteCount === 1 ? '' : 's'}`)
  }, [
    selectedShapeIdSet,
    selectedHardwareMarkerId,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    setStatus,
    setShapes,
    setStitchHoles,
    setSeamAllowances,
    setConstraints,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
  ])

  const handleCutSelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to cut')
      return
    }
    const payload = copySelectionToClipboard(shapes, stitchHoles, selectedShapeIdSet)
    setClipboardPayload(payload)
    const deleteCount = selectedShapeIdSet.size
    setShapes((previous) => previous.filter((shape) => !selectedShapeIdSet.has(shape.id)))
    setStitchHoles((previous) => previous.filter((hole) => !selectedShapeIdSet.has(hole.shapeId)))
    setSeamAllowances((previous) => previous.filter((entry) => !selectedShapeIdSet.has(entry.shapeId)))
    setConstraints((previous) =>
      previous.filter((entry) => {
        if (selectedShapeIdSet.has(entry.shapeId)) {
          return false
        }
        return entry.type === 'edge-offset' ? true : !selectedShapeIdSet.has(entry.referenceShapeId)
      }),
    )
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
    setStatus(`Cut ${deleteCount} selected shape${deleteCount === 1 ? '' : 's'}`)
  }, [
    selectedShapeIdSet,
    shapes,
    stitchHoles,
    setStatus,
    setClipboardPayload,
    setShapes,
    setStitchHoles,
    setSeamAllowances,
    setConstraints,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
  ])

  const handlePasteClipboard = useCallback(() => {
    if (!clipboardPayload || clipboardPayload.shapes.length === 0) {
      setStatus('Clipboard is empty')
      return
    }

    pasteCountRef.current += 1
    const offset = {
      x: CLIPBOARD_PASTE_OFFSET * pasteCountRef.current,
      y: CLIPBOARD_PASTE_OFFSET * pasteCountRef.current,
    }
    const pasted = pasteClipboardPayload(clipboardPayload, offset, activeLayerId)
    setShapes((previous) => [...previous, ...pasted.shapes])
    setStitchHoles((previous) => normalizeStitchHoleSequences([...previous, ...pasted.stitchHoles]))
    setSelectedShapeIds(pasted.shapeIds)
    setSelectedStitchHoleId(null)
    setStatus(`Pasted ${pasted.shapes.length} shape${pasted.shapes.length === 1 ? '' : 's'}`)
  }, [
    clipboardPayload,
    activeLayerId,
    pasteCountRef,
    setShapes,
    setStitchHoles,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setStatus,
  ])

  const handleDuplicateSelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to duplicate')
      return
    }
    const payload = copySelectionToClipboard(shapes, stitchHoles, selectedShapeIdSet)
    setClipboardPayload(payload)
    pasteCountRef.current += 1
    const offset = {
      x: CLIPBOARD_PASTE_OFFSET * pasteCountRef.current,
      y: CLIPBOARD_PASTE_OFFSET * pasteCountRef.current,
    }
    const pasted = pasteClipboardPayload(payload, offset, activeLayerId)
    setShapes((previous) => [...previous, ...pasted.shapes])
    setStitchHoles((previous) => normalizeStitchHoleSequences([...previous, ...pasted.stitchHoles]))
    setSelectedShapeIds(pasted.shapeIds)
    setSelectedStitchHoleId(null)
    setStatus(`Duplicated ${pasted.shapes.length} shape${pasted.shapes.length === 1 ? '' : 's'}`)
  }, [
    selectedShapeIdSet,
    shapes,
    stitchHoles,
    activeLayerId,
    pasteCountRef,
    setClipboardPayload,
    setShapes,
    setStitchHoles,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setStatus,
  ])

  const handleMoveSelectionForward = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to reorder')
      return
    }
    setShapes((previous) => moveSelectionByOneStep(previous, selectedShapeIdSet, 'forward'))
    setStatus('Moved selected shapes forward')
  }

  const handleMoveSelectionBackward = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to reorder')
      return
    }
    setShapes((previous) => moveSelectionByOneStep(previous, selectedShapeIdSet, 'backward'))
    setStatus('Moved selected shapes backward')
  }

  const handleBringSelectionToFront = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to reorder')
      return
    }
    setShapes((previous) => moveSelectionToEdge(previous, selectedShapeIdSet, 'front'))
    setStatus('Brought selected shapes to front')
  }

  const handleSendSelectionToBack = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to reorder')
      return
    }
    setShapes((previous) => moveSelectionToEdge(previous, selectedShapeIdSet, 'back'))
    setStatus('Sent selected shapes to back')
  }

  return {
    handleCopySelection,
    handleDeleteSelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleMoveSelectionForward,
    handleMoveSelectionBackward,
    handleBringSelectionToFront,
    handleSendSelectionToBack,
  }
}
