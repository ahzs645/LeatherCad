import type {
  LineTypeRole,
  LineTypeStyle,
  Point,
} from '../../cad/cad-types'

export type LccMeta = {
  file_type?: string
  version?: string
  memo?: string
  unit_for_view?: string
  licenses?: unknown[]
}

export type LccLayer = {
  id: number
  chk?: string
  nam?: string
  indp?: string
}

export type LccShape = {
  id: string
  type: string
  sp: [number, number]
  ep: [number, number]
  ct: [number, number]
  w: string
  h: string
  color: string
  dash: string
  opc?: string
  path?: string
  rt: string
  st: string
  inv: string
  bz1: [number, number]
  bz2: [number, number]
  thk: string
  la: string
  lb: string
  iv: string
  ih: string
  sta: string
  swa: string
  tx: string
  fs: string
  ff: string
  txst: string
  txrd: string
  guid?: string
  nm: string
  gid: string
  dim: string
  arst: string
  ared: string
  layer: string
  plidx: string
  orig?: unknown
  dk?: string
  dp1?: [number, number]
  dp2?: [number, number]
  doff?: string
  dprec?: string
  dunit?: string
  dsl?: string
  dti?: string
  dao?: string
  dtr?: string
  dlbl?: string
  dtid?: string
  pr?: { bt?: string; p?: string }
  StcIn?: [number, number]
  StcOut?: [number, number]
  PrevStId?: string
  NextStId?: string
}

export type LccBackdrop = {
  src?: string
  x?: number
  y?: number
  w?: number | string
  h?: number | string
  opc?: string
  lock?: string
  fullpath?: string
  image?: { mime?: string; base64?: string; pxw?: number | string; pxh?: number | string }
  topleft?: [number, number]
  rotc?: [number, number]
  angle?: string
  dpi?: string
  alpha?: string
  visible?: boolean
}

export type LccPrintArea = {
  offset?: [number, number]
  target?: boolean
  scalepos?: number
}

export type LccFile = {
  meta?: LccMeta
  layers?: LccLayer[]
  shapes?: LccShape[]
  backdrops?: LccBackdrop[]
  printareas?: LccPrintArea[]
  groups?: Array<{ id: number; parent: number }>
}

export type RawDimensionSegment = {
  sourceId?: string
  sourceGroupId?: string
  start: Point
  end: Point
  hasArrowStart: boolean
  hasArrowEnd: boolean
  layerId: string
  lineTypeId: string
}

export type RawDimensionText = {
  sourceId?: string
  sourceGroupId?: string
  text: string
  anchor: Point
  center: Point
  layerId: string
  fontSizeMm?: number
  rotationDeg?: number
  placement?: 'baseline' | 'center'
}

export type LccColorMap = Record<string, string>
export type LayerRoleMap = Record<number, LineTypeRole>
export type DashResolver = (dash: string) => LineTypeStyle
