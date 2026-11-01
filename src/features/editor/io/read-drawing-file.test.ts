import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readDrawingFileText } from './read-drawing-file'

describe('readDrawingFileText', () => {
  it('reads plain drawings as text', async () => {
    await expect(readDrawingFileText(new Blob(['{"version":2}']))).resolves.toBe('{"version":2}')
  })

  it('decompresses gzip drawings recognised by their magic bytes', async () => {
    const text = JSON.stringify({ version: 2, name: '名前', shapes: [] })
    const blob = new Blob([new Uint8Array(gzipSync(Buffer.from(text, 'utf8')))])
    await expect(readDrawingFileText(blob)).resolves.toBe(text)
  })
})
