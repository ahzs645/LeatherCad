import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseEnv } from 'node:util'

export const CONFIG_KEYS = ['VITE_CONVEX_URL', 'VITE_CONVEX_HTTP_URL', 'CONVEX_DEPLOYMENT', 'CONVEX_SITE_URL', 'VITE_OIDC_AUTHORITY', 'VITE_OIDC_CLIENT_ID', 'AUTH_JWT_ISSUER', 'AUTH_JWT_AUDIENCE', 'VITE_BASE_PATH', 'LEATHERCAD_CLOUD_EDITOR_URL']
export function loadCloudEnvironment({ directory = process.cwd(), environment = process.env, mode = 'development', files } = {}) {
  if (!['development', 'production', 'test'].includes(mode)) throw new Error('Choose development, production or test mode')
  const candidates = files ?? ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]
  const loaded = {}, sources = []
  for (const name of candidates) {
    const file = path.resolve(directory, name)
    if (!fs.existsSync(file)) { if (files) throw new Error('An explicitly selected environment file does not exist'); continue }
    Object.assign(loaded, parseEnv(fs.readFileSync(file, 'utf8')))
    sources.push(path.basename(file))
  }
  return { environment: { ...loaded, ...environment }, sources }
}
export function urlValue(value, name, { originOnly = false, directory = false } = {}) {
  let result
  try { result = new URL(value) } catch { throw new Error(`${name} must be a configured absolute URL`) }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(result.hostname)
  if ((result.protocol !== 'https:' && !(local && result.protocol === 'http:')) || result.username || result.password || result.search || result.hash || (originOnly && result.pathname !== '/') || (directory && !result.pathname.endsWith('/'))) throw new Error(`${name} must use HTTPS (or localhost HTTP) without credentials, query or fragment${directory ? ', and end in /' : ''}`)
  return result
}
export function inspectCloudConfiguration(environment, { credentialFilePresent = fs.existsSync(path.join(os.homedir(), '.convex', 'config.json')) } = {}) {
  const checks = [], values = {}, has = name => typeof environment[name] === 'string' && environment[name].trim().length > 0
  const check = (name, operation) => { try { const value = operation(); checks.push({ name, status: 'pass' }); return value } catch (error) { checks.push({ name, status: 'blocked', reason: error.message }); return undefined } }
  const required = name => { if (!has(name)) throw new Error(`Set ${name} from the existing deployment/client registration`); return environment[name].trim() }
  values.api = check('convex-api-origin', () => urlValue(required('VITE_CONVEX_URL'), 'VITE_CONVEX_URL', { originOnly: true }).origin)
  values.http = check('convex-http-origin', () => {
    if (has('VITE_CONVEX_HTTP_URL')) return urlValue(environment.VITE_CONVEX_HTTP_URL, 'VITE_CONVEX_HTTP_URL', { originOnly: true }).origin
    if (values.api && new URL(values.api).hostname.endsWith('.convex.cloud')) return values.api.replace(/\.convex\.cloud$/, '.convex.site')
    throw new Error('Set VITE_CONVEX_HTTP_URL for a custom-domain or local deployment')
  })
  values.authority = check('oidc-authority', () => { const raw = required('VITE_OIDC_AUTHORITY'); urlValue(raw, 'VITE_OIDC_AUTHORITY'); return raw })
  values.clientId = check('oidc-public-client', () => {
    const value = required('VITE_OIDC_CLIENT_ID')
    if (value.length > 1000 || /[\r\n]/.test(value)) throw new Error('VITE_OIDC_CLIENT_ID is not a valid public client ID')
    return value
  })
  values.editor = check('editor-callback', () => {
    const editor = urlValue(required('LEATHERCAD_CLOUD_EDITOR_URL'), 'LEATHERCAD_CLOUD_EDITOR_URL', { directory: true })
    const base = environment.VITE_BASE_PATH || '/'
    if (!base.startsWith('/') || !base.endsWith('/') || editor.pathname !== base) throw new Error('LEATHERCAD_CLOUD_EDITOR_URL path must match VITE_BASE_PATH (default /)')
    const callback = new URL(editor); callback.searchParams.set('lcad-oidc', 'callback')
    return { entry: editor.href, callback: callback.href }
  })
  values.declaredIssuer = has('AUTH_JWT_ISSUER') ? environment.AUTH_JWT_ISSUER : undefined
  if (has('AUTH_JWT_ISSUER')) check('declared-backend-issuer', () => {
    urlValue(environment.AUTH_JWT_ISSUER, 'AUTH_JWT_ISSUER')
    if (values.authority && environment.AUTH_JWT_ISSUER.replace(/\/+$/, '') !== values.authority.replace(/\/+$/, '')) throw new Error('AUTH_JWT_ISSUER and VITE_OIDC_AUTHORITY must describe the same issuer; discovery confirms its exact spelling')
  })
  else checks.push({ name: 'declared-backend-issuer', status: 'unverified', reason: 'Backend AUTH_JWT_ISSUER must be set on the selected deployment; local configuration cannot prove its remote value' })
  if (has('AUTH_JWT_AUDIENCE')) check('declared-backend-audience', () => { if (values.clientId && environment.AUTH_JWT_AUDIENCE !== values.clientId) throw new Error('Built-in sign-in requires AUTH_JWT_AUDIENCE to equal VITE_OIDC_CLIENT_ID') })
  else checks.push({ name: 'declared-backend-audience', status: 'unverified', reason: 'Backend AUTH_JWT_AUDIENCE must match the public SPA client ID; local configuration cannot prove its remote value' })
  if (has('CONVEX_SITE_URL')) check('declared-upload-origin', () => { if (values.http && urlValue(environment.CONVEX_SITE_URL, 'CONVEX_SITE_URL', { originOnly: true }).origin !== values.http) throw new Error('CONVEX_SITE_URL must match the trusted frontend HTTP-action origin') })
  values.deployment = check('explicit-existing-deployment', () => {
    const value = required('CONVEX_DEPLOYMENT')
    if (!/^(dev|prod|preview):[a-z0-9-]+$/.test(value)) throw new Error('Use the explicit existing dev:name, prod:name or preview:name deployment selector; no anonymous/new project is selected automatically')
    if (values.api && new URL(values.api).hostname.endsWith('.convex.cloud') && new URL(values.api).hostname !== `${value.split(':')[1]}.convex.cloud`) throw new Error('CONVEX_DEPLOYMENT name must match VITE_CONVEX_URL')
    return value
  })
  const cliAuth = has('CONVEX_DEPLOY_KEY') || has('CONVEX_ACCESS_TOKEN') || credentialFilePresent
  checks.push({ name: 'cli-authorization-present', status: cliAuth ? 'unverified' : 'blocked', reason: cliAuth ? 'Configured authorization still needs a successful CLI request; credential contents are never printed' : 'Provide deployment authorization through the configured secret store or an existing CLI session; no login is started' })
  const blocked = checks.filter(item => item.status === 'blocked')
  return { version: 1, status: blocked.length ? 'blocked' : 'configured-not-live-verified', checks, values, cliAuth,
    publicConfiguration: { apiOrigin: values.api ?? null, httpOrigin: values.http ?? null, callback: values.editor?.callback ?? null, deploymentConfigured: Boolean(values.deployment), clientIdConfigured: Boolean(values.clientId) },
    credentialPresence: { deployKey: has('CONVEX_DEPLOY_KEY'), accessToken: has('CONVEX_ACCESS_TOKEN'), existingCliSession: credentialFilePresent, tokenA: has('LEATHERCAD_CLOUD_SMOKE_TOKEN_A') || has('LEATHERCAD_CLOUD_SMOKE_TOKEN_A_FILE'), tokenB: has('LEATHERCAD_CLOUD_SMOKE_TOKEN_B') || has('LEATHERCAD_CLOUD_SMOKE_TOKEN_B_FILE') } }
}
export function publicReport(configuration) {
  const { values: _values, cliAuth: _cliAuth, ...report } = configuration
  return report
}
export function readSmokeToken(environment, label) {
  const key = `LEATHERCAD_CLOUD_SMOKE_TOKEN_${label}`
  const token = environment[key] || (environment[`${key}_FILE`] ? fs.readFileSync(environment[`${key}_FILE`], 'utf8').trim() : '')
  if (!token) return null
  if (token.length > 100000 || /[\r\n]/.test(token)) throw new Error(`Test account ${label} has an invalid token input`)
  return token
}
export function inspectTestIdentities(tokenA, tokenB, { issuer, clientId, now = Date.now() } = {}) {
  const decode = (token, label) => {
    try {
      const pieces = token.split('.')
      if (pieces.length !== 3) throw new Error()
      const payload = JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8'))
      if (typeof payload.iss !== 'string' || typeof payload.sub !== 'string' || !payload.sub || typeof payload.exp !== 'number' || payload.exp * 1000 < now + 120000) throw new Error()
      if (issuer && payload.iss.replace(/\/+$/, '') !== issuer.replace(/\/+$/, '')) throw new Error()
      if (clientId && !(Array.isArray(payload.aud) ? payload.aud.includes(clientId) : payload.aud === clientId)) throw new Error()
      return { issuer: payload.iss, subject: payload.sub }
    } catch { throw new Error(`Test account ${label} needs a current application ID token matching the configured issuer/client with at least two minutes remaining`) }
  }
  // This only guards test routing/account separation. Convex verifies signatures and authorization.
  const a = decode(tokenA, 'A'), b = decode(tokenB, 'B')
  if (a.issuer === b.issuer && a.subject === b.subject) throw new Error('Use two distinct test accounts; duplicate identities cannot prove isolation')
}
