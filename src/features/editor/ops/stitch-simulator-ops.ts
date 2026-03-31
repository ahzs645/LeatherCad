import type { Point, StitchHole } from '../cad/cad-types'
import { distance } from '../cad/cad-geometry'

export type StitchType = 'saddle' | 'running' | 'cross' | 'backstitch'

export type ThreadSegment = {
  from: Point
  to: Point
  threadIndex: 0 | 1
  side: 'front' | 'back'
}

export type StitchSimulatorResult = {
  segments: ThreadSegment[]
  threadLength: number
  holeCount: number
}

export type StitchSimulatorSettings = {
  stitchType: StitchType
  threadColor: string
  secondThreadColor: string
  threadWidthMm: number
  showBackStitches: boolean
}

const LEATHER_THICKNESS_MM = 3

export function getDefaultStitchSimulatorSettings(): StitchSimulatorSettings {
  return {
    stitchType: 'saddle',
    threadColor: '#d97706',
    secondThreadColor: '#92400e',
    threadWidthMm: 0.8,
    showBackStitches: true,
  }
}

function sortHolesBySequence(holes: StitchHole[]): StitchHole[] {
  return holes
    .slice()
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
}

export function simulateSaddleStitch(holes: StitchHole[]): StitchSimulatorResult {
  const sorted = sortHolesBySequence(holes)
  const segments: ThreadSegment[] = []

  if (sorted.length < 2) {
    return { segments, threadLength: 0, holeCount: sorted.length }
  }

  // Thread 0: front at even indices, back at odd indices
  // Thread 1: back at even indices, front at odd indices
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const from = sorted[i].point
    const to = sorted[i + 1].point

    // Thread 0: alternates front -> back -> front -> back ...
    const thread0Side: 'front' | 'back' = i % 2 === 0 ? 'front' : 'back'
    segments.push({ from, to, threadIndex: 0, side: thread0Side })

    // Thread 1: alternates back -> front -> back -> front ...
    const thread1Side: 'front' | 'back' = i % 2 === 0 ? 'back' : 'front'
    segments.push({ from, to, threadIndex: 1, side: thread1Side })
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

  return { segments, threadLength, holeCount: sorted.length }
}

export function simulateRunningStitch(holes: StitchHole[]): StitchSimulatorResult {
  const sorted = sortHolesBySequence(holes)
  const segments: ThreadSegment[] = []

  if (sorted.length < 2) {
    return { segments, threadLength: 0, holeCount: sorted.length }
  }

  // Single thread alternating front/back: front at hole[0]->hole[1], back at hole[1]->hole[2], etc.
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const side: 'front' | 'back' = i % 2 === 0 ? 'front' : 'back'
    segments.push({
      from: sorted[i].point,
      to: sorted[i + 1].point,
      threadIndex: 0,
      side,
    })
  }

  let threadLength = 0
  for (const segment of segments) {
    threadLength += distance(segment.from, segment.to)
  }
  // Add leather thickness per hole crossing
  threadLength += sorted.length * LEATHER_THICKNESS_MM

  return { segments, threadLength, holeCount: sorted.length }
}

export function simulateCrossStitch(holes: StitchHole[]): StitchSimulatorResult {
  const sorted = sortHolesBySequence(holes)
  const segments: ThreadSegment[] = []

  if (sorted.length < 2) {
    return { segments, threadLength: 0, holeCount: sorted.length }
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
    })
    // Connect to next pair on back side
    if (i + 2 < working.length) {
      segments.push({
        from: working[i + 1].point,
        to: working[i + 2].point,
        threadIndex: 0,
        side: 'back',
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
    })
    // Connect to previous pair on back side
    if (i - 2 >= 0) {
      segments.push({
        from: working[i - 1].point,
        to: working[i - 2].point,
        threadIndex: 0,
        side: 'back',
      })
    }
  }

  let threadLength = 0
  for (const segment of segments) {
    threadLength += distance(segment.from, segment.to)
  }
  threadLength += working.length * 2 * LEATHER_THICKNESS_MM

  return { segments, threadLength, holeCount: sorted.length }
}

export function simulateBackstitch(holes: StitchHole[]): StitchSimulatorResult {
  const sorted = sortHolesBySequence(holes)
  const segments: ThreadSegment[] = []

  if (sorted.length < 2) {
    return { segments, threadLength: 0, holeCount: sorted.length }
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

  return { segments, threadLength, holeCount: sorted.length }
}

export function simulateStitches(
  holes: StitchHole[],
  stitchType: StitchType,
): StitchSimulatorResult {
  switch (stitchType) {
    case 'saddle':
      return simulateSaddleStitch(holes)
    case 'running':
      return simulateRunningStitch(holes)
    case 'cross':
      return simulateCrossStitch(holes)
    case 'backstitch':
      return simulateBackstitch(holes)
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
