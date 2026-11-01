import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { MOBILE_MEDIA_QUERY } from '../editor-constants'
import type { MobileOptionsTab, MobileViewMode } from '../editor-types'
import type { Tool } from '../cad/cad-types'
import { resolveMobileViewMode } from '../workbench/useWorkbenchRouteSync'

type UseResponsiveLayoutParams = {
  setIsMobileLayout: Dispatch<SetStateAction<boolean>>
  setMobileViewMode: Dispatch<SetStateAction<MobileViewMode>>
  setShowMobileMenu: Dispatch<SetStateAction<boolean>>
  setMobileOptionsTab: Dispatch<SetStateAction<MobileOptionsTab>>
  setTool: Dispatch<SetStateAction<Tool>>
}

export function useResponsiveLayout(params: UseResponsiveLayoutParams) {
  // Setters are read through a ref: the media listener must run on mount and
  // on real breakpoint changes only. When it re-ran on every render (because a
  // setter's identity changed), it reset the tool to Move and phone users could
  // not pick a drawing tool.
  const settersRef = useRef(params)
  useEffect(() => {
    settersRef.current = params
  })

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    let wasMobile: boolean | null = null
    const sync = () => {
      const { setIsMobileLayout, setMobileViewMode, setShowMobileMenu, setMobileOptionsTab, setTool } = settersRef.current
      const isMobile = media.matches
      if (isMobile && wasMobile === true) {
        // Same layout: keep the user's tool and menus, only follow the route.
        setMobileViewMode(resolveMobileViewMode(window.location.pathname))
        return
      }
      if (!isMobile && wasMobile === false) return
      wasMobile = isMobile
      if (isMobile) {
        setIsMobileLayout(true)
        // The route is the source of truth for which pane is showing, so derive the
        // mode from the URL instead of forcing 'editor'. Hardcoding it here clobbered
        // a /workbench/3d deep link: this runs on every matchMedia change event, which
        // in a real browser lands after the route sync has already applied the URL,
        // and the resulting mode flip pushed the user back to "/".
        setMobileViewMode(resolveMobileViewMode(window.location.pathname))
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
  }, [])
}
