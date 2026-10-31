import { createCommunityDataClient } from './community-data-client'
import { createConvexDataClient } from './convex-data-client'
import { createConvexTransport, normalizeConvexUrl } from './convex-transport'

export type EditorCloudUser = { id: string; displayName: string }
/** Supplied by the host's established OIDC sign-in integration. Tokens stay in memory. */
export type EditorCloudAuth = {
  getUser(): EditorCloudUser | null
  getToken(): Promise<string | null>
  signIn(): Promise<void>
  signOut(): Promise<void>
  subscribe?(listener: () => void): () => void
}
export type EditorCloudState = { configured: boolean; authConfigured: boolean; user: EditorCloudUser | null; sessionKey: number }
let deploymentUrl = (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? ''
let auth: EditorCloudAuth | null = null
let unsubscribe: (() => void) | undefined
const listeners = new Set<() => void>()
let state: EditorCloudState = { configured: Boolean(deploymentUrl), authConfigured: false, user: null, sessionKey: 0 }
function update() {
  const current = auth?.getUser() ?? null
  const user = current ? { id: current.id, displayName: current.displayName } : null
  state = { configured: Boolean(deploymentUrl), authConfigured: Boolean(auth), user,
    sessionKey: state.sessionKey + (state.user?.id !== user?.id ? 1 : 0) }
  listeners.forEach(listener => listener())
}
export function configureEditorCloudAuth(provider: EditorCloudAuth | null, options?: { url: string }): () => void {
  unsubscribe?.()
  if (options) deploymentUrl = normalizeConvexUrl(options.url)
  auth = provider
  state = { ...state, sessionKey: state.sessionKey + 1 }
  unsubscribe = provider?.subscribe?.(update)
  update()
  return () => {
    if (auth === provider) { unsubscribe?.(); unsubscribe = undefined; auth = null; update() }
  }
}
export const getEditorCloudState = () => state
export function subscribeEditorCloudState(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export async function signInToEditorCloud() {
  if (!auth) throw new Error('Sign-in is not available in this installation')
  await auth.signIn(); update()
}
export async function signOutOfEditorCloud() { if (auth) await auth.signOut(); update() }
export function getEditorCloudTransport() {
  if (!deploymentUrl) throw new Error('Cloud is not configured')
  const sessionKey = state.sessionKey
  const assertSession = () => {
    if (state.sessionKey !== sessionKey) throw new Error('Your sign-in session changed; refresh the cloud library')
  }
  return createConvexTransport({ url: deploymentUrl, assertSession, getAuthToken: async () => {
    assertSession()
    const token = await auth?.getToken() ?? null
    assertSession()
    return token
  } })
}
export function getEditorCloudClients() {
  const transport = getEditorCloudTransport()
  return { documents: createConvexDataClient({ transport }), community: createCommunityDataClient(transport) }
}
