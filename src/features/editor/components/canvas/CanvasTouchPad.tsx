import { useSyncExternalStore } from 'react'
import { CANVAS_HISTORY_EVENT } from '../../hooks/canvas-interactions/useCanvasTouchGestures'
import { useTranslate } from '../../hooks/useTranslate'
import { useInterfacePreferences } from '../../ops/interface-preferences'
import { useEditorUIActions, useEditorUISelector } from '../../state/providers/EditorUIStateProvider'

const COARSE_POINTER_QUERY = '(pointer: coarse)'

function subscribeCoarsePointer(listener: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const media = window.matchMedia(COARSE_POINTER_QUERY)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

function isCoarsePointer() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(COARSE_POINTER_QUERY).matches)
}

/**
 * Floating pad for finger and pen use (the reference editor's modifier pad):
 * undo, redo, delete and a multi-select latch, so actions that need a keyboard
 * modifier are reachable on a tablet. Shown only for coarse pointers.
 */
export function CanvasTouchPad({ selectionCount }: { selectionCount: number }) {
  const t = useTranslate()
  const coarse = useSyncExternalStore(subscribeCoarsePointer, isCoarsePointer, () => false)
  const { modifierPad } = useInterfacePreferences()
  const incrementalSelection = useEditorUISelector((state) => state.incrementalSelection)
  const { setIncrementalSelection } = useEditorUIActions()
  if (!coarse || modifierPad === 'off') return null
  const send = (detail: 'undo' | 'redo' | 'delete') => window.dispatchEvent(new CustomEvent(CANVAS_HISTORY_EVENT, { detail }))
  return (
    <div className={`canvas-touch-pad canvas-touch-pad-${modifierPad}`} role="toolbar" aria-label={t('Touch actions')} data-testid="canvas-touch-pad">
      <button
        type="button"
        aria-pressed={incrementalSelection}
        title={t('Multi-select: each tap adds to the selection (like holding Shift)')}
        onClick={() => setIncrementalSelection((value) => !value)}
      >
        <span aria-hidden="true">⇧</span>
        <small>{t('Multi')}</small>
      </button>
      <button type="button" title={t('Undo (two-finger double tap)')} onClick={() => send('undo')}>
        <span aria-hidden="true">↶</span>
        <small>{t('Undo')}</small>
      </button>
      <button type="button" title={t('Redo (three-finger double tap)')} onClick={() => send('redo')}>
        <span aria-hidden="true">↷</span>
        <small>{t('Redo')}</small>
      </button>
      <button type="button" title={t('Delete selected shapes')} disabled={selectionCount === 0} onClick={() => send('delete')}>
        <span aria-hidden="true">🗑</span>
        <small>{t('Delete')}</small>
      </button>
    </div>
  )
}
