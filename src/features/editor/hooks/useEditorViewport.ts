import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Viewport } from '../cad/cad-types'

const DESKTOP_PREVIEW_MIN_WIDTH_PX = 300
const DESKTOP_CANVAS_MIN_WIDTH_PX = 420
const DESKTOP_SPLITTER_WIDTH_PX = 12

export { DESKTOP_SPLITTER_WIDTH_PX }

type UseEditorViewportParams = {
  isMobileLayout: boolean
  showThreePreview: boolean
}

export function useEditorViewport(params: UseEditorViewportParams) {
  const { isMobileLayout, showThreePreview } = params

  const [viewport, setViewport] = useState<Viewport>({ x: 560, y: 360, scale: 1 })
  const [desktopPreviewWidthPx, setDesktopPreviewWidthPx] = useState(420)
  const [isDesktopPreviewResizing, setIsDesktopPreviewResizing] = useState(false)
  const workspaceRef = useRef<HTMLElement | null>(null)

  const clampDesktopPreviewWidth = useCallback((value: number) => {
    const workspaceWidth = workspaceRef.current?.clientWidth ?? 0
    if (workspaceWidth <= 0) {
      return Math.max(value, DESKTOP_PREVIEW_MIN_WIDTH_PX)
    }

    const computedMax = workspaceWidth - DESKTOP_CANVAS_MIN_WIDTH_PX - DESKTOP_SPLITTER_WIDTH_PX
    const maxPreviewWidth = Math.max(DESKTOP_PREVIEW_MIN_WIDTH_PX, computedMax)
    return Math.min(Math.max(value, DESKTOP_PREVIEW_MIN_WIDTH_PX), maxPreviewWidth)
  }, [])

  const handleDesktopSplitterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isMobileLayout || !showThreePreview) {
        return
      }

      event.preventDefault()
      setIsDesktopPreviewResizing(true)
      event.currentTarget.setPointerCapture(event.pointerId)

      const updateFromPointer = (clientX: number) => {
        const workspaceRect = workspaceRef.current?.getBoundingClientRect()
        if (!workspaceRect) {
          return
        }

        const nextWidth = workspaceRect.right - clientX - DESKTOP_SPLITTER_WIDTH_PX / 2
        setDesktopPreviewWidthPx(clampDesktopPreviewWidth(nextWidth))
      }

      const handlePointerMove = (pointerEvent: PointerEvent) => {
        updateFromPointer(pointerEvent.clientX)
      }

      const finishResize = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', finishResize)
        window.removeEventListener('pointercancel', finishResize)
        setIsDesktopPreviewResizing(false)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', finishResize)
      window.addEventListener('pointercancel', finishResize)
      updateFromPointer(event.clientX)
    },
    [clampDesktopPreviewWidth, isMobileLayout, showThreePreview],
  )

  useEffect(() => {
    if (isMobileLayout || !showThreePreview) {
      return
    }

    const syncPreviewWidth = () => {
      setDesktopPreviewWidthPx((current) => clampDesktopPreviewWidth(current))
    }

    syncPreviewWidth()
    window.addEventListener('resize', syncPreviewWidth)
    return () => window.removeEventListener('resize', syncPreviewWidth)
  }, [clampDesktopPreviewWidth, isMobileLayout, showThreePreview])

  useEffect(() => {
    if (!isDesktopPreviewResizing) {
      return
    }

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isDesktopPreviewResizing])

  return {
    viewport,
    setViewport,
    desktopPreviewWidthPx,
    isDesktopPreviewResizing,
    workspaceRef,
    handleDesktopSplitterPointerDown,
  }
}
