import { useEffect, useMemo, useRef, useState } from 'react'
import { ExpressionField } from '../components/ToolOptionsBar'
import { useTranslate } from '../hooks/useTranslate'
import { useInterfacePreferences } from '../ops/interface-preferences'
import { FOCUS_SELECTION_GEOMETRY_EVENT } from '../ops/selection-geometry-focus'
import { boxToBoxMapper, fitSelectionToBox, lineEndFor, lineLengthAngle, selectionBox, type BoxTarget } from '../ops/selection-geometry'
import { getSelectionCenter, rotatePointAround, scalePointFrom, transformSelectedStitchHoles } from '../ops/shape-selection-ops'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import { rotateSelectionAround, scaleSelectionNonUniform } from '../ops/transform-ops'
import { fromDisplayValue, toDisplayValue } from '../ops/unit-ops'
import { useEditorDocumentActions, useEditorDocumentSelector } from '../state/providers/EditorDocumentStateProvider'
import { useEditorSelectionSelector } from '../state/providers/EditorSelectionStateProvider'
import { useEditorUIActions, useEditorUISelector } from '../state/providers/EditorUIStateProvider'

/**
 * Numeric position and size of the selection (the reference editor's "Shape
 * position & size" palette): bounding-box X/Y/W/H with keep-aspect, relative
 * rotate and scale, and length/angle for a single line. Each edit is one change.
 */
export function SelectionGeometryControls() {
  const t = useTranslate()
  const shapes = useEditorDocumentSelector((state) => state.shapes)
  const selectedIds = useEditorSelectionSelector((state) => state.selectedShapeIds)
  const { setShapes, setStitchHoles } = useEditorDocumentActions()
  const { displayUnit, customRotationPivot } = useEditorUISelector((state) => ({ displayUnit: state.displayUnit, customRotationPivot: state.customRotationPivot }))
  const { setStatus } = useEditorUIActions()
  const { invertYAxis } = useInterfacePreferences()
  const [keepAspect, setKeepAspect] = useState(true)
  const firstFieldRef = useRef<HTMLDivElement>(null)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const box = useMemo(() => selectionBox(shapes, selectedSet), [selectedSet, shapes])
  const singleLine = useMemo(() => {
    if (selectedIds.length !== 1) return null
    const shape = shapes.find((item) => item.id === selectedIds[0])
    return shape?.type === 'line' ? shape : null
  }, [selectedIds, shapes])

  useEffect(() => {
    const onFocus = (event: Event) => {
      const input = firstFieldRef.current?.querySelector('input')
      if (!input) return
      event.preventDefault()
      input.focus()
      input.select()
    }
    window.addEventListener(FOCUS_SELECTION_GEOMETRY_EVENT, onFocus)
    return () => window.removeEventListener(FOCUS_SELECTION_GEOMETRY_EVENT, onFocus)
  }, [])

  if (!box) return null
  const unit = displayUnit === 'in' ? 'in' : 'mm'
  const show = (mm: number) => toDisplayValue(mm, displayUnit)
  const width = box.maxX - box.minX
  const height = box.maxY - box.minY
  // With Y inverted (counting upward) the reported Y is the box's bottom edge.
  const displayY = invertYAxis ? -box.maxY : box.minY

  const applyBox = (target: BoxTarget, message: string) => {
    const mapper = boxToBoxMapper(box, target)
    setShapes((previous) => fitSelectionToBox(previous, selectedSet, target))
    setStitchHoles((previous) => normalizeStitchHoleSequences(transformSelectedStitchHoles(previous, selectedSet, mapper.map)))
    setStatus(message)
  }
  const setPosition = (axis: 'x' | 'y') => (value: number | null) => {
    if (value === null) return
    const mm = fromDisplayValue(value, displayUnit)
    const minY = axis === 'y' ? (invertYAxis ? -mm - height : mm) : box.minY
    applyBox({ minX: axis === 'x' ? mm : box.minX, minY, width, height }, 'Moved selection')
  }
  const setSize = (axis: 'width' | 'height') => (value: number | null) => {
    if (value === null || value <= 0) return
    const mm = fromDisplayValue(value, displayUnit)
    let nextWidth = axis === 'width' ? mm : width
    let nextHeight = axis === 'height' ? mm : height
    if (keepAspect) {
      if (axis === 'width' && width > 1e-9) nextHeight = height * (mm / width)
      if (axis === 'height' && height > 1e-9) nextWidth = width * (mm / height)
    }
    // Keep the edge that Y is measured from in place.
    const minY = invertYAxis ? box.maxY - nextHeight : box.minY
    applyBox({ minX: box.minX, minY, width: nextWidth, height: nextHeight }, `Resized selection to ${nextWidth.toFixed(2)} × ${nextHeight.toFixed(2)} mm`)
  }
  const pivot = customRotationPivot ?? getSelectionCenter(shapes, selectedSet)
  const rotateBy = (value: number | null) => {
    if (value === null || !pivot || Math.abs(value) < 1e-9) return
    // Positive angles turn counter-clockwise on screen; world Y points down.
    const worldAngle = -value
    const radians = (worldAngle * Math.PI) / 180
    setShapes((previous) => rotateSelectionAround(previous, selectedSet, worldAngle, pivot))
    setStitchHoles((previous) => normalizeStitchHoleSequences(transformSelectedStitchHoles(previous, selectedSet, (point) => rotatePointAround(point, pivot, radians))))
    setStatus(`Rotated selection by ${value}°`)
  }
  const scaleBy = (value: number | null) => {
    if (value === null || value <= 0 || !pivot || Math.abs(value - 100) < 1e-9) return
    const factor = value / 100
    setShapes((previous) => scaleSelectionNonUniform(previous, selectedSet, factor, factor, pivot))
    setStitchHoles((previous) => normalizeStitchHoleSequences(transformSelectedStitchHoles(previous, selectedSet, (point) => scalePointFrom(point, pivot, factor))))
    setStatus(`Scaled selection by ${value}%`)
  }
  const line = singleLine ? lineLengthAngle(singleLine) : null
  const setLine = (length: number, angleDeg: number) => {
    if (!singleLine || !(length > 0)) return
    const end = lineEndFor(singleLine.start, length, angleDeg)
    setShapes((previous) => previous.map((shape) => (shape.id === singleLine.id && shape.type === 'line' ? { ...shape, end } : shape)))
    setStatus('Line updated')
  }

  return (
    <div className="control-block selection-geometry" data-testid="selection-geometry">
      <h3>{t('Position & size')}</h3>
      <div className="selection-geometry-grid">
        <div ref={firstFieldRef}>
          <ExpressionField label="X" value={show(box.minX)} unit={unit} lengthUnit={displayUnit} testId="selection-geometry-x" onCommit={setPosition('x')} />
        </div>
        <ExpressionField label="Y" value={show(displayY)} unit={unit} lengthUnit={displayUnit} testId="selection-geometry-y" onCommit={setPosition('y')} />
        <ExpressionField label="W" value={show(width)} unit={unit} lengthUnit={displayUnit} min={0} testId="selection-geometry-width" onCommit={setSize('width')} />
        <ExpressionField label="H" value={show(height)} unit={unit} lengthUnit={displayUnit} min={0} testId="selection-geometry-height" onCommit={setSize('height')} />
      </div>
      <label className="selection-geometry-check">
        <input type="checkbox" checked={keepAspect} onChange={(event) => setKeepAspect(event.target.checked)} />
        <span>{t('Keep aspect')}</span>
      </label>
      <div className="selection-geometry-grid">
        <ExpressionField label="Rotate" value={0} unit="°" testId="selection-geometry-rotate" resetAfterCommit onCommit={rotateBy} />
        <ExpressionField label="Scale" value={100} unit="%" min={0.001} testId="selection-geometry-scale" resetAfterCommit onCommit={scaleBy} />
        {line && (
          <>
            <ExpressionField label="Length" value={show(line.length)} unit={unit} lengthUnit={displayUnit} min={0} testId="selection-geometry-length" onCommit={(value) => value !== null && setLine(fromDisplayValue(value, displayUnit), line.angleDeg)} />
            <ExpressionField label="Angle" value={line.angleDeg} unit="°" testId="selection-geometry-angle" onCommit={(value) => value !== null && setLine(line.length, value)} />
          </>
        )}
      </div>
      <p className="hint">{t('Rotate and Scale apply relative to the pivot. Fields accept arithmetic such as 100/3 or 5/32in.')}</p>
    </div>
  )
}
