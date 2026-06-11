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
    case 'options':
      return 'settings'
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
    case 'rotate-ccw-5':
    case 'rotate-ccw-1':
    case 'rotate-cw-1':
    case 'rotate-cw-5':
    case 'rotate-5':
    case 'specify-rotation':
      return 'rotate'
    case 'scale-down-5':
    case 'scale-down-1':
    case 'scale-up-1':
    case 'scale-up':
    case 'scale-up-5':
    case 'specify-scale':
    case 'specify-scale-x':
    case 'specify-scale-y':
      return 'scale'
    case 'set-rotation-pivot':
    case 'set-snap-point':
      return 'inspect'
    case 'clear-rotation-pivot':
    case 'clear-snap-point':
      return 'clear'
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
    case 'export-center':
      return 'export'
    case 'export-options':
      return 'export-options'
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
    case 'arc-to-bezier':
      return 'convert'
    case 'cad-offset':
      return 'offset'
    case 'cad-trim':
      return 'trim'
    case 'cad-extend':
      return 'trim'
    case 'cad-mirror':
      return 'mirror'
    case 'extend-trim':
      return 'trim'
    case 'mirror-shapes':
    case 'line-symmetry':
      return 'mirror'
    case 'bezier-cp-symmetric':
      return 'bezier-cp'
    case 'toggle-bezier-lines':
      return 'bezier-cp'
    case 'resize-shape':
      return 'resize'
    case 'stitch-simulator':
      return 'simulator'
    case 'box-stitch':
      return 'box-stitch'
    case 'pattern-wizard':
      return 'wizard'
    case 'mandala':
      return 'mandala'
    case 'letter-stamp':
      return 'stamp'
    default:
      return 'settings'
  }
}

export function resolvePeekIcon(mode: SecondaryPreviewMode): WorkbenchIconName {
  return mode === 'hidden' ? 'peek' : 'peek-off'
}
