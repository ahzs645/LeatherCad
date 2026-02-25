export type Tool = 'pan' | 'line' | 'arc' | 'bezier' | 'fold'

export type Point = {
  x: number
  y: number
}

export type LineShape = {
  id: string
  type: 'line'
  layerId: string
  start: Point
  end: Point
}

export type ArcShape = {
  id: string
  type: 'arc'
  layerId: string
  start: Point
  mid: Point
  end: Point
}

export type BezierShape = {
  id: string
  type: 'bezier'
  layerId: string
  start: Point
  control: Point
  end: Point
}

export type Shape = LineShape | ArcShape | BezierShape

export type Layer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  stackLevel?: number
}

export type FoldLine = {
  id: string
  name: string
  start: Point
  end: Point
  angleDeg: number
  maxAngleDeg: number
}

export type DocFile = {
  version: 1
  units: 'mm'
  layers: Layer[]
  activeLayerId: string
  objects: Shape[]
  foldLines: FoldLine[]
}

export type Viewport = {
  x: number
  y: number
  scale: number
}

export type TextureSource = {
  sourceUrl: string
  license: string
  albedoUrl: string
  normalUrl?: string
  roughnessUrl?: string
}
