import type { StitchHoleType } from '../cad/cad-types'

type StitchHolePanelProps = {
  holeType: StitchHoleType
  onChangeHoleType: (holeType: StitchHoleType) => void
  pitchMm: number
  onChangePitchMm: (pitchMm: number) => void
  variablePitchStartMm: number
  variablePitchEndMm: number
  onChangeVariablePitchStartMm: (pitchMm: number) => void
  onChangeVariablePitchEndMm: (pitchMm: number) => void
  onAutoPlaceFixedPitch: () => void
  onAutoPlaceVariablePitch: () => void
  onResequenceSelected: () => void
  onReverseSelected: () => void
  onSelectNextHole: () => void
  onFixOrderFromSelected: () => void
  onFixReverseOrderFromSelected: () => void
  showSequenceLabels: boolean
  onToggleSequenceLabels: () => void
  onCountSelected: () => void
  onDeleteOnSelected: () => void
  onClearAll: () => void
  selectedShapeCount: number
  selectedHoleCount: number
  totalHoleCount: number
  hasSelectedHole: boolean
}

export function StitchHolePanel({
  holeType,
  onChangeHoleType,
  pitchMm,
  onChangePitchMm,
  variablePitchStartMm,
  variablePitchEndMm,
  onChangeVariablePitchStartMm,
  onChangeVariablePitchEndMm,
  onAutoPlaceFixedPitch,
  onAutoPlaceVariablePitch,
  onResequenceSelected,
  onReverseSelected,
  onSelectNextHole,
  onFixOrderFromSelected,
  onFixReverseOrderFromSelected,
  showSequenceLabels,
  onToggleSequenceLabels,
  onCountSelected,
  onDeleteOnSelected,
  onClearAll,
  selectedShapeCount,
  selectedHoleCount,
  totalHoleCount,
  hasSelectedHole,
}: StitchHolePanelProps) {
  return (
    <div className="group stitch-controls">
      <span className="line-type-label">Stitch Holes</span>
      <select
        className="line-type-select"
        value={holeType}
        onChange={(event) => onChangeHoleType(event.target.value as StitchHoleType)}
      >
        <option value="round">Round hole</option>
        <option value="slit">Slit hole</option>
      </select>
      <button onClick={onCountSelected} disabled={selectedShapeCount === 0}>
        Count Selected
      </button>
      <button onClick={onDeleteOnSelected} disabled={selectedHoleCount === 0}>
        Delete Selected
      </button>
      <label className="stitch-pitch-inline">
        <span>Pitch</span>
        <input
          type="number"
          min={0.2}
          step={0.2}
          value={pitchMm}
          onChange={(event) => onChangePitchMm(Number(event.target.value))}
        />
      </label>
      <label className="stitch-pitch-inline">
        <span>Var From</span>
        <input
          type="number"
          min={0.2}
          step={0.2}
          value={variablePitchStartMm}
          onChange={(event) => onChangeVariablePitchStartMm(Number(event.target.value))}
        />
      </label>
      <label className="stitch-pitch-inline">
        <span>Var To</span>
        <input
          type="number"
          min={0.2}
          step={0.2}
          value={variablePitchEndMm}
          onChange={(event) => onChangeVariablePitchEndMm(Number(event.target.value))}
        />
      </label>
      <button onClick={onAutoPlaceFixedPitch} disabled={selectedShapeCount === 0}>
        Auto Fixed
      </button>
      <button onClick={onAutoPlaceVariablePitch} disabled={selectedShapeCount === 0}>
        Auto Variable
      </button>
      <button onClick={onResequenceSelected} disabled={selectedHoleCount === 0}>
        Re-sequence
      </button>
      <button onClick={onReverseSelected} disabled={selectedHoleCount === 0}>
        Reverse Order
      </button>
      <button onClick={onSelectNextHole} disabled={totalHoleCount === 0}>
        Select Next
      </button>
      <button onClick={onFixOrderFromSelected} disabled={!hasSelectedHole}>
        Fix From Selected
      </button>
      <button onClick={onFixReverseOrderFromSelected} disabled={!hasSelectedHole}>
        Fix Reverse
      </button>
      <button onClick={onToggleSequenceLabels}>
        {showSequenceLabels ? 'Hide Labels' : 'Show Labels'}
      </button>
      <button onClick={onClearAll} disabled={totalHoleCount === 0}>
        Clear All
      </button>
    </div>
  )
}
