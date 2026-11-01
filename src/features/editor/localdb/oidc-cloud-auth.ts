import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'
import type { EditorCloudAuth, EditorCloudUser } from './editor-cloud-connection'

export const OIDC_CALLBACK_PARAM = 'lcad-oidc'
export type OidcBrowser = {
  getUrl(): string
  replaceUrl(url: string): void
  protocolStorage: Storage
}
export type OidcCloudAuthOptions = {
  authority: string
  clientId: string
  basePath?: string
  browser?: OidcBrowser
  /** Captured before startup scrubs protocol parameters from the browser URL. */
  initialCallbackUrl?: string
  /** The editor supplies this after SDK initialization, immediately before navigation. */
  beforeRedirect?: () => Promise<void>
}
export type OidcCloudAuth = EditorCloudAuth & { initialize(): Promise<void>; dispose(): void }

function normalizeAuthority(value: string): string {
  const authority = new URL(value)
  const local = authority.hostname === 'localhost' || authority.hostname === '127.0.0.1'
  if (authority.protocol !== 'https:' && !(local && authority.protocol === 'http:')) throw new Error('OIDC authority requires HTTPS')
  if (authority.username || authority.password || authority.search || authority.hash) throw new Error('OIDC authority must not contain credentials, query parameters or fragments')
  return authority.href.replace(/\/$/, '')
}
function defaultBrowser(): OidcBrowser {
  return {
    getUrl: () => window.location.href,
    replaceUrl: (url) => {
      window.history.replaceState(null, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    },
    protocolStorage: window.sessionStorage,
  }
}
function isUsable(user: User | null): user is User {
  return Boolean(user?.id_token && user.profile.sub && !user.expired && typeof user.profile.exp === 'number' && user.profile.exp * 1000 > Date.now())
}

/** Authorization Code + PKCE handled by oidc-client-ts; authenticated users and
 * all tokens are stored in memory, never in local/session storage. */
export function createOidcCloudAuth(options: OidcCloudAuthOptions): OidcCloudAuth {
  const browser = options.browser ?? defaultBrowser()
  const current = new URL(browser.getUrl())
  const base = new URL(options.basePath ?? '/', current.origin)
  if (base.origin !== current.origin || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) throw new Error('OIDC editor base must be a same-origin directory URL')
  if (!options.clientId.trim()) throw new Error('OIDC client ID is required')
  const callback = new URL(base)
  callback.searchParams.set(OIDC_CALLBACK_PARAM, 'callback')
  const manager = new UserManager({
    authority: normalizeAuthority(options.authority), client_id: options.clientId.trim(),
    redirect_uri: callback.href, response_type: 'code', response_mode: 'query', scope: 'openid profile email',
    disablePKCE: false, loadUserInfo: false, automaticSilentRenew: false, monitorSession: false,
    // Only one-use SDK protocol state / PKCE verifier survives the redirect.
    stateStore: new WebStorageStateStore({ store: browser.protocolStorage, prefix: 'leathercad.oidc.request.' }),
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage(), prefix: 'leathercad.oidc.user.' }),
    staleStateAgeInSeconds: 900, requestTimeoutInSeconds: 15, fetchRequestCredentials: 'omit',
  })
  let user: User | null = null
  let disposed = false
  let initialization: Promise<void> | undefined
  let expiresTimer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const setUser = (next: User | null) => {
    if (disposed) return
    if (expiresTimer) clearTimeout(expiresTimer)
    expiresTimer = undefined
    user = isUsable(next) ? next : null
    if (user) {
      const captured = user
      const delay = Math.min((user.profile.exp ?? 0) * 1000 - Date.now(), 2_147_483_647)
      expiresTimer = setTimeout(() => {
        if (user === captured) {
          setUser(null)
          void manager.removeUser().catch(() => undefined)
        }
      }, delay)
    }
    listeners.forEach((listener) => listener())
  }
  const removeLoaded = manager.events.addUserLoaded((next) => setUser(next))
  const removeUnloaded = manager.events.addUserUnloaded(() => setUser(null))
  const removeExpired = manager.events.addAccessTokenExpired(() => setUser(null))
  const safeReturnTo = (value: unknown) => {
    if (typeof value !== 'string' || Array.from(value).some((character) => character.charCodeAt(0) < 32)) return base.pathname
    try {
      const url = new URL(value, current.origin)
      if (url.origin !== current.origin || !url.pathname.startsWith(base.pathname) || url.searchParams.has(OIDC_CALLBACK_PARAM)) return base.pathname
      return url.pathname + url.search + url.hash
    } catch { return base.pathname }
  }
  const provider: OidcCloudAuth = {
    getUser(): EditorCloudUser | null {
      if (!isUsable(user)) return null
      const displayName = user.profile.name ?? user.profile.preferred_username ?? user.profile.email ?? 'Signed-in member'
      // Issuer + subject is stable across names and unique across authorities.
      return { id: `${user.profile.iss}|${user.profile.sub}`, displayName }
    },
    async getToken() {
      await provider.initialize().catch(() => undefined)
      if (!isUsable(user)) { setUser(null); return null }
      // Convex validates this OIDC identity token's issuer/audience/signature.
      // An OAuth access token is not substituted for application identity.
      return user.id_token ?? null
    },
    async signIn() {
      if (disposed) throw new Error('Sign-in provider is no longer available')
      await provider.initialize().catch(() => undefined)
      if (disposed) throw new Error('Sign-in provider is no longer available')
      const url = new URL(browser.getUrl())
      const returnTo = safeReturnTo(url.pathname + url.search + url.hash)
      // Keep storage errors actionable and prevent navigation if the newest
      // document cannot be preserved. Do not fold them into generic SDK errors.
      await options.beforeRedirect?.()
      try {
        await manager.clearStaleState()
        await manager.signinRedirect({ state: { returnTo } })
      } catch { throw new Error('Could not start sign-in. Please try again.') }
    },
    async signOut() {
      await provider.initialize().catch(() => undefined)
      // Local application logout: clear memory immediately, even if a provider
      // has no federated end-session endpoint. Its SSO cookie is not our token.
      setUser(null)
      await manager.removeUser()
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    initialize() {
      initialization ??= restoreSession()
      return initialization
    },
    dispose() {
      disposed = true
      if (expiresTimer) clearTimeout(expiresTimer)
      removeLoaded(); removeUnloaded(); removeExpired(); listeners.clear(); user = null
      void manager.removeUser().catch(() => undefined)
    },
  }
  async function restoreSession() {
      const url = new URL(options.initialCallbackUrl ?? browser.getUrl())
      if (url.searchParams.get(OIDC_CALLBACK_PARAM) !== 'callback') {
        setUser(await manager.getUser())
        return
      }
      let returnTo = base.pathname
      browser.replaceUrl(returnTo)
      try {
        if (url.origin !== current.origin || url.pathname !== base.pathname) throw new Error('Invalid callback route')
        const authenticated = await manager.signinRedirectCallback(url.href)
        if (!isUsable(authenticated)) throw new Error('No usable identity token')
        const state = authenticated.state
        if (state && typeof state === 'object' && 'returnTo' in state) returnTo = safeReturnTo(state.returnTo)
        setUser(authenticated)
      } catch {
        setUser(null)
        await manager.removeUser().catch(() => undefined)
        // Provider error descriptions can contain URLs or sensitive values.
        throw new Error('Sign-in could not complete. Open Cloud & Community to try again.')
      } finally {
        // Restore the clean editor route after processing the one-use callback.
        browser.replaceUrl(returnTo)
      }
  }
  return provider
}
