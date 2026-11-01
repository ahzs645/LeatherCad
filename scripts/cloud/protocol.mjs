export class CloudCheckError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status }
}
export function cloudProtocol(origin, token, fetcher = fetch) {
  return async (kind, functionPath, args) => {
    let response, result
    try {
      response = await fetcher(`${origin}/api/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: functionPath, args, format: 'json' }), credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000) })
      result = await response.json()
    } catch { throw new CloudCheckError('network-or-invalid-json') }
    if (!response.ok || result?.status !== 'success' || !('value' in result)) {
      const authorization = [401, 403].includes(response.status) || (response.ok && typeof result?.errorMessage === 'string' && /sign in|unauthenticated|unauthorized|not authenticated/i.test(result.errorMessage))
      const conflict = response.ok && typeof result?.errorMessage === 'string' && /cloud drawing changed|drawing changed; refresh|pattern(?: visibility)? changed|pattern has a newer version|this (?:topic|reply) changed/i.test(result.errorMessage)
      const migration = typeof result?.errorMessage === 'string' && /index older cloud/i.test(result.errorMessage)
      throw new CloudCheckError(authorization ? 'authorization-denied' : conflict ? 'revision-conflict' : migration ? 'legacy-index-required' : 'cloud-function-failed', response.status)
    }
    return result.value
  }
}
export function assertCheck(condition, name) { if (!condition) throw new CloudCheckError(name) }
export async function expectFailure(operation, code) {
  try { await operation() } catch (error) { if (error instanceof CloudCheckError && error.code === code) return; throw error }
  throw new CloudCheckError(`expected-${code}`)
}
export async function inspectRemote(configuration, { fetcher = fetch } = {}) {
  const checks = [], values = configuration.values
  const run = async (name, operation) => { try { await operation(); checks.push({ name, status: 'pass' }) } catch (error) { checks.push({ name, status: 'fail', reason: error instanceof CloudCheckError ? error.code : 'remote-check-failed' }) } }
  if (values.authority) await run('oidc-discovery', async () => {
    let metadata
    try { const response = await fetcher(`${values.authority.replace(/\/+$/, '')}/.well-known/openid-configuration`, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) }); assertCheck(response.ok, 'oidc-discovery-http-failed'); metadata = await response.json() } catch (error) { if (error instanceof CloudCheckError) throw error; throw new CloudCheckError('oidc-discovery-unavailable') }
    assertCheck(typeof metadata.issuer === 'string' && metadata.issuer.replace(/\/+$/, '') === values.authority.replace(/\/+$/, ''), 'oidc-issuer-mismatch')
    if (values.declaredIssuer) assertCheck(metadata.issuer === values.declaredIssuer, 'oidc-exact-backend-issuer-mismatch')
    for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) assertCheck(typeof metadata[key] === 'string' && /^https:\/\//.test(metadata[key]) || typeof metadata[key] === 'string' && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(metadata[key]), `oidc-${key}-unavailable`)
    assertCheck(Array.isArray(metadata.response_types_supported) && metadata.response_types_supported.includes('code'), 'oidc-code-flow-unavailable')
    if (metadata.code_challenge_methods_supported) assertCheck(metadata.code_challenge_methods_supported.includes('S256'), 'oidc-pkce-s256-unavailable')
  })
  if (values.api) {
    const anonymous = cloudProtocol(values.api, null, fetcher)
    for (const [name, path] of [['anonymous-public-patterns', 'community:listPublic'], ['anonymous-public-topics', 'communityBoard:listPublicTopics']]) await run(name, async () => { const page = await anonymous('query', path, { cursor: null }); assertCheck(Array.isArray(page?.page) && typeof page.isDone === 'boolean', 'invalid-public-page') })
    await run('anonymous-private-library-denied', () => expectFailure(() => anonymous('query', 'cloudLifecycle:list', { cursor: null, trash: false }), 'authorization-denied'))
  }
  if (values.http) await run('upload-route-cors', async () => {
    const response = await fetcher(`${values.http}/cloud-assets/upload`, { method: 'OPTIONS', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) })
    assertCheck(response.status === 204 && /authorization/i.test(response.headers.get('access-control-allow-headers') ?? ''), 'upload-cors-unavailable')
  })
  return checks
}
