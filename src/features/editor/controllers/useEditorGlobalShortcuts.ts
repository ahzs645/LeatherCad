import type { Dispatch, SetStateAction } from 'react'
import type { Point, Shape, Tool } from '../cad/cad-types'
import { useEditorGlobalBindings } from '../hooks/useEditorGlobalBindings'

type UseEditorGlobalShortcutsParams = {
  handleDeleteSelection: () => void
  handleUndo: () => void
  handleRedo: () => void
  handleCopySelection: () => void
  handleCutSelection: () => void
  handlePasteClipboard: () => void
  handleDuplicateSelection: () => void
  handleSelectAllShapes: () => void
  selectedShapeIdSet: Set<string>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setShowCanvasRuler: Dispatch<SetStateAction<boolean>>
  setShowBezierOffsetLines: Dispatch<SetStateAction<boolean>>
  setShowGrid: Dispatch<SetStateAction<boolean>>
  setActiveTool: (tool: Tool) => void
  handleRotateSelection: (angleDeg: number) => void
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStatus: (message: string) => void
}

export function useEditorGlobalShortcuts({
  handleDeleteSelection,
  handleUndo,
  handleRedo,
  handleCopySelection,
  handleCutSelection,
  handlePasteClipboard,
  handleDuplicateSelection,
  handleSelectAllShapes,
  selectedShapeIdSet,
  setSelectedShapeIds,
  setSelectedStitchHoleId,
  setSelectedHardwareMarkerId,
  setShowCanvasRuler,
  setShowBezierOffsetLines,
  setShowGrid,
  setActiveTool,
  handleRotateSelection,
  setShapes,
  setStatus,
}: UseEditorGlobalShortcutsParams) {
  useEditorGlobalBindings({
    handleDeleteSelection,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleSelectAllShapes,
    handleDeselectAll: () => {
      setSelectedShapeIds([])
      setSelectedStitchHoleId(null)
      setSelectedHardwareMarkerId(null)
    },
    handleToggleCanvasRuler: () => {
      setShowCanvasRuler((previous) => !previous)
    },
    handleHideBezierOffsetGuides: () => {
      setShowBezierOffsetLines(false)
      setStatus('Bezier offset guides hidden')
    },
    handleToggleGrid: () => {
      setShowGrid((previous) => !previous)
    },
    handleBackToSelectMode: () => {
      setActiveTool('pan')
    },
    handleRotateSelectionBy: (angleDeg: number) => {
      if (selectedShapeIdSet.size === 0) return
      handleRotateSelection(angleDeg)
    },
    handleNudgeSelection: (dxMm: number, dyMm: number) => {
      if (selectedShapeIdSet.size === 0) return
      setShapes((previous) =>
        previous.map((shape) => {
          if (!selectedShapeIdSet.has(shape.id)) return shape
          const offset = (point: Point) => ({
            x: point.x + dxMm,
            y: point.y + dyMm,
          })
          if (shape.type === 'line' || shape.type === 'text') {
            return { ...shape, start: offset(shape.start), end: offset(shape.end) }
          }
          if (shape.type === 'arc') {
            return { ...shape, start: offset(shape.start), mid: offset(shape.mid), end: offset(shape.end) }
          }
          return { ...shape, start: offset(shape.start), control: offset(shape.control), end: offset(shape.end) }
        }),
      )
    },
  })
}
