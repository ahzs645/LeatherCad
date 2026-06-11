import type { Point, Shape } from '../../cad/cad-types'

export type PanState = {
  startX: number
  startY: number
  originX: number
  originY: number
  pointerId: number
}

export type ShapeDragState = {
  pointerId: number
  start: Point
  shapeIds: string[]
  initialShapesById: Map<string, Shape>
  didMove: boolean
}

export type HandlePointKey = 'start' | 'mid' | 'control' | 'end'

export type CanvasInteractionPreview =
  | {
      kind: 'move'
      shapeIds: string[]
      deltaX: number
      deltaY: number
    }
  | {
      kind: 'handle'
      shapeId: string
      pointKey: HandlePointKey
      point: Point
    }
  | {
      kind: 'selection-box'
      start: Point
      end: Point
      mode: 'crossing' | 'contained'
    }

export type HandleDragState = {
  pointerId: number
  shapeId: string
  pointKey: HandlePointKey
}
