import { MAX_IMPORT_FILE_BYTES } from './import-budget'

const isGzip = (bytes: Uint8Array) => bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b

/**
 * Text of a drawing file. The reference editor stores cloud and shared copies
 * of `.lcad` drawings gzip-compressed; those are recognised by their magic
 * bytes and decompressed, with the same 50 MB budget applied to the output.
 */
export async function readDrawingFileText(file: Blob): Promise<string> {
  if (typeof file.slice !== 'function' || typeof file.stream !== 'function') return file.text()
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  if (!isGzip(head)) return file.text()
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open gzip-compressed drawings')
  const reader = file.stream().pipeThrough(new DecompressionStream('gzip')).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_IMPORT_FILE_BYTES) {
      await reader.cancel()
      throw new Error('Import exceeds the 50 MB file limit once decompressed')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}
