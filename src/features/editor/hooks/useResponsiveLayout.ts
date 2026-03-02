import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { MOBILE_MEDIA_QUERY } from '../editor-constants'
import type { MobileOptionsTab, MobileViewMode } from '../editor-types'
import type { Tool } from '../cad/cad-types'

type UseResponsiveLayoutParams = {
  setIsMobileLayout: Dispatch<SetStateAction<boolean>>
  setMobileViewMode: Dispatch<SetStateAction<MobileViewMode>>
  setShowMobileMenu: Dispatch<SetStateAction<boolean>>
  setMobileOptionsTab: Dispatch<SetStateAction<MobileOptionsTab>>
  setTool: Dispatch<SetStateAction<Tool>>
}

export function useResponsiveLayout(params: UseResponsiveLayoutParams) {
  const {
    setIsMobileLayout,
    setMobileViewMode,
    setShowMobileMenu,
    setMobileOptionsTab,
    setTool,
  } = params

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const sync = () => {
      if (media.matches) {
        setIsMobileLayout(true)
        setMobileViewMode('editor')
        setShowMobileMenu(false)
        setMobileOptionsTab('view')
        setTool('pan')
      } else {
        setIsMobileLayout(false)
        setMobileViewMode('split')
        setShowMobileMenu(true)
      }
    }

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [setIsMobileLayout, setMobileViewMode, setShowMobileMenu, setMobileOptionsTab, setTool])
}
