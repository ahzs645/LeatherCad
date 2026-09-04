/**
 * A record of what the agent did, for the person watching it happen.
 *
 * The point of WebMCP is that the human and the agent share one workspace, so
 * a tool call that quietly rewrites the canvas is the wrong shape: the user
 * should be able to see what was called, with what, and what came back. This
 * is a tiny store rather than React state because the tools are registered
 * once, outside the render tree, and must be able to append from a callback
 * the browser invoked.
 */

export type WebMcpActivityStatus = 'ok' | 'error'

export type WebMcpActivityEntry = {
  id: number
  toolName: string
  status: WebMcpActivityStatus
  summary: string
  detail: string
  at: number
  durationMs: number
}

/** Enough history to follow a session without growing without bound. */
const MAX_ENTRIES = 40

type Listener = () => void

let entries: WebMcpActivityEntry[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export function recordWebMcpActivity(
  entry: Omit<WebMcpActivityEntry, 'id' | 'at'> & { at?: number },
): WebMcpActivityEntry {
  const created: WebMcpActivityEntry = {
    ...entry,
    id: nextId,
    at: entry.at ?? Date.now(),
  }
  nextId += 1
  entries = [created, ...entries].slice(0, MAX_ENTRIES)
  emit()
  return created
}

export function subscribeToWebMcpActivity(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getWebMcpActivitySnapshot(): WebMcpActivityEntry[] {
  return entries
}

export function clearWebMcpActivity() {
  entries = []
  emit()
}

/** Test seam: the store is module state and would otherwise leak across tests. */
export function resetWebMcpActivityForTests() {
  entries = []
  nextId = 1
  listeners.clear()
}
