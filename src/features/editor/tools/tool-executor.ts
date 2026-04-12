import type { Point, Tool } from '../cad/cad-types'
import type { EditorToolSession } from './tool-session'
import type { ToolRuntime } from './tool-types'
import { parseVector } from './tool-command-utils'
import { pickToolPoint } from './tool-helpers'
import { toolRegistry } from './tool-registry'

export function executeToolPointerDown(tool: Tool, point: Point, runtime: ToolRuntime) {
  if (tool === 'pan') {
    return
  }
  toolRegistry[tool].onPointerDown(point, runtime)
}

export function executeToolCommand(tool: Tool, command: string, runtime: ToolRuntime) {
  const trimmed = command.trim()
  if (!trimmed) {
    return 'Command is empty'
  }

  if (trimmed.toLowerCase() === 'help') {
    return 'Use x,y | @x,y | r<deg | @r<deg. For ellipse, you can also use rx,ry after center.'
  }

  if (tool === 'pan') {
    return 'Select a drawing tool first'
  }

  const definition = toolRegistry[tool]
  if (trimmed.toLowerCase() === 'finish' && tool !== 'freehand') {
    runtime.clearDraft()
    return 'Draft finished'
  }

  if (definition.onCommand) {
    return definition.onCommand(trimmed, {
      tool,
      runtime,
      referencePoint: runtime.toolSession.getReferencePoint(),
    })
  }

  const parsed = parseVector(runtime.toolSession.getReferencePoint(), trimmed)
  if (!parsed.ok) {
    return parsed.message
  }

  definition.onPointerDown(parsed.point, runtime)
  pickToolPoint(runtime, parsed.point)
  return 'Point accepted'
}

export function getToolHint(tool: Tool, draftPoints: Point[]) {
  return toolRegistry[tool].getHint?.(draftPoints) ?? null
}

export function resetToolSession(session: EditorToolSession, nextTool?: Tool) {
  session.resetForTool(nextTool)
  if (!nextTool || nextTool === 'pan') {
    return
  }
  toolRegistry[nextTool].resetSession?.(session, nextTool)
}
