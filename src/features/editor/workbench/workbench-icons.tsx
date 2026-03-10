import type { SVGProps } from 'react'
import type { QuickAction, RibbonCommandItem, SecondaryPreviewMode, WorkbenchIconName } from './workbench-types'

type WorkbenchIconProps = SVGProps<SVGSVGElement> & {
  name: WorkbenchIconName
}

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function renderIcon(name: WorkbenchIconName) {
  switch (name) {
    case 'save':
      return (
        <>
          <path {...STROKE_PROPS} d="M5 4.75h10.5L19.25 8.5v10.75a1 1 0 0 1-1 1H5.75a1 1 0 0 1-1-1V5.75a1 1 0 0 1 1-1z" />
          <path {...STROKE_PROPS} d="M8 4.75v5h7v-5" />
          <path {...STROKE_PROPS} d="M8.5 15.25h7" />
        </>
      )
    case 'undo':
      return <path {...STROKE_PROPS} d="M9.5 7H6.25v3.25M6.5 7.25c1.6-2.1 4-3.25 6.9-3.25 4.25 0 7.35 2.8 7.35 7s-3.1 7-7.35 7c-2.35 0-4.2-.7-5.85-2.15" />
    case 'redo':
      return <path {...STROKE_PROPS} d="M14.5 7h3.25v3.25M17.5 7.25c-1.6-2.1-4-3.25-6.9-3.25-4.25 0-7.35 2.8-7.35 7s3.1 7 7.35 7c2.35 0 4.2-.7 5.85-2.15" />
    case 'help':
      return (
        <>
          <circle {...STROKE_PROPS} cx="12" cy="12" r="8.5" />
          <path {...STROKE_PROPS} d="M9.7 9.35c.25-1.85 1.65-3 3.7-3 2.1 0 3.55 1.15 3.55 3 0 1.45-.7 2.25-2.2 3.15-1.45.85-1.95 1.5-1.95 2.9" />
          <circle cx="12" cy="18.2" r="1" fill="currentColor" />
        </>
      )
    case 'fit':
      return (
        <>
          <path {...STROKE_PROPS} d="M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3" />
          <path {...STROKE_PROPS} d="M9 9l-4-1M15 9l4-1M9 15l-4 1M15 15l4 1" />
          <rect {...STROKE_PROPS} x="9" y="9" width="6" height="6" rx="1" />
        </>
      )
    case 'reset':
    case 'resequence':
      return (
        <>
          <path {...STROKE_PROPS} d="M18 8.5V5h-3.5" />
          <path {...STROKE_PROPS} d="M6 15.5V19h3.5" />
          <path {...STROKE_PROPS} d="M17.2 11c-.55-3.9-3.3-6.25-7.2-6.25-2.4 0-4.35.8-5.95 2.5M6.8 13c.55 3.9 3.3 6.25 7.2 6.25 2.4 0 4.35-.8 5.95-2.5" />
        </>
      )
    case 'ruler':
      return (
        <>
          <path {...STROKE_PROPS} d="M5.5 16.75l7.5-7.5 5 5-7.5 7.5H5.5z" />
          <path {...STROKE_PROPS} d="M9.2 13.1l1.7 1.7M11.1 11.2l1.1 1.1M13 9.3l1.7 1.7M14.9 7.4l1.1 1.1" />
        </>
      )
    case 'dimensions':
      return (
        <>
          <path {...STROKE_PROPS} d="M7 6v12M17 6v12" />
          <path {...STROKE_PROPS} d="M9.5 8.5l-2.5 2.5 2.5 2.5M14.5 8.5l2.5 2.5-2.5 2.5" />
          <path {...STROKE_PROPS} d="M7.2 11h9.6" />
          <path {...STROKE_PROPS} d="M5 18.5h4M15 18.5h4" />
        </>
      )
    case 'preset':
    case 'piece':
      return (
        <>
          <path {...STROKE_PROPS} d="M3.75 7.75h5l1.4-2h2.1l1.4 2h6a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4.75a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1z" />
          <path {...STROKE_PROPS} d="M12 10.25v5.5M9.25 13h5.5" />
        </>
      )
    case 'notes':
      return (
        <>
          <path {...STROKE_PROPS} d="M7 5.5h7.5l4 4V17a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 17V7A1.5 1.5 0 0 1 7 5.5z" />
          <path {...STROKE_PROPS} d="M14.5 5.75V10h4.25" />
          <path {...STROKE_PROPS} d="M8.5 13h6M8.5 16h4.25" />
        </>
      )
    case 'copy':
      return (
        <>
          <rect {...STROKE_PROPS} x="8.5" y="8.5" width="9.5" height="9.5" rx="1.25" />
          <rect {...STROKE_PROPS} x="5.5" y="5.5" width="9.5" height="9.5" rx="1.25" />
        </>
      )
    case 'paste':
      return (
        <>
          <rect {...STROKE_PROPS} x="7" y="5.5" width="10" height="13" rx="1.5" />
          <path {...STROKE_PROPS} d="M9 5.5v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path {...STROKE_PROPS} d="M9.5 11.5H14.5" />
          <path {...STROKE_PROPS} d="M12 9v5" />
        </>
      )
    case 'delete':
      return (
        <>
          <path {...STROKE_PROPS} d="M6.5 7.5h11M9 7.5v-2h6v2M8 7.5l.8 11h6.4l.8-11" />
          <path {...STROKE_PROPS} d="M10.2 10.25v5.25M13.8 10.25v5.25" />
        </>
      )
    case 'move':
      return (
        <>
          <path {...STROKE_PROPS} d="M12 3.75v16.5M3.75 12h16.5" />
          <path {...STROKE_PROPS} d="M12 3.75l-2.25 2.25M12 3.75l2.25 2.25M12 20.25L9.75 18M12 20.25L14.25 18M3.75 12l2.25-2.25M3.75 12l2.25 2.25M20.25 12L18 9.75M20.25 12L18 14.25" />
        </>
      )
    case 'rotate':
      return (
        <>
          <rect {...STROKE_PROPS} x="6.5" y="9" width="8" height="8" rx="1.25" />
          <path {...STROKE_PROPS} d="M14.5 6h4v4" />
          <path {...STROKE_PROPS} d="M18.5 10c-.45-3.45-2.9-5.5-6.5-5.5-2.05 0-3.75.65-5.2 2" />
        </>
      )
    case 'scale':
      return (
        <>
          <path {...STROKE_PROPS} d="M8 8l-3 0v-3M16 8h3V5M8 16H5v3M16 16h3v3" />
          <path {...STROKE_PROPS} d="M9 9L5 5M15 9l4-4M9 15l-4 4M15 15l4 4" />
          <rect {...STROKE_PROPS} x="9" y="9" width="6" height="6" rx="1" />
        </>
      )
    case 'inspect':
      return (
        <>
          <circle {...STROKE_PROPS} cx="10.5" cy="10.5" r="4.75" />
          <path {...STROKE_PROPS} d="M14.25 14.25L19 19" />
        </>
      )
    case 'seam':
      return (
        <>
          <path {...STROKE_PROPS} d="M5 16.5c2.2-4.25 4.4-4.25 6.6 0s4.4 4.25 7.4 0" strokeDasharray="1.5 2.2" />
          <path {...STROKE_PROPS} d="M5 12.5c2.2-4.25 4.4-4.25 6.6 0s4.4 4.25 7.4 0" />
        </>
      )
    case 'nest':
      return (
        <>
          <path {...STROKE_PROPS} d="M12 4.75L18.75 8.5 12 12.25 5.25 8.5 12 4.75z" />
          <path {...STROKE_PROPS} d="M5.25 12.5L12 16.25l6.75-3.75M5.25 16.5L12 20.25l6.75-3.75" />
        </>
      )
    case 'stitch':
      return (
        <>
          <path {...STROKE_PROPS} d="M5 14h14" strokeDasharray="1 2.4" />
          <circle cx="7" cy="14" r="1.3" fill="currentColor" />
          <circle cx="12" cy="14" r="1.3" fill="currentColor" />
          <circle cx="17" cy="14" r="1.3" fill="currentColor" />
        </>
      )
    case 'stitch-var':
      return (
        <>
          <path {...STROKE_PROPS} d="M4.75 15.5c2.25-4 4.5-4 6.75 0s4.5 4 7.75 0" strokeDasharray="1 2.1" />
          <circle cx="7" cy="15.5" r="1.15" fill="currentColor" />
          <circle cx="12" cy="12.2" r="1.15" fill="currentColor" />
          <circle cx="17" cy="15.5" r="1.15" fill="currentColor" />
        </>
      )
    case 'next':
      return <path {...STROKE_PROPS} d="M9 6l6 6-6 6" />
    case 'clear':
      return <path {...STROKE_PROPS} d="M7 7l10 10M17 7L7 17" />
    case 'open':
    case 'templates':
      return (
        <>
          <path {...STROKE_PROPS} d="M4.75 8h5l1.7-2.25h2.8l1.2 1.5h4.8a1 1 0 0 1 1 1v1.25" />
          <path {...STROKE_PROPS} d="M4.75 8.75v9.5a1 1 0 0 0 1 1h12.5a1 1 0 0 0 .9-.55L21 10.5a1 1 0 0 0-.9-1.45H5.75a1 1 0 0 0-1 1z" />
        </>
      )
    case 'import':
      return (
        <>
          <path {...STROKE_PROPS} d="M4.75 8h5l1.7-2.25h2.8l1.2 1.5h4.8a1 1 0 0 1 1 1v1.25" />
          <path {...STROKE_PROPS} d="M4.75 8.75v9.5a1 1 0 0 0 1 1h12.5a1 1 0 0 0 .9-.55L21 10.5a1 1 0 0 0-.9-1.45H5.75a1 1 0 0 0-1 1z" />
          <path {...STROKE_PROPS} d="M12 14.5V9.5M9.75 11.75L12 9.5l2.25 2.25" />
        </>
      )
    case 'svg':
    case 'pdf':
    case 'dxf':
    case 'export':
      return (
        <>
          <path {...STROKE_PROPS} d="M7 4.75h7l4.25 4.25V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5.75a1 1 0 0 1 1-1z" />
          <path {...STROKE_PROPS} d="M14 4.75V9h4.25" />
          <path {...STROKE_PROPS} d="M9.25 14h7.5" />
          <path {...STROKE_PROPS} d="M14.5 11.75L16.75 14l-2.25 2.25" />
        </>
      )
    case 'print':
      return (
        <>
          <path {...STROKE_PROPS} d="M7.5 6h9v4.25h-9z" />
          <path {...STROKE_PROPS} d="M6.5 10.25h11a2.25 2.25 0 0 1 2.25 2.25v3.75H16.5v3H7.5v-3H4.25V12.5A2.25 2.25 0 0 1 6.5 10.25z" />
          <path {...STROKE_PROPS} d="M9 15.75h6" />
        </>
      )
    case 'tracing':
      return (
        <>
          <rect {...STROKE_PROPS} x="5.25" y="6" width="10.5" height="12" rx="1.25" />
          <path {...STROKE_PROPS} d="M8 15l2.5-3 2.25 2.25 1.75-2.25 2.5 3.5" />
          <path {...STROKE_PROPS} d="M16.25 8.5h2.5v10.5a1 1 0 0 1-1 1h-9.5" />
        </>
      )
    case 'ai':
      return (
        <>
          <path {...STROKE_PROPS} d="M12 4.5l1.45 4.05L17.5 10l-4.05 1.45L12 15.5l-1.45-4.05L6.5 10l4.05-1.45L12 4.5z" />
          <path {...STROKE_PROPS} d="M18.25 14.5l.75 2.1 2.1.75-2.1.75-.75 2.1-.75-2.1-2.1-.75 2.1-.75.75-2.1zM6 15.25l1.05 2.95L10 19.25l-2.95 1.05L6 23.25 4.95 20.3 2 19.25l2.95-1.05L6 15.25z" />
        </>
      )
    case 'peek':
      return (
        <>
          <path {...STROKE_PROPS} d="M2.75 12s3.25-5.5 9.25-5.5S21.25 12 21.25 12 18 17.5 12 17.5 2.75 12 2.75 12z" />
          <circle {...STROKE_PROPS} cx="12" cy="12" r="2.75" />
        </>
      )
    case 'peek-off':
      return (
        <>
          <path {...STROKE_PROPS} d="M4 4l16 16" />
          <path {...STROKE_PROPS} d="M2.75 12s3.25-5.5 9.25-5.5c1.9 0 3.5.55 4.85 1.35M21.25 12s-3.25 5.5-9.25 5.5c-1.9 0-3.5-.55-4.85-1.35" />
          <path {...STROKE_PROPS} d="M10.1 10.1A2.72 2.72 0 0 0 9.25 12c0 1.5 1.25 2.75 2.75 2.75.7 0 1.35-.25 1.85-.7" />
        </>
      )
    case 'settings':
      return (
        <>
          <circle {...STROKE_PROPS} cx="12" cy="12" r="2.75" />
          <path {...STROKE_PROPS} d="M12 4.25v2M12 17.75v2M19.75 12h-2M6.25 12h-2M17.5 6.5l-1.4 1.4M7.9 16.1l-1.4 1.4M17.5 17.5l-1.4-1.4M7.9 7.9L6.5 6.5" />
        </>
      )
  }
}

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

export function WorkbenchIcon({ name, className, ...props }: WorkbenchIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ? `workbench-icon ${className}` : 'workbench-icon'}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {renderIcon(name)}
    </svg>
  )
}
