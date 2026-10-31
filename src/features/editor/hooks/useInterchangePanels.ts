import { useCallback, useState } from 'react'

export type InterchangePanel = 'files' | 'stl' | 'cloud' | null

/** Owns the mutually exclusive interchange dialogs across desktop and mobile. */
export function useInterchangePanels() {
  const [panel, setPanel] = useState<InterchangePanel>(null)
  return {
    panel,
    close: useCallback(() => setPanel(null), []),
    openFiles: useCallback(() => setPanel('files'), []),
    openStl: useCallback(() => setPanel('stl'), []),
    openCloud: useCallback(() => setPanel('cloud'), []),
  }
}
