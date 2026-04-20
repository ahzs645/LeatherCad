import type { Dispatch, SetStateAction } from 'react'
import type { Point } from '../cad/cad-types'
import {
  useCanvasInteractions,
  type UseCanvasInteractionsParams,
} from '../hooks/useCanvasInteractions'
import {
  findBezierTNearestPoint,
  splitBezierAtT,
} from '../ops/geometry-editing-ops'

type UseEditorCanvasControllerParams = Omit<
  UseCanvasInteractionsParams,
  | 'onWheelRotateSelection'
  | 'onWheelScaleSelection'
  | 'onWheelAdjustThickness'
  | 'onPickLineTypeFromShape'
  | 'onBezierSplitAtPoint'
> & {
  selectedShapeIdSet: Set<string>
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  setStatus: (message: string) => void
  handleRotateSelection: (angleDeg: number) => void
  handleScaleSelection: (factor: number) => void
}

export function useEditorCanvasController({
  selectedShapeIdSet,
  setActiveLineTypeId,
  setStatus,
  handleRotateSelection,
  handleScaleSelection,
  ...canvasParams
}: UseEditorCanvasControllerParams) {
  return useCanvasInteractions({
    ...canvasParams,
    onWheelRotateSelection: (deltaDeg: number) => {
      if (selectedShapeIdSet.size === 0) return
      handleRotateSelection(deltaDeg)
    },
    onWheelScaleSelection: (factor: number) => {
      if (selectedShapeIdSet.size === 0) return
      handleScaleSelection(factor)
    },
    onWheelAdjustThickness: (deltaSteps: number) => {
      if (selectedShapeIdSet.size === 0) return
      canvasParams.setShapes((previous) =>
        previous.map((shape) => {
          if (!selectedShapeIdSet.has(shape.id)) return shape
          const rawCurrent = (shape as { strokeWidthOverride?: number }).strokeWidthOverride
          const current: number = typeof rawCurrent === 'number' ? rawCurrent : 2
          const next = Math.max(0.2, Math.min(12, current + deltaSteps * 0.3))
          return { ...shape, strokeWidthOverride: Math.round(next * 100) / 100 }
        }),
      )
    },
    onPickLineTypeFromShape: (shapeId: string) => {
      const shape = canvasParams.shapesById[shapeId]
      if (!shape) return
      setActiveLineTypeId(shape.lineTypeId)
      const lineType = canvasParams.lineTypesById[shape.lineTypeId]
      setStatus(`Active line type set to "${lineType?.name ?? shape.lineTypeId}"`)
    },
    onBezierSplitAtPoint: (shapeId: string, worldPoint: Point) => {
      const shape = canvasParams.shapesById[shapeId]
      if (!shape || shape.type !== 'bezier') return
      const t = findBezierTNearestPoint(shape, worldPoint)
      const parts = splitBezierAtT(shape, t)
      if (!parts) {
        setStatus('Could not split bezier at that point')
        return
      }
      canvasParams.setShapes((previous) => previous.flatMap((entry) => (entry.id === shape.id ? parts : [entry])))
      canvasParams.setSelectedShapeIds([parts[0].id, parts[1].id])
      setStatus('Split bezier at click point')
    },
  })
}
