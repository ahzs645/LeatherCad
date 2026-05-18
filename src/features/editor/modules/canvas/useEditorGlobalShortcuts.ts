import type { Dispatch, SetStateAction } from 'react'
import type { Point, Shape, Tool, Viewport } from '../../cad/cad-types'
import { useEditorGlobalBindings } from '../../hooks/useEditorGlobalBindings'

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
  setTracingOverlays: Dispatch<SetStateAction<import('../../cad/cad-types').TracingOverlay[]>>
  setActiveTool: (tool: Tool) => void
  handleRotateSelection: (angleDeg: number) => void
  handleExtendOrTrimLines: () => void
  setViewport: Dispatch<SetStateAction<Viewport>>
  reverseGridScrollDirection: boolean
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStatus: (message: string) => void
  setShowAnnotations: Dispatch<SetStateAction<boolean>>
  setShowStitchSimulatorModal: Dispatch<SetStateAction<boolean>>
  setStitchSimulatorSettings: Dispatch<SetStateAction<import('../../ops/stitch-simulator-ops').StitchSimulatorSettings>>
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
  setTracingOverlays,
  setActiveTool,
  handleRotateSelection,
  handleExtendOrTrimLines,
  setViewport,
  reverseGridScrollDirection,
  setShapes,
  setStatus,
  setShowAnnotations,
  setShowStitchSimulatorModal,
  setStitchSimulatorSettings,
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
    handleToggleTracingsVisibility: () => {
      setTracingOverlays((previous) => {
        if (previous.length === 0) return previous
        const anyVisible = previous.some((overlay) => overlay.visible)
        const next = previous.map((overlay) => ({ ...overlay, visible: !anyVisible }))
        return next
      })
      setStatus('Toggled tracing visibility')
    },
    handleBackToSelectMode: () => {
      setActiveTool('pan')
    },
    handleRotateSelectionBy: (angleDeg: number) => {
      if (selectedShapeIdSet.size === 0) return
      handleRotateSelection(angleDeg)
    },
    handleExtendOrTrimLines: () => {
      handleExtendOrTrimLines()
    },
    handlePanViewport: (dxScreenPx: number, dyScreenPx: number) => {
      setViewport((previous) => ({
        ...previous,
        x: previous.x + dxScreenPx,
        y: previous.y + dyScreenPx,
      }))
    },
    reverseGridScrollDirection,
    handleToggleDimensionAnnotations: () => {
      setShowAnnotations((previous) => !previous)
      setStatus('Toggled dimension annotations')
    },
    handleToggleStitchSimulator: () => {
      setShowStitchSimulatorModal((previous) => !previous)
    },
    handleAdjustThreadThickness: (delta: number) => {
      setStitchSimulatorSettings((previous) => ({
        ...previous,
        threadWidthMm: Math.max(0.1, Math.min(10, previous.threadWidthMm + delta * 0.1)),
      }))
    },
    handleToggleStitchParity: () => {
      setStitchSimulatorSettings((previous) => {
        // Cycle: both → even-only → odd-only → both
        if (previous.showEvenStitches && previous.showOddStitches) {
          return { ...previous, showOddStitches: false }
        }
        if (previous.showEvenStitches && !previous.showOddStitches) {
          return { ...previous, showEvenStitches: false, showOddStitches: true }
        }
        return { ...previous, showEvenStitches: true, showOddStitches: true }
      })
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
