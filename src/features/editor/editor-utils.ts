import { clamp } from './cad/cad-geometry'
import type { Layer, Tool } from './cad/cad-types'
import {
  DEFAULT_BACK_LAYER_COLOR,
  DEFAULT_FRONT_LAYER_COLOR,
  TOOL_OPTIONS,
} from './editor-constants'
import type { EditorSnapshot } from './editor-types'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function toolLabel(tool: Tool) {
  return TOOL_OPTIONS.find((entry) => entry.value === tool)?.label ?? tool
}

function channelToHex(value: number) {
  const clamped = clamp(Math.round(value), 0, 255)
  return clamped.toString(16).padStart(2, '0')
}

export function normalizeHexColor(value: string, fallback: string) {
  const candidate = value.trim()
  if (HEX_COLOR_PATTERN.test(candidate)) {
    return candidate.toLowerCase()
  }
  return fallback
}

export function interpolateHexColor(startHex: string, endHex: string, ratio: number) {
  const clampedRatio = clamp(ratio, 0, 1)
  const parseChannel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16)

  const start = normalizeHexColor(startHex, DEFAULT_FRONT_LAYER_COLOR)
  const end = normalizeHexColor(endHex, DEFAULT_BACK_LAYER_COLOR)

  const red = parseChannel(start, 1) + (parseChannel(end, 1) - parseChannel(start, 1)) * clampedRatio
  const green = parseChannel(start, 3) + (parseChannel(end, 3) - parseChannel(start, 3)) * clampedRatio
  const blue = parseChannel(start, 5) + (parseChannel(end, 5) - parseChannel(start, 5)) * clampedRatio

  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function newLayerName(index: number) {
  return `Layer ${index + 1}`
}

export function newSketchGroupName(index: number) {
  return `Sub-Sketch ${index + 1}`
}

export function createDefaultLayer(id: string): Layer {
  return {
    id,
    name: 'Layer 1',
    visible: true,
    locked: false,
    stackLevel: 0,
  }
}

export function buildDocSnapshotSignature(snapshot: EditorSnapshot) {
  return JSON.stringify(snapshot)
}
