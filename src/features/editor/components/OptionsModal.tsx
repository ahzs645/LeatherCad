import { LanguageSelector } from './LanguageSelector'
import { useTranslate } from '../hooks/useTranslate'
import { useRef, useState } from 'react'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { OptionsNavigation, OptionsSection, type OptionsCategory } from './OptionsNavigation'
import { InterfacePreferencesPanel } from './InterfacePreferencesPanel'
import { getDefaultEditorPreferences } from '../ops/editor-prefs'
import { DEFAULT_INTERFACE_PREFERENCES, getInterfacePreferences, updateInterfacePreferences } from '../ops/interface-preferences'
import { getDefaultStitchAutoPitchSettings } from '../ops/stitch-auto-pitch-settings'
import { getDefaultBoxStitchHelperSettings } from '../ops/box-stitch-settings'
import { useOptionalDisplayUnit } from '../state/providers/EditorUIStateProvider'
import { LengthInput } from './LengthInput'
import { fromDisplayValue } from '../ops/unit-ops'
import type { BoxStitchHelperSettings } from '../ops/box-stitch-settings'
import type { LineType } from '../cad/cad-types'
import type { StitchAutoPitchSettings } from '../editor-types'
import type { DimensionDefaults } from '../state/editor-domain-types'

type OptionsModalProps = {
  open: boolean
  autoSaveEnabled: boolean
  reverseZoomDirection: boolean
  reverseGridScrollDirection: boolean
  incrementalSelection: boolean
  mentoriWithoutCtrl: boolean
  continuousDistanceMarking: boolean
  reduceOneBlade: boolean
  highlightActiveLayer: boolean
  fillOnChange: boolean
  drawEdges: boolean
  drawFirstPos: boolean
  centerLineDivisions: number
  markingDistanceMm: number
  mandalaCircleTemplateName: string
  notchAngleDeg: number
  notchDepthMm: number
  relativeAngleStepDeg: number
  arcDrawMode: 'three-point' | 'radius' | 'half-moon'
  arcRadiusMm: number
  arcHalfMoonRatio: number
  tangentCircleMode: boolean
  tangentCircleDispStep: number
  dimensionLineTypeId: string | null
  lineTypes: LineType[]
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
  lineToolConstraint: 'none' | 'horizontal' | 'vertical' | 'relative-angle'
  gridBackgroundMode: 'theme' | 'light' | 'dark'
  dimensionDefaults: DimensionDefaults
  forceFitLastPrick: boolean
  autoPitchSettings: StitchAutoPitchSettings
  boxStitchHelperSettings: BoxStitchHelperSettings
  printCalibrationXPercent: number
  printCalibrationYPercent: number
  autoHideSidebar: boolean
  pinSideBar: boolean
  loadDemoOnStartup: boolean
  translationEntryCount: number
  onImportTranslationFile: () => void
  onResetTranslation: () => void
  onChangeAutoSaveEnabled: (value: boolean) => void
  onChangeReverseZoomDirection: (value: boolean) => void
  onChangeReverseGridScrollDirection: (value: boolean) => void
  onChangeIncrementalSelection: (value: boolean) => void
  onChangeContinuousDistanceMarking: (value: boolean) => void
  onChangeReduceOneBlade: (value: boolean) => void
  onChangeHighlightActiveLayer: (value: boolean) => void
  onChangeFillOnChange: (value: boolean) => void
  onChangeDrawEdges: (value: boolean) => void
  onChangeDrawFirstPos: (value: boolean) => void
  onChangeCenterLineDivisions: (value: number) => void
  onChangeMarkingDistanceMm: (value: number) => void
  onChangeMandalaCircleTemplateName: (value: string) => void
  onChangeNotchAngleDeg: (value: number) => void
  onChangeNotchDepthMm: (value: number) => void
  onChangeRelativeAngleStepDeg: (value: number) => void
  onChangeArcDrawMode: (value: 'three-point' | 'radius' | 'half-moon') => void
  onChangeArcRadiusMm: (value: number) => void
  onChangeArcHalfMoonRatio: (value: number) => void
  onChangeTangentCircleMode: (value: boolean) => void
  onChangeTangentCircleDispStep: (value: number) => void
  onChangeDimensionLineTypeId: (value: string | null) => void
  onChangeMentoriWithoutCtrl: (value: boolean) => void
  onChangeExportIncludeText: (value: boolean) => void
  onChangeExportIncludeTemplateMetadata: (value: boolean) => void
  onChangeLineToolConstraint: (value: 'none' | 'horizontal' | 'vertical' | 'relative-angle') => void
  onChangeGridBackgroundMode: (value: 'theme' | 'light' | 'dark') => void
  onChangeDimensionDefaults: (next: DimensionDefaults) => void
  onChangeForceFitLastPrick: (value: boolean) => void
  onChangeAutoPitchSettings: (next: StitchAutoPitchSettings) => void
  onChangeBoxStitchHelperSettings: (next: BoxStitchHelperSettings) => void
  onChangePrintCalibrationXPercent: (value: number) => void
  onChangePrintCalibrationYPercent: (value: number) => void
  onChangeAutoHideSidebar: (value: boolean) => void
  onChangePinSideBar: (value: boolean) => void
  onChangeLoadDemoOnStartup: (value: boolean) => void
  onOpenDimensionInspector?: () => void
  onClose: () => void
}

export function OptionsModal({
  open,
  autoSaveEnabled,
  reverseZoomDirection,
  reverseGridScrollDirection,
  incrementalSelection,
  mentoriWithoutCtrl,
  continuousDistanceMarking,
  reduceOneBlade,
  highlightActiveLayer,
  fillOnChange,
  drawEdges,
  drawFirstPos,
  centerLineDivisions,
  markingDistanceMm,
  mandalaCircleTemplateName,
  notchAngleDeg,
  notchDepthMm,
  relativeAngleStepDeg,
  arcDrawMode,
  arcRadiusMm,
  arcHalfMoonRatio,
  tangentCircleMode,
  tangentCircleDispStep,
  dimensionLineTypeId,
  lineTypes,
  exportIncludeText,
  exportIncludeTemplateMetadata,
  onChangeAutoSaveEnabled,
  onChangeReverseZoomDirection,
  onChangeReverseGridScrollDirection,
  onChangeIncrementalSelection,
  onChangeContinuousDistanceMarking,
  onChangeReduceOneBlade,
  onChangeHighlightActiveLayer,
  onChangeFillOnChange,
  onChangeDrawEdges,
  onChangeDrawFirstPos,
  onChangeCenterLineDivisions,
  onChangeMarkingDistanceMm,
  onChangeMandalaCircleTemplateName,
  onChangeNotchAngleDeg,
  onChangeNotchDepthMm,
  onChangeRelativeAngleStepDeg,
  onChangeArcDrawMode,
  onChangeArcRadiusMm,
  onChangeArcHalfMoonRatio,
  onChangeTangentCircleMode,
  onChangeTangentCircleDispStep,
  onChangeDimensionLineTypeId,
  onChangeMentoriWithoutCtrl,
  onChangeExportIncludeText,
  onChangeExportIncludeTemplateMetadata,
  lineToolConstraint,
  onChangeLineToolConstraint,
  gridBackgroundMode,
  onChangeGridBackgroundMode,
  dimensionDefaults,
  onChangeDimensionDefaults,
  forceFitLastPrick,
  onChangeForceFitLastPrick,
  autoPitchSettings,
  onChangeAutoPitchSettings,
  boxStitchHelperSettings,
  onChangeBoxStitchHelperSettings,
  printCalibrationXPercent,
  printCalibrationYPercent,
  onChangePrintCalibrationXPercent,
  onChangePrintCalibrationYPercent,
  autoHideSidebar,
  pinSideBar,
  loadDemoOnStartup,
  translationEntryCount,
  onImportTranslationFile,
  onResetTranslation,
  onChangeAutoHideSidebar,
  onChangePinSideBar,
  onChangeLoadDemoOnStartup,
  onOpenDimensionInspector,
  onClose,
}: OptionsModalProps) {
  const t = useTranslate()
  const [unit, setUnit] = useOptionalDisplayUnit()
  const [calibrationError, setCalibrationError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open, onClose })
  const [calibrationReferenceMm, setCalibrationReferenceMm] = useState<number>(100)
  const [measuredXMm, setMeasuredXMm] = useState<string>('')
  const [measuredYMm, setMeasuredYMm] = useState<string>('')

  const updateDimensionDefaults = <K extends keyof DimensionDefaults>(key: K, value: DimensionDefaults[K]) => {
    onChangeDimensionDefaults({ ...dimensionDefaults, [key]: value })
  }

  const updateAutoPitch = <K extends keyof StitchAutoPitchSettings>(key: K, value: StitchAutoPitchSettings[K]) => {
    onChangeAutoPitchSettings({ ...autoPitchSettings, [key]: value })
  }

  const updateBoxStitchHelper = <K extends keyof BoxStitchHelperSettings>(
    key: K,
    value: BoxStitchHelperSettings[K],
  ) => {
    onChangeBoxStitchHelperSettings({ ...boxStitchHelperSettings, [key]: value })
  }

  const applyCalibrationFromMeasured = (axis: 'x' | 'y') => {
    if (!Number.isFinite(calibrationReferenceMm) || calibrationReferenceMm <= 0) {
      setCalibrationError(t('Enter a positive reference length.'))
      return
    }
    const measuredRaw = axis === 'x' ? measuredXMm : measuredYMm
    const measured = fromDisplayValue(Number.parseFloat(measuredRaw), unit)
    if (!Number.isFinite(measured) || measured <= 0) {
      setCalibrationError(t('Enter a positive measured length.'))
      return
    }
    setCalibrationError('')
    const percent = (calibrationReferenceMm / measured) * 100
    const clamped = Math.min(150, Math.max(50, percent))
    if (axis === 'x') {
      onChangePrintCalibrationXPercent(clamped)
    } else {
      onChangePrintCalibrationYPercent(clamped)
    }
  }

  function resetCategory(category: OptionsCategory) {
    const defaults = getDefaultEditorPreferences()
    if (category === 'workspace') {
      onChangeAutoSaveEnabled(false); onChangeAutoHideSidebar(false); onChangePinSideBar(false); onChangeLoadDemoOnStartup(true)
    } else if (category === 'input') {
      updateInterfacePreferences({ ...DEFAULT_INTERFACE_PREFERENCES, displayUnit: getInterfacePreferences().displayUnit })
      onChangeReverseZoomDirection(false); onChangeReverseGridScrollDirection(false); onChangeIncrementalSelection(false)
      onChangeMentoriWithoutCtrl(false); onChangeContinuousDistanceMarking(false); onChangeReduceOneBlade(false)
      onChangeHighlightActiveLayer(false); onChangeFillOnChange(false); onChangeDrawEdges(false); onChangeDrawFirstPos(false)
      onChangeCenterLineDivisions(defaults.centerLineDivisions); onChangeMarkingDistanceMm(defaults.markingDistanceMm)
      onChangeMandalaCircleTemplateName(defaults.mandalaCircleTemplateName)
    } else if (category === 'drawing') {
      setUnit('mm')
      onChangeNotchAngleDeg(defaults.notchAngleDeg); onChangeNotchDepthMm(defaults.notchDepthMm)
      onChangeLineToolConstraint(defaults.lineToolConstraint); onChangeRelativeAngleStepDeg(defaults.relativeAngleStepDeg)
      onChangeArcDrawMode(defaults.arcDrawMode); onChangeArcRadiusMm(defaults.arcRadiusMm); onChangeArcHalfMoonRatio(defaults.arcHalfMoonRatio)
      onChangeTangentCircleMode(false); onChangeTangentCircleDispStep(defaults.tangentCircleDispStep); onChangeGridBackgroundMode('theme')
      onChangeDimensionDefaults({ fontSizeMm: 5, precision: 1, arrowOnly: false, singleLine: false, textInside: true, textReverse: false }); onChangeDimensionLineTypeId(null)
    } else if (category === 'stitch') {
      onChangeForceFitLastPrick(false); onChangeAutoPitchSettings(getDefaultStitchAutoPitchSettings()); onChangeBoxStitchHelperSettings(getDefaultBoxStitchHelperSettings())
    } else if (category === 'output') {
      onChangeExportIncludeText(true); onChangeExportIncludeTemplateMetadata(false)
      onChangePrintCalibrationXPercent(100); onChangePrintCalibrationYPercent(100)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label={t('Options')}>
      <div className="modal-content options-modal" role="dialog" aria-modal="true" aria-labelledby="options-dialog-title" ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <h3 id="options-dialog-title">{t('Options')}</h3>
        <OptionsNavigation onResetCategory={resetCategory}>
        <OptionsSection id="input-devices" category="input" searchTerms="wheel zoom pan trackpad sensitivity mouse touch edge pick radius tool order labels"><h4>{t('Input devices and tools')}</h4><InterfacePreferencesPanel /></OptionsSection>

        <OptionsSection id="autosave" category="workspace" scope="Browser preference">
          <h4>{t('Auto-save')}</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => onChangeAutoSaveEnabled(e.target.checked)}
            />
            <span>{t('Periodically snapshot the current project to browser storage')}</span>
          </label>
        </OptionsSection>

        <OptionsSection id="workspace" category="workspace" scope="Pinning: browser preference; auto-hide and startup demo: editor session">
          <h4>{t('Workspace')}</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={autoHideSidebar}
              disabled={pinSideBar}
              onChange={(e) => onChangeAutoHideSidebar(e.target.checked)}
            />
            <span>{t('Auto-hide the inspector sidebar to widen the workspace')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={pinSideBar}
              onChange={(e) => onChangePinSideBar(e.target.checked)}
            />
            <span>{t('Pin sidebar (force-keep the inspector open)')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={loadDemoOnStartup}
              onChange={(e) => onChangeLoadDemoOnStartup(e.target.checked)}
            />
            <span>{t('Load the demo project at startup')}</span>
          </label>
        </OptionsSection>

        <OptionsSection id="editing" category="input" scope="Browser preference">
          <h4>{t('Editing')}</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={incrementalSelection}
              onChange={(e) => onChangeIncrementalSelection(e.target.checked)}
            />
            <span>{t('Incremental selection (click adds to selection without Shift)')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={mentoriWithoutCtrl}
              onChange={(e) => onChangeMentoriWithoutCtrl(e.target.checked)}
            />
            <span>{t('Chamfer (mentori) acts without holding Ctrl')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={continuousDistanceMarking}
              onChange={(e) => onChangeContinuousDistanceMarking(e.target.checked)}
            />
            <span>{t('Continuous distance marking (prompt loops until cancelled)')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={reduceOneBlade}
              onChange={(e) => onChangeReduceOneBlade(e.target.checked)}
            />
            <span>{t('Reduce pricking-iron blade count by one (end-of-stitch helper)')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={highlightActiveLayer}
              onChange={(e) => onChangeHighlightActiveLayer(e.target.checked)}
            />
            <span>{t('Highlight shapes on the active layer')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={fillOnChange}
              onChange={(e) => onChangeFillOnChange(e.target.checked)}
            />
            <span>{t('Auto-fill newly-closed shapes with their line-type color')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={drawEdges}
              onChange={(e) => onChangeDrawEdges(e.target.checked)}
            />
            <span>{t('Overlay cut-edge outlines (red dashed)')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={drawFirstPos}
              onChange={(e) => onChangeDrawFirstPos(e.target.checked)}
            />
            <span>{t('Mark the first stitch hole of each chain')}</span>
          </label>
          <label className="field-row">
            <span>{t('Center-line divisions')}</span>
            <input
              type="number"
              min={1}
              max={64}
              step={1}
              value={centerLineDivisions}
              onChange={(event) =>
                onChangeCenterLineDivisions(Math.max(1, Math.min(64, Math.round(Number(event.target.value) || 2))))
              }
            />
          </label>
          <label className="field-row">
            <span>{t('Default marking distance (mm)').replace('(mm)', `(${unit})`)}</span>
            <LengthInput unit={unit} valueMm={markingDistanceMm} minMm={0.1} onChangeMm={next => { if (Number.isFinite(next) && next >= 0.1) onChangeMarkingDistanceMm(next) }} />
          </label>
          <label className="field-row">
            <span>{t('Mandala circle template name')}</span>
            <input
              type="text"
              value={mandalaCircleTemplateName}
              onChange={(event) => onChangeMandalaCircleTemplateName(event.target.value)}
            />
          </label>
        </OptionsSection>

        <OptionsSection id="notch" category="drawing" scope="Browser preference">
          <h4>{t('Notch (Kama) defaults')}</h4>
          <label className="field-row">
            <span>{t('Notch depth (mm)').replace('(mm)', `(${unit})`)}</span>
            <LengthInput unit={unit} valueMm={notchDepthMm} minMm={0.1} onChangeMm={next => { if (Number.isFinite(next) && next >= 0.1) onChangeNotchDepthMm(next) }} />
          </label>
          <label className="field-row">
            <span>{t('Notch angle (°)')}</span>
            <input
              type="number"
              min={5}
              max={170}
              step={1}
              value={notchAngleDeg}
              onChange={(event) => onChangeNotchAngleDeg(Math.max(5, Math.min(170, Number(event.target.value) || 60)))}
            />
          </label>
        </OptionsSection>

        <OptionsSection id="line" category="drawing" scope="Browser preference">
          <h4>{t('Line tool constraint')}</h4>
          {(['none', 'horizontal', 'vertical', 'relative-angle'] as const).map((mode) => (
            <label className="layer-toggle-item" key={mode}>
              <input
                type="radio"
                name="line-tool-constraint"
                checked={lineToolConstraint === mode}
                onChange={() => onChangeLineToolConstraint(mode)}
              />
              <span>
                {t(mode === 'none'
                  ? 'Free'
                  : mode === 'horizontal'
                    ? 'Horizontal only'
                    : mode === 'vertical'
                      ? 'Vertical only'
                      : 'Relative angle to last line (snaps to N° steps)')}
              </span>
            </label>
          ))}
          {lineToolConstraint === 'relative-angle' ? (
            <label className="field-row">
              <span>{t('Angle step (°)')}</span>
              <input
                type="number"
                min={1}
                max={180}
                step={1}
                value={relativeAngleStepDeg}
                onChange={(event) => onChangeRelativeAngleStepDeg(Math.max(1, Math.min(180, Number(event.target.value) || 15)))}
              />
            </label>
          ) : null}
        </OptionsSection>

        <OptionsSection id="arc" category="drawing" scope="Browser preference">
          <h4>{t('Arc tool')}</h4>
          {(['three-point', 'radius', 'half-moon'] as const).map((mode) => (
            <label className="layer-toggle-item" key={mode}>
              <input
                type="radio"
                name="arc-draw-mode"
                checked={arcDrawMode === mode}
                onChange={() => onChangeArcDrawMode(mode)}
              />
              <span>
                {t(mode === 'three-point'
                  ? '3-point (click start, mid, end)'
                  : mode === 'radius'
                    ? 'Radius (click start + end, fixed radius)'
                    : 'Half-moon ratio (click start + end, ratio of chord)')}
              </span>
            </label>
          ))}
          {arcDrawMode === 'radius' ? (
            <label className="field-row">
              <span>{t('Arc radius (mm)').replace('(mm)', `(${unit})`)}</span>
              <LengthInput unit={unit} valueMm={arcRadiusMm} minMm={0.5} onChangeMm={next => { if (Number.isFinite(next) && next >= 0.5) onChangeArcRadiusMm(next) }} />
            </label>
          ) : null}
          {arcDrawMode === 'half-moon' ? (
            <label className="field-row">
              <span>{t('Half-moon ratio (height / chord)')}</span>
              <input
                type="number"
                min={0.05}
                max={5}
                step={0.05}
                value={arcHalfMoonRatio}
                onChange={(event) =>
                  onChangeArcHalfMoonRatio(Math.max(0.05, Math.min(5, Number(event.target.value) || 0.5)))
                }
              />
            </label>
          ) : null}
        </OptionsSection>

        <OptionsSection id="tangent-circle" category="drawing" scope="Browser preference">
          <h4>{t('Tangent-circle mode')}</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={tangentCircleMode}
              onChange={(e) => onChangeTangentCircleMode(e.target.checked)}
            />
            <span>{t('Bias drawing toward circle-tangent contact points')}</span>
          </label>
          {tangentCircleMode ? (
            <label className="field-row">
              <span>{t('Display step (segments per circle)')}</span>
              <input
                type="number"
                min={2}
                max={64}
                step={1}
                value={tangentCircleDispStep}
                onChange={(event) =>
                  onChangeTangentCircleDispStep(Math.max(2, Math.min(64, Math.round(Number(event.target.value) || 6))))
                }
              />
            </label>
          ) : null}
        </OptionsSection>

        <OptionsSection id="grid" category="drawing" scope="Editor session">
          <h4>{t('Display and grid')}</h4><label className="field-row"><span>{t('Display units')}</span><select aria-label={t('Display units')} value={unit} onChange={event => { setUnit(event.target.value === 'in' ? 'in' : 'mm'); setMeasuredXMm(''); setMeasuredYMm(''); setCalibrationError('') }}><option value="mm">{t('Millimeters')}</option><option value="in">{t('Inches')}</option></select></label><p>{t('Display units are saved in this browser. Geometry and export dimensions stay in millimetres unless an export format offers its own units.')}</p>
          {(['theme', 'light', 'dark'] as const).map((mode) => (
            <label className="layer-toggle-item" key={mode}>
              <input
                type="radio"
                name="grid-background-mode"
                checked={gridBackgroundMode === mode}
                onChange={() => onChangeGridBackgroundMode(mode)}
              />
              <span>{t(mode === 'theme' ? 'Follow app theme' : mode === 'light' ? 'Light' : 'Dark')}</span>
            </label>
          ))}
        </OptionsSection>

        <OptionsSection id="language" category="language" scope="Browser preference">
          <h4>{t('Language')}</h4>
          <LanguageSelector />
          <p className="hint">
            {translationEntryCount > 0
              ? t('{count} custom translation entries loaded.').replace('{count}', String(translationEntryCount))
              : t('Built-in languages are available immediately. Import TSV or JSON for custom translations.')}
          </p>
          <div className="line-type-modal-actions">
            <button type="button" onClick={onImportTranslationFile}>
              {t('Import Translation File…')}
            </button>
            <button type="button" onClick={onResetTranslation} disabled={translationEntryCount === 0}>
              {t('Clear custom translations')}
            </button>
          </div>
        </OptionsSection>

        <OptionsSection id="zoom" category="input" scope="Browser preference">
          <h4>{t('Zoom & Scroll')}</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={reverseZoomDirection}
              onChange={(e) => onChangeReverseZoomDirection(e.target.checked)}
            />
            <span>{t('Reverse wheel-zoom direction')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={reverseGridScrollDirection}
              onChange={(e) => onChangeReverseGridScrollDirection(e.target.checked)}
            />
            <span>{t('Reverse arrow-key pan direction')}</span>
          </label>
        </OptionsSection>

        <OptionsSection id="svg" category="output" scope="Browser preference">
          <h4>{t('SVG Export')}</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportIncludeText}
              onChange={(e) => onChangeExportIncludeText(e.target.checked)}
            />
            <span>{t('Include text shapes')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportIncludeTemplateMetadata}
              onChange={(e) => onChangeExportIncludeTemplateMetadata(e.target.checked)}
            />
            <span>{t('Include template metadata')}</span>
          </label>
        </OptionsSection>

        <OptionsSection id="dimensions" category="drawing" scope="Editor session">
          <h4>{t('Dimension defaults')}</h4>
          <label className="field-row">
            <span>{t('Line palette for new dimensions')}</span>
            <select
              className="action-select"
              value={dimensionLineTypeId ?? ''}
              onChange={(event) => onChangeDimensionLineTypeId(event.target.value || null)}
            >
              <option value="">{t('Use active line type')}</option>
              {lineTypes.map((lineType) => (
                <option key={lineType.id} value={lineType.id}>
                  {lineType.name}
                </option>
              ))}
            </select>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={dimensionDefaults.arrowOnly}
              onChange={(e) => updateDimensionDefaults('arrowOnly', e.target.checked)}
            />
            <span>{t('Arrow only (no value text)')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={dimensionDefaults.singleLine}
              onChange={(e) => updateDimensionDefaults('singleLine', e.target.checked)}
            />
            <span>{t('Single measure line (do not split around label)')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={dimensionDefaults.textInside}
              onChange={(e) => updateDimensionDefaults('textInside', e.target.checked)}
            />
            <span>{t('Place text inside the dimension line')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={dimensionDefaults.textReverse}
              onChange={(e) => updateDimensionDefaults('textReverse', e.target.checked)}
            />
            <span>{t('Reverse text orientation (180°)')}</span>
          </label>
          <label className="layer-toggle-item">
            <span>{t('Default font size (mm)').replace('(mm)', `(${unit})`)}</span>
            <LengthInput unit={unit} valueMm={dimensionDefaults.fontSizeMm} minMm={1} maxMm={50} onChangeMm={next => { if (Number.isFinite(next) && next >= 1 && next <= 50) updateDimensionDefaults('fontSizeMm', next) }} />
          </label>
          <label className="layer-toggle-item">
            <span>{t('Default precision (decimals)')}</span>
            <input
              type="number"
              min={0}
              max={6}
              step={1}
              value={dimensionDefaults.precision}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10)
                if (Number.isFinite(next) && next >= 0) {
                  updateDimensionDefaults('precision', Math.min(6, next))
                }
              }}
            />
          </label>
          {onOpenDimensionInspector && (
            <button
              type="button"
              onClick={() => {
                onOpenDimensionInspector()
                onClose()
              }}
            >
              {t('Open per-dimension inspector…')}
            </button>
          )}
        </OptionsSection>

        <OptionsSection id="stitch-defaults" category="stitch" scope="Editor session">
          <h4>{t('Stitching defaults')}</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={forceFitLastPrick}
              onChange={(e) => onChangeForceFitLastPrick(e.target.checked)}
            />
            <span>{t('Force last pricking iron tooth to land on path endpoint')}</span>
          </label>
        </OptionsSection>

        <OptionsSection id="auto-pitch" category="stitch" scope="Browser preference">
          <h4>{t('Auto pitch')}</h4>
          <p className="options-modal-hint">
            {t('Default behaviour for the auto-pitch hole solver (used when you draw a stitch line without an explicit pitch override).')}
          </p>
          <div className="control-block">
            <span>{t('Default mode')}</span>
            {(['fixed', 'variable'] as const).map((mode) => (
              <label className="layer-toggle-item" key={mode}>
                <input
                  type="radio"
                  name="auto-pitch-default-mode"
                  checked={autoPitchSettings.defaultMode === mode}
                  onChange={() => updateAutoPitch('defaultMode', mode)}
                />
                <span>
                  {t(mode === 'fixed' ? 'Fixed pitch (every hole equal)' : 'Variable pitch (solver fits start → end)')}
                </span>
              </label>
            ))}
          </div>
          <label className="layer-toggle-item">
            <span>{t('Solver steps')}</span>
            <input
              type="number"
              min={2}
              max={24}
              step={1}
              value={autoPitchSettings.solverSteps}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10)
                if (Number.isFinite(next) && next >= 2) {
                  updateAutoPitch('solverSteps', Math.min(24, Math.max(2, next)))
                }
              }}
            />
          </label>
          <label className="layer-toggle-item">
            <span>{t('Precision (mm)').replace('(mm)', `(${unit})`)}</span>
            <LengthInput unit={unit} valueMm={autoPitchSettings.precisionMm} minMm={0.01} maxMm={5} onChangeMm={next => { if (Number.isFinite(next) && next >= 0.01 && next <= 5) updateAutoPitch('precisionMm', next) }} />
          </label>
          <label className="layer-toggle-item">
            <span>{t('Stop gap allowance (mm)').replace('(mm)', `(${unit})`)}</span>
            <LengthInput unit={unit} valueMm={autoPitchSettings.stopGapMm} minMm={0.1} maxMm={25} onChangeMm={next => { if (Number.isFinite(next) && next >= 0.1 && next <= 25) updateAutoPitch('stopGapMm', next) }} />
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={autoPitchSettings.continueFromSelectedHole}
              onChange={(e) => updateAutoPitch('continueFromSelectedHole', e.target.checked)}
            />
            <span>{t('Continue from the selected hole when re-running auto pitch')}</span>
          </label>
        </OptionsSection>

        <OptionsSection id="box-stitch" category="stitch" scope="Browser preference">
          <h4>{t('Box stitch helper')}</h4>
          <p className="options-modal-hint">
            {t('Defaults used when opening the box stitch helper. Search distance gates how far guide candidates are accepted from a piece edge.')}
          </p>
          <label className="layer-toggle-item">
            <span>{t('Search distance (mm)').replace('(mm)', `(${unit})`)}</span>
            <LengthInput unit={unit} valueMm={boxStitchHelperSettings.distanceMm} minMm={0.1} maxMm={50} onChangeMm={next => { if (Number.isFinite(next) && next >= 0.1 && next <= 50) updateBoxStitchHelper('distanceMm', next) }} />
          </label>
          <label className="layer-toggle-item">
            <span>{t('Stretch compensation (%)')}</span>
            <input
              type="number"
              min={25}
              max={250}
              step={1}
              value={boxStitchHelperSettings.stretchCompensationPercent}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  updateBoxStitchHelper(
                    'stretchCompensationPercent',
                    Math.min(250, Math.max(25, next)),
                  )
                }
              }}
            />
          </label>
        </OptionsSection>

        <OptionsSection id="print" category="output" scope="Editor session">
          <h4>{t('Print calibration')}</h4>
          <p className="options-modal-hint">
            {t('Compensate for printer scale errors. 100 % matches the ruler test square exactly.')}
          </p>
          <label className="layer-toggle-item">
            <span>{t('X-axis calibration (%)')}</span>
            <input
              type="number"
              min={50}
              max={150}
              step={0.1}
              value={printCalibrationXPercent}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  onChangePrintCalibrationXPercent(next)
                }
              }}
            />
          </label>
          <label className="layer-toggle-item">
            <span>{t('Y-axis calibration (%)')}</span>
            <input
              type="number"
              min={50}
              max={150}
              step={0.1}
              value={printCalibrationYPercent}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  onChangePrintCalibrationYPercent(next)
                }
              }}
            />
          </label>

          <div className="control-block">
            <h4>{t('Derive from measured length')}</h4>{calibrationError && <p role="alert">{calibrationError}</p>}
            <p className="options-modal-hint">
              {t('Print a known reference (default 100 mm), measure it with a ruler, enter the measured X/Y here, then press Apply to update the corresponding calibration percentage.')}
            </p>
            <label className="layer-toggle-item">
              <span>{t('Reference length (mm)').replace('(mm)', `(${unit})`)}</span>
              <LengthInput unit={unit} valueMm={calibrationReferenceMm} minMm={0.1} onChangeMm={next => { if (Number.isFinite(next) && next >= 0.1) setCalibrationReferenceMm(next) }} />
            </label>
            <label className="layer-toggle-item">
              <span>{t('Measured X length (mm)').replace('(mm)', `(${unit})`)}</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={measuredXMm}
                onChange={(e) => setMeasuredXMm(e.target.value)}
              />
              <button type="button" onClick={() => applyCalibrationFromMeasured('x')}>
                {t('Apply X')}
              </button>
            </label>
            <label className="layer-toggle-item">
              <span>{t('Measured Y length (mm)').replace('(mm)', `(${unit})`)}</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={measuredYMm}
                onChange={(e) => setMeasuredYMm(e.target.value)}
              />
              <button type="button" onClick={() => applyCalibrationFromMeasured('y')}>
                {t('Apply Y')}
              </button>
            </label>
          </div>
        </OptionsSection>

        </OptionsNavigation>
        <div className="modal-actions">
          <button onClick={onClose}>{t('Close')}</button>
        </div>
      </div>
    </div>
  )
}
