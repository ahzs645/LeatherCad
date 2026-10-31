import { act, createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import type { DocFile } from '../cad/cad-types'
import { EditorInterchangeOverlays, type EditorInterchangeOverlaysProps } from './EditorInterchangeOverlays'

const observed = vi.hoisted(() => ({ jobs: [] as unknown[], mounts: 0 }))
vi.mock('./StlExportModal', async () => {
  const { createElement, useEffect } = await import('react')
  return { StlExportModal: function MockStlExport({ doc }: { doc: DocFile }) {
    useEffect(() => { observed.jobs.push(doc) }, [doc])
    useEffect(() => { observed.mounts++ }, [])
    return createElement('p', null, 'Manufacturing mesh request')
  } }
})
let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null; observed.jobs = []; observed.mounts = 0 })

it('keeps an in-flight manufacturing request through unrelated renders and remounts for a new document session', async () => {
  const build = vi.fn(() => ({ version: 1, units: 'mm', objects: [] }) as unknown as DocFile)
  const props: EditorInterchangeOverlaysProps = {
    panels: { panel: 'stl', close: vi.fn(), openFiles: vi.fn(), openStl: vi.fn(), openCloud: vi.fn() },
    buildCurrentDocFile: build, onSaveLcad: vi.fn(), onLoadDocument: vi.fn(), onStatus: vi.fn(),
    selectedShapeIds: [], dxfImportProps: {} as EditorInterchangeOverlaysProps['dxfImportProps'], documentSessionKey: 1,
  }
  await act(async () => {
    rendered = renderForTest(createElement(EditorInterchangeOverlays, props))
    await import('./StlExportModal')
  })
  expect(observed.jobs).toHaveLength(1)
  const firstDoc = observed.jobs[0]
  await act(async () => rendered!.rerender(createElement(EditorInterchangeOverlays, { ...props, onStatus: vi.fn() })))
  expect(build).toHaveBeenCalledTimes(1)
  expect(observed.jobs).toEqual([firstDoc])
  expect(observed.mounts).toBe(1)
  await act(async () => rendered!.rerender(createElement(EditorInterchangeOverlays, { ...props, documentSessionKey: 2 })))
  expect(build).toHaveBeenCalledTimes(2)
  expect(observed.jobs).toHaveLength(2)
  expect(observed.jobs[1]).not.toBe(firstDoc)
  expect(observed.mounts).toBe(2)
})
