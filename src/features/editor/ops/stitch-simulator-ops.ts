import type { Point, StitchHole } from '../cad/cad-types'
import { distance } from '../cad/cad-geometry'

export type StitchType = 'saddle' | 'running' | 'cross' | 'backstitch'

export type ThreadSegment = {
  from: Point
  to: Point
  threadIndex: 0 | 1
  side: 'front' | 'back'
  stepIndex: number
  parity: 'even' | 'odd'
}

export type StitchSimulatorResult = {
  segments: ThreadSegment[]
  threadLength: number
  holeCount: number
  terminalHoleId: string | null
}

export type StitchSimulatorSettings = {
  stitchType: StitchType
  threadColor: string
  secondThreadColor: string
  threadWidthMm: number
  showSimulatorPattern: boolean
  showBackStitches: boolean
  showEvenStitches: boolean
  showOddStitches: boolean
  showDirectionArrows: boolean
  endHoleId: string | null
}

const LEATHER_THICKNESS_MM = 3

export function getDefaultStitchSimulatorSettings(): StitchSimulatorSettings {
  return {
    stitchType: 'saddle',
    threadColor: '#d97706',
    secondThreadColor: '#92400e',
    threadWidthMm: 0.8,
    showSimulatorPattern: true,
    showBackStitches: true,
    showEvenStitches: true,
    showOddStitches: true,
    showDirectionArrows: true,
    endHoleId: null,
  }
}

function sortHolesBySequence(holes: StitchHole[]): StitchHole[] {
  return holes
    .slice()
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
}

function limitHolesByEnd(holes: StitchHole[], endHoleId: string | null) {
  const sorted = sortHolesBySequence(holes)
  if (!endHoleId) {
    return sorted
  }
  const endIndex = sorted.findIndex((hole) => hole.id === endHoleId)
  if (endIndex < 0) {
    return sorted
  }
  return sorted.slice(0, endIndex + 1)
}

function resolveGroupEndHoleId(holes: StitchHole[], endHoleId: string | null) {
  const persisted = holes.find((hole) => hole.endHole === true)?.id ?? null
  if (persisted) {
    return persisted
  }
  if (endHoleId && holes.some((hole) => hole.id === endHoleId)) {
    return endHoleId
  }
  return null
}

function filterSegments(segments: ThreadSegment[], settings: StitchSimulatorSettings) {
  return segments.filter((segment) => {
    if (!settings.showBackStitches && segment.side === 'back') {
      return false
    }
    if (!settings.showEvenStitches && segment.parity === 'even') {
      return false
    }
    if (!settings.showOddStitches && segment.parity === 'odd') {
      return false
    }
    return true
  })
}

export function simulateSaddleStitch(holes: StitchHole[]): StitchSimulatorResult {
  const sorted = sortHolesBySequence(holes)
  const segments: ThreadSegment[] = []

  if (sorted.length < 2) {
    return { segments, threadLength: 0, holeCount: sorted.length, terminalHoleId: sorted[sorted.length - 1]?.id ?? null }
  }

  // Thread 0: front at even indices, back at odd indices
  // Thread 1: back at even indices, front at odd indices
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const from = sorted[i].point
    const to = sorted[i + 1].point
    const parity = i % 2 === 0 ? 'even' : 'odd'

    // Thread 0: alternates front -> back -> front -> back ...
    const thread0Side: 'front' | 'back' = i % 2 === 0 ? 'front' : 'back'
    segments.push({ from, to, threadIndex: 0, side: thread0Side, stepIndex: i, parity })

    // Thread 1: alternates back -> front -> back -> front ...
    const thread1Side: 'front' | 'back' = i % 2 === 0 ? 'back' : 'front'
    segments.push({ from, to, threadIndex: 1, side: thread1Side, stepIndex: i, parity })
  }

  // Calculate thread length: sum of all segment distances for one thread,
  // then double for both threads, plus thickness crossings
  let singleThreadLength = 0
  for (let i = 0; i < sorted.length - 1; i += 1) {
    singleThreadLength += distance(sorted[i].point, sorted[i + 1].point)
  }

  // Each hole crossing (where thread passes through leather) adds ~3mm
  // Each thread crosses at every hole. Number of crossings per thread = number of holes
  const crossingsPerThread = sorted.length
  const threadLength = singleThreadLength * 2 + crossingsPerThread * 2 * LEATHER_THICKNESS_MM

  return { segments, threadLength, holeCount: sorted.length, terminalHoleId: sorted[sorted.length - 1]?.id ?? null }
}

export function simulateRunningStitch(holes: StitchHole[]): StitchSimulatorResult {
  const sorted = sortHolesBySequence(holes)
  const segments: ThreadSegment[] = []

  if (sorted.length < 2) {
    return { segments, threadLength: 0, holeCount: sorted.length, terminalHoleId: sorted[sorted.length - 1]?.id ?? null }
  }

  // Single thread alternating front/back: front at hole[0]->hole[1], back at hole[1]->hole[2], etc.
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const side: 'front' | 'back' = i % 2 === 0 ? 'front' : 'back'
    segments.push({
      from: sorted[i].point,
      to: sorted[i + 1].point,
      threadIndex: 0,
      side,
      stepIndex: i,
      parity: i % 2 === 0 ? 'even' : 'odd',
    })
  }

  let threadLength = 0
  for (const segment of segments) {
    threadLength += distance(segment.from, segment.to)
  }
  // Add leather thickness per hole crossing
  threadLength += sorted.length * LEATHER_THICKNESS_MM

  return { segments, threadLength, holeCount: sorted.length, terminalHoleId: sorted[sorted.length - 1]?.id ?? null }
}

export function simulateCrossStitch(holes: StitchHole[]): StitchSimulatorResult {
  const sorted = sortHolesBySequence(holes)
  const segments: ThreadSegment[] = []

  if (sorted.length < 2) {
    return { segments, threadLength: 0, holeCount: sorted.length, terminalHoleId: sorted[sorted.length - 1]?.id ?? null }
  }

  // Ensure even number of holes by trimming the last if odd
  const evenCount = sorted.length % 2 === 0 ? sorted.length : sorted.length - 1
  const working = sorted.slice(0, evenCount)

  // First pass (forward): connect pairs on front side — hole[0]->hole[1], hole[2]->hole[3], etc.
  for (let i = 0; i < working.length - 1; i += 2) {
    segments.push({
      from: working[i].point,
      to: working[i + 1].point,
      threadIndex: 0,
      side: 'front',
      stepIndex: i,
      parity: i % 2 === 0 ? 'even' : 'odd',
    })
    // Connect to next pair on back side
    if (i + 2 < working.length) {
      segments.push({
        from: working[i + 1].point,
        to: working[i + 2].point,
        threadIndex: 0,
        side: 'back',
        stepIndex: i + 1,
        parity: (i + 1) % 2 === 0 ? 'even' : 'odd',
      })
    }
  }

  // Second pass (backward): create the X by connecting hole[1]->hole[0], hole[3]->hole[2], etc.
  // This goes in reverse to create the crossing pattern
  for (let i = working.length - 1; i >= 1; i -= 2) {
    segments.push({
      from: working[i].point,
      to: working[i - 1].point,
      threadIndex: 0,
      side: 'front',
      stepIndex: i,
      parity: i % 2 === 0 ? 'even' : 'odd',
    })
    // Connect to previous pair on back side
    if (i - 2 >= 0) {
      segments.push({
        from: working[i - 1].point,
        to: working[i - 2].point,
        threadIndex: 0,
        side: 'back',
        stepIndex: i - 1,
        parity: (i - 1) % 2 === 0 ? 'even' : 'odd',
      })
    }
  }

  let threadLength = 0
  for (const segment of segments) {
    threadLength += distance(segment.from, segment.to)
  }
  threadLength += working.length * 2 * LEATHER_THICKNESS_MM

  return { segments, threadLength, holeCount: sorted.length, terminalHoleId: working[working.length - 1]?.id ?? null }
}

export function simulateBackstitch(holes: StitchHole[]): StitchSimulatorResult {
  const sorted = sortHolesBySequence(holes)
  const segments: ThreadSegment[] = []

  if (sorted.length < 2) {
    return { segments, threadLength: 0, holeCount: sorted.length, terminalHoleId: sorted[sorted.length - 1]?.id ?? null }
  }

  // Backstitch pattern: forward two holes, back one hole
  // This creates overlapping stitches for strength
  let current = 0
  let onFront = true

  while (current < sorted.length - 1) {
    if (onFront) {
      // Forward two holes (or to the end if fewer remain)
      const target = Math.min(current + 2, sorted.length - 1)
      segments.push({
        from: sorted[current].point,
        to: sorted[target].point,
        threadIndex: 0,
        side: 'front',
        stepIndex: segments.length,
        parity: segments.length % 2 === 0 ? 'even' : 'odd',
      })
      current = target
      onFront = false
    } else {
      // Back one hole on the back side
      const target = current - 1
      if (target < 0) {
        break
      }
      segments.push({
        from: sorted[current].point,
        to: sorted[target].point,
        threadIndex: 0,
        side: 'back',
        stepIndex: segments.length,
        parity: segments.length % 2 === 0 ? 'even' : 'odd',
      })
      current = target
      onFront = true
    }

    // Safety: if we're back at hole 0, advance forward to avoid infinite loop
    if (!onFront && current <= 0) {
      break
    }
  }

  let threadLength = 0
  for (const segment of segments) {
    threadLength += distance(segment.from, segment.to)
  }
  threadLength += sorted.length * LEATHER_THICKNESS_MM

  return { segments, threadLength, holeCount: sorted.length, terminalHoleId: sorted[sorted.length - 1]?.id ?? null }
}

export function simulateStitches(
  holes: StitchHole[],
  settings: StitchSimulatorSettings,
): StitchSimulatorResult {
  if (holes.length === 0) {
    return {
      segments: [],
      threadLength: 0,
      holeCount: 0,
      terminalHoleId: null,
    }
  }

  const grouped = groupHolesByShape(holes)
  const aggregatedSegments: ThreadSegment[] = []
  let threadLength = 0
  let holeCount = 0
  let terminalHoleId: string | null = null

  for (const group of grouped.values()) {
    const groupEndHoleId = resolveGroupEndHoleId(group, settings.endHoleId)
    const workingHoles = limitHolesByEnd(group, groupEndHoleId)
    const baseResult = (() => {
      switch (settings.stitchType) {
        case 'saddle':
          return simulateSaddleStitch(workingHoles)
        case 'running':
          return simulateRunningStitch(workingHoles)
        case 'cross':
          return simulateCrossStitch(workingHoles)
        case 'backstitch':
          return simulateBackstitch(workingHoles)
      }
    })()

    aggregatedSegments.push(...filterSegments(baseResult.segments, settings))
    threadLength += baseResult.threadLength
    holeCount += baseResult.holeCount
    if (!terminalHoleId) {
      terminalHoleId = groupEndHoleId ?? baseResult.terminalHoleId
    }
  }

  return {
    segments: aggregatedSegments,
    threadLength,
    holeCount,
    terminalHoleId,
  }
}

export function groupHolesByShape(holes: StitchHole[]): Map<string, StitchHole[]> {
  const groups = new Map<string, StitchHole[]>()

  for (const hole of holes) {
    const group = groups.get(hole.shapeId)
    if (group) {
      group.push(hole)
    } else {
      groups.set(hole.shapeId, [hole])
    }
  }

  // Sort each group by sequence
  for (const [shapeId, group] of groups) {
    groups.set(shapeId, sortHolesBySequence(group))
  }

  return groups
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildStitchSimulatorSvgPaths(
  result: StitchSimulatorResult,
  settings: StitchSimulatorSettings,
): string[] {
  const elements: string[] = []

  for (const segment of result.segments) {
    if (!settings.showBackStitches && segment.side === 'back') {
      continue
    }

    const color = segment.threadIndex === 0 ? settings.threadColor : settings.secondThreadColor
    const strokeDasharray = segment.side === 'back' ? ` stroke-dasharray="4 2"` : ''

    const x1 = segment.from.x.toFixed(3)
    const y1 = segment.from.y.toFixed(3)
    const x2 = segment.to.x.toFixed(3)
    const y2 = segment.to.y.toFixed(3)

    elements.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeAttr(color)}" stroke-width="${settings.threadWidthMm}"${strokeDasharray} stroke-linecap="round" />`,
    )
  }

  return elements
}
