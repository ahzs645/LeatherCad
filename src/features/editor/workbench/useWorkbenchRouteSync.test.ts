import { createElement, useState } from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import type { WorkbenchInspectorTab, WorkspaceMode } from './workbench-types'
import {
  buildWorkbenchWorkspacePath,
  resolveWorkbenchWorkspaceMode,
  useWorkbenchRouteSync,
} from './useWorkbenchRouteSync'

describe('buildWorkbenchWorkspacePath', () => {
  it('builds root workspace paths', () => {
    expect(buildWorkbenchWorkspacePath('2d', '/')).toBe('/')
    expect(buildWorkbenchWorkspacePath('3d', '/')).toBe('/workbench/3d')
  })

  it('builds nested base paths', () => {
    expect(buildWorkbenchWorkspacePath('2d', '/leathercad/')).toBe('/leathercad')
    expect(buildWorkbenchWorkspacePath('3d', '/leathercad/')).toBe('/leathercad/workbench/3d')
  })
})

describe('resolveWorkbenchWorkspaceMode', () => {
  it('detects the 3d workspace path', () => {
    expect(resolveWorkbenchWorkspaceMode('/workbench/3d', '/')).toBe('3d')
    expect(resolveWorkbenchWorkspaceMode('/leathercad/workbench/3d', '/leathercad/')).toBe('3d')
  })

  it('falls back to the 2d workspace path', () => {
    expect(resolveWorkbenchWorkspaceMode('/', '/')).toBe('2d')
    expect(resolveWorkbenchWorkspaceMode('/leathercad', '/leathercad/')).toBe('2d')
  })
})

type HarnessHandle = {
  setMode: (mode: WorkspaceMode) => void
}

const handles: HarnessHandle[] = []

function Harness({ initialMode }: { initialMode: WorkspaceMode }) {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(initialMode)
  const [secondaryPreviewMode, setSecondaryPreviewMode] = useState<
    'hidden' | '2d-peek' | '3d-peek'
  >('hidden')
  const [activeInspectorTab, setActiveInspectorTab] = useState<WorkbenchInspectorTab>('inspect')

  useWorkbenchRouteSync({
    enabled: true,
    workspaceMode,
    setWorkspaceMode,
    setSecondaryPreviewMode,
    activeInspectorTab,
    setActiveInspectorTab,
  })

  handles.push({ setMode: setWorkspaceMode })

  return createElement('div', {
    'data-workspace-mode': workspaceMode,
    'data-secondary-preview': secondaryPreviewMode,
  })
}

describe('useWorkbenchRouteSync route writes', () => {
  let lastRender: ReturnType<typeof renderForTest> | null = null

  beforeEach(() => {
    handles.length = 0
    window.history.pushState(null, '', '/')
  })

  afterEach(() => {
    cleanupRender(lastRender)
    lastRender = null
    handles.length = 0
    window.history.pushState(null, '', '/')
  })

  it('pushes the 3d workbench path when state switches from 2d to 3d', () => {
    lastRender = renderForTest(createElement(Harness, { initialMode: '2d' }))
    expect(window.location.pathname).toBe('/')

    const handle = handles.at(-1)!
    act(() => {
      handle.setMode('3d')
    })

    expect(window.location.pathname).toBe('/workbench/3d')
  })

  it('pushes the 2d workbench path when state switches back to 2d', () => {
    window.history.pushState(null, '', '/workbench/3d')
    lastRender = renderForTest(createElement(Harness, { initialMode: '3d' }))
    expect(window.location.pathname).toBe('/workbench/3d')

    const handle = handles.at(-1)!
    act(() => {
      handle.setMode('2d')
    })

    expect(window.location.pathname).toBe('/')
  })
})
