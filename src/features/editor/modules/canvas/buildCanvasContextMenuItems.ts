import type { Shape, StitchHole } from '../../cad/cad-types'

type CanvasContextMenuItem = {
  id: string
  label: string
  disabled?: boolean
  onSelect: () => void
}

type BuildCanvasContextMenuItemsParams = {
  shapes: Shape[]
  selectedShapeIdSet: Set<string>
  selectedStitchHole: StitchHole | null
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

export function buildCanvasContextMenuItems({
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
}: BuildCanvasContextMenuItemsParams): CanvasContextMenuItem[] {
  const items: CanvasContextMenuItem[] = []

  if (selectedShapeIdSet.size > 0) {
    items.push(
      { id: 'bring-to-front', label: 'Bring to Front', onSelect: handleBringSelectionToFront },
      { id: 'send-to-back', label: 'Send to Back', onSelect: handleSendSelectionToBack },
      { id: 'duplicate', label: 'Duplicate', onSelect: handleDuplicateSelection },
      { id: 'convert-to-path', label: 'Convert to Path', onSelect: () => handleConvertSelectionToPath(false) },
      { id: 'delete', label: 'Delete', onSelect: handleDeleteSelection },
    )
  }

  const selectedShapesForContext = shapes.filter((shape) => selectedShapeIdSet.has(shape.id))
  const bezierCount = selectedShapesForContext.filter((shape) => shape.type === 'bezier').length
  if (selectedShapeIdSet.size === 2 && bezierCount === 2) {
    items.push(
      { id: 'bezier-flat', label: 'Bezier handle: flat', onSelect: handleMakeBezierCpFlat },
      { id: 'bezier-same-length', label: 'Bezier handle: same length', onSelect: handleMakeBezierCpSameLength },
      { id: 'bezier-symmetric', label: 'Bezier handle: symmetric', onSelect: handleMakeBezierCpSymmetric },
    )
  }

  if (selectedStitchHole) {
    items.push({
      id: 'stitch-end-here',
      label: selectedStitchHole.endHole ? 'Clear "ends here" marker' : 'Ends stitch here',
      onSelect: selectedStitchHole.endHole ? handleClearSelectedStitchHoleEnd : handleMarkSelectedStitchHoleAsEnd,
    })
  }

  return items
}
