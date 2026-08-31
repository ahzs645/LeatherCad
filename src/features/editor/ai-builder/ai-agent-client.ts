export type AiAgentStatus = {
  available: boolean
  mode: 'checking' | 'unavailable' | 'local-draft' | 'openai'
  model: string | null
  livePreview: boolean
  message?: string
}

export type AiAgentEvent =
  | {
      type: 'agent.status'
      available: boolean
      mode: 'local-draft' | 'openai'
      model: string | null
      livePreview: boolean
      createdAt: string
    }
  | {
      type: 'turn.started'
      turnId: string
      mode: 'local-draft' | 'openai'
      model: string | null
      createdAt: string
    }
  | {
      type: 'agent.progress'
      turnId?: string
      message: string
      createdAt: string
    }
  | {
      type: 'template.snapshot'
      turnId: string
      label: string
      stage: number
      final: boolean
      rawJson: string
      createdAt: string
    }
  | {
      type: 'turn.completed'
      turnId: string
      createdAt: string
    }
  | {
      type: 'turn.failed'
      turnId?: string
      message: string
      createdAt: string
    }

export type AiAgentTurnInput = {
  request: string
  currentJson?: string
  /**
   * What went wrong last time, in the app's own words.
   *
   * Compile and preflight already run in the browser on every snapshot, so
   * the findings cost nothing to collect; sending them back is what turns a
   * one-shot generator into a loop that can correct itself.
   */
  preflightIssues?: string[]
  onEvent: (event: AiAgentEvent) => void
  onError: (message: string) => void
  onClose?: () => void
}

export type AiAgentTurnController = {
  stop: () => void
}

function sameOriginAgentUrl(pathname: string) {
  if (typeof window === 'undefined' || window.location.protocol === 'file:') {
    return null
  }
  return new URL(pathname, window.location.origin)
}

function websocketUrl(pathname: string) {
  if (typeof window === 'undefined' || window.location.protocol === 'file:') {
    return null
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${pathname}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function decodeAgentEvent(raw: unknown): AiAgentEvent | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return null
  }
  return raw as AiAgentEvent
}

export async function getAiAgentStatus(): Promise<AiAgentStatus> {
  const statusUrl = sameOriginAgentUrl('/api/ai-agent/status')
  if (!statusUrl) {
    return {
      available: false,
      mode: 'unavailable',
      model: null,
      livePreview: false,
      message: 'Native agent server is not available from a file URL.',
    }
  }

  try {
    const response = await fetch(statusUrl, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`status ${response.status}`)
    }
    const payload = await response.json() as Partial<AiAgentStatus>
    return {
      available: payload.available === true,
      mode: payload.mode === 'openai' ? 'openai' : 'local-draft',
      model: typeof payload.model === 'string' ? payload.model : null,
      livePreview: payload.livePreview === true,
    }
  } catch (error) {
    return {
      available: false,
      mode: 'unavailable',
      model: null,
      livePreview: false,
      message: `Start LeatherCad with npm run agent to enable the native agent. ${error instanceof Error ? error.message : ''}`.trim(),
    }
  }
}

export function startAiAgentTurn(input: AiAgentTurnInput): AiAgentTurnController {
  const url = websocketUrl('/ws/ai-agent')
  if (!url) {
    input.onError('Native agent server is not available from a file URL.')
    return { stop: () => undefined }
  }

  const socket = new WebSocket(url)
  let closedByCaller = false

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      type: 'generate',
      request: input.request,
      currentJson: input.currentJson,
      preflightIssues: input.preflightIssues,
    }))
  })

  socket.addEventListener('message', (event) => {
    try {
      const decoded = decodeAgentEvent(JSON.parse(String(event.data)))
      if (decoded) {
        input.onEvent(decoded)
      }
    } catch (error) {
      input.onError(`Could not read native agent event: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  })

  socket.addEventListener('error', () => {
    if (!closedByCaller) {
      input.onError('Native agent WebSocket failed.')
    }
  })

  socket.addEventListener('close', () => {
    input.onClose?.()
  })

  return {
    stop: () => {
      closedByCaller = true
      socket.close()
    },
  }
}
