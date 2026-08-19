import { useEffect, useRef } from 'react'
import type { MobileViewMode } from '../editor-types'
import type { WorkbenchInspectorTab, WorkspaceMode } from './workbench-types'

/**
 * The URL vocabulary for the workspace. Desktop only ever produces/consumes the
 * two-value `WorkspaceMode` contract; the mobile shell adds a third tab (split
 * 2D + 3D) which gets its own path so every mobile tab is deep-linkable and the
 * Back button round-trips losslessly. A desktop client that opens a `split`
 * link degrades to the 3D workspace (see `resolveWorkbenchWorkspaceMode`).
 */
export type WorkbenchRouteMode = WorkspaceMode | 'split'

const ROUTE_SEGMENTS: Record<Exclude<WorkbenchRouteMode, '2d'>, string> = {
  '3d': 'workbench/3d',
  split: 'workbench/split',
}

const MOBILE_VIEW_MODE_BY_ROUTE_MODE: Record<WorkbenchRouteMode, MobileViewMode> = {
  '2d': 'editor',
  '3d': 'preview',
  split: 'split',
}

const ROUTE_MODE_BY_MOBILE_VIEW_MODE: Record<MobileViewMode, WorkbenchRouteMode> = {
  editor: '2d',
  preview: '3d',
  split: 'split',
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1)
  }
  return path
}

export function buildWorkbenchRoutePath(
  mode: WorkbenchRouteMode,
  basePath = import.meta.env.BASE_URL,
) {
  const normalizedBase = normalizePath(basePath || '/')
  if (mode === '2d') {
    return normalizedBase === '' ? '/' : normalizedBase
  }
  const segment = ROUTE_SEGMENTS[mode]
  if (normalizedBase === '/' || normalizedBase === '') {
    return `/${segment}`
  }
  return `${normalizedBase}/${segment}`
}

export function resolveWorkbenchRouteMode(
  pathname: string,
  basePath = import.meta.env.BASE_URL,
): WorkbenchRouteMode {
  const normalizedPath = normalizePath(pathname)
  if (normalizedPath === normalizePath(buildWorkbenchRoutePath('3d', basePath))) {
    return '3d'
  }
  if (normalizedPath === normalizePath(buildWorkbenchRoutePath('split', basePath))) {
    return 'split'
  }
  return '2d'
}

/** Desktop path builder — intentionally narrowed to the two-value contract. */
export function buildWorkbenchWorkspacePath(mode: WorkspaceMode, basePath = import.meta.env.BASE_URL) {
  return buildWorkbenchRoutePath(mode, basePath)
}

/** Desktop path resolver — `/workbench/split` degrades to the 3D workspace. */
export function resolveWorkbenchWorkspaceMode(pathname: string, basePath = import.meta.env.BASE_URL): WorkspaceMode {
  return resolveWorkbenchRouteMode(pathname, basePath) === '2d' ? '2d' : '3d'
}

export function buildMobileViewModePath(mode: MobileViewMode, basePath = import.meta.env.BASE_URL) {
  return buildWorkbenchRoutePath(ROUTE_MODE_BY_MOBILE_VIEW_MODE[mode], basePath)
}

export function resolveMobileViewMode(pathname: string, basePath = import.meta.env.BASE_URL): MobileViewMode {
  return MOBILE_VIEW_MODE_BY_ROUTE_MODE[resolveWorkbenchRouteMode(pathname, basePath)]
}

type RouteModeSyncParams<TMode extends string> = {
  enabled: boolean
  mode: TMode
  buildRoutePath: (mode: TMode) => string
  resolveRouteMode: (pathname: string) => TMode
  applyRouteMode: (mode: TMode) => void
}

/**
 * Bidirectional `mode` ⇄ `window.location.pathname` sync shared by the desktop
 * and mobile shells. Only one of the two shells is mounted at a time, so only
 * one caller is ever `enabled`.
 */
function useRouteModeSync<TMode extends string>(params: RouteModeSyncParams<TMode>) {
  const { enabled, mode } = params
  // Tracks the last mode this hook has reconciled with the URL.
  // On the very first enabled commit, URL → state is the source of truth, so
  // the state → URL effect must wait one render before pushing a path. Without
  // this, a deep link to /workbench/3d would be overwritten with "/" by the
  // initial state → URL run before the URL → state setter takes effect.
  // It is reset to null while disabled so re-enabling (a viewport crossing the
  // mobile breakpoint) restores the same "URL wins first" behaviour.
  const lastReconciledModeRef = useRef<TMode | null>(null)
  // Callbacks are read through a ref so the effects below depend on `enabled`
  // and `mode` alone; re-subscribing the popstate listener on every render
  // would re-apply the URL mode and fight the user's own tab switches.
  // This refresh is declared first so it commits before the sync effects below
  // (and before any popstate handler) ever read from it.
  const paramsRef = useRef(params)
  useEffect(() => {
    paramsRef.current = params
  })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const syncModeFromRoute = () => {
      const { resolveRouteMode, applyRouteMode } = paramsRef.current
      applyRouteMode(resolveRouteMode(window.location.pathname))
    }

    syncModeFromRoute()
    window.addEventListener('popstate', syncModeFromRoute)
    return () => window.removeEventListener('popstate', syncModeFromRoute)
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      lastReconciledModeRef.current = null
      return
    }
    if (typeof window === 'undefined') {
      return
    }

    const isInitialRun = lastReconciledModeRef.current === null
    const modeChanged = lastReconciledModeRef.current !== mode
    lastReconciledModeRef.current = mode

    if (isInitialRun || !modeChanged) {
      return
    }

    const url = new URL(window.location.href)
    const nextPath = paramsRef.current.buildRoutePath(mode)
    if (normalizePath(url.pathname) !== normalizePath(nextPath)) {
      url.pathname = nextPath
      window.history.pushState(null, '', url.toString())
    }
  }, [enabled, mode])
}

type UseWorkbenchRouteSyncParams = {
  enabled: boolean
  workspaceMode: WorkspaceMode
  setWorkspaceMode: React.Dispatch<React.SetStateAction<WorkspaceMode>>
  setSecondaryPreviewMode: React.Dispatch<React.SetStateAction<'hidden' | '2d-peek' | '3d-peek'>>
  activeInspectorTab: WorkbenchInspectorTab
  setActiveInspectorTab: (tab: WorkbenchInspectorTab) => void
}

/** Desktop workbench route sync, including the inspector/peek side effects. */
export function useWorkbenchRouteSync({
  enabled,
  workspaceMode,
  setWorkspaceMode,
  setSecondaryPreviewMode,
  activeInspectorTab,
  setActiveInspectorTab,
}: UseWorkbenchRouteSyncParams) {
  useRouteModeSync<WorkspaceMode>({
    enabled,
    mode: workspaceMode,
    buildRoutePath: buildWorkbenchWorkspacePath,
    resolveRouteMode: resolveWorkbenchWorkspaceMode,
    applyRouteMode: (nextMode) => {
      setWorkspaceMode(nextMode)
      setSecondaryPreviewMode((previous) =>
        nextMode === '3d'
          ? previous === 'hidden' || previous === '3d-peek'
            ? '2d-peek'
            : previous
          : 'hidden',
      )
    },
  })

  useEffect(() => {
    if (!enabled) {
      return
    }

    setSecondaryPreviewMode((previous) =>
      workspaceMode === '3d'
        ? previous === 'hidden' || previous === '3d-peek'
          ? '2d-peek'
          : previous
        : 'hidden',
    )

    if (workspaceMode === '2d' && activeInspectorTab === 'preview3d') {
      setActiveInspectorTab('inspect')
    }
  }, [
    activeInspectorTab,
    enabled,
    setActiveInspectorTab,
    setSecondaryPreviewMode,
    workspaceMode,
  ])
}

type UseMobileWorkbenchRouteSyncParams = {
  enabled: boolean
  mobileViewMode: MobileViewMode
  setMobileViewMode: React.Dispatch<React.SetStateAction<MobileViewMode>>
}

/**
 * Mobile workbench route sync. The mobile shell owns its own three-state tab
 * strip (2D / 3D / Split) instead of `workspaceMode`, and none of the desktop
 * inspector or peek-pane concepts exist there, so this deliberately touches
 * `mobileViewMode` and nothing else.
 */
export function useMobileWorkbenchRouteSync({
  enabled,
  mobileViewMode,
  setMobileViewMode,
}: UseMobileWorkbenchRouteSyncParams) {
  useRouteModeSync<MobileViewMode>({
    enabled,
    mode: mobileViewMode,
    buildRoutePath: buildMobileViewModePath,
    resolveRouteMode: resolveMobileViewMode,
    applyRouteMode: setMobileViewMode,
  })
}
