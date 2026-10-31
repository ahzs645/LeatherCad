import type { ConvexTransport } from './convex-transport'

const prefix = 'lcad-asset:'
const assetKeys = new Set(['sourceUrl', 'pdfSourceUrl', 'bitmapDataUrl', 'imageDataUrl', 'albedoUrl', 'normalUrl', 'roughnessUrl', 'dataUrl'])
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'font/ttf', 'font/otf'])
const maximumBytes = 8 * 1024 * 1024
function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(binary)
}
async function digest(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)), byte => byte.toString(16).padStart(2, '0')).join('')
}
async function mapStrings(value: unknown, visitor: (text: string, key: string) => Promise<string>, depth = 0, key = ''): Promise<unknown> {
  if (depth > 80) throw new Error('Drawing structure is too deep')
  if (typeof value === 'string') return visitor(value, key)
  if (Array.isArray(value)) {
    const result = []
    for (const item of value) result.push(await mapStrings(item, visitor, depth + 1, key))
    return result
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [name, item] of Object.entries(value)) Object.defineProperty(result, name, { value: await mapStrings(item, visitor, depth + 1, name), enumerable: true })
    return result
  }
  return value
}
export async function uploadCloudAsset(blob: Blob, name: string, transport: ConvexTransport, onProgress?: (percent: number) => void): Promise<string> {
  if (!allowedTypes.has(blob.type) || blob.size < 1 || blob.size > maximumBytes || (blob.type.startsWith('font/') && blob.size > 4 * 1024 * 1024)) throw new Error('Unsupported cloud asset type or size')
  transport.assertSession?.()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const reservation = await transport.mutation<{ id: string; uploadUrl: string | null }>('cloudAssets:beginUpload', { name: name.slice(0, 200) || 'Asset', contentType: blob.type, size: bytes.length, sha256: await digest(bytes) })
  if (!reservation || typeof reservation.id !== 'string' || (reservation.uploadUrl !== null && typeof reservation.uploadUrl !== 'string')) throw new Error('Cloud returned an invalid upload reservation')
  if (reservation.uploadUrl) {
    try {
      if (!transport.uploadAsset) throw new Error('This cloud connection does not support asset uploads')
      await transport.uploadAsset(reservation.uploadUrl, reservation.id, blob, onProgress)
    } catch (error) {
      await transport.mutation('cloudAssets:remove', { id: reservation.id }).catch(() => undefined)
      throw error
    }
  }
  transport.assertSession?.(); onProgress?.(100)
  return reservation.id
}
export async function serializeCloudDocument(doc: unknown, transport: ConvexTransport): Promise<string> {
  const cache = new Map<string, string>()
  let count = 0, totalBytes = 0
  const prepared = await mapStrings(doc, async (text, key) => {
    if (!assetKeys.has(key) || !text.startsWith('data:') || text.length < 32 * 1024) return text
    if (cache.has(text)) return cache.get(text)!
    if (text.length > Math.ceil(maximumBytes * 4 / 3) + 256) throw new Error('Cloud assets exceed the 8 MiB file limit')
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(text)
    if (!match || !allowedTypes.has(match[1])) throw new Error('Large cloud assets must use PNG, JPEG, WebP, GIF, PDF, TTF or OTF data URLs')
    if (++count > 64) throw new Error('A cloud drawing can contain at most 64 assets')
    const binary = atob(match[2].replace(/\s/g, ''))
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    totalBytes += bytes.length
    if (match[1].startsWith('font/') && bytes.length > 4 * 1024 * 1024) throw new Error('Manufacturing fonts are limited to 4 MiB')
    if (bytes.length > maximumBytes || totalBytes > 64 * 1024 * 1024) throw new Error('Cloud assets exceed the 8 MiB file or 64 MiB drawing limit')
    const id = await uploadCloudAsset(new Blob([bytes], { type: match[1] }), key, transport)
    const reference = prefix + id
    cache.set(text, reference)
    return reference
  })
  transport.assertSession?.()
  return JSON.stringify(prepared)
}
export async function hydrateCloudDocument(docJson: string, transport: ConvexTransport, publication?: { id: string; version: number }): Promise<string> {
  const cache = new Map<string, string>()
  let count = 0, totalBytes = 0
  const hydrated = await mapStrings(JSON.parse(docJson), async text => {
    if (!text.startsWith(prefix)) return text
    if (cache.has(text)) return cache.get(text)!
    if (++count > 64) throw new Error('Cloud drawing contains too many assets')
    const asset = await transport.query<{ url: string; size: number; contentType: string; sha256: string } | null>('cloudAssets:resolve', { id: text.slice(prefix.length), patternId: publication?.id ?? null, version: publication?.version ?? null })
    if (!asset || !allowedTypes.has(asset.contentType) || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > maximumBytes) throw new Error('A cloud drawing asset is unavailable')
    totalBytes += asset.size
    if (totalBytes > 64 * 1024 * 1024) throw new Error('Cloud drawing assets exceed the download limit')
    transport.assertSession?.()
    const response = await fetch(asset.url, { credentials: 'omit', signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error('Cloud asset download failed')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Cloud returned an empty asset')
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      for (;;) {
        const next = await reader.read()
        transport.assertSession?.()
        if (next.done) break
        length += next.value.length
        if (length > asset.size) throw new Error('Cloud asset exceeds its declared size')
        chunks.push(next.value)
      }
    } catch (error) { await reader.cancel().catch(() => undefined); throw error }
    if (length !== asset.size) throw new Error('Cloud asset size does not match')
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    if (await digest(bytes) !== asset.sha256) throw new Error('Cloud asset integrity check failed')
    transport.assertSession?.()
    const dataUrl = `data:${asset.contentType};base64,${base64(bytes)}`
    cache.set(text, dataUrl)
    return dataUrl
  })
  transport.assertSession?.()
  return JSON.stringify(hydrated)
}
