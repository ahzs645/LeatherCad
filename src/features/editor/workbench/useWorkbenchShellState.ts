import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  DockLayoutState,
  SecondaryPreviewMode,
  WorkbenchInspectorTab,
} from './workbench-types'
import { safeLocalStorageGet, safeLocalStorageSet } from '../ops/safe-storage'

const STORAGE_KEY = 'leathercad.workbench.layout.v1'
const MIN_BROWSER_WIDTH = 220
const MAX_BROWSER_WIDTH = 360
const MIN_INSPECTOR_WIDTH = 300
const MAX_INSPECTOR_WIDTH = 420
const MIN_PEEK_WIDTH = 300
const MAX_PEEK_WIDTH = 420
/**
 * In `both` mode the second surface is a co-equal lane rather than a peek, so
 * it may take most of the workspace and is not gated on a wide shell.
 */
const MIN_SPLIT_PEEK_WIDTH = 320
const MAX_SPLIT_PEEK_WIDTH = 1400
const SPLIT_PEEK_BREAKPOINT = 1000
const MIN_MAIN_WIDTH = 460
const TOOL_RAIL_WIDTH = 58
const SPLITTER_WIDTH = 10
const INSPECTOR_RESTORE_WIDTH = 44
const AUTO_HIDE_PEEK_BREAKPOINT = 1440

const DEFAULT_LAYOUT: DockLayoutState = {
  browserWidth: 260,
  inspectorWidth: 340,
  peekWidth: 360,
  splitWidth: null,
  activeInspectorTab: 'inspect',
  inspectorOpen: true,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function readStoredLayout(): DockLayoutState {
  if (typeof window === 'undefined') {
    return DEFAULT_LAYOUT
  }
  try {
    const raw = safeLocalStorageGet(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_LAYOUT
    }
    const parsed = JSON.parse(raw) as Partial<DockLayoutState>
    return {
      browserWidth: typeof parsed.browserWidth === 'number' ? parsed.browserWidth : DEFAULT_LAYOUT.browserWidth,
      inspectorWidth: typeof parsed.inspectorWidth === 'number' ? parsed.inspectorWidth : DEFAULT_LAYOUT.inspectorWidth,
      peekWidth: typeof parsed.peekWidth === 'number' ? parsed.peekWidth : DEFAULT_LAYOUT.peekWidth,
      splitWidth: typeof parsed.splitWidth === 'number' ? parsed.splitWidth : null,
      activeInspectorTab:
        parsed.activeInspectorTab === 'piece' ||
        parsed.activeInspectorTab === 'preview3d' ||
        parsed.activeInspectorTab === 'document'
          ? parsed.activeInspectorTab
          : 'inspect',
      inspectorOpen: typeof parsed.inspectorOpen === 'boolean' ? parsed.inspectorOpen : DEFAULT_LAYOUT.inspectorOpen,
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function clampDockLayoutState(
  layout: DockLayoutState,
  shellWidth: number,
  showPeek: boolean,
  evenSplit = false,
): DockLayoutState {
  const minPeek = evenSplit ? MIN_SPLIT_PEEK_WIDTH : MIN_PEEK_WIDTH
  const maxPeek = evenSplit ? MAX_SPLIT_PEEK_WIDTH : MAX_PEEK_WIDTH
  let browserWidth = clamp(layout.browserWidth, MIN_BROWSER_WIDTH, MAX_BROWSER_WIDTH)
  let inspectorWidth = clamp(layout.inspectorWidth, MIN_INSPECTOR_WIDTH, MAX_INSPECTOR_WIDTH)
  let peekWidth = clamp(evenSplit ? (layout.splitWidth ?? minPeek) : layout.peekWidth, minPeek, maxPeek)
  const showInspector = layout.inspectorOpen

  if (shellWidth <= 0) {
    return {
      ...layout,
      browserWidth,
      inspectorWidth,
      peekWidth,
    }
  }

  const splitterCount = (showPeek ? 2 : 1) + (showInspector ? 1 : 0)
  const maxPanelWidth =
    shellWidth -
    TOOL_RAIL_WIDTH -
    splitterCount * SPLITTER_WIDTH -
    (showInspector ? 0 : INSPECTOR_RESTORE_WIDTH) -
    MIN_MAIN_WIDTH
  if (maxPanelWidth > 0) {
    let totalPanelWidth = browserWidth + (showInspector ? inspectorWidth : 0) + (showPeek ? peekWidth : 0)
    let overflow = totalPanelWidth - maxPanelWidth

    if (overflow > 0 && showPeek) {
      const nextPeekWidth = Math.max(minPeek, peekWidth - overflow)
      overflow -= peekWidth - nextPeekWidth
      peekWidth = nextPeekWidth
    }
    if (overflow > 0 && showInspector) {
      const nextInspectorWidth = Math.max(MIN_INSPECTOR_WIDTH, inspectorWidth - overflow)
      overflow -= inspectorWidth - nextInspectorWidth
      inspectorWidth = nextInspectorWidth
    }
    if (overflow > 0) {
      const nextBrowserWidth = Math.max(MIN_BROWSER_WIDTH, browserWidth - overflow)
      overflow -= browserWidth - nextBrowserWidth
      browserWidth = nextBrowserWidth
    }
    totalPanelWidth = browserWidth + (showInspector ? inspectorWidth : 0) + (showPeek ? peekWidth : 0)
    if (totalPanelWidth > maxPanelWidth && showPeek) {
      peekWidth = Math.max(minPeek, maxPanelWidth - browserWidth - (showInspector ? inspectorWidth : 0))
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
  /** `both` mode: the second surface is a lane, not a peek. */
  evenSplit?: boolean
  autoHideSidebar?: boolean
  /** Source-app `chkPinSideBar` — when true, force inspector to stay open. */
  pinSideBar?: boolean
}

export function useWorkbenchShellState(params: UseWorkbenchShellStateParams) {
  const { enabled, secondaryPreviewMode, evenSplit = false, autoHideSidebar = false, pinSideBar = false } = params
  // A callback ref rather than a plain one, so the resize observer re-binds when
  // the shell element is replaced — which happens when a lazily-loaded surface
  // suspends and resolves. An observer left watching the detached node reports
  // nothing, which reads as a zero-width shell and folds the second lane away.
  const shellNodeRef = useRef<HTMLElement | null>(null)
  const [shellNode, setShellNode] = useState<HTMLElement | null>(null)
  const shellRef = useCallback((node: HTMLElement | null) => {
    shellNodeRef.current = node
    setShellNode(node)
  }, [])
  const [shellWidth, setShellWidth] = useState(0)
  const [dockLayout, setDockLayout] = useState<DockLayoutState>(() => readStoredLayout())
  const [isResizing, setIsResizing] = useState(false)

  // A peek is a luxury and folds away on a narrow shell; an even split is the
  // point of the mode, so it survives down to a much lower width.
  const peekBreakpoint = evenSplit ? SPLIT_PEEK_BREAKPOINT : AUTO_HIDE_PEEK_BREAKPOINT
  const effectiveSecondaryPreviewMode: SecondaryPreviewMode =
    secondaryPreviewMode !== 'hidden' && shellWidth >= peekBreakpoint
      ? secondaryPreviewMode
      : 'hidden'
  const showPeek = enabled && effectiveSecondaryPreviewMode !== 'hidden'

  // Re-bind whenever the observed element changes, not only when `enabled`
  // does. The shell element is replaced when a lazy surface suspends and
  // resolves, and an observer left watching the detached node reports nothing —
  // which reads as a zero-width shell and folds the second lane away.
  useEffect(() => {
    const node = enabled ? shellNode : null
    if (!node) {
      // No shell to measure. The last width stands, which is harmless: every
      // consumer of it is behind `enabled`.
      return
    }
    // observe() delivers an initial callback with the current size, so there is
    // no need to seed the width synchronously.
    const observer = new ResizeObserver((entries) => {
      setShellWidth(Math.round(entries[0]?.contentRect.width ?? node.clientWidth))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, shellNode])

  const layoutForAutoHide: DockLayoutState = useMemo(() => {
    if (pinSideBar && !dockLayout.inspectorOpen) {
      return { ...dockLayout, inspectorOpen: true }
    }
    if (autoHideSidebar && !pinSideBar && dockLayout.inspectorOpen) {
      return { ...dockLayout, inspectorOpen: false }
    }
    return dockLayout
  }, [autoHideSidebar, pinSideBar, dockLayout])

  const effectiveLayout = useMemo(() => {
    // An even split the user has not sized yet starts at half the space the two
    // surfaces share. Borrowing the peek's remembered width would open it as a
    // sliver, which is the arrangement `both` exists to avoid.
    const seeded =
      evenSplit && layoutForAutoHide.splitWidth === null && shellWidth > 0
        ? {
            ...layoutForAutoHide,
            splitWidth: Math.round(
              (shellWidth -
                TOOL_RAIL_WIDTH -
                layoutForAutoHide.browserWidth -
                (layoutForAutoHide.inspectorOpen ? layoutForAutoHide.inspectorWidth : INSPECTOR_RESTORE_WIDTH) -
                2 * SPLITTER_WIDTH) /
                2,
            ),
          }
        : layoutForAutoHide
    return clampDockLayoutState(seeded, shellWidth, showPeek, evenSplit)
  }, [evenSplit, layoutForAutoHide, shellWidth, showPeek])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(effectiveLayout))
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
      const node = shellNodeRef.current
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
          ...(evenSplit
            ? { splitWidth: clamp(inspectorLeft - clientX, MIN_SPLIT_PEEK_WIDTH, MAX_SPLIT_PEEK_WIDTH) }
            : { peekWidth: clamp(inspectorLeft - clientX, MIN_PEEK_WIDTH, MAX_PEEK_WIDTH) }),
        }
      }),
    // evenSplit decides which width the drag writes, so a stale capture would
    // resize the wrong one after a mode change.
    [evenSplit, startResize],
  )

  const setActiveInspectorTab = useCallback((tab: WorkbenchInspectorTab) => {
    setDockLayout((previous) => ({
      ...previous,
      activeInspectorTab: tab,
      inspectorOpen: true,
    }))
  }, [])

  const toggleInspector = useCallback(() => {
    setDockLayout((previous) => ({
      ...previous,
      inspectorOpen: !previous.inspectorOpen,
    }))
  }, [])

  return {
    shellRef,
    shellWidth,
    showPeek,
    effectiveSecondaryPreviewMode,
    effectiveLayout,
    setActiveInspectorTab,
    toggleInspector,
    handleBrowserResizeStart,
    handlePeekResizeStart,
    handleInspectorResizeStart,
    splitterWidth: SPLITTER_WIDTH,
    toolRailWidth: TOOL_RAIL_WIDTH,
    inspectorRestoreWidth: INSPECTOR_RESTORE_WIDTH,
  }
}
