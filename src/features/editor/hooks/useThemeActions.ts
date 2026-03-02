import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ThemeMode } from '../editor-types'

type UseThemeActionsParams = {
  setThemeMode: Dispatch<SetStateAction<ThemeMode>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useThemeActions(params: UseThemeActionsParams) {
  const { setThemeMode, setStatus } = params

  const handleToggleTheme = useCallback(() => {
    setThemeMode((previous) => {
      const next = previous === 'dark' ? 'light' : 'dark'
      setStatus(next === 'light' ? 'White mode enabled' : 'Dark mode enabled')
      return next
    })
  }, [setThemeMode, setStatus])

  return { handleToggleTheme }
}
