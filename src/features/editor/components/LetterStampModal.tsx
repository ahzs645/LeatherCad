import { useRef, useState } from 'react'
import type { LetterStampParams } from '../ops/letter-stamp-ops'
import { getDefaultLetterStampParams } from '../ops/letter-stamp-ops'
import {
  createLetterStampFontSet,
  loadLetterStampFontSets,
  parseLetterStampFontSets,
  saveLetterStampFontSets,
  serializeLetterStampFontSets,
  type LetterStampFontSet,
} from '../ops/letter-stamp-fontsets'

type LetterStampModalProps = {
  open: boolean
  onClose: () => void
  onGenerate: (params: LetterStampParams) => void
  defaultLayerId: string
  defaultLineTypeId: string
}

export function LetterStampModal({
  open,
  onClose,
  onGenerate,
  defaultLayerId,
  defaultLineTypeId,
}: LetterStampModalProps) {
  const defaults = getDefaultLetterStampParams()

  const [text, setText] = useState(defaults.text)
  const [stampSizeMm, setStampSizeMm] = useState(defaults.stampSizeMm)
  const [spacingMm, setSpacingMm] = useState(defaults.spacingMm)
  const [lineSpacingMm, setLineSpacingMm] = useState(defaults.lineSpacingMm)
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(defaults.alignment)
  const [baselineAngleDeg, setBaselineAngleDeg] = useState(defaults.baselineAngleDeg)
  const [fontFamily, setFontFamily] = useState(defaults.fontFamily)
  const [fontSets, setFontSets] = useState<LetterStampFontSet[]>(() => loadLetterStampFontSets())
  const [selectedFontSetId, setSelectedFontSetId] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)

  if (!open) {
    return null
  }

  function handleGenerate() {
    onGenerate({
      text,
      stampSizeMm,
      spacingMm,
      lineSpacingMm,
      alignment,
      baselineAngleDeg,
      origin: { x: 0, y: 0 },
      fontFamily,
      layerId: defaultLayerId,
      lineTypeId: defaultLineTypeId,
    })
  }

  function persistFontSets(nextFontSets: LetterStampFontSet[]) {
    setFontSets(nextFontSets)
    saveLetterStampFontSets(nextFontSets)
  }

  function handleApplyFontSet(id: string) {
    setSelectedFontSetId(id)
    const fontSet = fontSets.find((entry) => entry.id === id)
    if (!fontSet) {
      return
    }
    setFontFamily(fontSet.fontFamily)
    setStampSizeMm(fontSet.stampSizeMm)
    setSpacingMm(fontSet.spacingMm)
    setLineSpacingMm(fontSet.lineSpacingMm)
  }

  function handleSaveFontSet() {
    const name = window.prompt('Font set name', `${fontFamily} ${stampSizeMm}mm`)?.trim()
    if (!name) {
      return
    }
    const fontSet = createLetterStampFontSet({
      name,
      fontFamily,
      stampSizeMm,
      spacingMm,
      lineSpacingMm,
    })
    persistFontSets([fontSet, ...fontSets])
    setSelectedFontSetId(fontSet.id)
  }

  function handleDeleteFontSet() {
    if (!selectedFontSetId) {
      return
    }
    persistFontSets(fontSets.filter((entry) => entry.id !== selectedFontSetId))
    setSelectedFontSetId('')
  }

  function handleSaveFontSetChanges() {
    if (!selectedFontSetId) {
      handleSaveFontSet()
      return
    }
    persistFontSets(fontSets.map((fontSet) =>
      fontSet.id === selectedFontSetId
        ? { ...fontSet, fontFamily, stampSizeMm, spacingMm, lineSpacingMm }
        : fontSet,
    ))
  }

  function handleRenameFontSet() {
    const selected = fontSets.find((entry) => entry.id === selectedFontSetId)
    if (!selected) {
      return
    }
    const name = window.prompt('Font set name', selected.name)?.trim()
    if (!name) {
      return
    }
    persistFontSets(fontSets.map((entry) => entry.id === selected.id ? { ...entry, name } : entry))
  }

  function handleExportFontSets() {
    const blob = new Blob([serializeLetterStampFontSets(fontSets)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'letter-stamp-font-sets.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFontSets(file: File | null) {
    if (!file) {
      return
    }
    try {
      const imported = parseLetterStampFontSets(await file.text())
      persistFontSets([...imported, ...fontSets])
      setSelectedFontSetId(imported[0]?.id ?? selectedFontSetId)
    } catch {
      window.alert('Could not import letter stamp font sets')
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
    }
  }

  function handleMakePlaceholder() {
    setText('ABCDEFGHIJKLMNOPQRSTUVWXYZ\n0123456789')
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Letter Stamp">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Letter Stamp</h3>

        <label className="field-row">
          <span>Text</span>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </label>

        <label className="field-row">
          <span>Stamp Size (mm)</span>
          <input
            type="number"
            min={4}
            max={20}
            step={0.5}
            value={stampSizeMm}
            onChange={(e) => setStampSizeMm(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Spacing (mm)</span>
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={spacingMm}
            onChange={(e) => setSpacingMm(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Line Spacing (mm)</span>
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={lineSpacingMm}
            onChange={(e) => setLineSpacingMm(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Alignment</span>
          <select value={alignment} onChange={(e) => setAlignment(e.target.value as 'left' | 'center' | 'right')}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>

        <label className="field-row">
          <span>Baseline Angle (deg)</span>
          <input
            type="number"
            min={0}
            max={360}
            step={1}
            value={baselineAngleDeg}
            onChange={(e) => setBaselineAngleDeg(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Font Family</span>
          <input
            type="text"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          />
        </label>

        <label className="field-row">
          <span>Font Set</span>
          <select value={selectedFontSetId} onChange={(e) => handleApplyFontSet(e.target.value)}>
            <option value="">Unsaved settings</option>
            {fontSets.map((fontSet) => (
              <option key={fontSet.id} value={fontSet.id}>
                {fontSet.name}
              </option>
            ))}
          </select>
        </label>

        <div className="button-row">
          <button onClick={handleSaveFontSetChanges}>{selectedFontSetId ? 'Save Changes' : 'Save Font Set'}</button>
          <button onClick={handleSaveFontSet}>Save As</button>
          <button onClick={handleRenameFontSet} disabled={!selectedFontSetId}>
            Rename
          </button>
          <button onClick={handleDeleteFontSet} disabled={!selectedFontSetId}>
            Delete Font Set
          </button>
          <button onClick={() => importInputRef.current?.click()}>Import</button>
          <button onClick={handleExportFontSets} disabled={fontSets.length === 0}>Export</button>
          <button onClick={handleMakePlaceholder}>Placeholder</button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(event) => void handleImportFontSets(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleGenerate}>Generate</button>
        </div>
      </div>
    </div>
  )
}
