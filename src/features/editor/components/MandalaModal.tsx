import { useState } from 'react'
import type { MandalaSettings, GoldenSpiralParams } from '../ops/mandala-ops'

type MandalaTab = 'radial' | 'spiral' | 'golden' | 'silver'

type MandalaModalProps = {
  open: boolean
  onClose: () => void
  onGenerateRadial: (settings: MandalaSettings) => void
  onGenerateSpiral: (params: GoldenSpiralParams) => void
  onGenerateGoldenGuides: (center: { x: number; y: number }, size: number) => void
  onGenerateWhiteSilverGuides: (center: { x: number; y: number }, size: number) => void
  defaultLayerId: string
  defaultLineTypeId: string
}

export function MandalaModal({
  open,
  onClose,
  onGenerateRadial,
  onGenerateSpiral,
  onGenerateGoldenGuides,
  onGenerateWhiteSilverGuides,
  defaultLayerId,
  defaultLineTypeId,
}: MandalaModalProps) {
  const [activeTab, setActiveTab] = useState<MandalaTab>('radial')

  // Radial Symmetry state
  const [segmentCount, setSegmentCount] = useState(8)
  const [radialCenterX, setRadialCenterX] = useState(0)
  const [radialCenterY, setRadialCenterY] = useState(0)
  const [radius, setRadius] = useState(100)
  const [mirrorSegments, setMirrorSegments] = useState(false)

  // Golden Spiral state
  const [spiralCenterX, setSpiralCenterX] = useState(0)
  const [spiralCenterY, setSpiralCenterY] = useState(0)
  const [startRadius, setStartRadius] = useState(10)
  const [turns, setTurns] = useState(4)

  // Golden Ratio state
  const [goldenCenterX, setGoldenCenterX] = useState(0)
  const [goldenCenterY, setGoldenCenterY] = useState(0)
  const [goldenSize, setGoldenSize] = useState(200)

  if (!open) {
    return null
  }

  function handleGenerateRadial() {
    onGenerateRadial({
      segmentCount,
      center: { x: radialCenterX, y: radialCenterY },
      radius,
      mirrorSegments,
    })
  }

  function handleGenerateSpiral() {
    onGenerateSpiral({
      center: { x: spiralCenterX, y: spiralCenterY },
      startRadius,
      turns,
      layerId: defaultLayerId,
      lineTypeId: defaultLineTypeId,
    })
  }

  function handleGenerateGolden() {
    onGenerateGoldenGuides({ x: goldenCenterX, y: goldenCenterY }, goldenSize)
  }

  function handleGenerateSilver() {
    onGenerateWhiteSilverGuides({ x: goldenCenterX, y: goldenCenterY }, goldenSize)
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Mandala and Golden Ratio Tools">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Mandala / Golden Ratio</h3>

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
        </div>

        {activeTab === 'radial' && (
          <>
            <label className="field-row">
              <span>Segments</span>
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
              <span>Center X</span>
              <input
                type="number"
                step={1}
                value={radialCenterX}
                onChange={(e) => setRadialCenterX(Number(e.target.value))}
              />
            </label>

            <label className="field-row">
              <span>Center Y</span>
              <input
                type="number"
                step={1}
                value={radialCenterY}
                onChange={(e) => setRadialCenterY(Number(e.target.value))}
              />
            </label>

            <label className="field-row">
              <span>Radius (mm)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
            </label>

            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={mirrorSegments}
                onChange={(e) => setMirrorSegments(e.target.checked)}
              />
              <span>Mirror alternating segments</span>
            </label>

            <div className="modal-actions">
              <button onClick={onClose}>Cancel</button>
              <button onClick={handleGenerateRadial}>Generate</button>
            </div>
          </>
        )}

        {activeTab === 'spiral' && (
          <>
            <label className="field-row">
              <span>Center X</span>
              <input
                type="number"
                step={1}
                value={spiralCenterX}
                onChange={(e) => setSpiralCenterX(Number(e.target.value))}
              />
            </label>

            <label className="field-row">
              <span>Center Y</span>
              <input
                type="number"
                step={1}
                value={spiralCenterY}
                onChange={(e) => setSpiralCenterY(Number(e.target.value))}
              />
            </label>

            <label className="field-row">
              <span>Start Radius (mm)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={startRadius}
                onChange={(e) => setStartRadius(Number(e.target.value))}
              />
            </label>

            <label className="field-row">
              <span>Turns</span>
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
              <button onClick={onClose}>Cancel</button>
              <button onClick={handleGenerateSpiral}>Generate</button>
            </div>
          </>
        )}

        {activeTab === 'golden' && (
          <>
            <label className="field-row">
              <span>Center X</span>
              <input
                type="number"
                step={1}
                value={goldenCenterX}
                onChange={(e) => setGoldenCenterX(Number(e.target.value))}
              />
            </label>

            <label className="field-row">
              <span>Center Y</span>
              <input
                type="number"
                step={1}
                value={goldenCenterY}
                onChange={(e) => setGoldenCenterY(Number(e.target.value))}
              />
            </label>

            <label className="field-row">
              <span>Size (mm)</span>
              <input
                type="number"
                min={10}
                step={10}
                value={goldenSize}
                onChange={(e) => setGoldenSize(Number(e.target.value))}
              />
            </label>

            <div className="modal-actions">
              <button onClick={onClose}>Cancel</button>
              <button onClick={handleGenerateGolden}>Generate</button>
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
              <span>Center X</span>
              <input
                type="number"
                step={1}
                value={goldenCenterX}
                onChange={(e) => setGoldenCenterX(Number(e.target.value))}
              />
            </label>
            <label className="field-row">
              <span>Center Y</span>
              <input
                type="number"
                step={1}
                value={goldenCenterY}
                onChange={(e) => setGoldenCenterY(Number(e.target.value))}
              />
            </label>
            <label className="field-row">
              <span>Size (mm)</span>
              <input
                type="number"
                min={10}
                step={10}
                value={goldenSize}
                onChange={(e) => setGoldenSize(Number(e.target.value))}
              />
            </label>
            <div className="modal-actions">
              <button onClick={onClose}>Cancel</button>
              <button onClick={handleGenerateSilver}>Generate</button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
