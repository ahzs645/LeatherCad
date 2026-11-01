import { Blob as NodeBlob } from 'node:buffer'
import { act, createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { PRINTER_FIT_CALIBRATION_CHECKLIST, PRINTER_FIT_CALIBRATION_MANIFEST } from '../io/manufacturing/manufacturing-calibration-manifest'
import type { PrinterFitCalibrationDownload } from '../io/manufacturing/manufacturing-calibration'
import { setEditorLocale } from '../ops/locale-store'
import { StlCalibrationDownload } from './StlCalibrationDownload'

class FakeWorker {
  static instances: FakeWorker[] = []
  terminated = false
  onmessage: ((event: MessageEvent<{ calibration?: PrinterFitCalibrationDownload; error?: string }>) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  terminate() { this.terminated = true }
  send(data: { calibration?: PrinterFitCalibrationDownload; error?: string }) { this.onmessage?.({ data } as MessageEvent<typeof data>) }
}
const packet: PrinterFitCalibrationDownload = { content: 'solid fixture\nendsolid fixture\n', checklist: PRINTER_FIT_CALIBRATION_CHECKLIST, manifest: PRINTER_FIT_CALIBRATION_MANIFEST }
const OriginalURL = URL
let rendered: ReturnType<typeof renderForTest> | null = null
const downloads: { filename: string; blob: NodeBlob }[] = []
const blobs = new Map<string, NodeBlob>()
const revoke = vi.fn()
beforeEach(() => {
  vi.useFakeTimers(); setEditorLocale('en'); FakeWorker.instances = []; downloads.length = 0; blobs.clear(); revoke.mockClear()
  vi.stubGlobal('Worker', FakeWorker); vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('URL', class extends OriginalURL {
    static createObjectURL(blob: Blob) { const url = `blob:fixture-${blobs.size}`; blobs.set(url, blob as unknown as NodeBlob); return url }
    static revokeObjectURL = revoke
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const blob = blobs.get(this.href)
    if (!blob) throw new Error('Unknown download URL')
    downloads.push({ filename: this.download, blob })
  })
})
afterEach(() => {
  cleanupRender(rendered); rendered = null; vi.runOnlyPendingTimers(); vi.useRealTimers()
  vi.restoreAllMocks(); vi.unstubAllGlobals(); setEditorLocale('en')
})
function setup() {
  rendered = renderForTest(createElement(StlCalibrationDownload))
  const buttons = rendered.container.querySelectorAll('button')
  return { gauge: buttons[0], checklist: buttons[1], container: rendered.container }
}

it('downloads the independent checklist when background generation is unavailable', async () => {
  vi.stubGlobal('Worker', undefined); setEditorLocale('ja')
  const { gauge, checklist, container } = setup()
  click(checklist)
  expect(downloads[0].filename).toBe('leathercad-printer-fit-checklist.txt')
  expect(await downloads[0].blob.text()).toBe(PRINTER_FIT_CALIBRATION_CHECKLIST)
  expect(FakeWorker.instances).toHaveLength(0)
  click(gauge)
  expect(container.querySelector('[role=alert]')?.textContent).toContain('バックグラウンド')
  expect(checklist.disabled).toBe(false)
})

it('downloads and caches one successful worker packet without regenerating it', async () => {
  const { gauge, checklist, container } = setup()
  click(gauge)
  const worker = FakeWorker.instances[0]
  expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({})
  expect(gauge.disabled).toBe(true)
  expect(checklist.disabled).toBe(false)
  expect(container.querySelector('[role=status]')?.textContent).toBe('Preparing fit gauge…')
  act(() => worker.send({ calibration: packet }))
  expect(worker.terminated).toBe(true)
  expect(downloads[0].filename).toBe('leathercad-printer-fit-gauge.stl')
  expect(await downloads[0].blob.text()).toBe(packet.content)
  click(gauge)
  expect(FakeWorker.instances).toHaveLength(1)
  expect(downloads).toHaveLength(2)
  act(() => { vi.advanceTimersByTime(31_000) })
  expect(container.querySelector('[role=alert]')).toBeNull()
  expect(revoke).toHaveBeenCalledTimes(2)
})

it('catches constructor and post failures, terminates partial work and keeps the checklist available', () => {
  vi.stubGlobal('Worker', class { constructor() { throw new DOMException('Blocked', 'SecurityError') } })
  const { gauge, checklist, container } = setup()
  click(gauge)
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Could not start fit calibration')
  class PostFailure extends FakeWorker { postMessage = vi.fn(() => { throw new DOMException('Clone failed', 'DataCloneError') }) }
  vi.stubGlobal('Worker', PostFailure)
  click(gauge)
  expect(FakeWorker.instances[0].terminated).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
  click(checklist)
  expect(downloads[0].filename).toBe('leathercad-printer-fit-checklist.txt')
})

it('bounds generation and ignores late responses after timeout or modal unmount', () => {
  const { gauge, container } = setup()
  click(gauge)
  const first = FakeWorker.instances[0]
  act(() => { vi.advanceTimersByTime(30_000) })
  expect(first.terminated).toBe(true)
  expect(container.querySelector('[role=alert]')?.textContent).toContain('exceeded 30 seconds')
  act(() => first.send({ calibration: packet }))
  expect(downloads).toHaveLength(0)
  click(gauge)
  const second = FakeWorker.instances[1]
  cleanupRender(rendered); rendered = null
  expect(second.terminated).toBe(true)
  act(() => second.send({ calibration: packet }))
  expect(downloads).toHaveLength(0)
  expect(vi.getTimerCount()).toBe(0)
})

it('rejects a malformed response and permits a fresh successful request', () => {
  const { gauge, container } = setup()
  click(gauge)
  act(() => FakeWorker.instances[0].send({ calibration: { ...packet, content: '' } }))
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Could not prepare the fit gauge')
  expect(downloads).toHaveLength(0)
  click(gauge)
  act(() => FakeWorker.instances[1].send({ calibration: packet }))
  expect(downloads).toHaveLength(1)
  expect(container.querySelector('[role=alert]')).toBeNull()
})
