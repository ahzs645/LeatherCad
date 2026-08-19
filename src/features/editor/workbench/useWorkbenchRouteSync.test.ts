import { createElement, useState } from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import type { MobileViewMode } from '../editor-types'
import type { WorkbenchInspectorTab, WorkspaceMode } from './workbench-types'
import {
  buildMobileViewModePath,
  buildWorkbenchRoutePath,
  buildWorkbenchWorkspacePath,
  resolveMobileViewMode,
  resolveWorkbenchRouteMode,
  resolveWorkbenchWorkspaceMode,
  useMobileWorkbenchRouteSync,
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

describe('buildWorkbenchRoutePath', () => {
  it('builds the split route on the root base path', () => {
    expect(buildWorkbenchRoutePath('split', '/')).toBe('/workbench/split')
  })

  it('builds the split route on a nested base path', () => {
    expect(buildWorkbenchRoutePath('split', '/leathercad/')).toBe('/leathercad/workbench/split')
  })
})

describe('resolveWorkbenchRouteMode', () => {
  it('detects every workspace route', () => {
    expect(resolveWorkbenchRouteMode('/', '/')).toBe('2d')
    expect(resolveWorkbenchRouteMode('/workbench/3d', '/')).toBe('3d')
    expect(resolveWorkbenchRouteMode('/workbench/split', '/')).toBe('split')
    expect(resolveWorkbenchRouteMode('/leathercad/workbench/split', '/leathercad/')).toBe('split')
  })

  it('falls back to 2d for unknown routes', () => {
    expect(resolveWorkbenchRouteMode('/workbench/4d', '/')).toBe('2d')
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

  it('degrades the mobile split route to the 3d workspace', () => {
    expect(resolveWorkbenchWorkspaceMode('/workbench/split', '/')).toBe('3d')
  })
})

describe('mobile view mode routing', () => {
  it('maps every mobile tab onto a path', () => {
    expect(buildMobileViewModePath('editor', '/')).toBe('/')
    expect(buildMobileViewModePath('preview', '/')).toBe('/workbench/3d')
    expect(buildMobileViewModePath('split', '/')).toBe('/workbench/split')
  })

  it('maps every path back onto a mobile tab', () => {
    expect(resolveMobileViewMode('/', '/')).toBe('editor')
    expect(resolveMobileViewMode('/workbench/3d', '/')).toBe('preview')
    expect(resolveMobileViewMode('/workbench/split', '/')).toBe('split')
  })

  it('round-trips through a nested base path', () => {
    const modes: MobileViewMode[] = ['editor', 'preview', 'split']
    for (const mode of modes) {
      expect(resolveMobileViewMode(buildMobileViewModePath(mode, '/leathercad/'), '/leathercad/')).toBe(mode)
    }
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

function readAttribute(render: ReturnType<typeof renderForTest> | null, attribute: string) {
  return render?.container.firstElementChild?.getAttribute(attribute) ?? null
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

  it('lets a 3d deep link win over the initial state on the first render', () => {
    window.history.pushState(null, '', '/workbench/3d')
    lastRender = renderForTest(createElement(Harness, { initialMode: '2d' }))

    expect(readAttribute(lastRender, 'data-workspace-mode')).toBe('3d')
    expect(window.location.pathname).toBe('/workbench/3d')
  })

  it('normalizes a mobile split deep link to the 3d workspace on desktop', () => {
    window.history.pushState(null, '', '/workbench/split')
    lastRender = renderForTest(createElement(Harness, { initialMode: '2d' }))

    expect(readAttribute(lastRender, 'data-workspace-mode')).toBe('3d')
    expect(window.location.pathname).toBe('/workbench/3d')
  })

  it('reconciles the workspace mode on browser history navigation', () => {
    lastRender = renderForTest(createElement(Harness, { initialMode: '2d' }))

    const handle = handles.at(-1)!
    act(() => {
      handle.setMode('3d')
    })
    expect(window.location.pathname).toBe('/workbench/3d')

    act(() => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(readAttribute(lastRender, 'data-workspace-mode')).toBe('2d')
    expect(window.location.pathname).toBe('/')
  })
})

type MobileHarnessHandle = {
  setMode: (mode: MobileViewMode) => void
}

const mobileHandles: MobileHarnessHandle[] = []

function MobileHarness({
  initialMode,
  enabled = true,
}: {
  initialMode: MobileViewMode
  enabled?: boolean
}) {
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>(initialMode)

  useMobileWorkbenchRouteSync({
    enabled,
    mobileViewMode,
    setMobileViewMode,
  })

  mobileHandles.push({ setMode: setMobileViewMode })

  return createElement('div', { 'data-mobile-view-mode': mobileViewMode })
}

describe('useMobileWorkbenchRouteSync', () => {
  let lastRender: ReturnType<typeof renderForTest> | null = null

  beforeEach(() => {
    mobileHandles.length = 0
    window.history.pushState(null, '', '/')
  })

  afterEach(() => {
    cleanupRender(lastRender)
    lastRender = null
    mobileHandles.length = 0
    window.history.pushState(null, '', '/')
  })

  it('lets a 3d deep link win over the initial tab on the first render', () => {
    window.history.pushState(null, '', '/workbench/3d')
    lastRender = renderForTest(createElement(MobileHarness, { initialMode: 'editor' }))

    expect(readAttribute(lastRender, 'data-mobile-view-mode')).toBe('preview')
    expect(window.location.pathname).toBe('/workbench/3d')
  })

  it('lets a split deep link win over the initial tab on the first render', () => {
    window.history.pushState(null, '', '/workbench/split')
    lastRender = renderForTest(createElement(MobileHarness, { initialMode: 'editor' }))

    expect(readAttribute(lastRender, 'data-mobile-view-mode')).toBe('split')
    expect(window.location.pathname).toBe('/workbench/split')
  })

  it('pushes the 3d path when the 3d tab is selected', () => {
    lastRender = renderForTest(createElement(MobileHarness, { initialMode: 'editor' }))
    expect(window.location.pathname).toBe('/')

    act(() => {
      mobileHandles.at(-1)!.setMode('preview')
    })

    expect(window.location.pathname).toBe('/workbench/3d')
  })

  it('pushes the split path when the split tab is selected', () => {
    lastRender = renderForTest(createElement(MobileHarness, { initialMode: 'editor' }))

    act(() => {
      mobileHandles.at(-1)!.setMode('split')
    })

    expect(window.location.pathname).toBe('/workbench/split')
  })

  it('pushes the 2d path when the 2d tab is selected again', () => {
    window.history.pushState(null, '', '/workbench/3d')
    lastRender = renderForTest(createElement(MobileHarness, { initialMode: 'preview' }))
    expect(window.location.pathname).toBe('/workbench/3d')

    act(() => {
      mobileHandles.at(-1)!.setMode('editor')
    })

    expect(window.location.pathname).toBe('/')
  })

  it('restores the 2d tab when the browser navigates back', () => {
    lastRender = renderForTest(createElement(MobileHarness, { initialMode: 'editor' }))

    act(() => {
      mobileHandles.at(-1)!.setMode('preview')
    })
    expect(window.location.pathname).toBe('/workbench/3d')
    expect(readAttribute(lastRender, 'data-mobile-view-mode')).toBe('preview')

    act(() => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(readAttribute(lastRender, 'data-mobile-view-mode')).toBe('editor')
    expect(window.location.pathname).toBe('/')
  })

  it('leaves the route alone while disabled', () => {
    window.history.pushState(null, '', '/workbench/3d')
    lastRender = renderForTest(
      createElement(MobileHarness, { initialMode: 'editor', enabled: false }),
    )

    expect(readAttribute(lastRender, 'data-mobile-view-mode')).toBe('editor')

    act(() => {
      mobileHandles.at(-1)!.setMode('split')
    })

    expect(window.location.pathname).toBe('/workbench/3d')
  })

  it('treats the URL as the source of truth again when it is re-enabled', () => {
    lastRender = renderForTest(
      createElement(MobileHarness, { initialMode: 'editor', enabled: false }),
    )

    window.history.pushState(null, '', '/workbench/split')
    lastRender.rerender(createElement(MobileHarness, { initialMode: 'editor', enabled: true }))

    expect(readAttribute(lastRender, 'data-mobile-view-mode')).toBe('split')
    expect(window.location.pathname).toBe('/workbench/split')
  })
})
