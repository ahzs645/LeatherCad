import { describe, expect, it } from 'vitest'
import {
  buildWorkbenchWorkspacePath,
  resolveWorkbenchWorkspaceMode,
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

describe('route sync guard', () => {
  it('detects route/state mismatch before path writes should occur', () => {
    expect(resolveWorkbenchWorkspaceMode('/workbench/3d', '/')).toBe('3d')
    expect(resolveWorkbenchWorkspaceMode('/workbench/3d', '/')).not.toBe('2d')
  })
})
