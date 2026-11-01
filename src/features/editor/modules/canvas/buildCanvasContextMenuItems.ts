import type { Shape, StitchHole } from '../../cad/cad-types'

export type CanvasContextMenuItem = {
  id: string
  label: string
  disabled?: boolean
  /** Items with the same group render together; a separator divides groups. */
  group?: string
  shortcut?: string
  /** Also offered as a button in the tool options bar while selecting. */
  bar?: boolean
  onSelect: () => void
}

export type CanvasContextMenuHandlers = {
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
  handleCopySelection?: () => void
  handleCutSelection?: () => void
  handlePasteClipboard?: () => void
  handleSelectAllShapes?: () => void
  handleMoveSelectionForward?: () => void
  handleMoveSelectionBackward?: () => void
  handleGroupSelection?: () => void
  handleUngroupSelection?: () => void
  handleRotateSelection?: (angleDeg: number) => void
  handleFlipSelection?: (axis: 'horizontal' | 'vertical') => void
  handleSetAsRotationCenter?: () => void
  handleClearRotationCenter?: () => void
  handleMakeSelectedLineHorizontal?: () => void
  handleMakeSelectedLineVertical?: () => void
  handleConvertArcToBezier?: () => void
  handleSetSelectionLocked?: (locked: boolean) => void
  handleMoveSelectedShapesToLayerBelow?: () => void
  handleDuplicateSelectedShapesOnBelowLayer?: () => void
  handleMoveSelectedShapesToActiveLayer?: () => void
  handleActivateLayerOfSelectedShape?: () => void
  handleFitView?: () => void
}

type BuildCanvasContextMenuItemsParams = CanvasContextMenuHandlers & {
  shapes: Shape[]
  selectedShapeIdSet: Set<string>
  selectedStitchHole: StitchHole | null
  hasCustomRotationPivot?: boolean
  activeLayerId?: string | null
  layerCount?: number
}

/**
 * Right-click menu (and tool-bar selection buttons) built from what is actually
 * selected: line-only actions need a line, arc conversion needs an arc, layer
 * moves need more than one layer, and nothing selected offers paste/select all.
 */
export function buildCanvasContextMenuItems(params: BuildCanvasContextMenuItemsParams): CanvasContextMenuItem[] {
  const { shapes, selectedShapeIdSet, selectedStitchHole } = params
  const items: CanvasContextMenuItem[] = []
  const add = (group: string, item: Omit<CanvasContextMenuItem, 'group'> | null | false | undefined) => {
    if (item) items.push({ ...item, group })
  }
  const selected = shapes.filter((shape) => selectedShapeIdSet.has(shape.id))
  const count = selected.length

  if (count === 0) {
    if (params.handlePasteClipboard) add('clipboard', { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', onSelect: () => { void params.handlePasteClipboard?.() } })
    if (params.handleSelectAllShapes) add('clipboard', { id: 'select-all', label: 'Select all', shortcut: 'Ctrl+A', onSelect: params.handleSelectAllShapes })
    if (params.handleFitView) add('view', { id: 'fit-view', label: 'Fit all', onSelect: params.handleFitView })
  } else {
    const lineCount = selected.filter((shape) => shape.type === 'line').length
    const arcCount = selected.filter((shape) => shape.type === 'arc').length
    const bezierCount = selected.filter((shape) => shape.type === 'bezier').length
    const lockedCount = selected.filter((shape) => shape.locked === true).length
    const grouped = selected.some((shape) => Boolean(shape.groupId))

    add('clipboard', params.handleCopySelection && { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', bar: true, onSelect: params.handleCopySelection })
    add('clipboard', params.handleCutSelection && { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', bar: true, onSelect: params.handleCutSelection })
    add('clipboard', { id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D', bar: true, onSelect: params.handleDuplicateSelection })

    add('transform', params.handleFlipSelection && { id: 'flip-h', label: 'Flip horizontal', bar: true, onSelect: () => params.handleFlipSelection?.('horizontal') })
    add('transform', params.handleFlipSelection && { id: 'flip-v', label: 'Flip vertical', bar: true, onSelect: () => params.handleFlipSelection?.('vertical') })
    add('transform', params.handleRotateSelection && { id: 'rotate-cw', label: 'Rotate 90° CW', bar: true, onSelect: () => params.handleRotateSelection?.(90) })
    add('transform', params.handleRotateSelection && { id: 'rotate-ccw', label: 'Rotate 90° CCW', bar: true, onSelect: () => params.handleRotateSelection?.(-90) })
    add('transform', params.handleSetAsRotationCenter && { id: 'set-pivot', label: 'Set as rotate / scale pivot', onSelect: params.handleSetAsRotationCenter })
    add('transform', params.hasCustomRotationPivot && params.handleClearRotationCenter && { id: 'clear-pivot', label: 'Reset the pivot', onSelect: params.handleClearRotationCenter })
    if (count === 1 && lineCount === 1) {
      add('transform', params.handleMakeSelectedLineHorizontal && { id: 'line-horizontal', label: 'Rotate so this line is horizontal', onSelect: params.handleMakeSelectedLineHorizontal })
      add('transform', params.handleMakeSelectedLineVertical && { id: 'line-vertical', label: 'Rotate so this line is vertical', onSelect: params.handleMakeSelectedLineVertical })
    }

    add('geometry', arcCount > 0 && params.handleConvertArcToBezier && { id: 'arcs-to-bezier', label: `Convert arcs to Bézier curves (${arcCount})`, onSelect: params.handleConvertArcToBezier })
    add('geometry', { id: 'convert-to-path', label: 'Convert to Path', onSelect: () => params.handleConvertSelectionToPath(false) })
    if (count === 2 && bezierCount === 2) {
      add('geometry', { id: 'bezier-flat', label: 'Bezier handle: flat', onSelect: params.handleMakeBezierCpFlat })
      add('geometry', { id: 'bezier-same-length', label: 'Bezier handle: same length', onSelect: params.handleMakeBezierCpSameLength })
      add('geometry', { id: 'bezier-symmetric', label: 'Bezier handle: symmetric', onSelect: params.handleMakeBezierCpSymmetric })
    }

    add('order', { id: 'bring-to-front', label: 'Bring to Front', bar: true, onSelect: params.handleBringSelectionToFront })
    add('order', params.handleMoveSelectionForward && { id: 'bring-forward', label: 'Bring forward', onSelect: params.handleMoveSelectionForward })
    add('order', params.handleMoveSelectionBackward && { id: 'send-backward', label: 'Send backward', onSelect: params.handleMoveSelectionBackward })
    add('order', { id: 'send-to-back', label: 'Send to Back', bar: true, onSelect: params.handleSendSelectionToBack })

    add('organize', count >= 2 && params.handleGroupSelection && { id: 'group', label: 'Group', bar: true, onSelect: params.handleGroupSelection })
    add('organize', grouped && params.handleUngroupSelection && { id: 'ungroup', label: 'Ungroup', bar: true, onSelect: params.handleUngroupSelection })
    add('organize', lockedCount < count && params.handleSetSelectionLocked && { id: 'lock', label: 'Lock', bar: true, onSelect: () => params.handleSetSelectionLocked?.(true) })
    add('organize', lockedCount > 0 && params.handleSetSelectionLocked && { id: 'unlock', label: 'Unlock', bar: true, onSelect: () => params.handleSetSelectionLocked?.(false) })

    const multipleLayers = (params.layerCount ?? 1) > 1
    const offActiveLayer = params.activeLayerId ? selected.some((shape) => shape.layerId !== params.activeLayerId) : false
    add('layer', multipleLayers && params.handleMoveSelectedShapesToLayerBelow && { id: 'layer-move-below', label: 'Move to the layer below', onSelect: params.handleMoveSelectedShapesToLayerBelow })
    add('layer', multipleLayers && params.handleDuplicateSelectedShapesOnBelowLayer && { id: 'layer-duplicate-below', label: 'Duplicate on the layer below', onSelect: params.handleDuplicateSelectedShapesOnBelowLayer })
    add('layer', offActiveLayer && params.handleMoveSelectedShapesToActiveLayer && { id: 'layer-move-active', label: 'Move to the active layer', onSelect: params.handleMoveSelectedShapesToActiveLayer })
    add('layer', offActiveLayer && params.handleActivateLayerOfSelectedShape && { id: 'layer-activate', label: "Make this shape's layer active", onSelect: params.handleActivateLayerOfSelectedShape })

    add('delete', { id: 'delete', label: count > 1 ? `Delete (${count})` : 'Delete', shortcut: 'Del', bar: true, onSelect: params.handleDeleteSelection })
  }

  if (selectedStitchHole) {
    add('stitch', {
      id: 'stitch-end-here',
      label: selectedStitchHole.endHole ? 'Clear "ends here" marker' : 'Ends stitch here',
      onSelect: selectedStitchHole.endHole ? params.handleClearSelectedStitchHoleEnd : params.handleMarkSelectedStitchHoleAsEnd,
    })
  }

  return items
}
