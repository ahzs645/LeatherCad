import type { Dispatch, SetStateAction } from 'react'
import type { FoldInstructionNode, FoldLine, ThreePreviewSettings } from '../cad/cad-types'
import { compileFoldTimeline } from '../three/fold-timeline'

type WorkbenchFoldTimelinePanelProps = {
  foldLines: FoldLine[]
  threePreviewSettings: ThreePreviewSettings
  onSetThreePreviewSettings: Dispatch<SetStateAction<ThreePreviewSettings>>
}

function defaultFoldTimeline(foldLines: FoldLine[]): FoldInstructionNode[] {
  return foldLines.map((foldLine, index) => ({
    id: `fold-step-${foldLine.id}-${index + 1}`,
    label: foldLine.name || `Fold ${index + 1}`,
    commands: [{
      foldLineId: foldLine.id,
      targetAngleDeg: foldLine.angleDeg,
      duration: 1,
    }],
  }))
}

function createFoldTimelineStep(foldLine: FoldLine, index: number): FoldInstructionNode {
  return {
    id: `fold-step-${foldLine.id}-${Date.now()}-${index + 1}`,
    label: foldLine.name || `Fold ${index + 1}`,
    commands: [{
      foldLineId: foldLine.id,
      targetAngleDeg: foldLine.angleDeg,
      duration: 1,
    }],
  }
}

export function WorkbenchFoldTimelinePanel({
  foldLines,
  threePreviewSettings,
  onSetThreePreviewSettings,
}: WorkbenchFoldTimelinePanelProps) {
  const authoredFoldTimeline = threePreviewSettings.foldTimeline ?? []
  const compiledFoldTimeline = compileFoldTimeline({
    foldLines,
    instructions: authoredFoldTimeline,
  })
  const foldProgress = threePreviewSettings.finalFoldProgress ?? 1
  const activeFoldStep = compiledFoldTimeline.find((step) => foldProgress >= step.start && foldProgress <= step.end)
  const updateFoldTimeline = (updater: (current: FoldInstructionNode[]) => FoldInstructionNode[]) => {
    onSetThreePreviewSettings((previous) => {
      const nextTimeline = updater(previous.foldTimeline ?? [])
      return {
        ...previous,
        foldTimeline: nextTimeline.length > 0 ? nextTimeline : undefined,
      }
    })
  }
  const updateFoldTimelineStep = (stepIndex: number, updater: (current: FoldInstructionNode) => FoldInstructionNode) => {
    updateFoldTimeline((current) => current.map((step, index) => (index === stepIndex ? updater(step) : step)))
  }

  return (
    <div className="control-block">
      <h3>Fold Timeline</h3>
      <p className="hint">
        {authoredFoldTimeline.length > 0
          ? `Authored sequence: ${compiledFoldTimeline.length} step${compiledFoldTimeline.length === 1 ? '' : 's'}.`
          : 'Default sequence follows the fold lines in document order.'}
      </p>
      {activeFoldStep && (
        <p className="hint">{`Active step: ${activeFoldStep.label} (${Math.round(activeFoldStep.start * 100)}-${Math.round(activeFoldStep.end * 100)}%)`}</p>
      )}
      <div className="button-row">
        <button
          type="button"
          disabled={foldLines.length === 0}
          onClick={() =>
            onSetThreePreviewSettings((previous) => ({
              ...previous,
              foldTimeline: defaultFoldTimeline(foldLines),
            }))
          }
        >
          Create From Folds
        </button>
        <button
          type="button"
          disabled={foldLines.length === 0}
          onClick={() => updateFoldTimeline((current) => [...current, createFoldTimelineStep(foldLines[0], current.length)])}
        >
          Add Step
        </button>
        <button
          type="button"
          disabled={authoredFoldTimeline.length === 0}
          onClick={() =>
            onSetThreePreviewSettings((previous) => ({
              ...previous,
              foldTimeline: undefined,
            }))
          }
        >
          Use Default
        </button>
      </div>
      {authoredFoldTimeline.length > 0 && (
        <div className="layer-toggle-list">
          {authoredFoldTimeline.map((step, stepIndex) => (
            <FoldTimelineStepEditor
              key={step.id}
              step={step}
              stepIndex={stepIndex}
              stepCount={authoredFoldTimeline.length}
              foldLines={foldLines}
              updateFoldTimeline={updateFoldTimeline}
              updateFoldTimelineStep={updateFoldTimelineStep}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FoldTimelineStepEditor({
  step,
  stepIndex,
  stepCount,
  foldLines,
  updateFoldTimeline,
  updateFoldTimelineStep,
}: {
  step: FoldInstructionNode
  stepIndex: number
  stepCount: number
  foldLines: FoldLine[]
  updateFoldTimeline: (updater: (current: FoldInstructionNode[]) => FoldInstructionNode[]) => void
  updateFoldTimelineStep: (stepIndex: number, updater: (current: FoldInstructionNode) => FoldInstructionNode) => void
}) {
  const command = step.commands?.[0]
  const selectedFoldLine = foldLines.find((foldLine) => foldLine.id === command?.foldLineId) ?? foldLines[0]
  const targetAngleDeg = command?.targetAngleDeg ?? selectedFoldLine?.angleDeg ?? 0
  const duration = command?.duration ?? 1

  return (
    <div className="fold-control-card">
      <strong>{`Step ${stepIndex + 1}`}</strong>
      <label className="field-row">
        <span>Label</span>
        <input
          value={step.label ?? ''}
          onChange={(event) => updateFoldTimelineStep(stepIndex, (current) => ({ ...current, label: event.target.value }))}
        />
      </label>
      <label className="field-row">
        <span>Fold line</span>
        <select
          value={command?.foldLineId ?? selectedFoldLine?.id ?? ''}
          onChange={(event) => {
            const nextFoldLine = foldLines.find((foldLine) => foldLine.id === event.target.value)
            updateFoldTimelineStep(stepIndex, (current) => ({
              ...current,
              commands: [{
                ...(current.commands?.[0] ?? {}),
                foldLineId: event.target.value,
                targetAngleDeg: nextFoldLine?.angleDeg ?? current.commands?.[0]?.targetAngleDeg ?? 0,
              }],
            }))
          }}
        >
          {foldLines.map((foldLine) => (
            <option key={foldLine.id} value={foldLine.id}>
              {foldLine.name || foldLine.id}
            </option>
          ))}
        </select>
      </label>
      <label className="field-row">
        <span>Target Angle</span>
        <input
          type="number"
          min={selectedFoldLine ? -selectedFoldLine.maxAngleDeg : -360}
          max={selectedFoldLine ? selectedFoldLine.maxAngleDeg : 360}
          step={1}
          value={targetAngleDeg}
          onChange={(event) =>
            updateFoldTimelineStep(stepIndex, (current) => ({
              ...current,
              commands: [{
                ...(current.commands?.[0] ?? { foldLineId: selectedFoldLine?.id ?? '' }),
                targetAngleDeg: Number(event.target.value),
              }],
            }))
          }
        />
      </label>
      <label className="field-row">
        <span>Duration</span>
        <input
          type="number"
          min={0.1}
          max={100}
          step={0.1}
          value={duration}
          onChange={(event) =>
            updateFoldTimelineStep(stepIndex, (current) => ({
              ...current,
              commands: [{
                ...(current.commands?.[0] ?? { foldLineId: selectedFoldLine?.id ?? '' }),
                duration: Number(event.target.value),
              }],
            }))
          }
        />
      </label>
      <div className="button-row">
        <button type="button" disabled={stepIndex === 0} onClick={() => moveStep(updateFoldTimeline, stepIndex, -1)}>
          Move Up
        </button>
        <button type="button" disabled={stepIndex === stepCount - 1} onClick={() => moveStep(updateFoldTimeline, stepIndex, 1)}>
          Move Down
        </button>
        <button type="button" onClick={() => updateFoldTimeline((current) => current.filter((_, index) => index !== stepIndex))}>
          Delete
        </button>
      </div>
    </div>
  )
}

function moveStep(
  updateFoldTimeline: (updater: (current: FoldInstructionNode[]) => FoldInstructionNode[]) => void,
  stepIndex: number,
  offset: -1 | 1,
) {
  updateFoldTimeline((current) => {
    const next = [...current]
    const swapIndex = stepIndex + offset
    const swap = next[swapIndex]
    next[swapIndex] = next[stepIndex]
    next[stepIndex] = swap
    return next
  })
}
