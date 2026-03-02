import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ThemeMode } from '../editor-types'

type UseThemeActionsParams = {
  setThemeMode: Dispatch<SetStateAction<ThemeMode>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useThemeActions(params: UseThemeActionsParams) {
  const { setThemeMode, setStatus } = params

  const handleSetThemeMode = useCallback(
    (nextMode: ThemeMode) => {
      setThemeMode(nextMode)
      if (nextMode === 'system') {
        setStatus('System theme enabled')
        return
      }
      setStatus(nextMode === 'light' ? 'White mode enabled' : 'Dark mode enabled')
    },
    [setThemeMode, setStatus],
  )

  return { handleSetThemeMode }
}
