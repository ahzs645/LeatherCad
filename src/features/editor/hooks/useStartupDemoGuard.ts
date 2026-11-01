import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

/** A startup demo is optional background work. Any user action or document
 * change takes precedence while its lazy data module is being fetched. */
export function useStartupDemoGuard(buildDoc: () => unknown) {
  const latest = useRef(buildDoc), interacted = useRef(false)
  useLayoutEffect(() => { latest.current = buildDoc })
  useEffect(() => {
    const mark = () => { interacted.current = true }
    document.addEventListener('pointerdown', mark, true)
    document.addEventListener('keydown', mark, true)
    return () => {
      document.removeEventListener('pointerdown', mark, true)
      document.removeEventListener('keydown', mark, true)
    }
  }, [])
  return useCallback(() => {
    const initial = JSON.stringify(latest.current())
    return () => !interacted.current && JSON.stringify(latest.current()) === initial
  }, [])
}
