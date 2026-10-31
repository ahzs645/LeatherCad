export type ConvexTransport = {
  query<T>(path: string, args: Record<string, unknown>): Promise<T>
  mutation<T>(path: string, args: Record<string, unknown>): Promise<T>
}
export type ConvexConnectionOptions = {
  url: string
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
  return { query: (path, args) => call('query', path, args), mutation: (path, args) => call('mutation', path, args) }
}
