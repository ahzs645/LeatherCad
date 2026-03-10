import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  DockLayoutState,
  SecondaryPreviewMode,
  WorkbenchInspectorTab,
} from './workbench-types'

const STORAGE_KEY = 'leathercad.workbench.layout.v1'
const MIN_BROWSER_WIDTH = 220
const MAX_BROWSER_WIDTH = 360
const MIN_INSPECTOR_WIDTH = 300
const MAX_INSPECTOR_WIDTH = 420
const MIN_PEEK_WIDTH = 300
const MAX_PEEK_WIDTH = 420
const MIN_MAIN_WIDTH = 460
const TOOL_RAIL_WIDTH = 58
const SPLITTER_WIDTH = 10
const AUTO_HIDE_PEEK_BREAKPOINT = 1440

const DEFAULT_LAYOUT: DockLayoutState = {
  browserWidth: 260,
  inspectorWidth: 340,
  peekWidth: 360,
  activeInspectorTab: 'inspect',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function readStoredLayout(): DockLayoutState {
  if (typeof window === 'undefined') {
    return DEFAULT_LAYOUT
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_LAYOUT
    }
    const parsed = JSON.parse(raw) as Partial<DockLayoutState>
    return {
      browserWidth: typeof parsed.browserWidth === 'number' ? parsed.browserWidth : DEFAULT_LAYOUT.browserWidth,
      inspectorWidth: typeof parsed.inspectorWidth === 'number' ? parsed.inspectorWidth : DEFAULT_LAYOUT.inspectorWidth,
      peekWidth: typeof parsed.peekWidth === 'number' ? parsed.peekWidth : DEFAULT_LAYOUT.peekWidth,
      activeInspectorTab:
        parsed.activeInspectorTab === 'piece' ||
        parsed.activeInspectorTab === 'preview3d' ||
        parsed.activeInspectorTab === 'document'
          ? parsed.activeInspectorTab
          : 'inspect',
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function clampDockLayoutState(
  layout: DockLayoutState,
  shellWidth: number,
  showPeek: boolean,
): DockLayoutState {
  let browserWidth = clamp(layout.browserWidth, MIN_BROWSER_WIDTH, MAX_BROWSER_WIDTH)
  let inspectorWidth = clamp(layout.inspectorWidth, MIN_INSPECTOR_WIDTH, MAX_INSPECTOR_WIDTH)
  let peekWidth = clamp(layout.peekWidth, MIN_PEEK_WIDTH, MAX_PEEK_WIDTH)

  if (shellWidth <= 0) {
    return {
      ...layout,
      browserWidth,
      inspectorWidth,
      peekWidth,
    }
  }

  const splitterCount = showPeek ? 3 : 2
  const maxPanelWidth = shellWidth - TOOL_RAIL_WIDTH - splitterCount * SPLITTER_WIDTH - MIN_MAIN_WIDTH
  if (maxPanelWidth > 0) {
    let totalPanelWidth = browserWidth + inspectorWidth + (showPeek ? peekWidth : 0)
    let overflow = totalPanelWidth - maxPanelWidth

    if (overflow > 0 && showPeek) {
      const nextPeekWidth = Math.max(MIN_PEEK_WIDTH, peekWidth - overflow)
      overflow -= peekWidth - nextPeekWidth
      peekWidth = nextPeekWidth
    }
    if (overflow > 0) {
      const nextInspectorWidth = Math.max(MIN_INSPECTOR_WIDTH, inspectorWidth - overflow)
      overflow -= inspectorWidth - nextInspectorWidth
      inspectorWidth = nextInspectorWidth
    }
    if (overflow > 0) {
      const nextBrowserWidth = Math.max(MIN_BROWSER_WIDTH, browserWidth - overflow)
      overflow -= browserWidth - nextBrowserWidth
      browserWidth = nextBrowserWidth
    }
    totalPanelWidth = browserWidth + inspectorWidth + (showPeek ? peekWidth : 0)
    if (totalPanelWidth > maxPanelWidth) {
      peekWidth = showPeek ? Math.max(MIN_PEEK_WIDTH, maxPanelWidth - browserWidth - inspectorWidth) : peekWidth
    }
  }

  return {
    ...layout,
    browserWidth,
    inspectorWidth,
    peekWidth,
  }
}

type UseWorkbenchShellStateParams = {
  enabled: boolean
  secondaryPreviewMode: SecondaryPreviewMode
}

export function useWorkbenchShellState(params: UseWorkbenchShellStateParams) {
  const { enabled, secondaryPreviewMode } = params
  const shellRef = useRef<HTMLElement | null>(null)
  const [shellWidth, setShellWidth] = useState(0)
  const [dockLayout, setDockLayout] = useState<DockLayoutState>(() => readStoredLayout())
  const [isResizing, setIsResizing] = useState(false)

  const effectiveSecondaryPreviewMode: SecondaryPreviewMode =
    secondaryPreviewMode !== 'hidden' && shellWidth >= AUTO_HIDE_PEEK_BREAKPOINT
      ? secondaryPreviewMode
      : 'hidden'
  const showPeek = enabled && effectiveSecondaryPreviewMode !== 'hidden'

  useEffect(() => {
    if (!enabled) {
      return
    }
    const node = shellRef.current
    if (!node) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.round(entries[0]?.contentRect.width ?? node.clientWidth)
      setShellWidth(nextWidth)
    })
    observer.observe(node)
    setShellWidth(node.clientWidth)
    return () => observer.disconnect()
  }, [enabled])

  const effectiveLayout = useMemo(
    () => clampDockLayoutState(dockLayout, shellWidth, showPeek),
    [dockLayout, shellWidth, showPeek],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(effectiveLayout))
  }, [effectiveLayout])

  useEffect(() => {
    if (!isResizing) {
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
  }, [isResizing])

  const startResize = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      update: (clientX: number, rect: DOMRect, layout: DockLayoutState) => DockLayoutState,
    ) => {
      const node = shellRef.current
      if (!enabled || !node) {
        return
      }

      event.preventDefault()
      setIsResizing(true)
      event.currentTarget.setPointerCapture(event.pointerId)

      const handlePointerMove = (pointerEvent: PointerEvent) => {
        const rect = node.getBoundingClientRect()
        setDockLayout((previous) => update(pointerEvent.clientX, rect, previous))
      }

      const finishResize = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', finishResize)
        window.removeEventListener('pointercancel', finishResize)
        setIsResizing(false)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', finishResize)
      window.addEventListener('pointercancel', finishResize)
      handlePointerMove(event.nativeEvent)
    },
    [enabled],
  )

  const handleBrowserResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) =>
      startResize(event, (clientX, rect, previous) => ({
        ...previous,
        browserWidth: clamp(clientX - rect.left, MIN_BROWSER_WIDTH, MAX_BROWSER_WIDTH),
      })),
    [startResize],
  )

  const handleInspectorResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) =>
      startResize(event, (clientX, rect, previous) => ({
        ...previous,
        inspectorWidth: clamp(rect.right - clientX, MIN_INSPECTOR_WIDTH, MAX_INSPECTOR_WIDTH),
      })),
    [startResize],
  )

  const handlePeekResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) =>
      startResize(event, (clientX, rect, previous) => {
        const currentLayout = clampDockLayoutState(previous, rect.width, true)
        const inspectorLeft = rect.right - currentLayout.inspectorWidth - SPLITTER_WIDTH
        return {
          ...previous,
          peekWidth: clamp(inspectorLeft - clientX, MIN_PEEK_WIDTH, MAX_PEEK_WIDTH),
        }
      }),
    [startResize],
  )

  const setActiveInspectorTab = useCallback((tab: WorkbenchInspectorTab) => {
    setDockLayout((previous) => ({
      ...previous,
      activeInspectorTab: tab,
    }))
  }, [])

  return {
    shellRef,
    shellWidth,
    showPeek,
    effectiveSecondaryPreviewMode,
    effectiveLayout,
    setActiveInspectorTab,
    handleBrowserResizeStart,
    handlePeekResizeStart,
    handleInspectorResizeStart,
    splitterWidth: SPLITTER_WIDTH,
    toolRailWidth: TOOL_RAIL_WIDTH,
  }
}
