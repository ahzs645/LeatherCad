import type { TopbarSection } from './topbar-command-model'

type BuildTopbarEditSectionParams = {
  selectedShapeCount: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onCopySelection: () => void
  onCutSelection: () => void
  onPasteClipboard: () => void
  canPaste: boolean
  onSelectAllShapes: () => void
  onDuplicateSelection: () => void
  onDeleteSelection: () => void
  onGroupSelection: () => void
  onUngroupSelection: () => void
  onMoveSelectionByDistance: () => void
  onCopySelectionByDistance: () => void
  onRotateSelectionCw1: () => void
  onRotateSelectionCw5: () => void
  onRotateSelectionCcw1: () => void
  onRotateSelectionCcw5: () => void
  onScaleSelectionUp1: () => void
  onScaleSelectionDown1: () => void
  onScaleSelectionUp5: () => void
  onScaleSelectionDown5: () => void
  onEnableStitchOnSelection: () => void
  onDisableStitchOnSelection: () => void
  onMoveSelectionBackward: () => void
  onMoveSelectionForward: () => void
  onSendSelectionToBack: () => void
  onBringSelectionToFront: () => void
}

export function buildTopbarEditSection({
  selectedShapeCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCopySelection,
  onCutSelection,
  onPasteClipboard,
  canPaste,
  onSelectAllShapes,
  onDuplicateSelection,
  onDeleteSelection,
  onGroupSelection,
  onUngroupSelection,
  onMoveSelectionByDistance,
  onCopySelectionByDistance,
  onRotateSelectionCw1,
  onRotateSelectionCw5,
  onRotateSelectionCcw1,
  onRotateSelectionCcw5,
  onScaleSelectionUp1,
  onScaleSelectionDown1,
  onScaleSelectionUp5,
  onScaleSelectionDown5,
  onEnableStitchOnSelection,
  onDisableStitchOnSelection,
  onMoveSelectionBackward,
  onMoveSelectionForward,
  onSendSelectionToBack,
  onBringSelectionToFront,
}: BuildTopbarEditSectionParams): TopbarSection {
  const hasSelection = selectedShapeCount > 0

  return {
    id: 'edit',
    label: 'Edit',
    commands: [
      { id: 'undo', label: 'Undo', disabled: !canUndo, run: onUndo },
      { id: 'redo', label: 'Redo', disabled: !canRedo, run: onRedo },
      { id: 'copy', label: 'Copy', disabled: !hasSelection, run: onCopySelection },
      { id: 'cut', label: 'Cut', disabled: !hasSelection, run: onCutSelection },
      { id: 'paste', label: 'Paste', disabled: !canPaste, run: onPasteClipboard },
      { id: 'select-all', label: 'Select All', run: onSelectAllShapes },
      { id: 'duplicate', label: 'Duplicate', disabled: !hasSelection, run: onDuplicateSelection },
      { id: 'delete', label: 'Delete', disabled: !hasSelection, run: onDeleteSelection },
      { id: 'group', label: 'Group', disabled: selectedShapeCount < 2, run: onGroupSelection },
      { id: 'ungroup', label: 'Ungroup', disabled: !hasSelection, run: onUngroupSelection },
      { id: 'move-by-distance', label: 'Move by Dist', disabled: !hasSelection, run: onMoveSelectionByDistance },
      { id: 'copy-by-distance', label: 'Copy by Dist', disabled: !hasSelection, run: onCopySelectionByDistance },
      { id: 'rotate-cw-1', label: 'Rotate +1', disabled: !hasSelection, run: onRotateSelectionCw1 },
      { id: 'rotate-cw-5', label: 'Rotate +5', disabled: !hasSelection, run: onRotateSelectionCw5 },
      { id: 'rotate-ccw-1', label: 'Rotate -1', disabled: !hasSelection, run: onRotateSelectionCcw1 },
      { id: 'rotate-ccw-5', label: 'Rotate -5', disabled: !hasSelection, run: onRotateSelectionCcw5 },
      { id: 'scale-up-1', label: 'Scale +1%', disabled: !hasSelection, run: onScaleSelectionUp1 },
      { id: 'scale-down-1', label: 'Scale -1%', disabled: !hasSelection, run: onScaleSelectionDown1 },
      { id: 'scale-up-5', label: 'Scale +5%', disabled: !hasSelection, run: onScaleSelectionUp5 },
      { id: 'scale-down-5', label: 'Scale -5%', disabled: !hasSelection, run: onScaleSelectionDown5 },
      { id: 'stitch-always-plus', label: 'Stitch Always +', disabled: !hasSelection, run: onEnableStitchOnSelection },
      { id: 'stitch-always-minus', label: 'Stitch Always -', disabled: !hasSelection, run: onDisableStitchOnSelection },
      { id: 'send-back', label: 'Send Back', disabled: !hasSelection, run: onMoveSelectionBackward },
      { id: 'bring-forward', label: 'Bring Forward', disabled: !hasSelection, run: onMoveSelectionForward },
      { id: 'to-back', label: 'To Back', disabled: !hasSelection, run: onSendSelectionToBack },
      { id: 'to-front', label: 'To Front', disabled: !hasSelection, run: onBringSelectionToFront },
    ],
  }
}
