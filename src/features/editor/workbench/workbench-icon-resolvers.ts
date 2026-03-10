import type { QuickAction, RibbonCommandItem, SecondaryPreviewMode, WorkbenchIconName } from './workbench-types'

export function resolveQuickActionIcon(action: Pick<QuickAction, 'id' | 'icon'>): WorkbenchIconName {
  if (action.icon) {
    return action.icon
  }

  switch (action.id) {
    case 'save-json':
      return 'save'
    case 'undo':
      return 'undo'
    case 'redo':
      return 'redo'
    case 'help':
      return 'help'
    default:
      return 'settings'
  }
}

export function resolveRibbonCommandIcon(item: Pick<RibbonCommandItem, 'id' | 'icon'>): WorkbenchIconName {
  if (item.icon) {
    return item.icon
  }

  switch (item.id) {
    case 'fit-view':
      return 'fit'
    case 'reset-view':
      return 'reset'
    case 'toggle-ruler':
      return 'ruler'
    case 'toggle-dimensions':
      return 'dimensions'
    case 'load-preset':
      return 'preset'
    case 'toggle-annotations':
      return 'notes'
    case 'undo':
      return 'undo'
    case 'redo':
      return 'redo'
    case 'copy':
      return 'copy'
    case 'paste':
      return 'paste'
    case 'delete':
      return 'delete'
    case 'move-distance':
      return 'move'
    case 'rotate-5':
      return 'rotate'
    case 'scale-up':
      return 'scale'
    case 'create-piece':
      return 'piece'
    case 'open-piece':
    case 'piece-tab':
      return 'inspect'
    case 'apply-seam-allowance':
      return 'seam'
    case 'open-nesting':
      return 'nest'
    case 'place-fixed-stitch':
      return 'stitch'
    case 'place-variable-stitch':
      return 'stitch-var'
    case 'count-stitches':
      return 'dimensions'
    case 'resequence-stitches':
      return 'resequence'
    case 'next-stitch':
      return 'next'
    case 'clear-stitches':
      return 'clear'
    case 'save-json':
      return 'save'
    case 'load-json':
      return 'open'
    case 'import-svg':
      return 'import'
    case 'export-svg':
      return 'svg'
    case 'export-pdf':
      return 'pdf'
    case 'export-dxf':
      return 'dxf'
    case 'print-preview':
      return 'print'
    case 'template-repository':
      return 'templates'
    case 'tracing':
      return 'tracing'
    case 'ai-builder':
      return 'ai'
    default:
      return 'settings'
  }
}

export function resolvePeekIcon(mode: SecondaryPreviewMode): WorkbenchIconName {
  return mode === 'hidden' ? 'peek' : 'peek-off'
}
