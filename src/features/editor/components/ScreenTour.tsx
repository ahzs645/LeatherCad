import { useCallback, useEffect, useId, useLayoutEffect, useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import { getInterfacePreferences, updateInterfacePreferences } from '../ops/interface-preferences'

export const SHOW_TOUR_EVENT = 'leathercad:show-tour'

type TourStep = { title: string; text: string; target?: string }

const STEPS: TourStep[] = [
  { title: 'Welcome to LeatherCad', text: 'A short tour of the screen. Use the arrow keys or the buttons; Escape closes it.' },
  { title: 'Drawing tools', target: '.workbench-tool-rail', text: 'Lines, rectangles, curves, stitches, folds and seams. Pick one, or press its letter: L line, R rectangle, E circle, V arc, T text, P stitch, A select.' },
  { title: 'Tool settings', target: '.tool-options-bar', text: 'The active tool’s settings live here. Type a width and height (arithmetic like 100/3 works) and the rectangle is finished at your first click. With a selection, its actions appear here.' },
  { title: 'Drawing area', target: '.canvas-pane', text: 'Rulers follow the cursor and show the selection’s extent; click their corner to measure from the selection. Scroll or pinch to zoom. Right-click a shape for its actions.' },
  { title: 'Commands', target: '.workbench-ribbon', text: 'Draft, Modify, Piece, Stitch and Output group the commands for each stage of a pattern.' },
  { title: 'Document', target: '.workbench-browser-dock', text: 'Pieces, seams, layers, sketches and tracings. Show, lock or reorder layers here.' },
  { title: 'Inspector', target: '.workbench-inspector-dock', text: 'Exact position and size of the selection (press Enter to jump here), plus the actions that apply to it.' },
  { title: 'Command line', target: '.precision-strip', text: 'Type commands such as rect, offset 3 or coordinates (x,y and @dx,dy). Press Escape to step back: shape → Select → clear selection → previous tool.' },
  { title: 'You are ready', text: 'Open this tour again from Options › Input devices and tools › Show the screen tour.' },
]

function isAutomated() {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return true
  return import.meta.env.MODE === 'test'
}

/**
 * First-run spotlight tour (as in the reference editor). It is a non-modal
 * card: the page stays usable, and it never opens on its own in automated runs.
 */
export function ScreenTour() {
  const t = useTranslate()
  const titleId = useId()
  const [step, setStep] = useState<number | null>(() => (getInterfacePreferences().tourCompleted || isAutomated() ? null : 0))
  const [measured, setMeasured] = useState<{ target: string; rect: DOMRect | null } | null>(null)

  const close = useCallback(() => {
    setStep(null)
    updateInterfacePreferences({ tourCompleted: true })
  }, [])

  useEffect(() => {
    const show = () => setStep(0)
    window.addEventListener(SHOW_TOUR_EVENT, show)
    return () => window.removeEventListener(SHOW_TOUR_EVENT, show)
  }, [])

  const target = step === null ? undefined : STEPS[step].target
  const rect = target && measured?.target === target ? measured.rect : null
  useLayoutEffect(() => {
    if (!target) return
    const measure = () => setMeasured({ target, rect: document.querySelector(target)?.getBoundingClientRect() ?? null })
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [target])

  useEffect(() => {
    if (step === null) return
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')
      // A modal dialog (Options, file review…) handles its own keys first.
      if (typing || document.querySelector('[aria-modal="true"]')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        close()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setStep((current) => (current === null ? null : current >= STEPS.length - 1 ? current : current + 1))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setStep((current) => (current === null || current === 0 ? current : current - 1))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close, step])

  if (step === null) return null
  const current = STEPS[step]
  const last = step === STEPS.length - 1
  const cardStyle = (() => {
    if (!rect) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
    const width = 340
    const below = rect.bottom + 12
    const top = below + 180 < window.innerHeight ? below : Math.max(12, rect.top - 192)
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)
    // Large targets (the drawing area) get the card inside their top-left corner.
    if (rect.height > window.innerHeight * 0.5 && rect.width > window.innerWidth * 0.4) {
      return { left: rect.left + 40, top: rect.top + 70 }
    }
    return { left, top }
  })()

  return (
    <>
      {rect && (
        <div
          className="screen-tour-highlight"
          aria-hidden="true"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div className="screen-tour-card" role="dialog" aria-modal="false" aria-labelledby={titleId} data-testid="screen-tour" style={cardStyle}>
        <div className="screen-tour-progress">{step + 1} / {STEPS.length}</div>
        <h3 id={titleId}>{t(current.title)}</h3>
        <p>{t(current.text)}</p>
        <div className="screen-tour-actions">
          <button type="button" onClick={close}>{t(last ? 'Done' : 'Close tour')}</button>
          <span />
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)}>{t('Back')}</button>}
          {!last && <button type="button" className="primary" onClick={() => setStep(step + 1)}>{t('Next')}</button>}
        </div>
      </div>
    </>
  )
}
