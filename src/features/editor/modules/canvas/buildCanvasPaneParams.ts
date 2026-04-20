import type { Dispatch, SetStateAction } from 'react'
import type { Backdrop, Shape, StitchHole, Tool, TracingOverlay } from '../../cad/cad-types'
import { pushBackdropUndo } from '../../ops/backdrop-ops'
import type { StitchSimulatorResult } from '../../ops/stitch-simulator-ops'
import type { UseEditorCanvasPanePropsParams } from '../../view-models/useEditorCanvasPaneProps'
import { buildCanvasContextMenuItems } from './buildCanvasContextMenuItems'

type BuildCanvasPaneParamsInput = Omit<
  UseEditorCanvasPanePropsParams,
  | 'buildCanvasContextMenuItems'
  | 'hideCanvasPane'
  | 'onTracingOverlayOffset'
  | 'onBackdropLeftTop'
  | 'onSelectBackdrop'
  | 'onZoomOut'
  | 'onZoomIn'
  | 'showShapeHandles'
  | 'simulatedStitchSegments'
  | 'stitchSimulatorTerminalHoleId'
> & {
  tool: Tool
  shapes: Shape[]
  selectedStitchHole: StitchHole | null
  setTracingOverlays: Dispatch<SetStateAction<TracingOverlay[]>>
  setBackdrops: Dispatch<SetStateAction<Backdrop[]>>
  setActiveBackdropId: Dispatch<SetStateAction<string | null>>
  handleZoomStep: (factor: number) => void
  stitchSimulatorResult: StitchSimulatorResult | null
  handleBringSelectionToFront: () => void
  handleSendSelectionToBack: () => void
  handleDuplicateSelection: () => void
  handleConvertSelectionToPath: (copy?: boolean) => void
  handleDeleteSelection: () => void
  handleMakeBezierCpFlat: () => void
  handleMakeBezierCpSameLength: () => void
  handleMakeBezierCpSymmetric: () => void
  handleClearSelectedStitchHoleEnd: () => void
  handleMarkSelectedStitchHoleAsEnd: () => void
}

export function buildCanvasPaneParams({
  tool,
  shapes,
  selectedShapeIdSet,
  selectedStitchHole,
  setTracingOverlays,
  setBackdrops,
  setActiveBackdropId,
  handleZoomStep,
  stitchSimulatorResult,
  stitchSimulatorSettings,
  handleBringSelectionToFront,
  handleSendSelectionToBack,
  handleDuplicateSelection,
  handleConvertSelectionToPath,
  handleDeleteSelection,
  handleMakeBezierCpFlat,
  handleMakeBezierCpSameLength,
  handleMakeBezierCpSymmetric,
  handleClearSelectedStitchHoleEnd,
  handleMarkSelectedStitchHoleAsEnd,
  ...canvasParams
}: BuildCanvasPaneParamsInput): UseEditorCanvasPanePropsParams {
  return {
    ...canvasParams,
    selectedShapeIdSet,
    hideCanvasPane: false,
    buildCanvasContextMenuItems: () =>
      buildCanvasContextMenuItems({
        shapes,
        selectedShapeIdSet,
        selectedStitchHole,
        handleBringSelectionToFront,
        handleSendSelectionToBack,
        handleDuplicateSelection,
        handleConvertSelectionToPath,
        handleDeleteSelection,
        handleMakeBezierCpFlat,
        handleMakeBezierCpSameLength,
        handleMakeBezierCpSymmetric,
        handleClearSelectedStitchHoleEnd,
        handleMarkSelectedStitchHoleAsEnd,
      }),
    onTracingOverlayOffset: (overlayId: string, nextOffsetX: number, nextOffsetY: number) => {
      setTracingOverlays((previous) =>
        previous.map((overlay) =>
          overlay.id === overlayId ? { ...overlay, offsetX: nextOffsetX, offsetY: nextOffsetY } : overlay,
        ),
      )
    },
    onBackdropLeftTop: (backdropId: string, nextX: number, nextY: number) => {
      setBackdrops((previous) =>
        previous.map((backdrop) => {
          if (backdrop.id !== backdropId) return backdrop
          pushBackdropUndo(backdrop)
          return { ...backdrop, leftTop: { x: nextX, y: nextY } }
        }),
      )
    },
    onSelectBackdrop: (backdropId: string | null) => setActiveBackdropId(backdropId),
    onZoomOut: () => handleZoomStep(0.85),
    onZoomIn: () => handleZoomStep(1.15),
    showShapeHandles: tool === 'pan',
    stitchSimulatorSettings,
    simulatedStitchSegments: stitchSimulatorSettings?.showSimulatorPattern ? stitchSimulatorResult?.segments ?? [] : [],
    stitchSimulatorTerminalHoleId: stitchSimulatorResult?.terminalHoleId ?? null,
  }
}
