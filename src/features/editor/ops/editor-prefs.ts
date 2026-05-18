import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

const PREFS_STORAGE_KEY = 'leathercad-editor-prefs-v1'

export type EditorPreferences = {
  reverseZoomDirection: boolean
  reverseGridScrollDirection: boolean
  incrementalSelection: boolean
  mentoriWithoutCtrl: boolean
  continuousDistanceMarking: boolean
  reduceOneBlade: boolean
  pinSideBar: boolean
  highlightActiveLayer: boolean
  printIntoMargin: boolean
  notchAngleDeg: number
  notchDepthMm: number
  dimensionLineTypeId: string | null
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
  leatherSimTextureRotationDeg: number
  lineToolConstraint: 'none' | 'horizontal' | 'vertical' | 'relative-angle'
  relativeAngleStepDeg: number
  arcDrawMode: 'three-point' | 'radius' | 'half-moon'
  arcRadiusMm: number
  arcHalfMoonRatio: number
  tangentCircleMode: boolean
  tangentCircleDispStep: number
}

export function getDefaultEditorPreferences(): EditorPreferences {
  return {
    reverseZoomDirection: false,
    reverseGridScrollDirection: false,
    incrementalSelection: false,
    mentoriWithoutCtrl: false,
    continuousDistanceMarking: false,
    reduceOneBlade: false,
    pinSideBar: false,
    highlightActiveLayer: false,
    printIntoMargin: false,
    notchAngleDeg: 60,
    notchDepthMm: 3,
    dimensionLineTypeId: null,
    exportIncludeText: true,
    exportIncludeTemplateMetadata: false,
    leatherSimTextureRotationDeg: 0,
    lineToolConstraint: 'none',
    relativeAngleStepDeg: 15,
    arcDrawMode: 'three-point',
    arcRadiusMm: 20,
    arcHalfMoonRatio: 0.5,
    tangentCircleMode: false,
    tangentCircleDispStep: 6,
  }
}

export function loadEditorPreferences(): EditorPreferences {
  if (typeof window === 'undefined') {
    return getDefaultEditorPreferences()
  }
  const raw = safeLocalStorageGet(PREFS_STORAGE_KEY)
  if (!raw) {
    return getDefaultEditorPreferences()
  }
  try {
    const parsed = JSON.parse(raw) as Partial<EditorPreferences>
    const defaults = getDefaultEditorPreferences()
    return {
      reverseZoomDirection: parsed.reverseZoomDirection === true,
      reverseGridScrollDirection: parsed.reverseGridScrollDirection === true,
      incrementalSelection: parsed.incrementalSelection === true,
      mentoriWithoutCtrl: parsed.mentoriWithoutCtrl === true,
      continuousDistanceMarking: parsed.continuousDistanceMarking === true,
      reduceOneBlade: parsed.reduceOneBlade === true,
      pinSideBar: parsed.pinSideBar === true,
      highlightActiveLayer: parsed.highlightActiveLayer === true,
      printIntoMargin: parsed.printIntoMargin === true,
      notchAngleDeg:
        typeof parsed.notchAngleDeg === 'number' && Number.isFinite(parsed.notchAngleDeg)
          ? Math.max(5, Math.min(170, parsed.notchAngleDeg))
          : defaults.notchAngleDeg,
      notchDepthMm:
        typeof parsed.notchDepthMm === 'number' && Number.isFinite(parsed.notchDepthMm) && parsed.notchDepthMm > 0
          ? parsed.notchDepthMm
          : defaults.notchDepthMm,
      dimensionLineTypeId: typeof parsed.dimensionLineTypeId === 'string' ? parsed.dimensionLineTypeId : null,
      exportIncludeText: parsed.exportIncludeText !== false,
      exportIncludeTemplateMetadata: parsed.exportIncludeTemplateMetadata === true,
      leatherSimTextureRotationDeg:
        typeof parsed.leatherSimTextureRotationDeg === 'number' &&
        Number.isFinite(parsed.leatherSimTextureRotationDeg)
          ? ((parsed.leatherSimTextureRotationDeg % 360) + 360) % 360
          : defaults.leatherSimTextureRotationDeg,
      lineToolConstraint:
        parsed.lineToolConstraint === 'horizontal' ||
        parsed.lineToolConstraint === 'vertical' ||
        parsed.lineToolConstraint === 'relative-angle'
          ? parsed.lineToolConstraint
          : 'none',
      relativeAngleStepDeg:
        typeof parsed.relativeAngleStepDeg === 'number' &&
        Number.isFinite(parsed.relativeAngleStepDeg) &&
        parsed.relativeAngleStepDeg > 0
          ? Math.min(180, parsed.relativeAngleStepDeg)
          : defaults.relativeAngleStepDeg,
      arcDrawMode:
        parsed.arcDrawMode === 'radius' || parsed.arcDrawMode === 'half-moon' ? parsed.arcDrawMode : 'three-point',
      arcRadiusMm:
        typeof parsed.arcRadiusMm === 'number' && Number.isFinite(parsed.arcRadiusMm) && parsed.arcRadiusMm > 0
          ? parsed.arcRadiusMm
          : defaults.arcRadiusMm,
      arcHalfMoonRatio:
        typeof parsed.arcHalfMoonRatio === 'number' && Number.isFinite(parsed.arcHalfMoonRatio)
          ? Math.max(0.05, Math.min(5, parsed.arcHalfMoonRatio))
          : defaults.arcHalfMoonRatio,
      tangentCircleMode: parsed.tangentCircleMode === true,
      tangentCircleDispStep:
        typeof parsed.tangentCircleDispStep === 'number' &&
        Number.isFinite(parsed.tangentCircleDispStep) &&
        parsed.tangentCircleDispStep > 1
          ? Math.min(64, Math.round(parsed.tangentCircleDispStep))
          : defaults.tangentCircleDispStep,
    }
  } catch {
    return getDefaultEditorPreferences()
  }
}

export function saveEditorPreferences(prefs: EditorPreferences) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(PREFS_STORAGE_KEY, JSON.stringify(prefs))
}
