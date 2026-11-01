import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { StitchHoleRenderShape, Tool } from '../cad/cad-types'
import { toolLabel } from '../editor-utils'
import { useTranslate } from '../hooks/useTranslate'
import { requestSelectionGeometryFocus } from '../ops/selection-geometry-focus'
import { saveEditorPreferences } from '../ops/editor-prefs'
import { evaluateNumericExpression, isComputedExpression } from '../ops/numeric-expression'
import { TOOL_IDLE_HINTS, toolShortcutLabel } from '../ops/tool-shortcuts'
import { fromDisplayValue, toDisplayValue, type DisplayUnit } from '../ops/unit-ops'
import { useEditorToolActions, useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
import { useEditorUIActions, useEditorUISelector } from '../state/providers/EditorUIStateProvider'
import type { ContextMenuItem } from './CanvasContextMenu'
import { buildArmedCommand, type Armed } from '../ops/tool-option-commands'

type ToolOptionsBarProps = {
  displayUnit: DisplayUnit
  selectedShapeIdSet: Set<string>
  /** Runs a command-line command; returns the status text. */
  onRunCommand: (command: string) => string
  buildSelectionActions?: () => ContextMenuItem[]
}

type FieldProps = {
  label: string
  /** Current value in field units, or null when the field is free. */
  value: number | null
  unit?: string
  /** Display unit used to convert unit suffixes; null for unitless values. */
  lengthUnit?: DisplayUnit | null
  placeholder?: string
  min?: number
  testId?: string
  /** Relative fields (rotate by, scale by) return to their resting value after applying. */
  resetAfterCommit?: boolean
  onCommit: (value: number | null) => void
}

const formatNumber = (value: number) => String(Number(value.toFixed(4)))

/** Compact numeric field: accepts arithmetic, commits on Enter/blur, Escape reverts. */
export function ExpressionField({ label, value, unit, lengthUnit = null, placeholder, min, testId, resetAfterCommit = false, onCommit }: FieldProps) {
  const id = useId()
  const t = useTranslate()
  const shown = value === null ? '' : formatNumber(value)
  const [text, setText] = useState(shown)
  const [syncedFrom, setSyncedFrom] = useState(shown)
  if (syncedFrom !== shown) {
    setSyncedFrom(shown)
    setText(shown)
  }
  const evaluated = text.trim() === '' ? null : evaluateNumericExpression(text, lengthUnit)
  const invalid = text.trim() !== '' && (evaluated === null || (min !== undefined && evaluated < min))
  const commit = () => {
    if (invalid) return
    if (evaluated === null) {
      if (value !== null) onCommit(null)
      return
    }
    if (value === null || Math.abs(evaluated - value) > 1e-9) onCommit(evaluated)
    setText(resetAfterCommit ? shown : formatNumber(evaluated))
  }
  return (
    <label className={`tool-option-field${invalid ? ' invalid' : ''}`} htmlFor={id}>
      <span>{t(label)}</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        data-testid={testId}
        value={text}
        placeholder={placeholder ? t(placeholder) : undefined}
        aria-invalid={invalid}
        title={evaluated !== null && isComputedExpression(text) ? `= ${formatNumber(evaluated)}` : t('Accepts arithmetic and units, e.g. 100/3 or 5/32in')}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setText(shown)
            event.currentTarget.blur()
          }
        }}
      />
      {unit && <span className="tool-option-unit">{unit}</span>}
    </label>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <div className="tool-option-group">{children}</div>
}

const HOLE_SHAPES: Array<{ value: StitchHoleRenderShape; label: string }> = [
  { value: 'round', label: 'Round' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'french', label: 'European' },
  { value: 'flat', label: 'Flat' },
  { value: 'slit', label: 'Slit' },
]

/**
 * Per-tool parameter bar above the drawing area (the reference editor's top
 * bar). Shape sizes typed here finish the shape at the first click, or at once
 * when a shape is already in progress; they go through the same command path as
 * the command line.
 */
export function ToolOptionsBar({ displayUnit, selectedShapeIdSet, onRunCommand, buildSelectionActions }: ToolOptionsBarProps) {
  const selectionCount = selectedShapeIdSet.size
  const t = useTranslate()
  const { tool, draftPointCount, textDraftValue, textFontFamily, textFontSizeMm, stitchHoleDefaults } = useEditorToolSelector((state) => ({
    tool: state.tool,
    draftPointCount: state.draftPoints.length,
    textDraftValue: state.textDraftValue,
    textFontFamily: state.textFontFamily,
    textFontSizeMm: state.textFontSizeMm,
    stitchHoleDefaults: state.stitchHoleDefaults,
  }))
  const toolActions = useEditorToolActions()
  const ui = useEditorUISelector((state) => ({
    lineToolConstraint: state.lineToolConstraint,
    relativeAngleStepDeg: state.relativeAngleStepDeg,
    arcDrawMode: state.arcDrawMode,
    arcRadiusMm: state.arcRadiusMm,
    arcHalfMoonRatio: state.arcHalfMoonRatio,
    notchDepthMm: state.notchDepthMm,
    notchAngleDeg: state.notchAngleDeg,
    fontList: state.fontList,
  }))
  const uiActions = useEditorUIActions()
  const [armed, setArmed] = useState<Armed>({})
  const [result, setResult] = useState<{ tool: Tool; text: string } | null>(null)
  const lastResult = result?.tool === tool ? result.text : null
  const setLastResult = (text: string) => setResult({ tool, text })
  const previousDraftCount = useRef(draftPointCount)
  const unitLabel = displayUnit === 'in' ? 'in' : 'mm'
  const toDisplay = (mm: number) => toDisplayValue(mm, displayUnit)
  const fromDisplay = (value: number) => fromDisplayValue(value, displayUnit)

  // Typed sizes complete the shape as soon as its first point is placed.
  useEffect(() => {
    const started = previousDraftCount.current === 0 && draftPointCount === 1
    previousDraftCount.current = draftPointCount
    if (!started) return
    const command = buildArmedCommand(tool, armed)
    if (!command) return
    const text = onRunCommand(command)
    queueMicrotask(() => setResult({ tool, text }))
  }, [armed, draftPointCount, onRunCommand, tool])

  const arm = (key: keyof Armed) => (value: number | null) => {
    const next = { ...armed, [key]: value === null ? null : fromDisplay(value) }
    if (key === 'angle') next.angle = value
    setArmed(next)
    if (draftPointCount === 1) {
      const command = buildArmedCommand(tool, next)
      if (command) setLastResult(onRunCommand(command))
    }
  }
  const armedDisplay = (key: keyof Armed) => {
    const value = armed[key]
    if (typeof value !== 'number') return null
    return key === 'angle' ? value : toDisplay(value)
  }
  const sizeField = (key: keyof Armed, label: string, testId: string) => (
    <ExpressionField key={key} label={label} value={armedDisplay(key)} unit={unitLabel} lengthUnit={displayUnit} placeholder="free" min={0} testId={testId} onCommit={arm(key)} />
  )

  let body: ReactNode = null
  if (tool === 'line') {
    body = <>
      <Group>
        {sizeField('length', 'Length', 'tool-option-length')}
        <ExpressionField label="Angle" value={armedDisplay('angle')} unit="°" placeholder="free" testId="tool-option-angle" onCommit={arm('angle')} />
      </Group>
      <Group>
        <label className="tool-option-field">
          <span>{t('Constraint')}</span>
          <select
            value={ui.lineToolConstraint}
            onChange={(event) => {
              const value = event.target.value as typeof ui.lineToolConstraint
              uiActions.setLineToolConstraint(value)
              saveEditorPreferences({ lineToolConstraint: value })
            }}
          >
            <option value="none">{t('Free')}</option>
            <option value="horizontal">{t('Horizontal')}</option>
            <option value="vertical">{t('Vertical')}</option>
            <option value="relative-angle">{t('Angle snap')}</option>
          </select>
        </label>
        {ui.lineToolConstraint === 'relative-angle' && (
          <ExpressionField
            label="Step"
            value={ui.relativeAngleStepDeg}
            unit="°"
            min={1}
            onCommit={(value) => {
              if (value === null) return
              uiActions.setRelativeAngleStepDeg(value)
              saveEditorPreferences({ relativeAngleStepDeg: value })
            }}
          />
        )}
      </Group>
    </>
  } else if (tool === 'rectangle') {
    body = <Group>{sizeField('width', 'Width', 'tool-option-width')}{sizeField('height', 'Height', 'tool-option-height')}</Group>
  } else if (tool === 'circle') {
    body = <Group>{sizeField('radius', 'Radius', 'tool-option-radius')}</Group>
  } else if (tool === 'ellipse') {
    body = <Group>{sizeField('radiusX', 'Radius X', 'tool-option-radius-x')}{sizeField('radiusY', 'Radius Y', 'tool-option-radius-y')}</Group>
  } else if (tool === 'arc') {
    body = <Group>
      <label className="tool-option-field">
        <span>{t('Mode')}</span>
        <select
          value={ui.arcDrawMode}
          onChange={(event) => {
            const value = event.target.value as typeof ui.arcDrawMode
            uiActions.setArcDrawMode(value)
            saveEditorPreferences({ arcDrawMode: value })
          }}
        >
          <option value="three-point">{t('3 points')}</option>
          <option value="radius">{t('Fixed radius')}</option>
          <option value="half-moon">{t('Half-moon')}</option>
        </select>
      </label>
      {ui.arcDrawMode === 'radius' && (
        <ExpressionField label="Radius" value={toDisplay(ui.arcRadiusMm)} unit={unitLabel} lengthUnit={displayUnit} min={0.01} onCommit={(value) => {
          if (value === null) return
          uiActions.setArcRadiusMm(fromDisplay(value))
          saveEditorPreferences({ arcRadiusMm: fromDisplay(value) })
        }} />
      )}
      {ui.arcDrawMode === 'half-moon' && (
        <ExpressionField label="Ratio" value={ui.arcHalfMoonRatio} min={0.01} onCommit={(value) => {
          if (value === null) return
          uiActions.setArcHalfMoonRatio(value)
          saveEditorPreferences({ arcHalfMoonRatio: value })
        }} />
      )}
    </Group>
  } else if (tool === 'text') {
    body = <Group>
      <label className="tool-option-field tool-option-wide">
        <span>{t('Text')}</span>
        <input type="text" value={textDraftValue} onChange={(event) => toolActions.setTextDraftValue(event.target.value)} />
      </label>
      <ExpressionField label="Size" value={toDisplay(textFontSizeMm)} unit={unitLabel} lengthUnit={displayUnit} min={0.1} onCommit={(value) => {
        if (value !== null) toolActions.setTextFontSizeMm(fromDisplay(value))
      }} />
      <label className="tool-option-field">
        <span>{t('Font')}</span>
        <select value={textFontFamily} onChange={(event) => toolActions.setTextFontFamily(event.target.value)}>
          {[...new Set([textFontFamily, ...ui.fontList])].map((font) => <option key={font} value={font}>{font.split(',')[0]}</option>)}
        </select>
      </label>
    </Group>
  } else if (tool === 'stitch-hole') {
    const shape = stitchHoleDefaults.renderShape ?? (stitchHoleDefaults.holeType === 'slit' ? 'slit' : 'round')
    body = <>
      <Group>
        <label className="tool-option-field">
          <span>{t('Hole')}</span>
          <select
            value={shape}
            onChange={(event) => {
              const renderShape = event.target.value as StitchHoleRenderShape
              toolActions.setStitchHoleDefaults((previous) => ({ ...previous, renderShape, holeType: renderShape === 'slit' ? 'slit' : 'round' }))
            }}
          >
            {HOLE_SHAPES.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
          </select>
        </label>
        <ExpressionField label="Size" value={toDisplay(stitchHoleDefaults.diameterMm ?? 1.2)} unit={unitLabel} lengthUnit={displayUnit} min={0.05} onCommit={(value) => {
          if (value === null) return
          const sizeMm = fromDisplay(value)
          toolActions.setStitchHoleDefaults((previous) => ({ ...previous, diameterMm: sizeMm, widthMm: sizeMm, heightMm: sizeMm }))
        }} />
      </Group>
      <span className="tool-option-note">{t('To stitch a whole path, select it and use Stitch › Fixed, Var or Count.')}</span>
    </>
  } else if (tool === 'piece-notch') {
    body = <Group>
      <ExpressionField label="Depth" value={toDisplay(ui.notchDepthMm)} unit={unitLabel} lengthUnit={displayUnit} min={0.01} onCommit={(value) => {
        if (value === null) return
        uiActions.setNotchDepthMm(fromDisplay(value))
        saveEditorPreferences({ notchDepthMm: fromDisplay(value) })
      }} />
      <ExpressionField label="Angle" value={ui.notchAngleDeg} unit="°" min={1} onCommit={(value) => {
        if (value === null) return
        uiActions.setNotchAngleDeg(value)
        saveEditorPreferences({ notchAngleDeg: value })
      }} />
    </Group>
  } else if (tool === 'pan' && selectionCount > 0) {
    const actions = (buildSelectionActions?.() ?? []).filter((action) => action.bar)
    body = <>
      <span className="tool-option-note">{t('{count} selected').replace('{count}', String(selectionCount))}</span>
      <Group>
        <button type="button" onClick={requestSelectionGeometryFocus}>{t('Size & position')}</button>
        {actions.map((action) => (
          <button key={action.id} type="button" disabled={action.disabled} onClick={action.onSelect}>{t(action.label)}</button>
        ))}
      </Group>
    </>
  }

  if ((tool === 'polyline' || tool === 'cut-line' || tool === 'bezier' || tool === 'cubic' || tool === 'freehand') && draftPointCount > 0) {
    body = <>
      {body}
      <Group>
        <button type="button" onClick={() => setLastResult(onRunCommand('finish'))}>{t('Finish')}</button>
        <button type="button" onClick={() => { toolActions.clearDraft(); setLastResult(t('Shape in progress cancelled')) }}>{t('Cancel')}</button>
      </Group>
    </>
  }

  const shortcut = toolShortcutLabel(tool)
  return (
    <div className="tool-options-bar" role="toolbar" aria-label={t('Tool options')} data-testid="tool-options-bar">
      <span className="tool-options-name" title={shortcut ? `${t(toolLabel(tool))} (${shortcut})` : undefined}>{t(toolLabel(tool))}</span>
      {body ?? <span className="tool-option-note">{t(TOOL_IDLE_HINTS[tool])}</span>}
      {lastResult && <span className="tool-option-result" role="status">{t(lastResult)}</span>}
    </div>
  )
}
