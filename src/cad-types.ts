export type Tool = 'pan' | 'line' | 'arc' | 'bezier' | 'fold' | 'stitch-hole'

export type Point = {
  x: number
  y: number
}

export type LineTypeRole = 'cut' | 'stitch' | 'fold' | 'guide' | 'mark'

export type LineTypeStyle = 'solid' | 'dashed' | 'dotted'

export type LineType = {
  id: string
  name: string
  role: LineTypeRole
  style: LineTypeStyle
  color: string
  visible: boolean
}

type BaseShape = {
  id: string
  layerId: string
  lineTypeId: string
}

export type LineShape = {
  id: BaseShape['id']
  type: 'line'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  start: Point
  end: Point
}

export type ArcShape = {
  id: BaseShape['id']
  type: 'arc'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  start: Point
  mid: Point
  end: Point
}

export type BezierShape = {
  id: BaseShape['id']
  type: 'bezier'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
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

export type StitchHoleType = 'round' | 'slit'

export type StitchHole = {
  id: string
  shapeId: string
  point: Point
  angleDeg: number
  holeType: StitchHoleType
  sequence: number
}

export type TracingOverlayKind = 'image' | 'pdf'

export type TracingOverlay = {
  id: string
  name: string
  kind: TracingOverlayKind
  sourceUrl: string
  visible: boolean
  locked: boolean
  opacity: number
  scale: number
  rotationDeg: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  isObjectUrl?: boolean
}

export type DocFile = {
  version: 1
  units: 'mm'
  layers: Layer[]
  activeLayerId: string
  lineTypes: LineType[]
  activeLineTypeId: string
  objects: Shape[]
  foldLines: FoldLine[]
  stitchHoles?: StitchHole[]
  tracingOverlays?: TracingOverlay[]
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
