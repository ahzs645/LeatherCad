import type { Tool } from '../cad/cad-types'
import { constructionToolDefinitions } from './construction-tools'
import { drawingToolDefinitions } from './drawing-tools'
import { patternPieceToolDefinitions } from './pattern-piece-tools'
import { stitchHardwareToolDefinitions } from './stitch-hardware-tools'
import type { ToolDefinition } from './tool-types'

const panToolDefinition: ToolDefinition = {
  onPointerDown: () => undefined,
}

export const toolRegistry: Record<Tool, ToolDefinition> = {
  pan: panToolDefinition,
  line: drawingToolDefinitions.line,
  polyline: drawingToolDefinitions.polyline,
  rectangle: drawingToolDefinitions.rectangle,
  circle: drawingToolDefinitions.circle,
  ellipse: drawingToolDefinitions.ellipse,
  arc: drawingToolDefinitions.arc,
  bezier: drawingToolDefinitions.bezier,
  fold: constructionToolDefinitions.fold,
  dimension: constructionToolDefinitions.dimension,
  'stitch-hole': stitchHardwareToolDefinitions['stitch-hole'],
  hardware: stitchHardwareToolDefinitions.hardware,
  seam: stitchHardwareToolDefinitions.seam,
  'piece-notch': patternPieceToolDefinitions['piece-notch'],
  text: drawingToolDefinitions.text,
  freehand: drawingToolDefinitions.freehand,
  'cut-line': drawingToolDefinitions['cut-line'],
}
