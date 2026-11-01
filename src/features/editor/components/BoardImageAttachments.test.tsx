import { act, createElement, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { BoardImageUploader } from './BoardImageAttachments'

const upload = vi.hoisted(() => vi.fn())
vi.mock('../localdb/cloud-asset-client', () => ({ uploadCloudAsset: upload }))
vi.mock('../localdb/editor-cloud-connection', () => ({ getEditorCloudTransport: () => ({ query: async () => null }) }))
let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null; upload.mockReset() })
function choose(file: File) {
  const input = rendered!.container.querySelector('input[type="file"]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  act(() => { input.dispatchEvent(new Event('change', { bubbles: true })) })
}
describe('discussion image upload controls', () => {
  it('shows upload progress, preserves a failed file for retry, and appends the successful attachment once', async () => {
    let progress: ((percent: number) => void) | undefined, reject: (error: Error) => void = () => undefined, resolve: (id: string) => void = () => undefined
    upload.mockImplementationOnce((_blob: Blob, _name: string, _transport: unknown, onProgress?: (percent: number) => void) => {
      progress = onProgress
      return new Promise<string>((_resolve, fail) => { reject = fail })
    }).mockImplementationOnce(() => new Promise<string>(done => { resolve = done }))
    const onChange = vi.fn(), onBusy = vi.fn()
    function Harness() {
      const [ids, setIds] = useState<string[]>([])
      return createElement(BoardImageUploader, { ids, onBusyChange: onBusy, onChange: next => { setIds(next); onChange(next) } })
    }
    rendered = renderForTest(createElement(Harness))
    choose(new File(['png bytes'], 'pattern.png', { type: 'image/png' }))
    act(() => progress?.(42))
    expect(rendered.container.querySelector('progress')?.value).toBe(42)
    await act(async () => { reject(new Error('Network interrupted')); await Promise.resolve() })
    expect(rendered.container.textContent).toContain('Network interrupted')
    expect(onChange).not.toHaveBeenCalled()
    click([...rendered.container.querySelectorAll('button')].find(button => button.textContent === 'Retry image upload') ?? null)
    await act(async () => { resolve('ready-asset'); await Promise.resolve() })
    expect(upload).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith(['ready-asset'])
    expect(rendered.container.querySelector('progress')).toBeNull()
    expect(onBusy).toHaveBeenLastCalledWith(false)
  })
  it('rejects oversized or unsupported files before network upload', () => {
    rendered = renderForTest(createElement(BoardImageUploader, { ids: [], onChange: () => undefined, onBusyChange: () => undefined }))
    choose(new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' }))
    expect(upload).not.toHaveBeenCalled()
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('supported images')
  })
})
