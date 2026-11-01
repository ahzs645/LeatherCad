import { configureEditorCloudAuth, getEditorCloudState } from './editor-cloud-connection'
import { preserveEditorDraftForSignIn } from './editor-draft-bridge'

export type EditorOidcEnvironment = { authority?: string; clientId?: string; basePath?: string }
export type EditorOidcInitialization = { status: 'local' | 'external' | 'configured' | 'failed'; message?: string; dispose?: () => void }
let initializing: Promise<EditorOidcInitialization> | undefined

/** Start once at application startup without blocking the editor. Missing settings leave local editing
 * unchanged; a host-installed auth provider takes precedence over this default. */
export function initializeEditorCloudAuth(environment: EditorOidcEnvironment = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY as string | undefined,
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined,
  basePath: import.meta.env.BASE_URL,
}): Promise<EditorOidcInitialization> {
  if (initializing) return initializing
  initializing = initialize(environment)
  return initializing
}

async function initialize(environment: EditorOidcEnvironment): Promise<EditorOidcInitialization> {
  // Capture the one-use callback in memory and remove protocol parameters
  // immediately, before loading the SDK or waiting on provider discovery.
  let initialCallbackUrl: string | undefined
  if (typeof window !== 'undefined') {
    const current = new URL(window.location.href)
    if (current.searchParams.get('lcad-oidc') === 'callback') {
      initialCallbackUrl = current.href
      let returnPath = '/'
      try {
        const base = new URL(environment.basePath ?? '/', current.origin)
        if (base.origin === current.origin && base.pathname.endsWith('/')) returnPath = base.pathname
      } catch { /* remove callback parameters even if deployment settings are invalid */ }
      window.history.replaceState(null, '', returnPath)
    }
  }
  if (getEditorCloudState().authConfigured) return { status: 'external' }
  if (!environment.authority?.trim() || !environment.clientId?.trim()) return { status: 'local' }
  let dispose: (() => void) | undefined
  try {
    const { createOidcCloudAuth } = await import('./oidc-cloud-auth')
    // A trusted host may have installed its provider while the SDK chunk loaded.
    if (getEditorCloudState().authConfigured) return { status: 'external' }
    const provider = createOidcCloudAuth({ authority: environment.authority.trim(), clientId: environment.clientId.trim(), basePath: environment.basePath, initialCallbackUrl, beforeRedirect: preserveEditorDraftForSignIn })
    const unregister = configureEditorCloudAuth(provider)
    dispose = () => { unregister(); provider.dispose() }
    await provider.initialize()
    return { status: 'configured', dispose }
  } catch {
    // Keep a valid configured provider available for another Sign in attempt,
    // but never display raw discovery/callback errors or token-bearing URLs.
    return { status: 'failed', message: 'Cloud sign-in could not initialize. You can keep editing locally and try Sign in again.', dispose }
  }
}
