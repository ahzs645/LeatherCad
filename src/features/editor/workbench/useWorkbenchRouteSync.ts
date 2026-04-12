import { useEffect } from 'react'
import type { WorkbenchInspectorTab, WorkspaceMode } from './workbench-types'

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1)
  }
  return path
}

export function buildWorkbenchWorkspacePath(mode: WorkspaceMode, basePath = import.meta.env.BASE_URL) {
  const normalizedBase = normalizePath(basePath || '/')
  if (mode === '2d') {
    return normalizedBase === '' ? '/' : normalizedBase
  }
  if (normalizedBase === '/' || normalizedBase === '') {
    return '/workbench/3d'
  }
  return `${normalizedBase}/workbench/3d`
}

export function resolveWorkbenchWorkspaceMode(pathname: string, basePath = import.meta.env.BASE_URL): WorkspaceMode {
  const normalizedPath = normalizePath(pathname)
  const threePath = normalizePath(buildWorkbenchWorkspacePath('3d', basePath))
  return normalizedPath === threePath ? '3d' : '2d'
}

type UseWorkbenchRouteSyncParams = {
  enabled: boolean
  workspaceMode: WorkspaceMode
  setWorkspaceMode: React.Dispatch<React.SetStateAction<WorkspaceMode>>
  setSecondaryPreviewMode: React.Dispatch<React.SetStateAction<'hidden' | '2d-peek' | '3d-peek'>>
  activeInspectorTab: WorkbenchInspectorTab
  setActiveInspectorTab: (tab: WorkbenchInspectorTab) => void
}

export function useWorkbenchRouteSync({
  enabled,
  workspaceMode,
  setWorkspaceMode,
  setSecondaryPreviewMode,
  activeInspectorTab,
  setActiveInspectorTab,
}: UseWorkbenchRouteSyncParams) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const applyRouteMode = () => {
      const nextMode = resolveWorkbenchWorkspaceMode(window.location.pathname)
      setWorkspaceMode(nextMode)
      setSecondaryPreviewMode((previous) =>
        nextMode === '3d'
          ? previous === 'hidden' || previous === '3d-peek'
            ? '2d-peek'
            : previous
          : 'hidden',
      )
      if (nextMode === '2d' && activeInspectorTab === 'preview3d') {
        setActiveInspectorTab('inspect')
      }
    }

    applyRouteMode()
    window.addEventListener('popstate', applyRouteMode)
    return () => window.removeEventListener('popstate', applyRouteMode)
  }, [
    activeInspectorTab,
    enabled,
    setActiveInspectorTab,
    setSecondaryPreviewMode,
    setWorkspaceMode,
  ])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const url = new URL(window.location.href)
    const nextPath = buildWorkbenchWorkspacePath(workspaceMode)
    if (normalizePath(url.pathname) !== normalizePath(nextPath)) {
      url.pathname = nextPath
      window.history.pushState(null, '', url.toString())
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
