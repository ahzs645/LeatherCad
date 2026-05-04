import type { FoldInstructionNode, FoldLine, FoldStepCommand } from '../cad/cad-types'
import type { FinalProductDiagnostic } from './final-product-types'

export type { FoldInstructionNode, FoldStepCommand } from '../cad/cad-types'

export type CompiledFoldTimelineStep = {
  id: string
  label: string
  start: number
  end: number
  commands: FoldStepCommand[]
}

export type FoldTimelineCompileInput = {
  foldLines: FoldLine[]
  instructions?: FoldInstructionNode[]
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1))
}

function commandDuration(commands: FoldStepCommand[]) {
  const durations = commands
    .map((command) => command.duration)
    .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration > 0)
  return Math.max(1, ...durations)
}

function collectInstructionSteps(node: FoldInstructionNode): Array<{ id: string; label: string; commands: FoldStepCommand[] }> {
  const ownSteps = node.commands && node.commands.length > 0
    ? [{ id: node.id, label: node.label ?? node.id, commands: node.commands }]
    : []
  const childSteps = (node.children ?? []).flatMap(collectInstructionSteps)
  return [...ownSteps, ...childSteps]
}

function defaultInstructionSteps(foldLines: FoldLine[]) {
  return foldLines.map((foldLine) => ({
    id: `fold-step-${foldLine.id}`,
    label: foldLine.name || foldLine.id,
    commands: [{ foldLineId: foldLine.id, targetAngleDeg: foldLine.angleDeg }],
  }))
}

export function compileFoldTimeline({ foldLines, instructions = [] }: FoldTimelineCompileInput): CompiledFoldTimelineStep[] {
  const rawSteps = instructions.length > 0
    ? instructions.flatMap(collectInstructionSteps)
    : defaultInstructionSteps(foldLines)
  const totalDuration = rawSteps.reduce((sum, step) => sum + commandDuration(step.commands), 0)
  if (totalDuration <= 0) {
    return []
  }

  let cursor = 0
  return rawSteps.map((step, index) => {
    const duration = commandDuration(step.commands)
    const start = cursor / totalDuration
    cursor += duration
    return {
      id: step.id || `fold-step-${index + 1}`,
      label: step.label || step.id || `Fold step ${index + 1}`,
      start,
      end: cursor / totalDuration,
      commands: step.commands.map((command) => ({ ...command })),
    }
  })
}

export function validateFoldTimeline(
  timeline: CompiledFoldTimelineStep[],
  foldLines: FoldLine[],
): FinalProductDiagnostic[] {
  const diagnostics: FinalProductDiagnostic[] = []
  const foldLineIds = new Set(foldLines.map((foldLine) => foldLine.id))
  const stepIds = new Set<string>()

  for (const step of timeline) {
    if (stepIds.has(step.id)) {
      diagnostics.push({
        id: `fold-timeline-duplicate-step-${step.id}`,
        code: 'fold-timeline-duplicate-step',
        severity: 'warning',
        message: `Fold timeline step ${step.id} is duplicated.`,
      })
    }
    stepIds.add(step.id)

    if (step.end <= step.start) {
      diagnostics.push({
        id: `fold-timeline-invalid-window-${step.id}`,
        code: 'fold-timeline-invalid-window',
        severity: 'warning',
        message: `Fold timeline step ${step.label} has an invalid progress window.`,
      })
    }

    for (const command of step.commands) {
      if (!foldLineIds.has(command.foldLineId)) {
        diagnostics.push({
          id: `fold-timeline-missing-fold-${step.id}-${command.foldLineId}`,
          code: 'fold-timeline-missing-fold',
          severity: 'warning',
          message: `Fold timeline step ${step.label} references missing fold line ${command.foldLineId}.`,
          foldLineIds: [command.foldLineId],
        })
      }
    }
  }

  return diagnostics
}

export function foldLinesAtTimelineProgress(
  foldLines: FoldLine[],
  timeline: CompiledFoldTimelineStep[],
  progress: number,
) {
  const resolvedProgress = clamp01(progress)
  const baseAngles = new Map(foldLines.map((foldLine) => [foldLine.id, 0]))
  const targetAngles = new Map(foldLines.map((foldLine) => [foldLine.id, foldLine.angleDeg]))

  for (const step of timeline) {
    const stepSpan = Math.max(step.end - step.start, 1e-6)
    const localProgress = clamp01((resolvedProgress - step.start) / stepSpan)
    if (resolvedProgress < step.start) {
      continue
    }

    for (const command of step.commands) {
      if (!baseAngles.has(command.foldLineId)) {
        continue
      }
      const current = baseAngles.get(command.foldLineId) ?? 0
      const target = command.targetAngleDeg ?? targetAngles.get(command.foldLineId) ?? 0
      baseAngles.set(command.foldLineId, current + (target - current) * localProgress)
    }

    if (resolvedProgress < step.end) {
      break
    }
  }

  return foldLines.map((foldLine) => ({
    ...foldLine,
    angleDeg: baseAngles.get(foldLine.id) ?? 0,
  }))
}

export function buildFoldTimelinePreview({
  foldLines,
  instructions,
  progress,
}: FoldTimelineCompileInput & { progress: number }) {
  const timeline = compileFoldTimeline({ foldLines, instructions })
  return {
    timeline,
    diagnostics: validateFoldTimeline(timeline, foldLines),
    foldLines: foldLinesAtTimelineProgress(foldLines, timeline, progress),
  }
}
