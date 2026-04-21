import type { Point, StitchHole } from '../cad/cad-types'
import type { FinalProductDiagnostic, StitchChain, StitchPair } from './final-product-types'

const MIN_CHAIN_HOLES = 2
const PITCH_TOLERANCE_RATIO = 0.22
const PAIR_SCORE_THRESHOLD = 0.55
const AMBIGUITY_MARGIN = 0.07

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function pointBounds(points: Point[]) {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  return { minX, maxX, minY, maxY }
}

function normalizeDirection(start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length <= 1e-6) {
    return { x: 1, y: 0 }
  }
  return { x: dx / length, y: dy / length }
}

function sortHolesBySequence(holes: StitchHole[]) {
  return [...holes].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
}

function makeChain(id: string, holes: StitchHole[], explicit: boolean): StitchChain | null {
  const sortedHoles = sortHolesBySequence(holes)
  if (sortedHoles.length < MIN_CHAIN_HOLES) {
    return null
  }

  const points = sortedHoles.map((hole) => hole.point)
  const segmentLengths = points.slice(1).map((point, index) => distance(points[index], point))
  const lengthMm = segmentLengths.reduce((sum, value) => sum + value, 0)
  const start = points[0]
  const end = points[points.length - 1]

  return {
    id,
    holes: sortedHoles,
    pointCount: sortedHoles.length,
    pitchMm: average(segmentLengths),
    lengthMm,
    start,
    end,
    direction: normalizeDirection(start, end),
    bounds: pointBounds(points),
    explicit,
  }
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function inferSpatialChains(holes: StitchHole[]) {
  if (holes.length < MIN_CHAIN_HOLES) {
    return [] as StitchChain[]
  }

  const ordered = sortHolesBySequence(holes)
  const gaps = ordered.slice(1).map((hole, index) => distance(ordered[index].point, hole.point))
  const typicalGap = Math.max(median(gaps), 1)
  const chains: StitchHole[][] = []
  let current: StitchHole[] = []

  for (const [index, hole] of ordered.entries()) {
    const previous = ordered[index - 1]
    if (previous && distance(previous.point, hole.point) > typicalGap * 2.5 && current.length > 0) {
      chains.push(current)
      current = []
    }
    current.push(hole)
  }
  if (current.length > 0) {
    chains.push(current)
  }

  return chains
    .map((chain, index) => makeChain(`inferred-chain-${index + 1}`, chain, false))
    .filter((chain): chain is StitchChain => chain !== null)
}

export function buildStitchChains(stitchHoles: StitchHole[]) {
  const diagnostics: FinalProductDiagnostic[] = []
  const explicitGroups = new Map<string, StitchHole[]>()
  const shapeGroups = new Map<string, StitchHole[]>()
  const ungrouped: StitchHole[] = []

  for (const hole of stitchHoles) {
    if (hole.chainId) {
      const group = explicitGroups.get(hole.chainId) ?? []
      group.push(hole)
      explicitGroups.set(hole.chainId, group)
      continue
    }

    const shapeGroup = shapeGroups.get(hole.shapeId) ?? []
    shapeGroup.push(hole)
    shapeGroups.set(hole.shapeId, shapeGroup)
  }

  const chains: StitchChain[] = []
  for (const [chainId, holes] of explicitGroups) {
    const chain = makeChain(chainId, holes, true)
    if (chain) {
      chains.push(chain)
    } else {
      diagnostics.push({
        id: `stitch-chain-short-${chainId}`,
        code: 'stitch-chain-short',
        severity: 'warning',
        message: `Stitch chain ${chainId} has fewer than two holes and cannot be paired.`,
        chainIds: [chainId],
      })
    }
  }

  for (const [shapeId, holes] of shapeGroups) {
    if (holes.length >= MIN_CHAIN_HOLES) {
      const chain = makeChain(`shape-${shapeId}`, holes, false)
      if (chain) {
        chains.push(chain)
      }
      continue
    }
    ungrouped.push(...holes)
  }

  chains.push(...inferSpatialChains(ungrouped))

  return {
    chains: chains.sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics,
  }
}

function centeredRms(left: Point[], right: Point[]) {
  const leftCenter = {
    x: average(left.map((point) => point.x)),
    y: average(left.map((point) => point.y)),
  }
  const rightCenter = {
    x: average(right.map((point) => point.x)),
    y: average(right.map((point) => point.y)),
  }

  let sum = 0
  for (let index = 0; index < left.length; index += 1) {
    const dx = (left[index].x - leftCenter.x) - (right[index].x - rightCenter.x)
    const dy = (left[index].y - leftCenter.y) - (right[index].y - rightCenter.y)
    sum += dx * dx + dy * dy
  }
  return Math.sqrt(sum / Math.max(left.length, 1))
}

function perpendicularDistance(left: StitchChain, right: StitchChain) {
  const leftCenter = {
    x: (left.bounds.minX + left.bounds.maxX) / 2,
    y: (left.bounds.minY + left.bounds.maxY) / 2,
  }
  const rightCenter = {
    x: (right.bounds.minX + right.bounds.maxX) / 2,
    y: (right.bounds.minY + right.bounds.maxY) / 2,
  }
  const dx = rightCenter.x - leftCenter.x
  const dy = rightCenter.y - leftCenter.y
  return Math.abs(dx * -left.direction.y + dy * left.direction.x)
}

function projectionOverlapScore(left: StitchChain, right: StitchChain) {
  const axis = left.direction
  const leftPoints = left.holes.map((hole) => hole.point.x * axis.x + hole.point.y * axis.y)
  const rightPoints = right.holes.map((hole) => hole.point.x * axis.x + hole.point.y * axis.y)
  const leftMin = Math.min(...leftPoints)
  const leftMax = Math.max(...leftPoints)
  const rightMin = Math.min(...rightPoints)
  const rightMax = Math.max(...rightPoints)
  const overlap = Math.max(0, Math.min(leftMax, rightMax) - Math.max(leftMin, rightMin))
  const span = Math.max(leftMax - leftMin, rightMax - rightMin, 1)
  return overlap / span
}

type Candidate = {
  left: StitchChain
  right: StitchChain
  reversed: boolean
  score: number
  rmsErrorMm: number
}

function scorePair(left: StitchChain, right: StitchChain): Candidate | null {
  if (left.pointCount !== right.pointCount || left.pointCount < MIN_CHAIN_HOLES) {
    return null
  }

  const pitchBase = Math.max(left.pitchMm, right.pitchMm, 1e-6)
  const pitchRatio = Math.abs(left.pitchMm - right.pitchMm) / pitchBase
  if (pitchRatio > PITCH_TOLERANCE_RATIO) {
    return null
  }

  const leftPoints = left.holes.map((hole) => hole.point)
  const rightPoints = right.holes.map((hole) => hole.point)
  const directRms = centeredRms(leftPoints, rightPoints)
  const reversedPoints = [...rightPoints].reverse()
  const reversedRms = centeredRms(leftPoints, reversedPoints)
  const reversed = reversedRms <= directRms
  const rmsErrorMm = Math.min(directRms, reversedRms)
  const dot = left.direction.x * right.direction.x + left.direction.y * right.direction.y
  const directionScore = reversed || dot < -0.2 ? 1 : 0.68
  const pitchScore = 1 - pitchRatio
  const shapeScore = 1 / (1 + rmsErrorMm / Math.max(left.pitchMm, right.pitchMm, 1))
  const overlapScore = projectionOverlapScore(left, right)
  const distanceScore = 1 / (1 + perpendicularDistance(left, right) / Math.max(left.lengthMm, right.lengthMm, 1))
  const compatibleDistanceScore = distanceScore * (0.35 + 0.65 * overlapScore)
  const score = (
    0.28 * pitchScore +
    0.22 * directionScore +
    0.12 * shapeScore +
    0.13 * overlapScore +
    0.25 * compatibleDistanceScore
  )

  return { left, right, reversed, score, rmsErrorMm }
}

export function pairStitchChains(chains: StitchChain[]) {
  const diagnostics: FinalProductDiagnostic[] = []
  const candidates: Candidate[] = []
  for (let leftIndex = 0; leftIndex < chains.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < chains.length; rightIndex += 1) {
      const candidate = scorePair(chains[leftIndex], chains[rightIndex])
      if (candidate) {
        candidates.push(candidate)
      }
    }
  }

  candidates.sort((left, right) => right.score - left.score)
  const used = new Set<string>()
  const pairs: StitchPair[] = []

  for (const candidate of candidates) {
    if (used.has(candidate.left.id) || used.has(candidate.right.id)) {
      continue
    }

    const alternatives = candidates.filter((entry) => {
      if (entry === candidate) return false
      if (used.has(entry.left.id) || used.has(entry.right.id)) return false
      return (
        entry.left.id === candidate.left.id ||
        entry.left.id === candidate.right.id ||
        entry.right.id === candidate.left.id ||
        entry.right.id === candidate.right.id
      )
    })
    const nextBestScore = alternatives[0]?.score ?? 0

    if (candidate.score < PAIR_SCORE_THRESHOLD) {
      diagnostics.push({
        id: `stitch-pair-low-score-${candidate.left.id}-${candidate.right.id}`,
        code: 'stitch-pair-low-score',
        severity: 'warning',
        message: `Stitch chains ${candidate.left.id} and ${candidate.right.id} match by count but not by pitch/direction strongly enough.`,
        chainIds: [candidate.left.id, candidate.right.id],
      })
      continue
    }

    if (nextBestScore > 0 && nextBestScore >= candidate.score - AMBIGUITY_MARGIN) {
      diagnostics.push({
        id: `stitch-pair-ambiguous-${candidate.left.id}-${candidate.right.id}`,
        code: 'stitch-pair-ambiguous',
        severity: 'warning',
        message: `Stitch chains ${candidate.left.id} and ${candidate.right.id} have an ambiguous alternate pairing.`,
        chainIds: [candidate.left.id, candidate.right.id],
      })
      continue
    }

    used.add(candidate.left.id)
    used.add(candidate.right.id)
    pairs.push({
      id: `stitch-pair-${pairs.length + 1}`,
      left: candidate.left,
      right: candidate.right,
      reversed: candidate.reversed,
      score: candidate.score,
      rmsErrorMm: candidate.rmsErrorMm,
      status: 'paired',
    })
  }

  for (const chain of chains) {
    if (!used.has(chain.id)) {
      diagnostics.push({
        id: `stitch-chain-unpaired-${chain.id}`,
        code: 'stitch-chain-unpaired',
        severity: 'warning',
        message: `Stitch chain ${chain.id} is unpaired.`,
        chainIds: [chain.id],
      })
    }
  }

  return { pairs, diagnostics }
}
