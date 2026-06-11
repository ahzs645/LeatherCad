import type { LineShape, Point, Tool } from '../cad/cad-types'
import { createOffsetGeometryForSelection } from '../ops/advanced-pattern-ops'
import { extendLineToShape, trimShapeAtPoint } from '../ops/geometry/line-editing'
import { flipSelection, mirrorSelectionAcrossAxis } from '../ops/transform-ops'
import type { EditorToolSession } from './tool-session'
import type { ToolRuntime } from './tool-types'
import { parseNumber, parseVector } from './tool-command-utils'
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
  const normalized = trimmed.toLowerCase()
  const parts = normalized.split(/\s+/)
  const commandName = parts[0]

  if (normalized === 'help') {
    return 'Commands: l, pl, rect, c, arc, bezier, offset [mm], trim [start|end], extend [start|end], mirror [h|v|angle], finish, x,y, @x,y, r<deg.'
  }

  const toolAlias: Partial<Record<string, Tool>> = {
    a: 'arc',
    arc: 'arc',
    b: 'bezier',
    bezier: 'bezier',
    c: 'circle',
    circle: 'circle',
    e: 'ellipse',
    ellipse: 'ellipse',
    f: 'fold',
    fold: 'fold',
    l: 'line',
    line: 'line',
    mtext: 'text',
    p: 'pan',
    pan: 'pan',
    pl: 'polyline',
    polyline: 'polyline',
    r: 'rectangle',
    rect: 'rectangle',
    rectangle: 'rectangle',
    t: 'text',
    text: 'text',
  }
  const nextTool = toolAlias[commandName]
  if (nextTool) {
    runtime.setActiveTool(nextTool)
    return `Tool selected: ${nextTool}`
  }

  const globalResult = executeGlobalCadCommand(commandName, parts.slice(1), runtime)
  if (globalResult) {
    return globalResult
  }

  const definition = toolRegistry[tool]
  if (normalized === 'finish' && tool !== 'freehand') {
    runtime.setCadCommandMode(null)
    runtime.clearDraft()
    return 'Draft finished'
  }

  if (tool === 'pan') {
    return 'Select a drawing tool first, or run a CAD command like offset, trim, extend, or mirror.'
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

function executeGlobalCadCommand(commandName: string, args: string[], runtime: ToolRuntime): string | null {
  if (commandName === 'offset' || commandName === 'o') {
    const session = runtime.toolSession as EditorToolSession & { lastOffsetDistanceMm?: number }
    const parsedDistance = args[0] ? parseNumber(args[0]) : Number.NaN
    const offsetMm = Number.isFinite(parsedDistance)
      ? parsedDistance
      : Number.isFinite(session.lastOffsetDistanceMm)
        ? session.lastOffsetDistanceMm
        : Number.NaN
    if (!Number.isFinite(offsetMm)) {
      return 'Offset distance required. Use: offset 3'
    }
    const safeOffsetMm = Number(offsetMm)
    const result = createOffsetGeometryForSelection(
      Object.values(runtime.shapesById),
      new Set(runtime.selectedShapeIds),
      safeOffsetMm,
      runtime.activeLineTypeId,
    )
    if (!result.ok) {
      return result.message
    }
    session.lastOffsetDistanceMm = safeOffsetMm
    runtime.setShapes((previous) => [...previous, ...result.created])
    runtime.setSelectedShapeIds(result.created.map((shape) => shape.id))
    return `${result.message}. Offset distance ${safeOffsetMm} mm remains active.`
  }

  if (commandName === 'mirror' || commandName === 'mi') {
    const selected = new Set(runtime.selectedShapeIds)
    if (selected.size === 0) {
      return 'Select one or more shapes to mirror'
    }
    const axis = args[0] ?? 'h'
    if (axis === 'h' || axis === 'horizontal' || axis === 'x') {
      runtime.setShapes((previous) => flipSelection(previous, selected, 'horizontal'))
      return 'Mirrored selection horizontally'
    }
    if (axis === 'v' || axis === 'vertical' || axis === 'y') {
      runtime.setShapes((previous) => flipSelection(previous, selected, 'vertical'))
      return 'Mirrored selection vertically'
    }
    const angleDeg = parseNumber(axis)
    if (!Number.isFinite(angleDeg)) {
      return 'Mirror axis must be h, v, or an angle in degrees'
    }
    const pivot = runtime.cursorPoint ?? runtime.toolSession.getReferencePoint()
    runtime.setShapes((previous) => mirrorSelectionAcrossAxis(previous, selected, pivot, angleDeg))
    return `Mirrored selection across ${angleDeg}° axis`
  }

  if (commandName === 'extend' || commandName === 'ex') {
    if (args.length === 0) {
      runtime.setActiveTool('pan')
      runtime.setCadCommandMode('extend')
      return 'Extend: hover to preview, click to commit'
    }
    const selectedShapes = runtime.selectedShapeIds.map((id) => runtime.shapesById[id]).filter(Boolean)
    const line = selectedShapes.find((shape): shape is LineShape => shape.type === 'line')
    const target = selectedShapes.find((shape) => shape && shape.id !== line?.id)
    if (!line || !target) {
      return 'Select a line and a target shape, then run extend'
    }
    const explicitEnd = args[0] === 'start' || args[0] === 'end' ? args[0] : null
    const reference = runtime.cursorPoint ?? runtime.toolSession.getReferencePoint()
    const extendEnd = explicitEnd ?? (distance(reference, line.start) < distance(reference, line.end) ? 'start' : 'end')
    const extended = extendLineToShape(line, target, extendEnd)
    if (!extended) {
      return 'No valid extension found'
    }
    runtime.setShapes((previous) => previous.map((shape) => (shape.id === line.id ? extended : shape)))
    runtime.setSelectedShapeIds([line.id])
    return `Extended line ${extendEnd}`
  }

  if (commandName === 'trim' || commandName === 'tr') {
    if (args.length === 0) {
      runtime.setActiveTool('pan')
      runtime.setCadCommandMode('trim')
      return 'Trim: hover to preview, click to commit'
    }
    const selectedShapes = runtime.selectedShapeIds.map((id) => runtime.shapesById[id]).filter(Boolean)
    const target = selectedShapes[0]
    if (!target) {
      return 'Select a shape to trim'
    }
    const cutPoint = runtime.cursorPoint ?? runtime.toolSession.getReferencePoint()
    const explicitKeep = args[0] === 'start' || args[0] === 'end' ? args[0] : null
    const keepSide = explicitKeep ?? (distance(cutPoint, target.start) < distance(cutPoint, target.end) ? 'end' : 'start')
    const trimmed = trimShapeAtPoint(target, cutPoint, keepSide)
    runtime.setShapes((previous) => previous.map((shape) => (shape.id === target.id ? trimmed : shape)))
    runtime.setSelectedShapeIds([target.id])
    return `Trimmed shape, kept ${keepSide} side`
  }

  return null
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
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
