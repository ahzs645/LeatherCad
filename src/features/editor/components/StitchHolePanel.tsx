import { useMemo, useState } from 'react'
import type { StitchHoleType } from '../cad/cad-types'
import {
  createBuiltinPrickingIrons,
  createCustomPrickingIron,
  loadCustomPrickingIrons,
  parsePrickingIronShape,
  prickingIronToHoleType,
  saveCustomPrickingIrons,
  type PrickingIronPreset,
} from '../ops/pricking-iron-ops'

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
  const [customPrickingIrons, setCustomPrickingIrons] = useState<PrickingIronPreset[]>(() => loadCustomPrickingIrons())
  const [selectedPrickingIronId, setSelectedPrickingIronId] = useState<string>(() => createBuiltinPrickingIrons()[0]?.id ?? '')

  const builtinPrickingIrons = useMemo(() => createBuiltinPrickingIrons(), [])
  const allPrickingIrons = useMemo(
    () => [...builtinPrickingIrons, ...customPrickingIrons],
    [builtinPrickingIrons, customPrickingIrons],
  )
  const selectedPrickingIron = allPrickingIrons.find((entry) => entry.id === selectedPrickingIronId) ?? allPrickingIrons[0] ?? null

  const applyPrickingIron = () => {
    if (!selectedPrickingIron) {
      return
    }
    const holeTypeFromIron = prickingIronToHoleType(selectedPrickingIron.shape)
    onChangeHoleType(holeTypeFromIron)
    onChangePitchMm(selectedPrickingIron.pitchMm)
    onChangeVariablePitchStartMm(selectedPrickingIron.pitchMm)
    onChangeVariablePitchEndMm(selectedPrickingIron.pitchMm)
  }

  const handleRegisterCustomIron = () => {
    const name = window.prompt('Pricking iron name', `Custom Iron ${customPrickingIrons.length + 1}`)?.trim()
    if (!name) {
      return
    }

    const shapeInput = window.prompt('Shape: diamond / french / flat / round', 'diamond')
    const shape = parsePrickingIronShape(shapeInput?.trim().toLowerCase())
    const pitchInput = Number(window.prompt('Pitch in mm', pitchMm.toFixed(2)))
    if (!Number.isFinite(pitchInput) || pitchInput <= 0) {
      return
    }

    const customIron = createCustomPrickingIron({
      name,
      shape,
      pitchMm: pitchInput,
    })
    const nextCustom = [customIron, ...customPrickingIrons]
    setCustomPrickingIrons(nextCustom)
    saveCustomPrickingIrons(nextCustom)
    setSelectedPrickingIronId(customIron.id)
    onChangeHoleType(prickingIronToHoleType(customIron.shape))
    onChangePitchMm(customIron.pitchMm)
    onChangeVariablePitchStartMm(customIron.pitchMm)
    onChangeVariablePitchEndMm(customIron.pitchMm)
  }

  const handleDeleteCustomIron = () => {
    if (!selectedPrickingIron || !selectedPrickingIron.id.startsWith('custom-')) {
      return
    }
    const nextCustom = customPrickingIrons.filter((entry) => entry.id !== selectedPrickingIron.id)
    setCustomPrickingIrons(nextCustom)
    saveCustomPrickingIrons(nextCustom)
    setSelectedPrickingIronId(builtinPrickingIrons[0]?.id ?? '')
  }

  return (
    <div className="group stitch-controls">
      <span className="line-type-label">Stitch Holes</span>
      <label className="stitch-pitch-inline">
        <span>Pricking Iron</span>
        <select
          className="line-type-select"
          value={selectedPrickingIron?.id ?? ''}
          onChange={(event) => setSelectedPrickingIronId(event.target.value)}
        >
          {allPrickingIrons.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} ({entry.pitchMm.toFixed(2)}mm)
            </option>
          ))}
        </select>
      </label>
      <button onClick={applyPrickingIron} disabled={!selectedPrickingIron}>
        Apply Iron
      </button>
      <button onClick={handleRegisterCustomIron}>Register Custom</button>
      <button onClick={handleDeleteCustomIron} disabled={!selectedPrickingIron || !selectedPrickingIron.id.startsWith('custom-')}>
        Delete Custom
      </button>
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
