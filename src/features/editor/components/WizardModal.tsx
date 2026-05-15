import { useRef, useState } from 'react'
import type {
  WizardType,
  WatchStrapParams,
  PassCaseParams,
  BoxJointParams,
  JigsawParams,
  DiceCupParams,
  CapPatternParams,
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
  { type: 'cap-pattern', label: 'Cap Pattern' },
]

type WizardModalProps = {
  open: boolean
  onClose: () => void
  onGenerate: (
    type: WizardType,
    params:
      | WatchStrapParams
      | PassCaseParams
      | BoxJointParams
      | JigsawParams
      | DiceCupParams
      | CapPatternParams,
  ) => void
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
  const [watchLength, setWatchLength] = useState(44)
  const [wristCircumference, setWristCircumference] = useState(170)
  const [lugInnerWidth, setLugInnerWidth] = useState(22)
  const [buckleInnerWidth, setBuckleInnerWidth] = useState(20)
  const [buckleLength, setBuckleLength] = useState(18)
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
  const [sourcePassWidth, setSourcePassWidth] = useState(100)
  const [sourcePassHeight, setSourcePassHeight] = useState(70)
  const [passCompactSourceMode, setPassCompactSourceMode] = useState(false)
  const [passStitchPitch, setPassStitchPitch] = useState(4)
  const [passStitchSpace, setPassStitchSpace] = useState(5)
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
  const [boxMode, setBoxMode] = useState<'closed' | 'open'>('closed')
  const [pinWidthMm, setPinWidthMm] = useState(12)
  const [lidMode, setLidMode] = useState<'none' | 'drop-in' | 'sliding'>('none')
  const [grooveDepth, setGrooveDepth] = useState(1)
  const [grooveOffset, setGrooveOffset] = useState(4)
  const [kerfCompensation, setKerfCompensation] = useState(0)
  const [pinOverhang, setPinOverhang] = useState(0)
  const [bottomOffset, setBottomOffset] = useState(0)
  const [sameThickness, setSameThickness] = useState(true)
  const [frontThickness, setFrontThickness] = useState(3)
  const [backThickness, setBackThickness] = useState(3)
  const [leftThickness, setLeftThickness] = useState(3)
  const [rightThickness, setRightThickness] = useState(3)
  const [bottomThickness, setBottomThickness] = useState(3)
  const [lidThickness, setLidThickness] = useState(3)

  // Jigsaw
  const [columns, setColumns] = useState(4)
  const [rows, setRows] = useState(3)
  const [pieceSize, setPieceSize] = useState(40)
  const [tabDepth, setTabDepth] = useState(10)
  const [tabWidth, setTabWidth] = useState(15)
  const [jigsawRandomSeed, setJigsawRandomSeed] = useState(1)
  const [jigsawRandomizeTabs, setJigsawRandomizeTabs] = useState(false)
  const [jigsawFlatEdges, setJigsawFlatEdges] = useState(true)
  const [jigsawFlattenPath, setJigsawFlattenPath] = useState(false)

  // Dice Cup
  const [topDiameter, setTopDiameter] = useState(70)
  const [bottomDiameter, setBottomDiameter] = useState(50)
  const [cupHeight, setCupHeight] = useState(100)
  const [segments, setSegments] = useState(8)
  const [includeBottom, setIncludeBottom] = useState(true)
  const [cupLeatherThickness, setCupLeatherThickness] = useState(0)
  const [cupCompensationFactor, setCupCompensationFactor] = useState(0.5)
  const [cupStitchBottomRim, setCupStitchBottomRim] = useState(0)
  const [cupStitchTopRimOffset, setCupStitchTopRimOffset] = useState(0)
  const [cupStitchSide, setCupStitchSide] = useState(0)
  const [cupStitchBottomDisc, setCupStitchBottomDisc] = useState(0)
  const [cupStitchTopRim, setCupStitchTopRim] = useState(false)

  // Cap Pattern
  const [capPanelCount, setCapPanelCount] = useState(6)
  const [capCrownHeightMM, setCapCrownHeightMM] = useState(99)
  const [capPanelGapMM, setCapPanelGapMM] = useState(10)
  const [capSeamMM, setCapSeamMM] = useState(5)
  const [capCrownBulge, setCapCrownBulge] = useState(6)
  const [capBaseSmile, setCapBaseSmile] = useState(4)
  const [capBrimDepthMM, setCapBrimDepthMM] = useState(70)
  const [capBrimWidthMM, setCapBrimWidthMM] = useState(180)
  const [capBrimBackRiseMM, setCapBrimBackRiseMM] = useState(8)

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
          watchLength,
          wristCircumference,
          lugInnerWidth,
          buckleInnerWidth,
          buckleLength,
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
          compactSourceMode: passCompactSourceMode,
          sourceWidth: sourcePassWidth,
          sourceHeight: sourcePassHeight,
          stitchPitchMm: passStitchPitch,
          stitchSpaceMm: passStitchSpace,
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
          boxMode,
          lidMode,
          pinWidthMm,
          grooveDepthMm: grooveDepth,
          grooveOffsetMm: grooveOffset,
          kerfCompensationMm: kerfCompensation,
          pinOverhangMm: pinOverhang,
          bottomOffsetMm: bottomOffset,
          sameThickness,
          frontThicknessMm: frontThickness,
          backThicknessMm: backThickness,
          leftThicknessMm: leftThickness,
          rightThicknessMm: rightThickness,
          bottomThicknessMm: bottomThickness,
          lidThicknessMm: lidThickness,
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
          randomSeed: jigsawRandomSeed,
          randomizeTabs: jigsawRandomizeTabs,
          flatEdges: jigsawFlatEdges,
          flattenPath: jigsawFlattenPath,
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
          leatherThickness: cupLeatherThickness,
          compensationFactor: cupCompensationFactor,
          stitchOffsetBottomRim: cupStitchBottomRim,
          stitchOffsetTopRim: cupStitchTopRimOffset,
          stitchOffsetSide: cupStitchSide,
          stitchOffsetBottomDisc: cupStitchBottomDisc,
          stitchTopRim: cupStitchTopRim,
          layerId: defaultLayerId,
          lineTypeId: defaultLineTypeId,
        })
        break
      case 'cap-pattern':
        onGenerate('cap-pattern', {
          panelCount: capPanelCount,
          crownHeightMM: capCrownHeightMM,
          panelGapMM: capPanelGapMM,
          seamMM: capSeamMM,
          crownBulge: capCrownBulge,
          baseSmile: capBaseSmile,
          brimDepthMM: capBrimDepthMM,
          brimWidthMM: capBrimWidthMM,
          brimBackRiseMM: capBrimBackRiseMM,
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
            <div className="button-row">
              <button
                type="button"
                onClick={() => setStrapTotalLength(Math.max(50, wristCircumference - watchLength - buckleLength + holeStartOffset))}
              >
                Calc Fit
              </button>
            </div>
            <label className="field-row">
              <span>Total Length (mm)</span>
              <input type="number" min={50} step={1} value={strapTotalLength} onChange={(e) => setStrapTotalLength(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Watch Length (mm)</span>
              <input type="number" min={0} step={1} value={watchLength} onChange={(e) => setWatchLength(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Wrist Circumference (mm)</span>
              <input type="number" min={80} step={1} value={wristCircumference} onChange={(e) => setWristCircumference(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Lug Inner Width (mm)</span>
              <input type="number" min={5} step={1} value={lugInnerWidth} onChange={(e) => setLugInnerWidth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Buckle Inner Width (mm)</span>
              <input type="number" min={5} step={1} value={buckleInnerWidth} onChange={(e) => setBuckleInnerWidth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Buckle Length (mm)</span>
              <input type="number" min={0} step={1} value={buckleLength} onChange={(e) => setBuckleLength(Number(e.target.value))} />
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
              <span>Source Width (mm)</span>
              <input type="number" min={10} step={1} value={sourcePassWidth} onChange={(e) => setSourcePassWidth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Source Height (mm)</span>
              <input type="number" min={10} step={1} value={sourcePassHeight} onChange={(e) => setSourcePassHeight(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Stitch Pitch (mm)</span>
              <input type="number" min={0.2} max={100} step={0.1} value={passStitchPitch} onChange={(e) => setPassStitchPitch(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Stitch Space (mm)</span>
              <input type="number" min={0} step={0.5} value={passStitchSpace} onChange={(e) => setPassStitchSpace(Number(e.target.value))} />
            </label>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={passCompactSourceMode} onChange={(e) => setPassCompactSourceMode(e.target.checked)} />
              <span>Compact source width/height mode</span>
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
              <span>Box Mode</span>
              <select value={boxMode} onChange={(e) => setBoxMode(e.target.value as 'closed' | 'open')}>
                <option value="closed">Closed</option>
                <option value="open">Open</option>
              </select>
            </label>
            <label className="field-row">
              <span>Pin Width (mm)</span>
              <input type="number" min={1} step={0.5} value={pinWidthMm} onChange={(e) => setPinWidthMm(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Finger Count</span>
              <input type="number" min={2} max={20} step={1} value={fingerCount} onChange={(e) => setFingerCount(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Lid Mode</span>
              <select value={lidMode} onChange={(e) => setLidMode(e.target.value as 'none' | 'drop-in' | 'sliding')}>
                <option value="none">None</option>
                <option value="drop-in">Drop-in</option>
                <option value="sliding">Sliding</option>
              </select>
            </label>
            <label className="field-row">
              <span>Groove Depth (mm)</span>
              <input type="number" min={0} step={0.1} value={grooveDepth} onChange={(e) => setGrooveDepth(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Groove Offset (mm)</span>
              <input type="number" min={0} step={0.5} value={grooveOffset} onChange={(e) => setGrooveOffset(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Kerf Compensation (mm)</span>
              <input type="number" step={0.05} value={kerfCompensation} onChange={(e) => setKerfCompensation(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Pin Overhang (mm)</span>
              <input type="number" min={0} step={0.5} value={pinOverhang} onChange={(e) => setPinOverhang(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Bottom Offset (mm)</span>
              <input type="number" step={0.5} value={bottomOffset} onChange={(e) => setBottomOffset(Number(e.target.value))} />
            </label>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={sameThickness} onChange={(e) => setSameThickness(e.target.checked)} />
              <span>Use same thickness</span>
            </label>
            {!sameThickness && (
              <>
                <label className="field-row">
                  <span>Front Thickness (mm)</span>
                  <input type="number" min={0.1} step={0.1} value={frontThickness} onChange={(e) => setFrontThickness(Number(e.target.value))} />
                </label>
                <label className="field-row">
                  <span>Back Thickness (mm)</span>
                  <input type="number" min={0.1} step={0.1} value={backThickness} onChange={(e) => setBackThickness(Number(e.target.value))} />
                </label>
                <label className="field-row">
                  <span>Left Thickness (mm)</span>
                  <input type="number" min={0.1} step={0.1} value={leftThickness} onChange={(e) => setLeftThickness(Number(e.target.value))} />
                </label>
                <label className="field-row">
                  <span>Right Thickness (mm)</span>
                  <input type="number" min={0.1} step={0.1} value={rightThickness} onChange={(e) => setRightThickness(Number(e.target.value))} />
                </label>
                <label className="field-row">
                  <span>Bottom Thickness (mm)</span>
                  <input type="number" min={0.1} step={0.1} value={bottomThickness} onChange={(e) => setBottomThickness(Number(e.target.value))} />
                </label>
                <label className="field-row">
                  <span>Lid Thickness (mm)</span>
                  <input type="number" min={0.1} step={0.1} value={lidThickness} onChange={(e) => setLidThickness(Number(e.target.value))} />
                </label>
              </>
            )}
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
            <label className="field-row">
              <span>Random Seed</span>
              <input type="number" min={1} step={1} value={jigsawRandomSeed} onChange={(e) => setJigsawRandomSeed(Number(e.target.value))} />
            </label>
            <div className="button-row">
              <button
                type="button"
                onClick={() => setJigsawRandomSeed(Math.max(1, Math.floor(Math.random() * 2147483647)))}
              >
                Random
              </button>
            </div>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={jigsawRandomizeTabs} onChange={(e) => setJigsawRandomizeTabs(e.target.checked)} />
              <span>Randomize tabs</span>
            </label>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={jigsawFlatEdges} onChange={(e) => setJigsawFlatEdges(e.target.checked)} />
              <span>Flat outer edges</span>
            </label>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={jigsawFlattenPath} onChange={(e) => setJigsawFlattenPath(e.target.checked)} />
              <span>Flatten generated path</span>
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
            <label className="field-row">
              <span>Leather Thickness (mm)</span>
              <input type="number" min={0} step={0.5} value={cupLeatherThickness} onChange={(e) => setCupLeatherThickness(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Compensation Factor</span>
              <input type="number" min={0} max={1} step={0.05} value={cupCompensationFactor} onChange={(e) => setCupCompensationFactor(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Stitch Offset — Bottom Rim (mm)</span>
              <input type="number" min={0} step={0.5} value={cupStitchBottomRim} onChange={(e) => setCupStitchBottomRim(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Stitch Offset — Side Edges (mm)</span>
              <input type="number" min={0} step={0.5} value={cupStitchSide} onChange={(e) => setCupStitchSide(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Stitch Offset — Bottom Disc (mm)</span>
              <input type="number" min={0} step={0.5} value={cupStitchBottomDisc} onChange={(e) => setCupStitchBottomDisc(Number(e.target.value))} />
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={cupStitchTopRim}
                onChange={(e) => setCupStitchTopRim(e.target.checked)}
              />
              <span>Stitch top rim</span>
            </label>
            {cupStitchTopRim && (
              <label className="field-row">
                <span>Stitch Offset — Top Rim (mm)</span>
                <input type="number" min={0} step={0.5} value={cupStitchTopRimOffset} onChange={(e) => setCupStitchTopRimOffset(Number(e.target.value))} />
              </label>
            )}
          </>
        )}

        {activeType === 'cap-pattern' && (
          <>
            <label className="field-row">
              <span>Crown Panels</span>
              <input type="number" min={1} max={12} step={1} value={capPanelCount} onChange={(e) => setCapPanelCount(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Crown Height (mm)</span>
              <input type="number" min={20} step={5} value={capCrownHeightMM} onChange={(e) => setCapCrownHeightMM(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Panel Gap (mm)</span>
              <input type="number" min={0} step={1} value={capPanelGapMM} onChange={(e) => setCapPanelGapMM(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Brim Width (mm)</span>
              <input type="number" min={60} step={5} value={capBrimWidthMM} onChange={(e) => setCapBrimWidthMM(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Brim Depth (mm)</span>
              <input type="number" min={20} step={5} value={capBrimDepthMM} onChange={(e) => setCapBrimDepthMM(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Brim Back Rise (mm)</span>
              <input type="number" min={0} step={1} value={capBrimBackRiseMM} onChange={(e) => setCapBrimBackRiseMM(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Crown Bulge (mm)</span>
              <input type="number" min={0} step={1} value={capCrownBulge} onChange={(e) => setCapCrownBulge(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Base Smile (mm)</span>
              <input type="number" min={0} step={1} value={capBaseSmile} onChange={(e) => setCapBaseSmile(Number(e.target.value))} />
            </label>
            <label className="field-row">
              <span>Seam Allowance (mm)</span>
              <input type="number" min={0} step={1} value={capSeamMM} onChange={(e) => setCapSeamMM(Number(e.target.value))} />
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
