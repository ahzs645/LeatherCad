import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocFile } from '../cad/cad-types'
import type { StlExportOptions, StlExportResult } from '../io/io-stl'
import { useStlGeneration } from './useStlGeneration'

class FakeWorker {
  static instances: FakeWorker[] = []
  terminated = false
  onmessage: ((event: MessageEvent<{ result?: StlExportResult; error?: string }>) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  terminate() { this.terminated = true }
  send(result: StlExportResult) { this.onmessage?.({ data: { result } } as MessageEvent<{ result: StlExportResult }>) }
}
const doc = { version: 1, units: 'mm', objects: [] } as unknown as DocFile
const result = { triangleCount: 12, faces: [] } as unknown as StlExportResult
let root: Root | undefined
let host: HTMLDivElement | undefined
function Probe({ options, enabled = true }: { options: Partial<StlExportOptions>; enabled?: boolean }) {
  const state = useStlGeneration(doc, options, enabled)
  return createElement('p', { 'data-faces': state.faces.length }, state.result ? `mesh:${state.result.triangleCount}` : state.pending ? 'pending' : state.error || 'closed')
}
async function render(options: Partial<StlExportOptions>, enabled = true) {
  if (!host) { host = document.createElement('div'); document.body.append(host); root = createRoot(host) }
  await act(async () => root!.render(createElement(Probe, { options, enabled })))
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  host?.remove(); host = undefined; root = undefined; FakeWorker.instances = []
  vi.unstubAllGlobals(); vi.useRealTimers()
})

describe('background manufacturing generation', () => {
  it('terminates superseded CPU work and ignores its late result', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    await render({ thicknessMm: 2 })
    const first = FakeWorker.instances[0]
    await render({ thicknessMm: 3 })
    expect(first.terminated).toBe(true)
    await act(async () => first.send(result))
    expect(host?.textContent).toBe('pending')
    await act(async () => FakeWorker.instances[1].send(result))
    expect(host?.textContent).toBe('mesh:12')
  })
  it('cancels work on close and never exposes a previous result as a current download', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const options = { thicknessMm: 2 }
    await render(options)
    await act(async () => FakeWorker.instances[0].send(result))
    await render({ thicknessMm: 4 })
    expect(host?.textContent).toBe('pending')
    await render(options, false)
    expect(FakeWorker.instances[1].terminated).toBe(true)
    expect(host?.textContent).toBe('closed')
  })
  it('clears its time budget after success and reports bounded worker failures', async () => {
    vi.useFakeTimers(); vi.stubGlobal('Worker', FakeWorker)
    await render({ thicknessMm: 2 })
    await act(async () => FakeWorker.instances[0].send(result))
    await act(async () => vi.advanceTimersByTime(31_000))
    expect(host?.textContent).toBe('mesh:12')
    await render({ thicknessMm: 3 })
    await act(async () => vi.advanceTimersByTime(30_001))
    expect(host?.textContent).toMatch(/exceeded 30 seconds/)
    expect(FakeWorker.instances[1].terminated).toBe(true)
  })
  it('clears stale face assignments when selection changes but retains them during height edits', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    await render({ thicknessMm: 2, selectedShapeIds: new Set(['a']) })
    await act(async () => FakeWorker.instances[0].send({ ...result, faces: [{ id: 'face', at: { x: 1, y: 1 }, rings: [], heightMm: 2, through: false }] }))
    expect(host?.firstElementChild?.getAttribute('data-faces')).toBe('1')
    await render({ thicknessMm: 3, selectedShapeIds: new Set(['a']) })
    expect(host?.firstElementChild?.getAttribute('data-faces')).toBe('1')
    await render({ thicknessMm: 3, selectedShapeIds: new Set(['b']) })
    expect(host?.firstElementChild?.getAttribute('data-faces')).toBe('0')
  })
})
