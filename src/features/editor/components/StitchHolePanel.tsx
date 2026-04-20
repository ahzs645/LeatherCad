import { useMemo, useState } from 'react'
import type { StitchHoleDefaults } from '../cad/cad-types'
import type { StitchAutoPitchSettings } from '../editor-types'
import {
  createBuiltinPrickingIronCatalog,
  createCustomPrickingIron,
  createCustomPrickingIronGroup,
  createDefaultCustomPrickingIronGroup,
  loadCustomPrickingIronCatalog,
  parsePrickingIronShape,
  prickingIronPresetToDefaults,
  saveCustomPrickingIronCatalog,
  type PrickingIronCatalog,
  type PrickingIronGroup,
  type PrickingIronPreset,
} from '../ops/pricking-iron-ops'
import {
  formatDisplayDistance,
  fromDisplayValue,
  toDisplayValue,
  unitInputMin,
  unitInputStep,
  type DisplayUnit,
} from '../ops/unit-ops'

type StitchHolePanelProps = {
  holeDefaults: StitchHoleDefaults
  onUpdateHoleDefaults: (patch: Partial<StitchHoleDefaults>) => void
  displayUnit: DisplayUnit
  pitchMm: number
  onChangePitchMm: (pitchMm: number) => void
  variablePitchStartMm: number
  variablePitchEndMm: number
  onChangeVariablePitchStartMm: (pitchMm: number) => void
  onChangeVariablePitchEndMm: (pitchMm: number) => void
  autoPitchSettings: StitchAutoPitchSettings
  onUpdateAutoPitchSettings: (patch: Partial<StitchAutoPitchSettings>) => void
  onAutoPlacePreferredPitch: () => void
  onAutoPlaceFixedPitch: () => void
  onAutoPlaceVariablePitch: () => void
  onAutoPlaceEvenlySpaced: () => void
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

function normalizeCatalog(catalog: PrickingIronCatalog): PrickingIronCatalog {
  const groups = catalog.groups
    .slice()
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
  const presets = catalog.presets
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
  return { groups, presets }
}

export function StitchHolePanel({
  holeDefaults,
  onUpdateHoleDefaults,
  displayUnit,
  pitchMm,
  onChangePitchMm,
  variablePitchStartMm,
  variablePitchEndMm,
  onChangeVariablePitchStartMm,
  onChangeVariablePitchEndMm,
  autoPitchSettings,
  onUpdateAutoPitchSettings,
  onAutoPlacePreferredPitch,
  onAutoPlaceFixedPitch,
  onAutoPlaceVariablePitch,
  onAutoPlaceEvenlySpaced,
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
  const builtinCatalog = useMemo(() => createBuiltinPrickingIronCatalog(), [])
  const [customCatalog, setCustomCatalog] = useState<PrickingIronCatalog>(() => loadCustomPrickingIronCatalog())
  const [pendingPrickingIronId, setPendingPrickingIronId] = useState<string | null>(null)
  const selectedPrickingIronId = pendingPrickingIronId ?? holeDefaults.presetId ?? builtinCatalog.presets[0]?.id ?? ''

  const mergedCatalog = useMemo(
    () =>
      normalizeCatalog({
        groups: [...builtinCatalog.groups, ...customCatalog.groups],
        presets: [...builtinCatalog.presets, ...customCatalog.presets],
      }),
    [builtinCatalog, customCatalog],
  )

  const groupsById = useMemo(
    () => Object.fromEntries(mergedCatalog.groups.map((group) => [group.id, group] as const)),
    [mergedCatalog.groups],
  )
  const presetsByGroup = useMemo(() => {
    const grouped = new Map<string, PrickingIronPreset[]>()
    for (const preset of mergedCatalog.presets) {
      const entries = grouped.get(preset.groupId) ?? []
      entries.push(preset)
      grouped.set(preset.groupId, entries)
    }
    return grouped
  }, [mergedCatalog.presets])
  const selectedPrickingIron =
    mergedCatalog.presets.find((entry) => entry.id === selectedPrickingIronId) ?? mergedCatalog.presets[0] ?? null

  const saveCustomCatalog = (nextCatalog: PrickingIronCatalog) => {
    const normalized = normalizeCatalog(nextCatalog)
    setCustomCatalog(normalized)
    saveCustomPrickingIronCatalog(normalized)
  }

  const applyPrickingIron = () => {
    if (!selectedPrickingIron) {
      return
    }
    const nextDefaults = prickingIronPresetToDefaults(selectedPrickingIron)
    onUpdateHoleDefaults(nextDefaults)
    onChangePitchMm(selectedPrickingIron.pitchMm)
    onChangeVariablePitchStartMm(selectedPrickingIron.pitchMm)
    onChangeVariablePitchEndMm(selectedPrickingIron.pitchMm)
    setPendingPrickingIronId(null)
  }

  const handleCreateGroup = () => {
    const name = window.prompt('Pricking iron group name', `Custom Group ${customCatalog.groups.length + 1}`)?.trim()
    if (!name) {
      return
    }

    const nextGroup = createCustomPrickingIronGroup(name, customCatalog.groups.length)
    saveCustomCatalog({
      groups: [...customCatalog.groups, nextGroup],
      presets: customCatalog.presets,
    })
  }

  const handleSaveCurrentPreset = () => {
    const availableGroups = customCatalog.groups.length > 0 ? customCatalog.groups : [createDefaultCustomPrickingIronGroup(0)]
    const defaultGroup = availableGroups[0]
    const promptMessage = [
      'Target custom group ID:',
      ...availableGroups.map((group) => `${group.id} = ${group.name}`),
    ].join('\n')
    const groupInput = window.prompt(promptMessage, defaultGroup.id)?.trim()
    if (!groupInput) {
      return
    }

    let nextGroups = customCatalog.groups
    if (!customCatalog.groups.some((group) => group.id === groupInput)) {
      const created = createCustomPrickingIronGroup(groupInput, customCatalog.groups.length)
      nextGroups = [...customCatalog.groups, created]
    }

    const name = window.prompt('Pricking iron preset name', `${holeDefaults.presetName ?? 'Custom'} ${customCatalog.presets.length + 1}`)?.trim()
    if (!name) {
      return
    }

    const shapeInput = window.prompt(
      'Shape: diamond / french / flat / round',
      holeDefaults.renderShape === 'round' ? 'round' : holeDefaults.renderShape ?? 'diamond',
    )
    const shape = parsePrickingIronShape(shapeInput?.trim().toLowerCase())

    const preset = createCustomPrickingIron({
      groupId: groupInput,
      name,
      shape,
      pitchMm,
      widthMm: holeDefaults.widthMm,
      heightMm: holeDefaults.heightMm,
      tiltDeg: holeDefaults.tiltDeg,
      inverted: holeDefaults.inverted,
    })
    saveCustomCatalog({
      groups: nextGroups,
      presets: [preset, ...customCatalog.presets],
    })
    setPendingPrickingIronId(null)
    onUpdateHoleDefaults(prickingIronPresetToDefaults(preset))
  }

  const handleDeleteCustomPreset = () => {
    if (!selectedPrickingIron || selectedPrickingIron.system) {
      return
    }

    const nextPresets = customCatalog.presets.filter((entry) => entry.id !== selectedPrickingIron.id)
    saveCustomCatalog({
      groups: customCatalog.groups.filter((group) => nextPresets.some((preset) => preset.groupId === group.id)),
      presets: nextPresets,
    })
    setPendingPrickingIronId(builtinCatalog.presets[0]?.id ?? null)
  }

  const renderShape = holeDefaults.renderShape ?? (holeDefaults.holeType === 'round' ? 'round' : 'slit')

  return (
    <div className="group stitch-controls">
      <span className="line-type-label">Stitch Holes</span>

      <label className="stitch-pitch-inline">
        <span>Pricking Iron</span>
        <select
          className="line-type-select"
          value={selectedPrickingIron?.id ?? ''}
          onChange={(event) => setPendingPrickingIronId(event.target.value)}
        >
          {mergedCatalog.groups.map((group: PrickingIronGroup) => {
            const presets = presetsByGroup.get(group.id) ?? []
            if (presets.length === 0) {
              return null
            }
            return (
              <optgroup key={group.id} label={group.name}>
                {presets.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({formatDisplayDistance(entry.pitchMm, displayUnit, displayUnit === 'in' ? 3 : 2)})
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </label>
      <button onClick={applyPrickingIron} disabled={!selectedPrickingIron}>
        Apply Iron
      </button>
      <button onClick={handleCreateGroup}>New Group</button>
      <button onClick={handleSaveCurrentPreset}>Save Preset</button>
      <button onClick={handleDeleteCustomPreset} disabled={!selectedPrickingIron || selectedPrickingIron.system}>
        Delete Preset
      </button>

      <label className="stitch-pitch-inline">
        <span>Shape</span>
        <select
          className="line-type-select"
          value={renderShape}
          onChange={(event) => {
            const nextShape = event.target.value as NonNullable<StitchHoleDefaults['renderShape']>
            onUpdateHoleDefaults({
              renderShape: nextShape,
              holeType: nextShape === 'round' ? 'round' : 'slit',
            })
          }}
        >
          <option value="round">Round</option>
          <option value="slit">Slit</option>
          <option value="diamond">Diamond</option>
          <option value="french">French</option>
          <option value="flat">Flat</option>
        </select>
      </label>

      <label className="stitch-pitch-inline">
        <span>Width</span>
        <input
          type="number"
          min={unitInputMin(displayUnit)}
          step={unitInputStep(displayUnit)}
          value={toDisplayValue(holeDefaults.widthMm ?? holeDefaults.diameterMm ?? 1.2, displayUnit)}
          onChange={(event) => {
            const value = fromDisplayValue(Number(event.target.value), displayUnit)
            onUpdateHoleDefaults({
              widthMm: value,
              diameterMm: renderShape === 'round' ? value : holeDefaults.diameterMm,
            })
          }}
        />
      </label>

      <label className="stitch-pitch-inline">
        <span>Height</span>
        <input
          type="number"
          min={unitInputMin(displayUnit)}
          step={unitInputStep(displayUnit)}
          value={toDisplayValue(holeDefaults.heightMm ?? holeDefaults.diameterMm ?? 1.2, displayUnit)}
          onChange={(event) =>
            onUpdateHoleDefaults({
              heightMm: fromDisplayValue(Number(event.target.value), displayUnit),
            })
          }
        />
      </label>

      <label className="stitch-pitch-inline">
        <span>Tilt</span>
        <input
          type="number"
          min={-89}
          max={89}
          step={1}
          value={holeDefaults.tiltDeg ?? 0}
          onChange={(event) => onUpdateHoleDefaults({ tiltDeg: Number(event.target.value) || 0 })}
        />
      </label>

      <label className="layer-toggle-item">
        <input
          type="checkbox"
          checked={holeDefaults.inverted === true}
          onChange={(event) => onUpdateHoleDefaults({ inverted: event.target.checked })}
        />
        <span>Inverted</span>
      </label>

      <button onClick={onCountSelected} disabled={selectedShapeCount === 0}>
        Count Selected
      </button>
      <button onClick={onDeleteOnSelected} disabled={selectedHoleCount === 0}>
        Delete Selected
      </button>

      <label className="stitch-pitch-inline">
        <span>Default Auto</span>
        <select
          className="line-type-select"
          value={autoPitchSettings.defaultMode}
          onChange={(event) =>
            onUpdateAutoPitchSettings({
              defaultMode: event.target.value as StitchAutoPitchSettings['defaultMode'],
            })
          }
        >
          <option value="fixed">Fixed</option>
          <option value="variable">Variable</option>
        </select>
      </label>
      <label className="stitch-pitch-inline">
        <span>Pitch</span>
        <input
          type="number"
          min={unitInputMin(displayUnit)}
          step={unitInputStep(displayUnit)}
          value={toDisplayValue(pitchMm, displayUnit)}
          onChange={(event) => onChangePitchMm(fromDisplayValue(Number(event.target.value), displayUnit))}
        />
      </label>
      <label className="stitch-pitch-inline">
        <span>Var From</span>
        <input
          type="number"
          min={unitInputMin(displayUnit)}
          step={unitInputStep(displayUnit)}
          value={toDisplayValue(variablePitchStartMm, displayUnit)}
          onChange={(event) => onChangeVariablePitchStartMm(fromDisplayValue(Number(event.target.value), displayUnit))}
        />
      </label>
      <label className="stitch-pitch-inline">
        <span>Var To</span>
        <input
          type="number"
          min={unitInputMin(displayUnit)}
          step={unitInputStep(displayUnit)}
          value={toDisplayValue(variablePitchEndMm, displayUnit)}
          onChange={(event) => onChangeVariablePitchEndMm(fromDisplayValue(Number(event.target.value), displayUnit))}
        />
      </label>
      <label className="layer-toggle-item">
        <input
          type="checkbox"
          checked={autoPitchSettings.forceFitLastHole}
          onChange={(event) => onUpdateAutoPitchSettings({ forceFitLastHole: event.target.checked })}
        />
        <span>Force Fit Last</span>
      </label>
      <label className="layer-toggle-item">
        <input
          type="checkbox"
          checked={autoPitchSettings.continueFromSelectedHole}
          onChange={(event) => onUpdateAutoPitchSettings({ continueFromSelectedHole: event.target.checked })}
        />
        <span>Continue From Selected</span>
      </label>
      <label className="stitch-pitch-inline">
        <span>Solver Steps</span>
        <input
          type="number"
          min={2}
          max={24}
          step={1}
          value={autoPitchSettings.solverSteps}
          onChange={(event) => onUpdateAutoPitchSettings({ solverSteps: Math.max(2, Math.min(24, Math.round(Number(event.target.value) || 2))) })}
        />
      </label>
      <label className="stitch-pitch-inline">
        <span>Precision</span>
        <input
          type="number"
          min={0.01}
          max={5}
          step={0.01}
          value={autoPitchSettings.precisionMm}
          onChange={(event) => onUpdateAutoPitchSettings({ precisionMm: Math.max(0.01, Math.min(5, Number(event.target.value) || 0.01)) })}
        />
      </label>
      <label className="stitch-pitch-inline">
        <span>Stop Gap</span>
        <input
          type="number"
          min={0.1}
          max={25}
          step={0.1}
          value={autoPitchSettings.stopGapMm}
          onChange={(event) => onUpdateAutoPitchSettings({ stopGapMm: Math.max(0.1, Math.min(25, Number(event.target.value) || 0.1)) })}
        />
      </label>

      {selectedPrickingIron && (
        <span className="hint">
          {groupsById[selectedPrickingIron.groupId]?.name ?? 'Group'}: {selectedPrickingIron.numBlades} blades
        </span>
      )}

      <button onClick={onAutoPlacePreferredPitch} disabled={selectedShapeCount === 0}>
        Auto {autoPitchSettings.defaultMode === 'variable' ? 'Variable' : 'Fixed'}
      </button>
      <button onClick={onAutoPlaceFixedPitch} disabled={selectedShapeCount === 0}>
        Auto Fixed
      </button>
      <button onClick={onAutoPlaceVariablePitch} disabled={selectedShapeCount === 0}>
        Auto Variable
      </button>
      <button onClick={onAutoPlaceEvenlySpaced} disabled={selectedShapeCount === 0}>
        Auto Even N…
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
