import { useEffect, useRef, useState } from 'react'
import type {
  WizardType,
  WatchStrapParams,
  PassCaseParams,
  BoxJointParams,
  JigsawParams,
  DiceCupParams,
} from '../ops/wizard-ops'

type WizardTab = {
  type: WizardType
  label: string
}

const WIZARD_TABS: WizardTab[] = [
  { type: 'watch-strap', label: 'Watch Strap' },
  { type: 'pass-case', label: 'Pass Case' },
  { type: 'box-joint', label: 'Box Joint' },
  { type: 'jigsaw', label: 'Jigsaw' },
  { type: 'dice-cup', label: 'Dice Cup' },
]

type WizardModalProps = {
  open: boolean
  onClose: () => void
  onGenerate: (type: WizardType, params: WatchStrapParams | PassCaseParams | BoxJointParams | JigsawParams | DiceCupParams) => void
  defaultLayerId: string
  defaultLineTypeId: string
}

export function WizardModal({
  open,
  onClose,
  onGenerate,
  defaultLayerId,
  defaultLineTypeId,
}: WizardModalProps) {
  const [activeType, setActiveType] = useState<WizardType>('watch-strap')
  const [isGenerating, setIsGenerating] = useState(false)
  const isGeneratingRef = useRef(false)

  // Watch Strap
  const [strapTotalLength, setStrapTotalLength] = useState(220)
  const [strapWidth, setStrapWidth] = useState(22)
  const [buckleEndWidth, setBuckleEndWidth] = useState(20)
  const [taperLength, setTaperLength] = useState(40)
  const [holeCount, setHoleCount] = useState(7)
  const [holeSpacing, setHoleSpacing] = useState(5)
  const [holeStartOffset, setHoleStartOffset] = useState(60)
  const [holeDiameter, setHoleDiameter] = useState(2)
  const [tipShape, setTipShape] = useState<'pointed' | 'round' | 'square'>('pointed')
  const [keeperWidth, setKeeperWidth] = useState(8)

  // Pass Case
  const [cardWidth, setCardWidth] = useState(86)
  const [cardHeight, setCardHeight] = useState(54)
  const [margin, setMargin] = useState(5)
  const [cornerRadius, setCornerRadius] = useState(3)
  const [flapHeight, setFlapHeight] = useState(30)
  const [pocketCount, setPocketCount] = useState(2)

  // Box Joint
  const [jointLength, setJointLength] = useState(200)
  const [jointWidth, setJointWidth] = useState(100)
  const [jointHeight, setJointHeight] = useState(80)
  const [materialThickness, setMaterialThickness] = useState(3)
  const [fingerCount, setFingerCount] = useState(5)

  // Jigsaw
  const [columns, setColumns] = useState(4)
  const [rows, setRows] = useState(3)
  const [pieceSize, setPieceSize] = useState(40)
  const [tabDepth, setTabDepth] = useState(10)
  const [tabWidth, setTabWidth] = useState(15)

  // Dice Cup
  const [topDiameter, setTopDiameter] = useState(70)
  const [bottomDiameter, setBottomDiameter] = useState(50)
  const [cupHeight, setCupHeight] = useState(100)
  const [segments, setSegments] = useState(8)
  const [includeBottom, setIncludeBottom] = useState(true)

  useEffect(() => {
    if (!open) {
      setIsGenerating(false)
      isGeneratingRef.current = false
    }
  }, [open])

  if (!open) {
    return null
  }

  function handleGenerate() {
    if (isGeneratingRef.current) {
      return
    }
    isGeneratingRef.current = true
    setIsGenerating(true)

    switch (activeType) {
      case 'watch-strap':
        onGenerate('watch-strap', {
          totalLength: strapTotalLength,
          width: strapWidth,
          buckleEndWidth,
          taperLength,
          holeCount,
          holeSpacing,
          holeStartOffset,
          holeDiameter,
          tipShape,
          keeperWidth,
          layerId: defaultLayerId,
          lineTypeId: defaultLineTypeId,
        })
        break
      case 'pass-case':
        onGenerate('pass-case', {
          cardWidth,
          cardHeight,
          margin,
          cornerRadius,
          flapHeight,
          pocketCount,
          layerId: defaultLayerId,
          lineTypeId: defaultLineTypeId,
        })
        break
      case 'box-joint':
        onGenerate('box-joint', {
          length: jointLength,
          width: jointWidth,
          height: jointHeight,
          materialThickness,
          fingerCount,
          layerId: defaultLayerId,
          lineTypeId: defaultLineTypeId,
        })
        break
      case 'jigsaw':
        onGenerate('jigsaw', {
          columns,
          rows,
          pieceSize,
          tabDepth,
          tabWidth,
          layerId: defaultLayerId,
          lineTypeId: defaultLineTypeId,
        })
        break
      case 'dice-cup':
        onGenerate('dice-cup', {
          topDiameter,
          bottomDiameter,
          height: cupHeight,
          segments,
          includeBottom,
          layerId: defaultLayerId,
          lineTypeId: defaultLineTypeId,
        })
        break
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Pattern Wizard">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Pattern Wizard</h3>

        <div className="button-row">
          {WIZARD_TABS.map((tab) => (
            <button
              key={tab.type}
              className={activeType === tab.type ? 'active' : ''}
              onClick={() => setActiveType(tab.type)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeType === 'watch-strap' && (
          <>
            <label className="field-row">
              <span>Total Length (mm)</span>
              <input type="number" min={50} step={1} value={strapTotalLength} onChange={(e) => setStrapTotalLength(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Width (mm)</span>
              <input type="number" min={5} step={1} value={strapWidth} onChange={(e) => setStrapWidth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Buckle End Width (mm)</span>
              <input type="number" min={5} step={1} value={buckleEndWidth} onChange={(e) => setBuckleEndWidth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Taper Length (mm)</span>
              <input type="number" min={0} step={1} value={taperLength} onChange={(e) => setTaperLength(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Hole Count</span>
              <input type="number" min={1} max={20} step={1} value={holeCount} onChange={(e) => setHoleCount(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Hole Spacing (mm)</span>
              <input type="number" min={1} step={0.5} value={holeSpacing} onChange={(e) => setHoleSpacing(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Hole Start Offset (mm)</span>
              <input type="number" min={0} step={1} value={holeStartOffset} onChange={(e) => setHoleStartOffset(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Hole Diameter (mm)</span>
              <input type="number" min={0.5} max={10} step={0.5} value={holeDiameter} onChange={(e) => setHoleDiameter(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Tip Shape</span>
              <select value={tipShape} onChange={(e) => setTipShape(e.target.value as 'pointed' | 'round' | 'square')}>
                <option value="pointed">Pointed</option>
                <option value="round">Rounded</option>
                <option value="square">Square</option>
              </select>
            </label>
            <label className="field-row">
              <span>Keeper Width (mm)</span>
              <input type="number" min={3} max={30} step={1} value={keeperWidth} onChange={(e) => setKeeperWidth(Number(e.target.value))} />
            </label>
          </>
        )}

        {activeType === 'pass-case' && (
          <>
            <label className="field-row">
              <span>Card Width (mm)</span>
              <input type="number" min={10} step={1} value={cardWidth} onChange={(e) => setCardWidth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Card Height (mm)</span>
              <input type="number" min={10} step={1} value={cardHeight} onChange={(e) => setCardHeight(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Margin (mm)</span>
              <input type="number" min={0} max={20} step={0.5} value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Corner Radius (mm)</span>
              <input type="number" min={0} max={20} step={0.5} value={cornerRadius} onChange={(e) => setCornerRadius(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Flap Height (mm)</span>
              <input type="number" min={0} step={1} value={flapHeight} onChange={(e) => setFlapHeight(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Pocket Count</span>
              <input type="number" min={1} max={6} step={1} value={pocketCount} onChange={(e) => setPocketCount(Number(e.target.value))} />
            </label>
          </>
        )}

        {activeType === 'box-joint' && (
          <>
            <label className="field-row">
              <span>Length (mm)</span>
              <input type="number" min={10} step={1} value={jointLength} onChange={(e) => setJointLength(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Width (mm)</span>
              <input type="number" min={10} step={1} value={jointWidth} onChange={(e) => setJointWidth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Height (mm)</span>
              <input type="number" min={10} step={1} value={jointHeight} onChange={(e) => setJointHeight(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Material Thickness (mm)</span>
              <input type="number" min={0.5} max={10} step={0.5} value={materialThickness} onChange={(e) => setMaterialThickness(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Finger Count</span>
              <input type="number" min={2} max={20} step={1} value={fingerCount} onChange={(e) => setFingerCount(Number(e.target.value))} />
            </label>
          </>
        )}

        {activeType === 'jigsaw' && (
          <>
            <label className="field-row">
              <span>Columns</span>
              <input type="number" min={2} max={20} step={1} value={columns} onChange={(e) => setColumns(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Rows</span>
              <input type="number" min={2} max={20} step={1} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Piece Size (mm)</span>
              <input type="number" min={10} step={1} value={pieceSize} onChange={(e) => setPieceSize(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Tab Depth (mm)</span>
              <input type="number" min={1} max={30} step={1} value={tabDepth} onChange={(e) => setTabDepth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Tab Width (mm)</span>
              <input type="number" min={1} max={30} step={1} value={tabWidth} onChange={(e) => setTabWidth(Number(e.target.value))} />
            </label>
          </>
        )}

        {activeType === 'dice-cup' && (
          <>
            <label className="field-row">
              <span>Top Diameter (mm)</span>
              <input type="number" min={10} step={1} value={topDiameter} onChange={(e) => setTopDiameter(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Bottom Diameter (mm)</span>
              <input type="number" min={10} step={1} value={bottomDiameter} onChange={(e) => setBottomDiameter(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Height (mm)</span>
              <input type="number" min={10} step={1} value={cupHeight} onChange={(e) => setCupHeight(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Segments</span>
              <input type="number" min={3} max={24} step={1} value={segments} onChange={(e) => setSegments(Number(e.target.value))} />
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={includeBottom}
                onChange={(e) => setIncludeBottom(e.target.checked)}
              />
              <span>Include bottom piece</span>
            </label>
          </>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
