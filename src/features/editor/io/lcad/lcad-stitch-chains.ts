import type { Point } from '../../cad/cad-types'

export type LcadHoleRecord = { id: string; layerId: string; point: Point; runId?: string; seq?: number }
export type LcadHoleChain = { chainId?: string; sequence: number }

/** Neighbouring holes further apart than this are never joined into one row. */
const MAX_LINK_MM = 12
/** A link may be at most this much longer than either hole's nearest neighbour. */
const LINK_RATIO = 1.6
/** A run whose consecutive holes jump further than this times the median step is not a sewing path. */
const COHERENT_STEP_RATIO = 2.5

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function appendTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/** Above this many holes the nearest-neighbour check is skipped (quadratic). */
const MAX_COHERENCE_CHECK = 4000

/**
 * True when the run, ordered by `seq`, steps from hole to neighbouring hole:
 * every step is close to the typical spacing between neighbouring holes.
 */
function isCoherentRun(holes: LcadHoleRecord[]) {
  if (holes.length < 3) return true
  if (new Set(holes.map(hole => hole.seq)).size !== holes.length) return false
  const steps = holes.slice(1).map((hole, index) => distance(holes[index].point, hole.point))
  let spacing = median(steps)
  if (holes.length <= MAX_COHERENCE_CHECK) {
    spacing = median(holes.map((hole, index) => {
      let best = Infinity
      holes.forEach((other, otherIndex) => {
        if (otherIndex === index) return
        const gap = distance(hole.point, other.point)
        if (gap > 1e-6 && gap < best) best = gap
      })
      return best
    }).filter(Number.isFinite))
  }
  return steps.every(step => step <= Math.max(spacing * COHERENT_STEP_RATIO, spacing + 1))
}

/**
 * Orders loose holes into rows: each hole links to its closest neighbours (at
 * most two, no loops), and every connected row becomes one chain, numbered from
 * one end. Holes with no neighbour stay unchained.
 */
function chainByGeometry(holes: LcadHoleRecord[], result: Map<string, LcadHoleChain>) {
  const cells = new Map<string, number[]>()
  const cellOf = (point: Point) => [Math.floor(point.x / MAX_LINK_MM), Math.floor(point.y / MAX_LINK_MM)]
  holes.forEach((hole, index) => {
    const [cx, cy] = cellOf(hole.point)
    const key = `${cx}:${cy}`
    const cell = cells.get(key)
    if (cell) cell.push(index)
    else cells.set(key, [index])
  })
  const candidates: Array<[number, number, number]> = []
  const nearest = holes.map(() => Infinity)
  holes.forEach((hole, index) => {
    const [cx, cy] = cellOf(hole.point)
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const other of cells.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (other <= index) continue
          const gap = distance(hole.point, holes[other].point)
          if (gap < 1e-6 || gap > MAX_LINK_MM) continue
          candidates.push([gap, index, other])
          nearest[index] = Math.min(nearest[index], gap)
          nearest[other] = Math.min(nearest[other], gap)
        }
      }
    }
  })
  const parent = holes.map((_, index) => index)
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }
    return index
  }
  const links = holes.map(() => [] as number[])
  candidates.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  for (const [gap, a, b] of candidates) {
    if (gap > LINK_RATIO * Math.max(nearest[a], nearest[b])) continue
    if (links[a].length >= 2 || links[b].length >= 2) continue
    const rootA = find(a), rootB = find(b)
    if (rootA === rootB) continue
    parent[rootA] = rootB
    links[a].push(b)
    links[b].push(a)
  }
  const visited = new Set<number>()
  holes.forEach((_, start) => {
    if (visited.has(start) || links[start].length > 1) return
    const row: number[] = []
    let previous = -1, current = start
    while (current !== -1 && !visited.has(current)) {
      visited.add(current)
      row.push(current)
      const next = links[current].find(candidate => candidate !== previous) ?? -1
      previous = current
      current = next
    }
    const chainId = row.length > 1 ? `lcad-row-${holes[row[0]].id}` : undefined
    row.forEach((index, sequence) => result.set(holes[index].id, { chainId, sequence }))
  })
}

/**
 * Stitch chains for imported holes. The reference's `runId`/`seq` record how
 * holes were generated, which is not always the sewing order: a mirrored pair
 * of rows can share one run with alternating sequence numbers. Runs that step
 * from neighbour to neighbour keep their ids; holes from other runs and holes
 * with no run are regrouped into rows by position.
 */
export function planLcadStitchChains(holes: LcadHoleRecord[]): { chains: Map<string, LcadHoleChain>; regrouped: boolean } {
  const chains = new Map<string, LcadHoleChain>()
  const runs = new Map<string, LcadHoleRecord[]>()
  const loose: LcadHoleRecord[] = []
  for (const hole of holes) {
    if (hole.runId) appendTo(runs, hole.runId, hole)
    else loose.push(hole)
  }
  let regrouped = false
  for (const [runId, members] of runs) {
    const ordered = members.map((hole, index) => ({ hole, index })).sort((a, b) => (a.hole.seq ?? 0) - (b.hole.seq ?? 0) || a.index - b.index).map(entry => entry.hole)
    if (isCoherentRun(ordered)) ordered.forEach((hole, sequence) => chains.set(hole.id, { chainId: runId, sequence }))
    else {
      loose.push(...members)
      regrouped = true
    }
  }
  const byLayer = new Map<string, LcadHoleRecord[]>()
  for (const hole of loose) appendTo(byLayer, hole.layerId, hole)
  for (const layerHoles of byLayer.values()) chainByGeometry(layerHoles, chains)
  return { chains, regrouped }
}
