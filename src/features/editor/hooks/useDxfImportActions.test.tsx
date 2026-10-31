import { act, createElement, type ChangeEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import type { Shape } from '../cad/cad-types'
import { DxfImportButton } from '../components/DxfImportButton'
import { useDxfImportActions, type DxfImportActionsParams } from './useDxfImportActions'

const validDxf = '0\nSECTION\n2\nENTITIES\n0\nLINE\n10\n0\n20\n0\n11\n10\n21\n5\n0\nENDSEC\n0\nEOF\n'
let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null })
function callbacks() {
  return { setLayers: vi.fn(), setLineTypes: vi.fn(), setShapes: vi.fn(), setSelectedShapeIds: vi.fn(), setStatus: vi.fn(), onImported: vi.fn() }
}
function fileEvent(text: () => Promise<string>, name = 'drawing.dxf'): ChangeEvent<HTMLInputElement> {
  return { target: { files: [{ name, size: 50, text }], value: name } } as unknown as ChangeEvent<HTMLInputElement>
}
function deferredRead() {
  let resolve!: (raw: string) => void
  const promise = new Promise<string>((complete) => { resolve = complete })
  return { promise, resolve }
}

function renderHook(props: DxfImportActionsParams) {
  let actions!: ReturnType<typeof useDxfImportActions>
  function Harness(params: DxfImportActionsParams) {
    actions = useDxfImportActions(params)
    return createElement('output', { 'data-pending': actions.isImporting }, actions.feedback?.message)
  }
  rendered = renderForTest(createElement(Harness, props))
  return { getActions: () => actions, rerender: (next: DxfImportActionsParams) => rendered?.rerender(createElement(Harness, next)) }
}

describe('DXF import lifetime and feedback', () => {
  it('does not append to a project after the importer unmounts during a file read', async () => {
    const spies = callbacks(), read = deferredRead()
    const hook = renderHook(spies)
    let pending!: Promise<void>
    act(() => { pending = hook.getActions().handleImportDxf(fileEvent(() => read.promise)) })
    expect(hook.getActions().isImporting).toBe(true)
    cleanupRender(rendered)
    rendered = null
    await act(async () => { read.resolve(validDxf); await pending })
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled()
  })

  it('abandons a pending read when immutable document identity changes, and permits a new import', async () => {
    const spies = callbacks(), read = deferredRead()
    const before: Shape[] = [], after: Shape[] = []
    const hook = renderHook({ ...spies, importSessionKey: before })
    let pending!: Promise<void>
    act(() => { pending = hook.getActions().handleImportDxf(fileEvent(() => read.promise)) })
    hook.rerender({ ...spies, importSessionKey: after })
    expect(hook.getActions().isImporting).toBe(false)
    await act(async () => { read.resolve(validDxf); await pending })
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled()
    await act(async () => { await hook.getActions().handleImportDxf(fileEvent(async () => validDxf)) })
    expect(spies.setShapes).toHaveBeenCalledTimes(1)
    expect(spies.onImported).toHaveBeenCalledTimes(1)
  })

  it('keeps successful import feedback when its own append changes the parent shapes identity', async () => {
    const spies = callbacks()
    const hook = renderHook({ ...spies, importSessionKey: [] })
    await act(async () => { await hook.getActions().handleImportDxf(fileEvent(async () => validDxf)) })
    expect(hook.getActions().feedback?.message).toContain('Imported 1 DXF shapes')
    hook.rerender({ ...spies, importSessionKey: [] })
    expect(hook.getActions().isImporting).toBe(false)
    expect(hook.getActions().feedback?.kind).toBe('success')
    expect(hook.getActions().feedback?.warnings.join(' ')).toContain('units are unspecified')
  })

  it('shows parse errors inline and in global status without changing document state', async () => {
    const spies = callbacks()
    rendered = renderForTest(createElement(DxfImportButton, spies))
    const input = rendered.container.querySelector('input')!
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'broken.dxf', size: 4, text: async () => 'broken' }] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await vi.waitFor(() => expect(rendered?.container.querySelector('[role="alert"]')?.textContent).toContain('DXF import failed:'))
    expect(spies.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('DXF import failed:'))
    expect(spies.setShapes).not.toHaveBeenCalled()
    expect(spies.setLayers).not.toHaveBeenCalled()
  })

  it('keeps approximation/unit warnings visible inside the import dialog after success', async () => {
    const spies = callbacks()
    rendered = renderForTest(createElement(DxfImportButton, spies))
    const input = rendered.container.querySelector('input')!
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'drawing.dxf', size: validDxf.length, text: async () => validDxf }] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await vi.waitFor(() => expect(rendered?.container.querySelector('[role="status"] li')?.textContent).toContain('units are unspecified'))
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('Imported 1 DXF shapes')
    expect(spies.setShapes).toHaveBeenCalledTimes(1)
  })
})
