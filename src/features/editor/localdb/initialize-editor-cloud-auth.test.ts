import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OidcCloudAuth, OidcCloudAuthOptions } from './oidc-cloud-auth'
import type { EditorCloudAuth } from './editor-cloud-connection'
const adapter = vi.hoisted(() => ({ create: vi.fn<(options: OidcCloudAuthOptions) => OidcCloudAuth>(), initialize: vi.fn<() => Promise<void>>(), dispose: vi.fn() }))
vi.mock('./oidc-cloud-auth', () => ({ createOidcCloudAuth: adapter.create }))
const configured = { authority: 'https://issuer.test', clientId: 'editor-client', basePath: '/editor/' }
const external: EditorCloudAuth = { getUser: () => ({ id: 'external-user', displayName: 'Existing host session' }), getToken: async () => 'HOST_MEMORY_TOKEN', signIn: async () => undefined, signOut: async () => undefined }

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
  adapter.initialize.mockResolvedValue(undefined)
  adapter.create.mockImplementation(() => ({ getUser: () => null, getToken: async () => null, signIn: async () => undefined, signOut: async () => undefined, initialize: adapter.initialize, dispose: adapter.dispose }))
})
describe('configured OIDC startup', () => {
  it('keeps absent or partial config local without loading the auth SDK', async () => {
    const { initializeEditorCloudAuth } = await import('./initialize-editor-cloud-auth')
    expect(await initializeEditorCloudAuth({ authority: 'https://issuer.test' })).toEqual({ status: 'local' })
    expect(adapter.create).not.toHaveBeenCalled()
    const { getEditorCloudState } = await import('./editor-cloud-connection')
    expect(getEditorCloudState().authConfigured).toBe(false)
  })

  it('registers the built-in provider once for concurrent startup calls', async () => {
    const { initializeEditorCloudAuth } = await import('./initialize-editor-cloud-auth')
    const first = initializeEditorCloudAuth(configured), second = initializeEditorCloudAuth(configured)
    expect(first).toBe(second)
    const result = await first
    expect(result.status).toBe('configured')
    expect(adapter.create).toHaveBeenCalledOnce()
    const { getEditorCloudState } = await import('./editor-cloud-connection')
    expect(getEditorCloudState().authConfigured).toBe(true)
    result.dispose?.()
    expect(getEditorCloudState().authConfigured).toBe(false)
  })

  it('preserves host auth installed before startup or while the default SDK loads', async () => {
    const { initializeEditorCloudAuth } = await import('./initialize-editor-cloud-auth')
    const { configureEditorCloudAuth, getEditorCloudState } = await import('./editor-cloud-connection')
    const pending = initializeEditorCloudAuth(configured)
    configureEditorCloudAuth(external)
    expect(await pending).toEqual({ status: 'external' })
    expect(adapter.create).not.toHaveBeenCalled()
    expect(getEditorCloudState().user?.id).toBe('external-user')
  })

  it('scrubs callback secrets before SDK load and keeps provider errors out of visible messages', async () => {
    window.history.replaceState(null, '', '/editor/?lcad-oidc=callback&code=PRIVATE_CODE&state=PRIVATE_STATE')
    adapter.initialize.mockRejectedValue(new Error('PRIVATE_TOKEN_DISCOVERY_ERROR'))
    const { initializeEditorCloudAuth } = await import('./initialize-editor-cloud-auth')
    const pending = initializeEditorCloudAuth(configured)
    expect(window.location.pathname).toBe('/editor/')
    expect(window.location.search).toBe('')
    const result = await pending
    expect(result.status).toBe('failed')
    expect(result.message).not.toContain('PRIVATE')
    expect(adapter.create.mock.calls[0][0].initialCallbackUrl).toContain('PRIVATE_CODE')
    const { getEditorCloudState } = await import('./editor-cloud-connection')
    expect(getEditorCloudState().authConfigured).toBe(true)
    result.dispose?.()
  })

  it('does not remove a trusted host replacement when the default adapter is disposed', async () => {
    const { initializeEditorCloudAuth } = await import('./initialize-editor-cloud-auth')
    const result = await initializeEditorCloudAuth(configured)
    const { configureEditorCloudAuth, getEditorCloudState } = await import('./editor-cloud-connection')
    configureEditorCloudAuth(external)
    result.dispose?.()
    expect(adapter.dispose).toHaveBeenCalledOnce()
    expect(getEditorCloudState().user?.id).toBe('external-user')
  })
})
