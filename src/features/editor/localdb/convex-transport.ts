export type ConvexTransport = {
  assertSession?(): void
  uploadAsset?(url: string, assetId: string, blob: Blob, onProgress?: (percent: number) => void): Promise<void>
  query<T>(path: string, args: Record<string, unknown>): Promise<T>
  mutation<T>(path: string, args: Record<string, unknown>): Promise<T>
}
export type ConvexConnectionOptions = {
  url: string
  httpUrl?: string
  getAuthToken?: () => Promise<string | null>
  assertSession?: () => void
  fetch?: typeof fetch
}
export function normalizeConvexUrl(value: string): string {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Cloud deployment URL is not valid') }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Cloud deployments require HTTPS')
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Cloud deployment URL must be an origin without credentials or a path')
  }
  return url.origin
}
export function createConvexTransport(options: ConvexConnectionOptions): ConvexTransport {
  const origin = normalizeConvexUrl(options.url)
  const fetcher = options.fetch ?? globalThis.fetch
  const call = async <T>(kind: 'query' | 'mutation', path: string, args: Record<string, unknown>): Promise<T> => {
    options.assertSession?.()
    const token = await options.getAuthToken?.()
    options.assertSession?.()
    const response = await fetcher(`${origin}/api/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ path, args, format: 'json' }),
      signal: AbortSignal.timeout(30_000), credentials: 'omit',
    })
    options.assertSession?.()
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'Sign in to access your cloud library' : `Cloud request failed (${response.status})`)
    let result: unknown
    try { result = await response.json() } catch { throw new Error('Cloud returned an invalid response') }
    options.assertSession?.()
    if (!result || typeof result !== 'object' || !('status' in result)) throw new Error('Cloud returned an invalid response')
    if (result.status !== 'success') {
      throw new Error('errorMessage' in result && typeof result.errorMessage === 'string'
        ? result.errorMessage.slice(0, 300) : 'Cloud operation did not complete')
    }
    if (!('value' in result)) throw new Error('Cloud returned an invalid response')
    return result.value as T
  }
  const uploadAsset: NonNullable<ConvexTransport['uploadAsset']> = async (value, assetId, blob, onProgress) => {
    const target = new URL(value)
    const configuredHttpUrl = options.httpUrl ?? (import.meta.env.VITE_CONVEX_HTTP_URL as string | undefined)
    const expected = configuredHttpUrl ? normalizeConvexUrl(configuredHttpUrl) : new URL(origin).hostname.endsWith('.convex.cloud') ? origin.replace(/\.convex\.cloud$/, '.convex.site') : ''
    if (!expected || target.origin !== expected || target.pathname !== '/cloud-assets/upload' || target.username || target.password || target.search || target.hash) throw new Error('Cloud upload origin does not match the configured deployment')
    options.assertSession?.()
    const token = await options.getAuthToken?.()
    options.assertSession?.()
    if (!token) throw new Error('Sign in to upload cloud assets')
    onProgress?.(0)
    if (typeof XMLHttpRequest !== 'undefined' && !options.fetch) await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('POST', target.href); request.timeout = 60_000
      request.setRequestHeader('Authorization', `Bearer ${token}`)
      request.setRequestHeader('Content-Type', blob.type)
      request.setRequestHeader('X-LeatherCad-Asset', assetId)
      request.upload.onprogress = event => {
        try { options.assertSession?.(); if (event.lengthComputable) onProgress?.(Math.min(99, Math.round(event.loaded / event.total * 100))) }
        catch (error) { request.abort(); reject(error instanceof Error ? error : new Error('Cloud upload session changed')) }
      }
      request.onerror = () => reject(new Error('Cloud asset upload failed'))
      request.onabort = () => reject(new Error('Cloud asset upload was cancelled'))
      request.ontimeout = () => reject(new Error('Cloud asset upload timed out; retry the upload'))
      request.onload = () => { try { options.assertSession?.(); if (request.status < 200 || request.status >= 300) throw new Error('Cloud asset upload failed; check its size and content, then retry'); resolve() } catch (error) { reject(error instanceof Error ? error : new Error('Cloud asset upload failed')) } }
      request.send(blob)
    })
    else {
      const response = await fetcher(target.href, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type, 'X-LeatherCad-Asset': assetId }, body: blob, credentials: 'omit', signal: AbortSignal.timeout(60_000) })
      options.assertSession?.()
      if (!response.ok) throw new Error('Cloud asset upload failed; check its size and content, then retry')
    }
    options.assertSession?.(); onProgress?.(100)
  }
  return { assertSession: options.assertSession, uploadAsset, query: (path, args) => call('query', path, args), mutation: (path, args) => call('mutation', path, args) }
}
