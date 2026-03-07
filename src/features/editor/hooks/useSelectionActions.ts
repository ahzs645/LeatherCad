import { useCallback } from 'react'
import { safeLocalStorageGet, safeLocalStorageSet } from '../ops/safe-storage'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import type { HardwareMarker, ParametricConstraint, SeamAllowance, Shape, SketchGroup, StitchHole } from '../cad/cad-types'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import {
  copySelectionToClipboard,
  getSelectionCenter,
  groupSelection,
  moveSelectionByOneStep,
  moveSelectionToEdge,
  parseClipboardPayload,
  pasteClipboardPayload,
  rotatePointAround,
  rotateSelection,
  scalePointFrom,
  scaleSelection,
  serializeClipboardPayload,
  transformSelectedStitchHoles,
  translateSelection,
  ungroupSelection,
  type ClipboardPayload,
} from '../ops/shape-selection-ops'
import { CLIPBOARD_PASTE_OFFSET } from '../editor-constants'

const SYSTEM_CLIPBOARD_STORAGE_KEY = 'leathercraft-system-clipboard-v1'

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
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
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
    setSketchGroups,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setHardwareMarkers,
    setStatus,
  } = params

  const writeClipboard = useCallback(async (payload: ClipboardPayload) => {
    const serialized = serializeClipboardPayload(payload)
    try {
      safeLocalStorageSet(SYSTEM_CLIPBOARD_STORAGE_KEY, serialized)
    } catch {
      // Ignore local storage failures.
    }

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      return
    }

    try {
      await navigator.clipboard.writeText(serialized)
    } catch {
      // Permission or browser limitations should not block in-app clipboard.
    }
  }, [])

  const readClipboard = useCallback(async (): Promise<ClipboardPayload | null> => {
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      try {
        const raw = await navigator.clipboard.readText()
        const parsed = parseClipboardPayload(raw)
        if (parsed) {
          return parsed
        }
      } catch {
        // Continue with local fallback.
      }
    }

    try {
      const raw = safeLocalStorageGet(SYSTEM_CLIPBOARD_STORAGE_KEY)
      if (!raw) {
        return null
      }
      return parseClipboardPayload(raw)
    } catch {
      return null
    }
  }, [])

  const handleCopySelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to copy')
      return
    }
    const payload = copySelectionToClipboard(shapes, stitchHoles, selectedShapeIdSet)
    setClipboardPayload(payload)
    void writeClipboard(payload)
    setStatus(`Copied ${payload.shapes.length} shape${payload.shapes.length === 1 ? '' : 's'} to clipboard`)
  }, [selectedShapeIdSet, shapes, stitchHoles, setClipboardPayload, setStatus, writeClipboard])

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
    void writeClipboard(payload)
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
    writeClipboard,
    setShapes,
    setStitchHoles,
    setSeamAllowances,
    setConstraints,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
  ])

  const handlePasteClipboard = useCallback(async () => {
    let payload = clipboardPayload
    if (!payload || payload.shapes.length === 0) {
      payload = await readClipboard()
      if (payload) {
        setClipboardPayload(payload)
      }
    }

    if (!payload || payload.shapes.length === 0) {
      setStatus('Clipboard is empty')
      return
    }

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
    setStatus(`Pasted ${pasted.shapes.length} shape${pasted.shapes.length === 1 ? '' : 's'}`)
  }, [
    clipboardPayload,
    readClipboard,
    setClipboardPayload,
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
    void writeClipboard(payload)
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
    writeClipboard,
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

  const handleSelectAllShapes = () => {
    if (shapes.length === 0) {
      setSelectedShapeIds([])
      setStatus('No shapes to select')
      return
    }
    setSelectedShapeIds(shapes.map((shape) => shape.id))
    setSelectedHardwareMarkerId(null)
    setSelectedStitchHoleId(null)
    setStatus(`Selected all shapes (${shapes.length})`)
  }

  const handleGroupSelection = () => {
    if (selectedShapeIdSet.size < 2) {
      setStatus('Select at least two shapes to group')
      return
    }
    const selectedLayerIds = new Set(
      shapes.filter((shape) => selectedShapeIdSet.has(shape.id)).map((shape) => shape.layerId),
    )
    if (selectedLayerIds.size > 1) {
      setStatus('Grouping requires shapes on the same layer')
      return
    }
    const fallbackLayerId = selectedLayerIds.values().next().value ?? null
    const layerId = activeLayerId ?? fallbackLayerId
    if (!layerId) {
      setStatus('No valid layer available for grouping')
      return
    }

    const groupId = uid()
    setSketchGroups((previous) => [
      ...previous,
      {
        id: groupId,
        name: `Group ${previous.length + 1}`,
        layerId,
        visible: true,
        locked: false,
      },
    ])
    setShapes((previous) => groupSelection(previous, selectedShapeIdSet, groupId))
    setStatus(`Grouped ${selectedShapeIdSet.size} shape${selectedShapeIdSet.size === 1 ? '' : 's'}`)
  }

  const handleUngroupSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more grouped shapes to ungroup')
      return
    }
    setShapes((previous) => ungroupSelection(previous, selectedShapeIdSet))
    setStatus('Ungrouped selected shapes')
  }

  const handleMoveSelectionByDistance = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    const dx = Number(window.prompt('Move selected shapes by X (mm)', '10'))
    const dy = Number(window.prompt('Move selected shapes by Y (mm)', '0'))
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      setStatus('Move cancelled')
      return
    }

    setShapes((previous) => translateSelection(previous, selectedShapeIdSet, dx, dy))
    setStitchHoles((previous) =>
      normalizeStitchHoleSequences(
        transformSelectedStitchHoles(previous, selectedShapeIdSet, (point) => ({ x: point.x + dx, y: point.y + dy })),
      ),
    )
    setStatus(`Moved selected shapes by (${dx.toFixed(2)}, ${dy.toFixed(2)})mm`)
  }

  const handleCopySelectionByDistance = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    const dx = Number(window.prompt('Copy selected shapes by X (mm)', '10'))
    const dy = Number(window.prompt('Copy selected shapes by Y (mm)', '0'))
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      setStatus('Copy cancelled')
      return
    }

    const payload = copySelectionToClipboard(shapes, stitchHoles, selectedShapeIdSet)
    const pasted = pasteClipboardPayload(payload, { x: dx, y: dy }, activeLayerId)
    setShapes((previous) => [...previous, ...pasted.shapes])
    setStitchHoles((previous) => normalizeStitchHoleSequences([...previous, ...pasted.stitchHoles]))
    setSelectedShapeIds(pasted.shapeIds)
    setStatus(`Copied ${pasted.shapes.length} shape${pasted.shapes.length === 1 ? '' : 's'} by distance`)
  }

  const handleRotateSelection = (angleDeg: number) => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to rotate')
      return
    }
    const center = getSelectionCenter(shapes, selectedShapeIdSet)
    if (!center) {
      setStatus('Could not compute selection center')
      return
    }
    const radians = (angleDeg * Math.PI) / 180
    setShapes((previous) => rotateSelection(previous, selectedShapeIdSet, angleDeg))
    setStitchHoles((previous) =>
      normalizeStitchHoleSequences(
        transformSelectedStitchHoles(previous, selectedShapeIdSet, (point) => rotatePointAround(point, center, radians)),
      ),
    )
    setStatus(`Rotated selected shapes by ${angleDeg.toFixed(1)} deg`)
  }

  const handleScaleSelection = (factor: number) => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to scale')
      return
    }
    const center = getSelectionCenter(shapes, selectedShapeIdSet)
    if (!center) {
      setStatus('Could not compute selection center')
      return
    }
    setShapes((previous) => scaleSelection(previous, selectedShapeIdSet, factor))
    setStitchHoles((previous) =>
      normalizeStitchHoleSequences(
        transformSelectedStitchHoles(previous, selectedShapeIdSet, (point) => scalePointFrom(point, center, factor)),
      ),
    )
    setStatus(`Scaled selected shapes by ${(factor * 100).toFixed(1)}%`)
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
    handleSelectAllShapes,
    handleGroupSelection,
    handleUngroupSelection,
    handleMoveSelectionByDistance,
    handleCopySelectionByDistance,
    handleRotateSelection,
    handleScaleSelection,
  }
}
