import type { LineTypeRole, Point } from '../../cad/cad-types'
import { parseManufacturingFontData, type ManufacturingFontData } from './manufacturing-font-data'

export type ManufacturingRegionSetting = { id: string; at: Point; heightMm: number; through: boolean }
export type ManufacturingFingerHole = { id: string; x: number; y: number; diameterMm: number }
export type ManufacturingSettings = {
  version: 1
  mode: 'pattern' | 'jig'
  thicknessMm: number
  toleranceMm: number
  stitchHoles: 'none' | 'round' | 'original'
  roundHoleDiameterMm: number
  holeSizeOverrides: boolean
  diamondLengthMm: number; diamondWidthMm: number
  frenchLengthMm: number; frenchWidthMm: number
  flatLengthMm: number; flatWidthMm: number
  targetRoles: LineTypeRole[]
  jigBaseThicknessMm: number; jigWallHeightMm: number; jigMarginMm: number; jigClearanceMm: number
  jigOuterMode: 'margin' | 'dimensions' | 'offset'
  jigWidthMm: number; jigHeightMm: number
  jigStitchThrough: boolean; jigStitchDiameterMm: number
  fingerHoles: ManufacturingFingerHole[]
  regions: ManufacturingRegionSetting[]
  textEngrave: 'none' | 'top' | 'bottom'
  textDepthMm: number
  engravingFont?: ManufacturingFontData
  edgeFinish: 'none' | 'chamfer' | 'fillet'
  edgeSizeMm: number
  filletSteps: number
  materialPreset: 'leather' | 'acrylic' | 'metal' | 'matte'
  previewColor: string
}

export const DEFAULT_MANUFACTURING_SETTINGS: ManufacturingSettings = {
  version: 1, mode: 'pattern', thicknessMm: 2, toleranceMm: 0.02,
  stitchHoles: 'round', roundHoleDiameterMm: 1, holeSizeOverrides: false,
  diamondLengthMm: 3.4, diamondWidthMm: 1.1, frenchLengthMm: 3.4, frenchWidthMm: 1.1,
  flatLengthMm: 3.4, flatWidthMm: 1.1, targetRoles: ['cut'],
  jigBaseThicknessMm: 2, jigWallHeightMm: 3, jigMarginMm: 5, jigClearanceMm: 0.3,
  jigOuterMode: 'margin', jigWidthMm: 100, jigHeightMm: 100,
  jigStitchThrough: false, jigStitchDiameterMm: 1.6, fingerHoles: [], regions: [],
  textEngrave: 'none', textDepthMm: 0.5, edgeFinish: 'none', edgeSizeMm: 0.5, filletSteps: 6,
  materialPreset: 'leather', previewColor: '#c79558',
}

/** Only validated, versioned data is persisted; session selection/font bytes stay outside the document. */
export function parseManufacturingSettings(value: unknown): ManufacturingSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Manufacturing settings must be an object.')
  const input = value as Record<string, unknown>
  if (input.version !== 1) throw new Error('Unsupported manufacturing settings version.')
  const result = structuredClone(DEFAULT_MANUFACTURING_SETTINGS)
  if (input.engravingFont !== undefined) result.engravingFont = parseManufacturingFontData(input.engravingFont)
  const enums = {
    mode: ['pattern', 'jig'], stitchHoles: ['none', 'round', 'original'],
    jigOuterMode: ['margin', 'dimensions', 'offset'], textEngrave: ['none', 'top', 'bottom'],
    edgeFinish: ['none', 'chamfer', 'fillet'], materialPreset: ['leather', 'acrylic', 'metal', 'matte'],
  }
  for (const [key, allowed] of Object.entries(enums)) {
    if (input[key] !== undefined && !allowed.includes(input[key] as string)) throw new Error(`Invalid manufacturing ${key}.`)
    if (input[key] !== undefined) Object.assign(result, { [key]: input[key] })
  }
  const numeric = ['thicknessMm', 'roundHoleDiameterMm', 'diamondLengthMm', 'diamondWidthMm', 'frenchLengthMm', 'frenchWidthMm', 'flatLengthMm', 'flatWidthMm', 'jigBaseThicknessMm', 'jigWallHeightMm', 'jigMarginMm', 'jigWidthMm', 'jigHeightMm', 'jigStitchDiameterMm', 'textDepthMm', 'edgeSizeMm']
  for (const key of numeric) {
    if (input[key] === undefined) continue
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] <= 0 || input[key] > 1000) throw new Error(`${key === 'thicknessMm' ? 'Thickness' : `Manufacturing ${key}`} must be greater than 0 and no more than 1000 mm.`)
    Object.assign(result, { [key]: input[key] })
  }
  for (const key of ['holeSizeOverrides', 'jigStitchThrough']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`Invalid manufacturing ${key}.`)
    if (input[key] !== undefined) Object.assign(result, { [key]: input[key] })
  }
  if (input.toleranceMm !== undefined) {
    if (typeof input.toleranceMm !== 'number' || !Number.isFinite(input.toleranceMm) || input.toleranceMm < 0.001 || input.toleranceMm > 1) throw new Error('Manufacturing tolerance must be between 0.001 and 1 mm.')
    result.toleranceMm = input.toleranceMm
  }
  if (input.jigClearanceMm !== undefined) {
    if (typeof input.jigClearanceMm !== 'number' || !Number.isFinite(input.jigClearanceMm) || Math.abs(input.jigClearanceMm) > 100) throw new Error('Jig clearance must be between -100 and 100 mm.')
    result.jigClearanceMm = input.jigClearanceMm
  }
  if (input.filletSteps !== undefined) {
    if (!Number.isInteger(input.filletSteps) || (input.filletSteps as number) < 2 || (input.filletSteps as number) > 32) throw new Error('Fillet steps must be an integer between 2 and 32.')
    result.filletSteps = input.filletSteps as number
  }
  if (input.previewColor !== undefined) {
    if (typeof input.previewColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.previewColor)) throw new Error('Invalid manufacturing preview color.')
    result.previewColor = input.previewColor
  }
  if (input.targetRoles !== undefined) {
    if (!Array.isArray(input.targetRoles) || !input.targetRoles.length || (input.targetRoles as unknown[]).some((role) => typeof role !== 'string' || !['cut', 'stitch', 'fold', 'guide', 'mark'].includes(role))) throw new Error('Choose at least one supported manufacturing line role.')
    result.targetRoles = [...new Set(input.targetRoles as LineTypeRole[])]
  }
  const finitePoint = (p: unknown): p is Point => !!p && typeof p === 'object' && ['x', 'y'].every((key) => typeof (p as Record<string, unknown>)[key] === 'number' && Number.isFinite((p as Record<string, number>)[key]) && Math.abs((p as Record<string, number>)[key]) <= 1_000_000)
  if (input.fingerHoles !== undefined) {
    if (!Array.isArray(input.fingerHoles) || input.fingerHoles.length > 100) throw new Error('A jig supports at most 100 finger holes.')
    result.fingerHoles = input.fingerHoles.map((hole) => {
      const candidate = hole as Record<string, unknown>
      if (!finitePoint(hole) || typeof candidate.id !== 'string' || typeof candidate.diameterMm !== 'number' || !Number.isFinite(candidate.diameterMm) || candidate.diameterMm <= 0 || candidate.diameterMm > 1000) throw new Error('Invalid jig finger hole.')
      return { id: candidate.id.slice(0, 100), x: hole.x, y: hole.y, diameterMm: candidate.diameterMm }
    })
  }
  if (input.regions !== undefined) {
    if (!Array.isArray(input.regions) || input.regions.length > 200) throw new Error('Manufacturing supports at most 200 region overrides.')
    result.regions = (input.regions as unknown[]).map((region) => {
      if (!region || typeof region !== 'object') throw new Error('Invalid manufacturing region.')
      const candidate = region as Record<string, unknown>
      if (typeof candidate.id !== 'string' || !finitePoint(candidate.at) || typeof candidate.heightMm !== 'number' || !Number.isFinite(candidate.heightMm) || candidate.heightMm < 0 || candidate.heightMm > 1000 || typeof candidate.through !== 'boolean') throw new Error('Invalid manufacturing region.')
      return { id: candidate.id.slice(0, 100), at: { ...candidate.at }, heightMm: candidate.heightMm, through: candidate.through }
    })
  }
  return result
}
