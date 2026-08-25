/**
 * The simulated fold: a piece's mid-surface as cloth, folded by sweeping it
 * along its crease pose with contact turned on.
 *
 * The analytic fold in `assembled-fold-bend.ts` rotates rigid halves and
 * bridges them with an arc it knows is right for the stack the fold closes
 * over. That solves the dominant case exactly and cannot do the general one:
 * a flap will pass through anything it is not specifically accounted for,
 * and the leather stays rigid to either side of the bend. This module is the
 * general case. The piece becomes a triangle mesh with the flat pattern as
 * its rest state; XPBD distance constraints keep the leather inextensible,
 * bending constraints keep it smooth, soft anchors sweep it from flat to the
 * folded pose — a real fold motion, not a teleport — and the triangle
 * collider answers contact against the piece itself and against every other
 * piece in the assembly, sewn to it or not. What comes back is wherever the
 * leather actually settles.
 *
 * Everything here happens in the piece's own document frame: x and z are
 * document millimetres, y is height in millimetres above the flat sheet.
 * `flatToWorld ∘ projectPiecePoint` maps that frame into the scene without
 * mirroring (its two y-negations cancel), so a fold that rises here rises on
 * screen.
 */

import { triangulate } from '@atelier/geometry'
import {
  buildClothConstraints,
  createAnchorConstraint,
  createClothState,
  createTriangleCollider,
  creaseChainPose,
  settleXpbdCloth,
  type CreaseFold,
  type XpbdAnchorConstraint,
} from '@atelier/sim'
import type { Point } from '../cad/cad-types'

/** More vertices than this and the settle would stall the rebuild. */
const MAX_CLOTH_VERTICES = 700
/** Most steps a sweep takes; a shallow fold sweeps proportionally fewer. */
const MAX_RAMP_STEPS = 80
/** Fewest steps a sweep from flat takes, however shallow the fold. */
const MIN_RAMP_STEPS = 16
/**
 * Fewest steps a sweep from an already-solved drape takes. A warm start begins
 * a fold's width from its answer instead of a half-turn away, so the sweep is
 * only there to let contact re-catch the leather over a small move.
 */
const MIN_WARM_RAMP_STEPS = 6
/** Steps allowed for the contact-perturbed state to stop moving. */
const MAX_SETTLE_STEPS = 120
/** A step that moves nothing farther than this (mm) counts as settled. */
const REST_DISPLACEMENT_MM = 5e-2
/** How many of the way an anchor pulls per iteration — weak, so contact wins. */
const ANCHOR_HOLD_FRACTION = 0.01
/** Narrowest bend zone the mesher will resolve, whatever the radius asks for. */
const MIN_BEND_ZONE_MM = 1.5
/** Rest-space offset that keeps obstacle vertices clear of the mesh filter. */
const OBSTACLE_REST_OFFSET_MM = 1e5

const SOLVE_OPTIONS = {
  dt: 1 / 60,
  substeps: 5,
  iterations: 4,
  damping: 0.7,
}

export type DrapeFoldInput = {
  foldLineId: string
  start: Point
  end: Point
  /** Signed the way the assembled renderer signs it: mountain −, valley +. */
  angleDeg: number
  bendRadiusMm: number
  /** A point on the half that swings, which fixes the crease's orientation. */
  swingSample: Point
}

/** A rigid body the fold can land on, in the piece's document frame. */
export type DrapeObstacleMesh = {
  /** x, height, y triples, millimetres. */
  positions: number[]
  triangles: number[]
}

/** What the solver is asked for: a piece, its folds, and what is in the way. */
export type FoldDrapeParams = {
  outer: Point[]
  holes: Point[][]
  folds: DrapeFoldInput[]
  thicknessMm: number
  obstacles?: DrapeObstacleMesh[]
  /** A previous solve of the same mesh to start from. */
  warmStart?: FoldDrapeWarmStart
}

/**
 * A settled drape, offered back to the solver as the starting state for the
 * next one.
 *
 * Consecutive states of a scrub are neighbours: the leather at 91° is the
 * leather at 90° nudged. Handing the previous solve back turns a sweep from
 * flat into a sweep across the angle that actually changed. `restPositions` is
 * what proves the correspondence — two meshes with the same rest state are the
 * same mesh, vertex for vertex, so a warm start that survives that check
 * cannot mix two pieces' geometry up.
 */
export type FoldDrapeWarmStart = {
  /** Solved positions of that mesh, x/height/y triples. */
  positions: Float32Array
  /** Its flat rest positions, xy pairs. */
  restPositions: Float32Array
  /** The pose it settled at, which the next sweep ramps away from. */
  creases: CreaseFold[]
}

/**
 * The drape as plain data: what a solve produces, and all of it survives a
 * structured clone, so the solve can run in a worker and post this back.
 */
export type FoldDrapeData = {
  /** Solved mid-surface, x/height/y triples in the piece's document frame. */
  positions: Float32Array
  /** Flat rest position of each vertex, xy pairs, document millimetres. */
  restPositions: Float32Array
  /** Wound so the flat mesh's normals point up — the leather's grain side. */
  triangles: number[]
  /** Area-weighted vertex normals of the solved surface. */
  normals: Float32Array
  /** Vertex loops of the cut boundary: the outline first, then each cutout. */
  boundaryLoops: number[][]
  settled: boolean
  /** The pose solved for, kept so the next solve can warm-start from it. */
  creases: CreaseFold[]
}

export type FoldDrapeResult = FoldDrapeData & {
  /** A flat document point carried onto the solved surface. */
  mapPoint(point: Point): { x: number; y: number; z: number }
  /** The solved surface normal under a flat document point. */
  mapNormal(point: Point): { x: number; y: number; z: number }
}

/** A crease as posed, plus the bend zone the mesh resolves it with. */
type LatticeCrease = CreaseFold & { latticeZoneWidth: number }

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside
    }
  }
  return inside
}

/**
 * The creases in the pose's terms: directed so the swinging half is on the
 * left, angle signed so the pose turns the way the pivot chain would.
 *
 * The pivot chain rotates by the document's signed angle about the authored
 * direction in a scene whose projection mirrors document y, which carries a
 * flap on the crease's document-left up for a positive angle and a
 * document-right flap down; the pose always lifts its (re-oriented) left side
 * for a positive angle. Same fold, opposite handedness bookkeeping,
 * reconciled here and pinned by the builder's fold tests against the rigid
 * transform.
 */
function creasesForFolds(folds: DrapeFoldInput[], zoneFloorMm: number): LatticeCrease[] {
  const creases: LatticeCrease[] = []
  for (const fold of folds) {
    const direction = { x: fold.end.x - fold.start.x, y: fold.end.y - fold.start.y }
    const length = Math.hypot(direction.x, direction.y)
    const angleRad = (fold.angleDeg * Math.PI) / 180
    if (length <= 1e-9 || Math.abs(angleRad) <= 1e-6) {
      continue
    }
    const side = Math.sign(
      direction.x * (fold.swingSample.y - fold.start.y) -
        direction.y * (fold.swingSample.x - fold.start.x),
    )
    if (side === 0) {
      continue
    }
    creases.push({
      start: side > 0 ? fold.start : fold.end,
      end: side > 0 ? fold.end : fold.start,
      angleRad: side * angleRad,
      zoneWidth: Math.max(fold.bendRadiusMm * Math.abs(angleRad), zoneFloorMm),
      // Meshed for the widest zone the crease can ever open to, not the one it
      // is dialled to: a lattice that changed with the angle would give every
      // scrub step a different mesh, and a mesh is what a warm start is
      // continuous across. The station lines a shallow fold does not need cost
      // a handful of vertices; re-solving from flat every frame costs the
      // scrub.
      latticeZoneWidth: Math.max(fold.bendRadiusMm * Math.PI, zoneFloorMm),
    })
  }
  return creases
}

/**
 * A polygon resampled to the mesh pitch: long edges gain points, and runs of
 * near-collinear points collapse — an imported outline sampled at a fraction
 * of a millimetre would otherwise hand the solver hundreds of boundary
 * particles that buy nothing but constraint iterations. Corners survive
 * because a point only collapses while the run stays within a deviation
 * tolerance of its chord.
 */
function resampleLoop(loop: Point[], pitch: number) {
  const deviation = 0.3
  const decimated: Point[] = []
  let anchor = loop[0]
  decimated.push(anchor)
  for (let index = 1; index < loop.length; index += 1) {
    const point = loop[index]
    const next = loop[(index + 1) % loop.length]
    const chordX = next.x - anchor.x
    const chordY = next.y - anchor.y
    const chordLength = Math.hypot(chordX, chordY)
    const offChord =
      chordLength > 1e-9
        ? Math.abs(chordX * (point.y - anchor.y) - chordY * (point.x - anchor.x)) / chordLength
        : Math.hypot(point.x - anchor.x, point.y - anchor.y)
    const alongChord = Math.hypot(point.x - anchor.x, point.y - anchor.y)
    if (offChord <= deviation && alongChord < pitch) {
      continue
    }
    decimated.push(point)
    anchor = point
  }

  const resampled: Point[] = []
  for (let index = 0; index < decimated.length; index += 1) {
    const a = decimated[index]
    const b = decimated[(index + 1) % decimated.length]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.max(1, Math.ceil(length / pitch))
    for (let step = 0; step < steps; step += 1) {
      resampled.push({
        x: a.x + ((b.x - a.x) * step) / steps,
        y: a.y + ((b.y - a.y) * step) / steps,
      })
    }
  }
  return resampled
}

function distanceToLoops(point: Point, loops: Point[][]) {
  let best = Infinity
  for (const loop of loops) {
    for (let index = 0; index < loop.length; index += 1) {
      const a = loop[index]
      const b = loop[(index + 1) % loop.length]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const lengthSq = dx * dx + dy * dy
      const t =
        lengthSq > 0
          ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
          : 0
      best = Math.min(best, Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)))
    }
  }
  return best
}

/**
 * A structured lattice aligned to the first crease, with extra station lines
 * through every bend zone.
 *
 * The alignment is load-bearing, not cosmetic: with inextensible edges, a
 * triangulated surface only folds where its edges line up with the fold — an
 * irregular triangulation is a rigid shell, which is why geodesic domes
 * stand. Delaunay over this lattice keeps the crease-parallel edge lines the
 * fold needs; the piece's outline still contributes an irregular ring at the
 * boundary, which is why the solver gives stretch a whisker of compliance.
 */
function foldAlignedLattice(
  creases: CreaseFold[],
  outer: Point[],
  holes: Point[][],
  spacing: number,
) {
  const primary = creases[0]
  const direction = {
    x: primary.end.x - primary.start.x,
    y: primary.end.y - primary.start.y,
  }
  const length = Math.hypot(direction.x, direction.y)
  const along = length > 0 ? { x: direction.x / length, y: direction.y / length } : { x: 0, y: 1 }
  const left = { x: -along.y, y: along.x }

  // The piece's bounds in the crease frame.
  let minAlong = Infinity
  let maxAlong = -Infinity
  let minAcross = Infinity
  let maxAcross = -Infinity
  for (const point of outer) {
    const relX = point.x - primary.start.x
    const relY = point.y - primary.start.y
    const alongCoord = relX * along.x + relY * along.y
    const acrossCoord = relX * left.x + relY * left.y
    minAlong = Math.min(minAlong, alongCoord)
    maxAlong = Math.max(maxAlong, alongCoord)
    minAcross = Math.min(minAcross, acrossCoord)
    maxAcross = Math.max(maxAcross, acrossCoord)
  }

  // Across stations: a regular pitch, with each parallel crease's bend zone
  // cut in at its own finer pitch. Regular stations too close to a zone
  // station yield to it.
  const zoneStations: number[] = []
  for (const crease of creases) {
    const creaseDirection = {
      x: crease.end.x - crease.start.x,
      y: crease.end.y - crease.start.y,
    }
    const creaseLength = Math.hypot(creaseDirection.x, creaseDirection.y)
    if (creaseLength <= 1e-9) continue
    const parallel =
      Math.abs(creaseDirection.x * along.y - creaseDirection.y * along.x) / creaseLength < 0.1
    if (!parallel) continue
    const centre =
      (crease.start.x - primary.start.x) * left.x + (crease.start.y - primary.start.y) * left.y
    const rows = Math.min(8, Math.max(3, Math.round(crease.zoneWidth / (spacing * 0.6))))
    for (let row = 0; row <= rows; row += 1) {
      zoneStations.push(centre - crease.zoneWidth / 2 + (row / rows) * crease.zoneWidth)
    }
    // A tight bend on a coarse piece asks for station lines a fraction of a
    // millimetre apart inside a lattice pitched at ten or more. Dropping
    // straight from one to the other hands the triangulator slivers, and
    // slivers are what an inextensible mesh tears on — 7% strain on a 300 mm
    // panel before these existed. Step the pitch back up by doubling instead.
    const zonePitch = crease.zoneWidth / rows
    for (let step = zonePitch * 2; step < spacing; step *= 2) {
      zoneStations.push(centre - crease.zoneWidth / 2 - step, centre + crease.zoneWidth / 2 + step)
    }
  }
  const stations: number[] = [...zoneStations]
  for (let d = minAcross - spacing; d <= maxAcross + spacing; d += spacing) {
    if (zoneStations.every((z) => Math.abs(d - z) > spacing * 0.4)) stations.push(d)
  }

  const clearance = spacing * 0.35
  const loops = [outer, ...holes]
  const lattice: Point[] = []
  for (const station of stations) {
    for (let t = minAlong - spacing; t <= maxAlong + spacing; t += spacing) {
      const point = {
        x: primary.start.x + along.x * t + left.x * station,
        y: primary.start.y + along.y * t + left.y * station,
      }
      if (!pointInPolygon(point, outer)) continue
      if (holes.some((hole) => pointInPolygon(point, hole))) continue
      if (distanceToLoops(point, loops) < clearance) continue
      lattice.push(point)
    }
  }
  return lattice
}

/**
 * The previous solve, if it is one this mesh can actually continue from.
 *
 * Same rest state, same creases in the same order: anything else — a moved
 * outline, a new hole, a fold that appeared — is a different mesh, and the
 * only safe answer is to sweep from flat again.
 */
function usableWarmStart(
  warmStart: FoldDrapeWarmStart | undefined,
  restPositions: Float32Array,
  creases: CreaseFold[],
): FoldDrapeWarmStart | null {
  if (!warmStart) {
    return null
  }
  const { positions, restPositions: previousRest, creases: previousCreases } = warmStart
  if (previousRest.length !== restPositions.length) {
    return null
  }
  if (positions.length !== (restPositions.length / 2) * 3) {
    return null
  }
  for (let index = 0; index < restPositions.length; index += 1) {
    if (previousRest[index] !== restPositions[index]) {
      return null
    }
  }
  if (previousCreases.length !== creases.length) {
    return null
  }
  for (let index = 0; index < creases.length; index += 1) {
    const previous = previousCreases[index]
    const crease = creases[index]
    if (
      previous.start.x !== crease.start.x ||
      previous.start.y !== crease.start.y ||
      previous.end.x !== crease.end.x ||
      previous.end.y !== crease.end.y
    ) {
      return null
    }
  }
  return warmStart
}

/**
 * Solve one piece's fold, as data.
 *
 * Split from `solveFoldDrape` because everything here crosses a structured
 * clone: hand this the same arguments in a worker and post the result back,
 * and the caller cannot tell which thread settled the leather.
 */
export function solveFoldDrapeData(params: FoldDrapeParams): FoldDrapeData | null {
  const { outer, holes } = params
  if (outer.length < 3) {
    return null
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of outer) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  const area = Math.max(1, (maxX - minX) * (maxY - minY))
  const spacing = Math.min(16, Math.max(3, Math.sqrt(area / 140)))

  const creases = creasesForFolds(params.folds, MIN_BEND_ZONE_MM)
  if (creases.length === 0) {
    return null
  }

  const resampledOuter = resampleLoop(outer, spacing * 0.9)
  const resampledHoles = holes
    .filter((hole) => hole.length >= 3)
    .map((hole) => resampleLoop(hole, spacing * 0.9))
  let mesh
  try {
    mesh = triangulate({
      outer: resampledOuter,
      holes: resampledHoles,
      internalPoints: foldAlignedLattice(
        creases.map((crease) => ({ ...crease, zoneWidth: crease.latticeZoneWidth })),
        resampledOuter,
        resampledHoles,
        spacing,
      ),
      spacing: 0,
    })
  } catch {
    // The triangulator throws rather than hand back a mesh with coverage
    // holes; a piece it cannot mesh keeps the analytic fold.
    return null
  }
  if (mesh.triangles.length === 0 || mesh.points.length > MAX_CLOTH_VERTICES) {
    return null
  }

  const clothCount = mesh.points.length
  const restPositions = new Float32Array(clothCount * 2)
  mesh.points.forEach((point, index) => {
    restPositions[index * 2] = point.x
    restPositions[index * 2 + 1] = point.y
  })
  // Wind so the flat mesh's normals point up: the triangulator's winding is
  // counter-clockwise in document xy, which embeds facing down.
  const triangles: number[] = []
  for (let index = 0; index < mesh.triangles.length; index += 3) {
    triangles.push(mesh.triangles[index], mesh.triangles[index + 2], mesh.triangles[index + 1])
  }

  const meshed = new Uint8Array(clothCount)
  for (const vertex of triangles) meshed[vertex] = 1

  const fullPose = creaseChainPose(creases)
  const embedded: number[] = []
  const inverseMasses: number[] = []
  for (let index = 0; index < clothCount; index += 1) {
    const x = restPositions[index * 2]
    const y = restPositions[index * 2 + 1]
    embedded.push(x, 0, y)
    const [px, py, pz] = fullPose(x, y)
    const moves = Math.hypot(px - x, py, pz - y) > 1e-6
    inverseMasses.push(meshed[index] && moves ? 1 : 0)
  }
  if (!inverseMasses.some((w) => w > 0)) {
    return null
  }

  const obstaclePositions: number[] = []
  const obstacleTriangles: number[] = []
  const obstacleRest: number[] = []
  for (const obstacle of params.obstacles ?? []) {
    const base = clothCount + obstaclePositions.length / 3
    obstacleTriangles.push(...obstacle.triangles.map((vertex) => vertex + base))
    obstaclePositions.push(...obstacle.positions)
    for (let index = 0; index < obstacle.positions.length / 3; index += 1) {
      const slot = obstacleRest.length / 2
      obstacleRest.push(OBSTACLE_REST_OFFSET_MM + slot, OBSTACLE_REST_OFFSET_MM + slot)
    }
  }

  // Where the solve starts: flat, or wherever this mesh last settled. Pinned
  // vertices start on the pose either way — they are the half that stays, and
  // a warm start has nothing to say about a particle that cannot move.
  const warmStart = usableWarmStart(params.warmStart, restPositions, creases)
  const seeded = embedded.slice()
  if (warmStart) {
    for (let index = 0; index < clothCount; index += 1) {
      if (inverseMasses[index] <= 0) continue
      seeded[index * 3] = warmStart.positions[index * 3]
      seeded[index * 3 + 1] = warmStart.positions[index * 3 + 1]
      seeded[index * 3 + 2] = warmStart.positions[index * 3 + 2]
    }
  }

  const state = createClothState(
    [...seeded, ...obstaclePositions],
    [...inverseMasses, ...new Array<number>(obstaclePositions.length / 3).fill(0)],
  )
  const { constraints } = buildClothConstraints(
    { restPositions, triangles },
    {
      // Not exactly rigid: the boundary ring the outline forces into the
      // lattice can only follow the fold by giving a whisker, exactly as
      // real leather does.
      stretchCompliance: 1e-6,
      bendCompliance: 5e-3,
      bendComplianceBeyond: 5e-3,
    },
  )

  const subDt = SOLVE_OPTIONS.dt / SOLVE_OPTIONS.substeps
  const anchorCompliance =
    ((1 - ANCHOR_HOLD_FRACTION) / ANCHOR_HOLD_FRACTION) * subDt * subDt
  const anchors: XpbdAnchorConstraint[] = []
  for (let index = 0; index < clothCount; index += 1) {
    if (inverseMasses[index] <= 0) continue
    const anchor = createAnchorConstraint({
      index,
      target: [embedded[index * 3], embedded[index * 3 + 1], embedded[index * 3 + 2]],
      compliance: anchorCompliance,
    })
    anchors.push(anchor)
    ;(constraints).push(anchor)
  }

  const collider = createTriangleCollider({
    triangles: [...triangles, ...obstacleTriangles],
    restPositions: [...restPositions, ...obstacleRest],
    config: { thickness: Math.max(0.2, params.thicknessMm), friction: 0.2 },
  })

  // The sweep runs from the pose the state is already in to the dialled one:
  // flat when starting cold, the previous drape's pose when warm-started.
  const fromAngle = (index: number) => warmStart?.creases[index].angleRad ?? 0
  const fromZone = (index: number) => warmStart?.creases[index].zoneWidth ?? 0
  const creasesAt = (t: number): CreaseFold[] =>
    creases.map((crease, index) => ({
      ...crease,
      angleRad: fromAngle(index) + (crease.angleRad - fromAngle(index)) * t,
      zoneWidth: Math.max(fromZone(index) + (crease.zoneWidth - fromZone(index)) * t, 1e-6),
    }))
  // A shallow fold has less far to sweep; scale the ramp to the largest turn.
  const largestTurn = Math.max(
    ...creases.map((crease, index) => Math.abs(crease.angleRad - fromAngle(index))),
  )
  const rampSteps = Math.max(
    warmStart ? MIN_WARM_RAMP_STEPS : MIN_RAMP_STEPS,
    Math.round(MAX_RAMP_STEPS * Math.min(1, largestTurn / Math.PI)),
  )
  const result = settleXpbdCloth(
    state,
    constraints,
    { ...SOLVE_OPTIONS, collider, colliderEveryIteration: true },
    {
      maxSteps: rampSteps + MAX_SETTLE_STEPS,
      restDisplacement: REST_DISPLACEMENT_MM,
      onStep: (step) => {
        if (step > rampSteps) return true
        const pose = creaseChainPose(creasesAt(Math.min(1, (step + 1) / rampSteps)))
        for (const anchor of anchors) {
          const [x, y, z] = pose(
            restPositions[anchor.index * 2],
            restPositions[anchor.index * 2 + 1],
          )
          anchor.targetX = x
          anchor.targetY = y
          anchor.targetZ = z
        }
        return step >= rampSteps
      },
    },
  )

  const positions = state.positions.slice(0, clothCount * 3)
  // Orphan vertices (kept out of every triangle by the triangulator's sliver
  // filters) never moved; park them on the pose so nothing maps to garbage.
  for (let index = 0; index < clothCount; index += 1) {
    if (meshed[index]) continue
    const [px, py, pz] = fullPose(restPositions[index * 2], restPositions[index * 2 + 1])
    positions[index * 3] = px
    positions[index * 3 + 1] = py
    positions[index * 3 + 2] = pz
  }

  const normals = new Float32Array(clothCount * 3)
  for (let index = 0; index < triangles.length; index += 3) {
    const a = triangles[index] * 3
    const b = triangles[index + 1] * 3
    const c = triangles[index + 2] * 3
    const abx = positions[b] - positions[a]
    const aby = positions[b + 1] - positions[a + 1]
    const abz = positions[b + 2] - positions[a + 2]
    const acx = positions[c] - positions[a]
    const acy = positions[c + 1] - positions[a + 1]
    const acz = positions[c + 2] - positions[a + 2]
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    for (const vertex of [a, b, c]) {
      normals[vertex] += nx
      normals[vertex + 1] += ny
      normals[vertex + 2] += nz
    }
  }
  for (let index = 0; index < clothCount; index += 1) {
    const length = Math.hypot(
      normals[index * 3],
      normals[index * 3 + 1],
      normals[index * 3 + 2],
    )
    if (length > 1e-9) {
      normals[index * 3] /= length
      normals[index * 3 + 1] /= length
      normals[index * 3 + 2] /= length
    } else {
      normals[index * 3 + 1] = 1
    }
  }

  // The triangulator compacts and remaps its vertices, but it keeps the
  // input point objects themselves, so a loop's vertices are found back by
  // identity. A vertex the sliver filters dropped simply falls out of its
  // loop.
  const indexOfPoint = new Map<Point, number>()
  mesh.points.forEach((point, index) => indexOfPoint.set(point, index))
  const loopIndices = (loop: Point[]) =>
    loop
      .map((point) => indexOfPoint.get(point))
      .filter((index): index is number => index !== undefined)
  const boundaryLoops: number[][] = [loopIndices(resampledOuter)]
  for (const hole of resampledHoles) {
    const loop = loopIndices(hole)
    if (loop.length >= 3) boundaryLoops.push(loop)
  }

  return {
    positions,
    restPositions,
    triangles,
    normals,
    boundaryLoops,
    settled: result.settled,
    creases,
  }
}

/**
 * The data with the two lookups a renderer needs put back on it: where a flat
 * document point went, and which way the leather faces there.
 *
 * Kept apart from the solve so a drape that came back from a worker is the
 * same object as one solved in place.
 */
export function hydrateFoldDrape(data: FoldDrapeData): FoldDrapeResult {
  const { positions, restPositions, triangles, normals, creases } = data
  const fullPose = creaseChainPose(creases)

  const locate = (point: Point) => {
    let bestTriangle = -1
    let bestBary: [number, number, number] = [1, 0, 0]
    let bestOutside = Infinity
    for (let index = 0; index < triangles.length; index += 3) {
      const a = triangles[index] * 2
      const b = triangles[index + 1] * 2
      const c = triangles[index + 2] * 2
      const v0x = restPositions[b] - restPositions[a]
      const v0y = restPositions[b + 1] - restPositions[a + 1]
      const v1x = restPositions[c] - restPositions[a]
      const v1y = restPositions[c + 1] - restPositions[a + 1]
      const v2x = point.x - restPositions[a]
      const v2y = point.y - restPositions[a + 1]
      const denominator = v0x * v1y - v1x * v0y
      if (Math.abs(denominator) < 1e-12) continue
      const v = (v2x * v1y - v1x * v2y) / denominator
      const w = (v0x * v2y - v2x * v0y) / denominator
      const u = 1 - v - w
      const outside = Math.max(0, -u, -v, -w)
      if (outside < bestOutside) {
        bestOutside = outside
        bestTriangle = index
        bestBary = [u, v, w]
        if (outside === 0) break
      }
    }
    return { triangle: bestTriangle, bary: bestBary }
  }

  const interpolate = (source: Float32Array, point: Point) => {
    const { triangle, bary } = locate(point)
    if (triangle < 0) {
      const [px, py, pz] = fullPose(point.x, point.y)
      return { x: px, y: py, z: pz }
    }
    const a = triangles[triangle] * 3
    const b = triangles[triangle + 1] * 3
    const c = triangles[triangle + 2] * 3
    return {
      x: source[a] * bary[0] + source[b] * bary[1] + source[c] * bary[2],
      y: source[a + 1] * bary[0] + source[b + 1] * bary[1] + source[c + 1] * bary[2],
      z: source[a + 2] * bary[0] + source[b + 2] * bary[1] + source[c + 2] * bary[2],
    }
  }

  return {
    ...data,
    mapPoint: (point) => interpolate(positions, point),
    mapNormal: (point) => {
      const normal = interpolate(normals, point)
      const length = Math.hypot(normal.x, normal.y, normal.z)
      return length > 1e-9
        ? { x: normal.x / length, y: normal.y / length, z: normal.z / length }
        : { x: 0, y: 1, z: 0 }
    },
  }
}

/** Solve a piece's fold and hand back the drape ready to draw. */
export function solveFoldDrape(params: FoldDrapeParams): FoldDrapeResult | null {
  const data = solveFoldDrapeData(params)
  return data ? hydrateFoldDrape(data) : null
}
