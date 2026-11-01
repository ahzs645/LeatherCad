import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

/** A startup demo is optional background work. Any user action or document
 * change takes precedence while its lazy data module is being fetched. */
export function useStartupDemoGuard(buildDoc: () => unknown) {
  const latest = useRef(buildDoc), interacted = useRef(false)
  useLayoutEffect(() => { latest.current = buildDoc })
  useEffect(() => {
    const mark = () => { interacted.current = true }
    // Form changes count too: choosing a tool from the phone's list (or any
    // assistive input) may arrive as a change event without a pointer event.
    const events = ['pointerdown', 'keydown', 'change', 'input'] as const
    for (const type of events) document.addEventListener(type, mark, true)
    return () => {
      for (const type of events) document.removeEventListener(type, mark, true)
    }
  }, [])
  return useCallback(() => {
    const initial = JSON.stringify(latest.current())
    return () => !interacted.current && JSON.stringify(latest.current()) === initial
  }, [])
}
