import { useRef, useState } from 'react'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { useTranslate } from '../hooks/useTranslate'
import { useOptionalDisplayUnit } from '../state/providers/EditorUIStateProvider'
import { LengthInput } from './LengthInput'
import type { MandalaSettings, GoldenSpiralParams } from '../ops/mandala-ops'

type MandalaTab = 'radial' | 'spiral' | 'golden' | 'silver' | 'mirror'

type MandalaModalProps = {
  open: boolean
  onClose: () => void
  onGenerateRadial: (settings: MandalaSettings) => void
  onGenerateSpiral: (params: GoldenSpiralParams) => void
  onGenerateGoldenGuides: (center: { x: number; y: number }, size: number) => void
  onGenerateWhiteSilverGuides: (center: { x: number; y: number }, size: number) => void
  onMirrorSelectionAcrossAxis?: (axisAngleDeg: number) => void
  onUseSelectionAsCenter?: () => { x: number; y: number } | null
  onGenerateIntersections?: () => void
  onClearIntersections?: () => void
  onOpenHelp?: () => void
  selectedShapeCount?: number
  defaultLayerId: string
  defaultLineTypeId: string
  circleTemplateName?: string
  onChangeCircleTemplateName?: (value: string) => void
}

export function MandalaModal({
  open,
  onClose,
  onGenerateRadial,
  onGenerateSpiral,
  onGenerateGoldenGuides,
  onGenerateWhiteSilverGuides,
  onMirrorSelectionAcrossAxis,
  onUseSelectionAsCenter,
  onGenerateIntersections,
  onClearIntersections,
  onOpenHelp,
  selectedShapeCount = 0,
  defaultLayerId,
  defaultLineTypeId,
  circleTemplateName = 'Mandala Section',
  onChangeCircleTemplateName,
}: MandalaModalProps) {
  const t = useTranslate()
  const [unit] = useOptionalDisplayUnit()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open, onClose })
  const [activeTab, setActiveTab] = useState<MandalaTab>('radial')
  const [mirrorAxisAngleDeg, setMirrorAxisAngleDeg] = useState(0)

  // Radial Symmetry state
  const [segmentCount, setSegmentCount] = useState(8)
  const [radialCenterX, setRadialCenterX] = useState(0)
  const [radialCenterY, setRadialCenterY] = useState(0)
  const [radius, setRadius] = useState(100)
  const [mirrorSegments, setMirrorSegments] = useState(false)
  const [relativeDiameterPercent, setRelativeDiameterPercent] = useState(100)
  const [includeCircleTemplate, setIncludeCircleTemplate] = useState(true)
  const [includeDivisionLines, setIncludeDivisionLines] = useState(true)
  const [rotationDeg, setRotationDeg] = useState(0)
  const [noIntersectionCalc, setNoIntersectionCalc] = useState(false)

  // Golden Spiral state
  const [spiralCenterX, setSpiralCenterX] = useState(0)
  const [spiralCenterY, setSpiralCenterY] = useState(0)
  const [startRadius, setStartRadius] = useState(10)
  const [turns, setTurns] = useState(4)

  // Golden Ratio state
  const [goldenCenterX, setGoldenCenterX] = useState(0)
  const [goldenCenterY, setGoldenCenterY] = useState(0)
  const [goldenSize, setGoldenSize] = useState(200)

  const validRadial = Number.isInteger(segmentCount) && segmentCount >= 2 && segmentCount <= 360 && Number.isFinite(radialCenterX) && Number.isFinite(radialCenterY) && Number.isFinite(radius) && radius > 0 && Number.isFinite(rotationDeg) && Number.isFinite(relativeDiameterPercent) && relativeDiameterPercent > 0
  const validSpiral = Number.isFinite(spiralCenterX) && Number.isFinite(spiralCenterY) && Number.isFinite(startRadius) && startRadius > 0 && Number.isInteger(turns) && turns >= 1 && turns <= 30
  const validGuides = Number.isFinite(goldenCenterX) && Number.isFinite(goldenCenterY) && Number.isFinite(goldenSize) && goldenSize > 0
  const validMirror = Number.isFinite(mirrorAxisAngleDeg)
  const validCurrent = activeTab === 'radial' ? validRadial : activeTab === 'spiral' ? validSpiral : activeTab === 'mirror' ? validMirror : validGuides

  if (!open) {
    return null
  }

  function handleGenerateRadial() {
    if (!validRadial) return
    onGenerateRadial({
      segmentCount,
      center: { x: radialCenterX, y: radialCenterY },
      radius,
      mirrorSegments,
      relativeDiameterPercent,
      includeCircleTemplate,
      includeDivisionLines,
      rotationDeg,
      noIntersectionCalc,
    })
  }

  function applySelectionCenter() {
    const center = onUseSelectionAsCenter?.()
    if (!center) return
    setRadialCenterX(center.x)
    setRadialCenterY(center.y)
    setSpiralCenterX(center.x)
    setSpiralCenterY(center.y)
    setGoldenCenterX(center.x)
    setGoldenCenterY(center.y)
  }

  function handleGenerateSpiral() {
    if (!validSpiral) return
    onGenerateSpiral({
      center: { x: spiralCenterX, y: spiralCenterY },
      startRadius,
      turns,
      layerId: defaultLayerId,
      lineTypeId: defaultLineTypeId,
    })
  }

  function handleGenerateGolden() {
    if (!validGuides) return
    onGenerateGoldenGuides({ x: goldenCenterX, y: goldenCenterY }, goldenSize)
  }

  function handleGenerateSilver() {
    if (!validGuides) return
    onGenerateWhiteSilverGuides({ x: goldenCenterX, y: goldenCenterY }, goldenSize)
  }

  function handleApplyMirror() {
    if (onMirrorSelectionAcrossAxis && validMirror) {
      onMirrorSelectionAcrossAxis(mirrorAxisAngleDeg)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Mandala and Golden Ratio Tools">
      <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="mandala-title" tabIndex={-1} ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <h3 id="mandala-title">{t('Mandala / Golden Ratio')}</h3>
        <p>{t('Lengths use the selected display unit; geometry is stored in millimetres.')} ({unit})</p>
        {!validCurrent && <p role="alert">{t('Enter finite coordinates and positive lengths. Radial divisions must be 2–360; spiral turns must be 1–30.')}</p>}

        <div className="button-row">
          <button
            className={activeTab === 'radial' ? 'active' : ''}
            onClick={() => setActiveTab('radial')}
          >
            Radial Symmetry
          </button>
          <button
            className={activeTab === 'spiral' ? 'active' : ''}
            onClick={() => setActiveTab('spiral')}
          >
            Golden Spiral
          </button>
          <button
            className={activeTab === 'golden' ? 'active' : ''}
            onClick={() => setActiveTab('golden')}
          >
            Golden Ratio
          </button>
          <button
            className={activeTab === 'silver' ? 'active' : ''}
            onClick={() => setActiveTab('silver')}
          >
            White-Silver
          </button>
          <button
            className={activeTab === 'mirror' ? 'active' : ''}
            onClick={() => setActiveTab('mirror')}
          >
            Mirror Item
          </button>
          {onOpenHelp && <button onClick={onOpenHelp}>{t('Help')}</button>}
        </div>

        {activeTab === 'radial' && (
          <>
            <label className="field-row">
              <span>{t('Segments')}</span>
              <input
                type="range"
                min={4}
                max={36}
                step={1}
                value={segmentCount}
                onChange={(e) => setSegmentCount(Number(e.target.value))}
              />
              <span>{segmentCount}</span>
            </label>

            <label className="field-row">
              <span>{t('Center X')}</span>
              <LengthInput unit={unit} valueMm={radialCenterX} onChangeMm={setRadialCenterX} />
            </label>

            <label className="field-row">
              <span>{t('Center Y')}</span>
              <LengthInput unit={unit} valueMm={radialCenterY} onChangeMm={setRadialCenterY} />
            </label>

            <label className="field-row">
              <span>{t('Radius')} ({unit})</span>
              <LengthInput unit={unit} valueMm={radius} onChangeMm={setRadius} minMm={1} />
            </label>

            <label className="field-row">
              <span>{t('Rotation (°)')}</span>
              <input
                type="number"
                step={1}
                value={rotationDeg}
                onChange={(e) => setRotationDeg(Number(e.target.value))}
              />
            </label>

            <label className="field-row">
              <span>{t('Relative diameter (%)')}</span>
              <input
                type="number"
                min={1}
                max={400}
                step={1}
                value={relativeDiameterPercent}
                onChange={(e) => setRelativeDiameterPercent(Number(e.target.value))}
              />
            </label>

            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={mirrorSegments}
                onChange={(e) => setMirrorSegments(e.target.checked)}
              />
              <span>{t('Mirror alternating segments')}</span>
            </label>

            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={includeCircleTemplate}
                onChange={(e) => setIncludeCircleTemplate(e.target.checked)}
              />
              <span>{t('Circle template')}</span>
            </label>
            {includeCircleTemplate ? (
              <label className="field-row">
                <span>{t('Template name')}</span>
                <input
                  type="text"
                  value={circleTemplateName}
                  onChange={(event) => onChangeCircleTemplateName?.(event.target.value)}
                />
              </label>
            ) : null}

            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={includeDivisionLines}
                onChange={(e) => setIncludeDivisionLines(e.target.checked)}
              />
              <span>{t('Division lines')}</span>
            </label>

            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={noIntersectionCalc}
                onChange={(e) => setNoIntersectionCalc(e.target.checked)}
              />
              <span>{t('No intersection calculation')}</span>
            </label>

            <div className="button-row">
              <button onClick={applySelectionCenter} disabled={!onUseSelectionAsCenter || selectedShapeCount === 0}>
                Set Center From Selection
              </button>
              <button onClick={onGenerateIntersections} disabled={noIntersectionCalc || !onGenerateIntersections}>
                Calc Intersections
              </button>
              <button onClick={onClearIntersections} disabled={!onClearIntersections}>
                Clear Intersections
              </button>
            </div>

            <div className="modal-actions">
              <button onClick={onClose}>{t('Cancel')}</button>
              <button disabled={!validRadial} onClick={handleGenerateRadial}>{t('Generate')}</button>
            </div>
          </>
        )}

        {activeTab === 'spiral' && (
          <>
            <label className="field-row">
              <span>{t('Center X')}</span>
              <LengthInput unit={unit} valueMm={spiralCenterX} onChangeMm={setSpiralCenterX} />
            </label>

            <label className="field-row">
              <span>{t('Center Y')}</span>
              <LengthInput unit={unit} valueMm={spiralCenterY} onChangeMm={setSpiralCenterY} />
            </label>

            <label className="field-row">
              <span>{t('Start Radius')} ({unit})</span>
              <LengthInput unit={unit} valueMm={startRadius} onChangeMm={setStartRadius} minMm={1} />
            </label>

            <label className="field-row">
              <span>{t('Turns')}</span>
              <input
                type="number"
                min={1}
                max={8}
                step={1}
                value={turns}
                onChange={(e) => setTurns(Number(e.target.value))}
              />
            </label>

            <div className="modal-actions">
              <button onClick={onClose}>{t('Cancel')}</button>
              <button disabled={!validSpiral} onClick={handleGenerateSpiral}>{t('Generate')}</button>
            </div>
          </>
        )}

        {activeTab === 'golden' && (
          <>
            <label className="field-row">
              <span>{t('Center X')}</span>
              <LengthInput unit={unit} valueMm={goldenCenterX} onChangeMm={setGoldenCenterX} />
            </label>

            <label className="field-row">
              <span>{t('Center Y')}</span>
              <LengthInput unit={unit} valueMm={goldenCenterY} onChangeMm={setGoldenCenterY} />
            </label>

            <label className="field-row">
              <span>{t('Size')} ({unit})</span>
              <LengthInput unit={unit} valueMm={goldenSize} onChangeMm={setGoldenSize} minMm={10} />
            </label>

            <div className="modal-actions">
              <button onClick={onClose}>{t('Cancel')}</button>
              <button disabled={!validGuides} onClick={handleGenerateGolden}>{t('Generate')}</button>
            </div>
          </>
        )}

        {activeTab === 'mirror' && (
          <>
            <p>
              Mirror the selected shapes across an axis through the rotation pivot
              (or selection center if no pivot is set). Axis angle 0° is horizontal,
              90° is vertical, 45° mirrors diagonally — useful for mirroring across a
              mandala spoke.
            </p>
            <p>
              {selectedShapeCount} selected shape{selectedShapeCount === 1 ? '' : 's'}
            </p>
            <label className="field-row">
              <span>{t('Axis angle (°)')}</span>
              <input
                type="number"
                step={1}
                value={mirrorAxisAngleDeg}
                onChange={(e) => setMirrorAxisAngleDeg(Number(e.target.value))}
              />
            </label>
            <div className="button-row">
              <button onClick={() => setMirrorAxisAngleDeg(0)}>0°</button>
              <button onClick={() => setMirrorAxisAngleDeg(45)}>45°</button>
              <button onClick={() => setMirrorAxisAngleDeg(90)}>90°</button>
              <button onClick={() => setMirrorAxisAngleDeg(135)}>135°</button>
            </div>
            <div className="modal-actions">
              <button onClick={onClose}>{t('Cancel')}</button>
              <button
                onClick={handleApplyMirror}
                disabled={!validMirror || selectedShapeCount === 0 || !onMirrorSelectionAcrossAxis}
              >
                Mirror
              </button>
            </div>
          </>
        )}

        {activeTab === 'silver' && (
          <>
            <p>
              White-silver ratio guides (1:√2). Uses the same center and size fields as the
              golden-ratio tab.
            </p>
            <label className="field-row">
              <span>{t('Center X')}</span>
              <LengthInput unit={unit} valueMm={goldenCenterX} onChangeMm={setGoldenCenterX} />
            </label>
            <label className="field-row">
              <span>{t('Center Y')}</span>
              <LengthInput unit={unit} valueMm={goldenCenterY} onChangeMm={setGoldenCenterY} />
            </label>
            <label className="field-row">
              <span>{t('Size')} ({unit})</span>
              <LengthInput unit={unit} valueMm={goldenSize} onChangeMm={setGoldenSize} minMm={10} />
            </label>
            <div className="modal-actions">
              <button onClick={onClose}>{t('Cancel')}</button>
              <button disabled={!validGuides} onClick={handleGenerateSilver}>{t('Generate')}</button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
