import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User, UserManagerSettings } from 'oidc-client-ts'

const sdk = vi.hoisted(() => ({
  settings: [] as UserManagerSettings[], user: null as User | null, callbackUser: null as User | null,
  onLoaded: undefined as ((user: User) => void) | undefined,
  onUnloaded: undefined as (() => void) | undefined,
  onExpired: undefined as (() => void) | undefined,
  getUser: vi.fn<() => Promise<User | null>>(), removeUser: vi.fn<() => Promise<void>>(),
  signinRedirect: vi.fn<(args: unknown) => Promise<void>>(), callback: vi.fn<(url: string) => Promise<User>>(), clearStaleState: vi.fn<() => Promise<void>>(),
}))
vi.mock('oidc-client-ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('oidc-client-ts')>()
  return { ...original, UserManager: class {
    constructor(settings: UserManagerSettings) { sdk.settings.push(settings) }
    getUser = sdk.getUser
    removeUser = sdk.removeUser
    signinRedirect = sdk.signinRedirect
    signinRedirectCallback = sdk.callback
    clearStaleState = sdk.clearStaleState
    events = {
      addUserLoaded: (listener: (user: User) => void) => { sdk.onLoaded = listener; return () => { sdk.onLoaded = undefined } },
      addUserUnloaded: (listener: () => void) => { sdk.onUnloaded = listener; return () => { sdk.onUnloaded = undefined } },
      addAccessTokenExpired: (listener: () => void) => { sdk.onExpired = listener; return () => { sdk.onExpired = undefined } },
    }
  } }
})
import { InMemoryWebStorage, User as SdkUser } from 'oidc-client-ts'
import { createOidcCloudAuth, type OidcBrowser, type OidcCloudAuth } from './oidc-cloud-auth'

const providers: OidcCloudAuth[] = []
function authenticated(sub = 'member', returnTo: unknown = '/editor/workbench/split?view=fit#piece') {
  const now = Math.floor(Date.now() / 1000)
  return new SdkUser({ id_token: 'FAKE_IDENTITY_TOKEN', access_token: 'FAKE_ACCESS_TOKEN', token_type: 'Bearer', expires_at: now + 3600,
    profile: { sub, iss: 'https://issuer.test', aud: 'editor-client', exp: now + 3600, iat: now, name: 'Same display name' }, userState: { returnTo } })
}
function browser(initial = 'https://editor.test/editor/') {
  let url = new URL(initial)
  const replaceUrl = vi.fn((next: string) => { url = new URL(next, url.origin) })
  return { getUrl: () => url.href, replaceUrl, protocolStorage: new InMemoryWebStorage() } satisfies OidcBrowser
}
function create(runtime = browser()) {
  const provider = createOidcCloudAuth({ authority: 'https://issuer.test', clientId: 'editor-client', basePath: '/editor/', browser: runtime })
  providers.push(provider)
  return provider
}
beforeEach(() => {
  vi.clearAllMocks(); sdk.settings.length = 0; sdk.user = null; sdk.callbackUser = null
  sdk.getUser.mockImplementation(async () => sdk.user)
  sdk.removeUser.mockImplementation(async () => { sdk.user = null; sdk.onUnloaded?.() })
  sdk.signinRedirect.mockResolvedValue(undefined); sdk.clearStaleState.mockResolvedValue(undefined)
  sdk.callback.mockImplementation(async () => { if (!sdk.callbackUser) throw new Error('Invalid protocol state'); return sdk.callbackUser })
  localStorage.clear(); sessionStorage.clear()
})
afterEach(() => { providers.splice(0).forEach(provider => provider.dispose()); vi.useRealTimers() })

describe('OIDC cloud auth adapter', () => {
  it('uses SDK code+PKCE and keeps user/token storage out of browser storage', async () => {
    const runtime = browser(), provider = create(runtime)
    await provider.initialize()
    const settings = sdk.settings[0]
    expect(settings).toMatchObject({ response_type: 'code', response_mode: 'query', disablePKCE: false, automaticSilentRenew: false, scope: 'openid profile email', redirect_uri: 'https://editor.test/editor/?lcad-oidc=callback' })
    await settings.userStore!.set('user', 'FAKE_IDENTITY_TOKEN')
    await settings.stateStore!.set('request', 'one-use-pkce-verifier')
    expect(Array.from({ length: runtime.protocolStorage.length }, (_, index) => runtime.protocolStorage.getItem(runtime.protocolStorage.key(index)))).toEqual(['one-use-pkce-verifier'])
    expect(localStorage.length).toBe(0)
    const another = create(runtime)
    expect(await sdk.settings[1].userStore!.get('user')).toBeFalsy()
    await another.initialize()
  })

  it('initiates real SDK sign-in and preserves only a same-origin editor return route', async () => {
    const provider = create(browser('https://editor.test/editor/workbench/3d?mode=fit#part'))
    await provider.signIn()
    expect(sdk.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/editor/workbench/3d?mode=fit#part' } })
    expect(sdk.clearStaleState).toHaveBeenCalledOnce()
  })

  it('completes the SDK callback, scrubs protocol parameters, and returns the identity token', async () => {
    const runtime = browser('https://editor.test/editor/?lcad-oidc=callback&code=FAKE_CODE&state=request')
    sdk.callbackUser = authenticated()
    const provider = create(runtime)
    const notify = vi.fn(); provider.subscribe?.(notify)
    await provider.initialize()
    expect(sdk.callback).toHaveBeenCalledWith(expect.stringContaining('code=FAKE_CODE'))
    expect(runtime.getUrl()).toBe('https://editor.test/editor/workbench/split?view=fit#piece')
    expect(provider.getUser()).toEqual({ id: 'https://issuer.test|member', displayName: 'Same display name' })
    expect(await provider.getToken()).toBe('FAKE_IDENTITY_TOKEN')
    expect(notify).toHaveBeenCalled()
    expect(runtime.protocolStorage.length).toBe(0)
  })

  it('does not follow an external callback return target', async () => {
    const runtime = browser('https://editor.test/editor/?lcad-oidc=callback&code=fake&state=request')
    sdk.callbackUser = authenticated('member', '//evil.test/steal')
    await create(runtime).initialize()
    expect(runtime.getUrl()).toBe('https://editor.test/editor/')
  })

  it('reports callback failure generically and clears the token-bearing URL immediately', async () => {
    const runtime = browser('https://editor.test/editor/?lcad-oidc=callback&code=PRIVATE_CODE&state=PRIVATE_STATE')
    sdk.callback.mockRejectedValue(new Error('https://issuer.test/token?secret=PRIVATE_CODE'))
    const provider = create(runtime)
    const initialization = provider.initialize()
    expect(runtime.getUrl()).toBe('https://editor.test/editor/')
    await expect(initialization).rejects.toThrow('Sign-in could not complete.')
    expect(provider.getUser()).toBeNull()
    expect(await provider.getToken()).toBeNull()
    expect(runtime.getUrl()).not.toContain('PRIVATE')
    // A failed callback does not prevent an explicit new sign-in attempt.
    await provider.signIn()
    expect(sdk.signinRedirect).toHaveBeenCalledOnce()
  })

  it('serializes concurrent token/sign-in calls behind callback initialization', async () => {
    const runtime = browser('https://editor.test/editor/?lcad-oidc=callback&code=fake&state=request')
    let complete!: (user: User) => void
    sdk.callback.mockImplementation(() => new Promise<User>((resolve) => { complete = resolve }))
    const provider = create(runtime)
    const initialization = provider.initialize(), token = provider.getToken(), signIn = provider.signIn()
    expect(sdk.signinRedirect).not.toHaveBeenCalled()
    complete(authenticated())
    await initialization
    expect(await token).toBe('FAKE_IDENTITY_TOKEN')
    await signIn
    expect(sdk.callback).toHaveBeenCalledOnce()
    expect(sdk.signinRedirect).toHaveBeenCalledOnce()
  })

  it('updates stable identity on account changes and clears user memory on local sign-out', async () => {
    const provider = create(); await provider.initialize()
    sdk.onLoaded?.(authenticated('first'))
    expect(provider.getUser()?.id).toBe('https://issuer.test|first')
    sdk.onLoaded?.(authenticated('second'))
    expect(provider.getUser()?.id).toBe('https://issuer.test|second')
    await provider.signOut()
    expect(provider.getUser()).toBeNull()
    expect(await provider.getToken()).toBeNull()
    expect(sdk.removeUser).toHaveBeenCalled()
  })

  it('expires identity tokens and notifies subscribed cloud state', async () => {
    vi.useFakeTimers()
    const provider = create(); await provider.initialize()
    const user = authenticated(); user.profile.exp = Math.floor(Date.now() / 1000) + 2
    sdk.onLoaded?.(user)
    const notify = vi.fn(); provider.subscribe?.(notify)
    await vi.advanceTimersByTimeAsync(2100)
    expect(provider.getUser()).toBeNull()
    expect(await provider.getToken()).toBeNull()
    expect(notify).toHaveBeenCalled()
  })

  it('rejects insecure issuers/cross-origin redirect bases and hides SDK start errors', async () => {
    expect(() => createOidcCloudAuth({ authority: 'http://public.test', clientId: 'x', browser: browser() })).toThrow('HTTPS')
    expect(() => createOidcCloudAuth({ authority: 'https://issuer.test', clientId: 'x', basePath: 'https://evil.test/', browser: browser() })).toThrow('same-origin')
    const provider = create(); sdk.signinRedirect.mockRejectedValue(new Error('PRIVATE_DISCOVERY_DETAIL'))
    await expect(provider.signIn()).rejects.toThrow('Could not start sign-in. Please try again.')
  })
})
