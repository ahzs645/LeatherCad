import { describe, expect, it } from 'vitest'
import { dataUrlToUint8Array } from './tracing-asset-ops'

describe('tracing asset persistence helpers', () => {
  it('decodes base64 data URLs into bytes', () => {
    const bytes = dataUrlToUint8Array('data:application/pdf;base64,JVBERi0xLjQ=')

    expect(Array.from(bytes)).toEqual([37, 80, 68, 70, 45, 49, 46, 52])
  })

  it('rejects non-data URLs', () => {
    expect(() => dataUrlToUint8Array('blob:http://localhost/example')).toThrow('Expected a data URL')
  })
})
