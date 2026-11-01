import { Fragment, type ReactElement } from 'react'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const icon = (...children: ReactElement[]) => <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">{children.map((child, index) => <Fragment key={index}>{child}</Fragment>)}</svg>

/** Compact icons for selection actions in the tool options bar (keyed by menu item id). */
export const TOOL_ACTION_ICONS: Record<string, ReactElement> = {
  copy: icon(<rect x="5.5" y="5.5" width="8" height="8" rx="1.2" {...stroke} />, <path d="M10.5 3.5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h.5" {...stroke} />),
  cut: icon(<circle cx="4" cy="12" r="2" {...stroke} />, <circle cx="12" cy="12" r="2" {...stroke} />, <path d="M5.5 10.5 12 2M10.5 10.5 4 2" {...stroke} />),
  duplicate: icon(<rect x="2" y="2" width="8" height="8" rx="1.2" {...stroke} />, <rect x="6" y="6" width="8" height="8" rx="1.2" {...stroke} />),
  'flip-h': icon(<path d="M8 1.5v13" {...stroke} strokeDasharray="1.5 1.5" />, <path d="M6 4 2 12h4zM10 4l4 8h-4z" {...stroke} />),
  'flip-v': icon(<path d="M1.5 8h13" {...stroke} strokeDasharray="1.5 1.5" />, <path d="M4 6 12 2v4zM4 10l8 4v-4z" {...stroke} />),
  'rotate-cw': icon(<path d="M13 8a5 5 0 1 1-2.2-4.1" {...stroke} />, <path d="M11 1.5v3h-3" {...stroke} />),
  'rotate-ccw': icon(<path d="M3 8a5 5 0 1 0 2.2-4.1" {...stroke} />, <path d="M5 1.5v3h3" {...stroke} />),
  'bring-to-front': icon(<rect x="2" y="6" width="7" height="7" rx="1" {...stroke} strokeDasharray="1.5 1.5" />, <rect x="6" y="2.5" width="7.5" height="7.5" rx="1" fill="currentColor" stroke="currentColor" strokeWidth={1.2} />),
  'send-to-back': icon(<rect x="2" y="6" width="7" height="7" rx="1" fill="currentColor" stroke="currentColor" strokeWidth={1.2} />, <rect x="6" y="2.5" width="7.5" height="7.5" rx="1" {...stroke} />),
  group: icon(<rect x="1.5" y="1.5" width="13" height="13" rx="1.5" {...stroke} strokeDasharray="2 1.5" />, <rect x="4" y="4" width="4" height="4" {...stroke} />, <circle cx="10.5" cy="10.5" r="2" {...stroke} />),
  ungroup: icon(<rect x="1.5" y="1.5" width="6" height="6" rx="1" {...stroke} />, <circle cx="11.5" cy="11.5" r="3" {...stroke} />),
  lock: icon(<rect x="3" y="7" width="10" height="7" rx="1.2" {...stroke} />, <path d="M5 7V5a3 3 0 0 1 6 0v2" {...stroke} />),
  unlock: icon(<rect x="3" y="7" width="10" height="7" rx="1.2" {...stroke} />, <path d="M5 7V5a3 3 0 0 1 5.8-1" {...stroke} />),
  delete: icon(<path d="M2.5 4h11M6 4V2.5h4V4M3.8 4l.7 9.5h7l.7-9.5M6.5 6.5v5M9.5 6.5v5" {...stroke} />),
  'size-position': icon(<rect x="3" y="3" width="10" height="10" {...stroke} strokeDasharray="2 1.5" />, <path d="M1 1.5h3M12 1.5h3M1 14.5h3M12 14.5h3" {...stroke} />),
}
