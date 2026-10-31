import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-LeatherCad-Asset', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }
const respond = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
function matchesContentType(bytes: Uint8Array, contentType: string): boolean {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (contentType === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  if (contentType === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (contentType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(text(0, 6))
  if (contentType === 'image/webp') return text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP'
  if (contentType === 'application/pdf') return text(0, 5) === '%PDF-'
  if (contentType === 'font/otf') return text(0, 4) === 'OTTO'
  return contentType === 'font/ttf' && ((bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) || text(0, 4) === 'true')
}
const http = httpRouter()
http.route({ path: '/cloud-assets/upload', method: 'OPTIONS', handler: httpAction(async () => new Response(null, { status: 204, headers: cors })) })
http.route({ path: '/cloud-assets/upload', method: 'POST', handler: httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return respond(401, 'Sign in to upload cloud assets')
  const rawId = request.headers.get('X-LeatherCad-Asset')
  if (!rawId || rawId.length > 200) return respond(400, 'An upload reservation is required')
  const id = rawId as Id<'cloudAssets'>, owner = identity.tokenIdentifier
  let attempt: number | undefined, storageId: Id<'_storage'> | undefined
  try {
    const reservation = await ctx.runMutation(internal.cloudAssetUpload.claim, { id, owner })
    attempt = reservation.attempt
    if (reservation.storageId) return new Response(JSON.stringify({ id }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    if (request.headers.get('Content-Type') !== reservation.contentType) return respond(400, 'Upload type does not match its reservation')
    const declaredLength = request.headers.get('Content-Length')
    if (declaredLength && Number(declaredLength) !== reservation.size) return respond(413, 'Upload size does not match its reservation')
    const reader = request.body?.getReader()
    if (!reader) return respond(400, 'Upload body is required')
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        length += chunk.value.length
        if (length > reservation.size) throw new Error('Upload exceeds its reserved size')
        chunks.push(chunk.value)
      }
    } catch (error) { await reader.cancel().catch(() => undefined); throw error }
    if (length !== reservation.size) throw new Error('Upload size does not match its reservation')
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    if (!matchesContentType(bytes, reservation.contentType)) throw new Error('Upload file signature does not match its type')
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.buffer)), byte => byte.toString(16).padStart(2, '0')).join('')
    if (sha256 !== reservation.sha256) throw new Error('Upload digest does not match its reservation')
    storageId = await ctx.storage.store(new Blob([bytes], { type: reservation.contentType }))
    await ctx.runMutation(internal.cloudAssetUpload.finish, { id, owner, storageId, attempt })
    return new Response(JSON.stringify({ id }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch {
    if (storageId) {
      const current = await ctx.runQuery(internal.cloudAssetUpload.inspect, { id, owner }).catch(() => null)
      if (current?.storageId !== storageId) await ctx.storage.delete(storageId)
    }
    return respond(400, 'Upload failed: check its size, type and content, then retry')
  } finally {
    if (attempt !== undefined) await ctx.runMutation(internal.cloudAssetUpload.release, { id, owner, attempt }).catch(() => undefined)
  }
}) })
export default http
