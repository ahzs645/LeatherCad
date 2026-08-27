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
  dihedralAngle,
  settleXpbdCloth,
  type CreaseFold,
  type XpbdAnchorConstraint,
  type XpbdClothConstraint,
} from '@atelier/sim'
import type { Point } from '../cad/cad-types'
import { DEFAULT_FOLD_STIFFNESS } from '../ops/fold-line-ops'
import { minimumBendRadiusMm } from './assembled-fold-bend'

/** More vertices than this and the settle would stall the rebuild. */
const MAX_CLOTH_VERTICES = 700
/**
 * How many times the mesher may coarsen before a piece is genuinely unmeshable.
 *
 * Four halvings of detail is a factor of five on the pitch, which turns any
 * geometry this app can draw into a mesh well under the cap. Bounded so a
 * pathological outline cannot spin here.
 */
const MAX_MESH_ATTEMPTS = 4
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
/** Closest the cut edge is sampled where it crosses a bend. */
const MIN_BOUNDARY_PITCH_MM = 0.4
/** Where the neutral axis lies when a crease does not say: on the mid-surface. */
const MID_SURFACE_RATIO = 0.5
/**
 * How far a skive's bevel runs out past the bend zone, in zone widths.
 *
 * A skive is a long shallow bevel — a leatherworker takes the thickness down
 * over a centimetre or so, not over a millimetre — and the run-out is what
 * keeps it invisible. Measured in zone widths rather than millimetres so a
 * gentle fold gets a correspondingly gentle bevel.
 */
const SKIVE_RUNOUT_ZONES = 1
/** Rest-space offset that keeps obstacle vertices clear of the mesh filter. */
const OBSTACLE_REST_OFFSET_MM = 1e5
/** Bending compliance of plain leather: everywhere no crease speaks for. */
const BEND_COMPLIANCE = 5e-3
/** Bending compliance of a crease dialled all the way to stiff. */
const STIFF_BEND_COMPLIANCE = 1e-6
/**
 * In-plane strain that reads as fully stressed.
 *
 * Leather is not elastic the way a knit is. A strap pulled five percent past
 * the length it was cut at does not come back — it stays long, and the piece
 * it was cut for no longer fits. Long before that a pattern needing the
 * leather to grow is a pattern that will not go together. Five percent is
 * therefore the top of this scale, not the breaking strain: the hide has more
 * left in it, but the maker has already lost the piece.
 */
const MEMBRANE_FULL_SCALE_STRAIN = 0.05

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
  /**
   * The crease's own three material properties, as the document already
   * carries them. All optional: a caller that omits them gets the behaviour
   * this module had before they existed.
   */
  /** 0–1, the fold's resistance to being deformed away from its pose. */
  stiffness?: number
  /** Where the neutral axis sits through the leather, 0–1. 0.5 is the middle. */
  neutralAxisRatio?: number
  /** The leather's thickness at the crease — thinner than the panel if skived. */
  foldThicknessMm?: number
  /**
   * Leather this fold closes over — the pieces sewn between its two halves,
   * summed. Not what the fold looks like but what it has room for: with the
   * crease's own thickness it fixes how tight this fold may close, which is
   * the threshold the stress map is read against. Nothing wrapped by default.
   */
  wrappedThicknessMm?: number
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
  /**
   * How thick the leather is at each vertex, as a fraction of the panel's
   * thickness. One everywhere until a crease is skived, and then a bevel
   * through that crease's bend zone — see `skiveProfile`.
   */
  thicknessScale: Float32Array
  /**
   * How hard the fold leans on the leather at each vertex, 0 to 1. See
   * `foldStressPerVertex` for what the number means; 0 is leather doing
   * nothing it minds, 1 is leather with none of its allowance left.
   */
  stress: Float32Array
  /**
   * How far each vertex ended up *inside* another piece, in millimetres.
   *
   * Zero everywhere the fold cleared what it was folding over, which is what
   * a settled solve should read. See `clashDepthPerVertex`.
   */
  clash: Float32Array
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

/** A crease as posed, plus what the mesh and the solver need beside the pose. */
type LatticeCrease = CreaseFold & {
  /** The bend zone the mesh resolves the crease with. */
  latticeZoneWidth: number
  /** The crease's thickness as a fraction of the panel's: 1 unless skived. */
  skiveScale: number
  /** Bending compliance of the leather inside this crease's zone. */
  bendCompliance: number
  /**
   * Tightest radius this crease may turn through, on the same neutral axis
   * its bend allowance is measured against. Below it the leather is being
   * asked to go where there is no room for it.
   */
  minimumRadiusMm: number
}

/**
 * A crease's stiffness as the bending compliance of its own leather.
 *
 * Stiffness is what Marvelous Designer calls a fold's strength: how hard the
 * crease holds its shape when the rest of the assembly pushes back on it. The
 * elastic reading of that is compliance, a stiffness's reciprocal, so the map
 * has to be geometric rather than linear — a crease half again as stiff as its
 * neighbour reads as a different fold, one fifty-one times as stiff instead of
 * fifty does not, and only a constant ratio per notch of the slider gives the
 * knob the same authority along its whole travel.
 *
 * Two ends fix the curve, and both are where they are because of what the
 * solver does either side of them. The low end is the compliance this module
 * has always used, which the document's default has to land on exactly so that
 * no fold anyone has already drawn moves; there the crease's own bending
 * stiffness is negligible beside the anchors holding the pose, which is why
 * softening it further changes nothing and the bottom of the slider is flat.
 * The high end is where the fold stops answering: by 1e-6 — as rigid as the
 * distance constraints that make the leather inextensible — the bend zone
 * refuses the pose's arc outright and rounds out instead, and another decade
 * past that moves the leather by two hundredths of a millimetre. The slider
 * runs from one to the other, so the fold's answer arrives over the top half
 * of the travel — which is the honest shape of the thing, not a compromise.
 */
function bendComplianceForStiffness(stiffness: number | undefined) {
  const dialled = Math.min(1, Math.max(0, stiffness ?? DEFAULT_FOLD_STIFFNESS))
  const notches = (dialled - DEFAULT_FOLD_STIFFNESS) / (1 - DEFAULT_FOLD_STIFFNESS)
  return BEND_COMPLIANCE * (STIFF_BEND_COMPLIANCE / BEND_COMPLIANCE) ** notches
}

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
 * The leather's thickness at a crease.
 *
 * Skiving is how a thick panel is made to fold at all: the leather is bevelled
 * away along the fold line, so a 1.6–1.8 mm wallet body turns through a
 * 0.9–1.1 mm spine. The crease may therefore be thinner than the panel — and
 * never thicker, because a fold cannot be cut from leather that is not there,
 * so the panel is the ceiling. A crease that says nothing is unskived.
 */
function creaseThicknessMm(fold: DrapeFoldInput, panelThicknessMm: number) {
  const panel = Math.max(0, panelThicknessMm)
  return Math.max(0, Math.min(fold.foldThicknessMm ?? panel, panel))
}

/**
 * The radius the bend actually spends leather at.
 *
 * A bend costs flat material equal to the arc travelled by its neutral axis —
 * the layer that neither stretches on the outside of the turn nor compresses
 * on the inside. `bendRadiusMm` measures the mid-surface, so the inside of the
 * fold is half a thickness under it and the neutral axis sits `ratio` of a
 * thickness back up from there: R − T/2 + K·T, which is R + (K − ½)·T.
 *
 * Written the second way for a reason. The mid-axis case is the one every
 * document that never authored a neutral axis is in, and in that form it costs
 * exactly nothing — the correction is a literal zero, not a subtraction and an
 * addition that a float would not quite undo — so those documents fold to the
 * radius they always did, to the bit.
 *
 * Leather is not sheet steel: it gives up far more readily in compression than
 * in tension, so its neutral axis sits below the middle, nearer 0.35, and a
 * bend spends measurably less flat material than the mid-surface arc suggests.
 */
function neutralRadiusMm(fold: DrapeFoldInput, panelThicknessMm: number) {
  const ratio = fold.neutralAxisRatio ?? MID_SURFACE_RATIO
  const shift = (ratio - MID_SURFACE_RATIO) * creaseThicknessMm(fold, panelThicknessMm)
  return Math.max(0, fold.bendRadiusMm + shift)
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
function creasesForFolds(
  folds: DrapeFoldInput[],
  zoneFloorMm: number,
  panelThicknessMm: number,
): LatticeCrease[] {
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
    // The bend allowance: the arc the neutral axis travels is the flat leather
    // the turn eats, so that arc — not the mid-surface's — is how wide the
    // zone has to be for the fold to spend the right amount of material.
    const radius = neutralRadiusMm(fold, panelThicknessMm)
    const panel = Math.max(0, panelThicknessMm)
    // The tightest this crease can close: half the leather at the fold —
    // less if it is skived, which is the whole point of skiving — plus half
    // of whatever is sewn in between. Carried onto the neutral axis by the
    // same correction the bend allowance uses, because that is the axis the
    // material a hinge spans actually lies on.
    const clearanceRadiusMm = minimumBendRadiusMm(
      creaseThicknessMm(fold, panel) / 2,
      fold.wrappedThicknessMm ?? 0,
    )
    creases.push({
      start: side > 0 ? fold.start : fold.end,
      end: side > 0 ? fold.end : fold.start,
      angleRad: side * angleRad,
      zoneWidth: Math.max(radius * Math.abs(angleRad), zoneFloorMm),
      // Meshed for the widest zone the crease can ever open to, not the one it
      // is dialled to: a lattice that changed with the angle would give every
      // scrub step a different mesh, and a mesh is what a warm start is
      // continuous across. The station lines a shallow fold does not need cost
      // a handful of vertices; re-solving from flat every frame costs the
      // scrub.
      latticeZoneWidth: Math.max(radius * Math.PI, zoneFloorMm),
      skiveScale: panel > 0 ? creaseThicknessMm(fold, panel) / panel : 1,
      bendCompliance: bendComplianceForStiffness(fold.stiffness),
      minimumRadiusMm: neutralRadiusMm({ ...fold, bendRadiusMm: clearanceRadiusMm }, panel),
    })
  }
  return creases
}

/**
 * How thick the leather is drawn at each vertex, as a fraction of the panel.
 *
 * Skiving is the one material property of a fold you can see without measuring
 * anything: the leather visibly thins into the spine. Drawing that means the
 * shell cannot offset the mid-surface by one constant half-thickness any more,
 * so the solve hands the renderer a per-vertex fraction to scale it by.
 *
 * A skive is a bevel, never a step. The full thinning holds across the bend
 * zone and then eases back out to the panel over about the same width again on
 * each side, with a smoothstep so the bevel meets both the spine and the panel
 * tangentially. A step would draw a hard line down each side of the fold —
 * a second crease parallel to the real one, which is precisely the artefact
 * skiving exists to prevent.
 *
 * The profile is measured against the zone the crease opens to fully rather
 * than the one it is dialled to, because a skived spine is skived whether the
 * wallet is shut or open; keying it to the angle would pump the leather's
 * thickness up and down through a scrub.
 */
function skiveProfile(creases: LatticeCrease[], restPositions: Float32Array) {
  const count = restPositions.length / 2
  const scale = new Float32Array(count).fill(1)
  for (const crease of creases) {
    if (crease.skiveScale >= 1) {
      continue
    }
    const dx = crease.end.x - crease.start.x
    const dy = crease.end.y - crease.start.y
    const length = Math.hypot(dx, dy)
    if (length <= 1e-9) {
      continue
    }
    const flat = crease.latticeZoneWidth / 2
    const bevel = crease.latticeZoneWidth * SKIVE_RUNOUT_ZONES
    for (let index = 0; index < count; index += 1) {
      const across =
        Math.abs(
          dx * (restPositions[index * 2 + 1] - crease.start.y) -
            dy * (restPositions[index * 2] - crease.start.x),
        ) / length
      const t = Math.min(1, Math.max(0, (across - flat) / bevel))
      const eased = t * t * (3 - 2 * t)
      scale[index] = Math.min(scale[index], crease.skiveScale + (1 - crease.skiveScale) * eased)
    }
  }
  return scale
}

/**
 * How hard the fold leans on the leather at each vertex, 0 to 1.
 *
 * Two different things can go wrong at a fold, and a maker treats them
 * differently, so both are measured and the worse of the two is reported.
 *
 * The leather can be pulled or squeezed in its own plane. That is measured
 * straight off the flat pattern — every mesh edge's solved length against the
 * length it was cut at — and the solver holds it near zero on purpose, since
 * `stretchCompliance` is a whisker off rigid. So membrane strain that survives
 * the settle is the solve reporting that the pose could not be reached without
 * changing the material's own lengths, which is a pattern problem rather than
 * a fold one.
 *
 * The leather can also be asked to turn tighter than it will turn.
 * `minimumBendRadiusMm` is this codebase's statement of how tight a given
 * stack closes: the fold carries the swinging half a bend diameter clear of
 * the half that stays, and that gap has to hold both halves plus anything sewn
 * between them. Turn tighter and the leather would have to go where there is
 * no room for it — which in the shop is exactly when you skive the crease or
 * move the fold, and skiving shows up here as a lower threshold, because a
 * thinner spine genuinely does close tighter. The radius is read off the
 * solved surface rather than off what was authored, because contact can force
 * a flap tighter than any crease asked for: a hinge turning through φ with a
 * material span s across it is rolling at s / 2φ, the relation a polygon
 * inscribed in a circle obeys. That span is rest-space material, so the radius
 * it recovers is the neutral axis's, which is why the threshold is carried
 * onto the same axis instead of being left on the mid-surface.
 *
 * Both are reported the same way, which is what puts them on one scale: the
 * fraction of the leather's allowance that has been spent past what it will
 * give. Zero is leather doing nothing it minds. One means the whole allowance
 * is gone — a crease turned to a point, with no roll left in it at all, or
 * leather stretched the full `MEMBRANE_FULL_SCALE_STRAIN` past the shape it
 * was cut — and values are clamped there, so the top of the scale is a real
 * place rather than wherever this particular solve happened to peak.
 *
 * They are combined with `max` rather than summed or averaged because a heat
 * map wants the worst thing happening at each spot: a fold that is over-bent
 * and placid in-plane is the same amount of trouble as one that is over-bent
 * and also stretched, and averaging would cool the first one down.
 *
 * The bend score lands on the hinge's own two vertices rather than being
 * smeared over the pair opposite it, because the hinge is where the leather
 * actually turns; the flat leather either side of a crease reads zero and the
 * tint falls off across one row of triangles.
 */
function foldStressPerVertex(params: {
  positions: Float32Array
  restPositions: Float32Array
  edges: ReadonlyArray<readonly [number, number]>
  constraints: readonly XpbdClothConstraint[]
  creases: readonly LatticeCrease[]
  /** Tightest radius plain leather may turn through, away from every crease. */
  panelRadiusMm: number
}) {
  const { positions, restPositions } = params
  const stress = new Float32Array(restPositions.length / 2)
  const raise = (vertex: number, score: number) => {
    if (score > stress[vertex]) {
      stress[vertex] = score
    }
  }

  for (const [a, b] of params.edges) {
    const rest = Math.hypot(
      restPositions[a * 2] - restPositions[b * 2],
      restPositions[a * 2 + 1] - restPositions[b * 2 + 1],
    )
    if (rest <= 1e-9) continue
    const solved = Math.hypot(
      positions[a * 3] - positions[b * 3],
      positions[a * 3 + 1] - positions[b * 3 + 1],
      positions[a * 3 + 2] - positions[b * 3 + 2],
    )
    const score = Math.min(1, Math.abs(solved - rest) / rest / MEMBRANE_FULL_SCALE_STRAIN)
    raise(a, score)
    raise(b, score)
  }

  // What the leather at a hinge is allowed. Inside a crease's bend zone it is
  // that crease's stack: the two halves and everything sewn between them.
  // Outside, the leather has only itself to clear — a corner of a hanging flap
  // curls, and calling that a fault because some crease elsewhere on the piece
  // closes over a card pocket would be nonsense. Two folds' zones can overlap;
  // the nearer crease owns the hinge, the same rule the compliance uses.
  const allowanceAt = (x: number, y: number) => {
    let allowance = params.panelRadiusMm
    let nearest = Infinity
    for (const crease of params.creases) {
      const dx = crease.end.x - crease.start.x
      const dy = crease.end.y - crease.start.y
      const length = Math.hypot(dx, dy)
      if (length <= 1e-9) continue
      const off = Math.abs(dx * (y - crease.start.y) - dy * (x - crease.start.x)) / length
      if (off <= crease.zoneWidth / 2 && off < nearest) {
        nearest = off
        allowance = crease.minimumRadiusMm
      }
    }
    return allowance
  }

  const solvedAt = (vertex: number) =>
    [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]] as const

  for (const constraint of params.constraints) {
    if (constraint.kind !== 'bend') continue
    const { a, b, hingeA, hingeB } = constraint
    const turn = Math.abs(
      dihedralAngle(solvedAt(a), solvedAt(b), solvedAt(hingeA), solvedAt(hingeB)),
    )
    if (turn <= 1e-6) continue
    // How much leather the turn is spread over: the rest separation of the
    // opposite pair, taken across the hinge. Only the across component is
    // material the bend spends — the along component runs with the crease and
    // turns through nothing.
    const hingeX = restPositions[hingeB * 2] - restPositions[hingeA * 2]
    const hingeY = restPositions[hingeB * 2 + 1] - restPositions[hingeA * 2 + 1]
    const hingeLength = Math.hypot(hingeX, hingeY)
    if (hingeLength <= 1e-9) continue
    const spanX = restPositions[b * 2] - restPositions[a * 2]
    const spanY = restPositions[b * 2 + 1] - restPositions[a * 2 + 1]
    const span = Math.abs(spanX * hingeY - spanY * hingeX) / hingeLength
    if (span <= 1e-9) continue
    const allowance = allowanceAt(
      (restPositions[hingeA * 2] + restPositions[hingeB * 2]) / 2,
      (restPositions[hingeA * 2 + 1] + restPositions[hingeB * 2 + 1]) / 2,
    )
    if (allowance <= 0) continue
    const score = Math.min(1, Math.max(0, 1 - span / (2 * turn) / allowance))
    raise(hingeA, score)
    raise(hingeB, score)
  }

  return stress
}

/**
 * A polygon resampled to the mesh pitch: long edges gain points, and runs of
 * near-collinear points collapse — an imported outline sampled at a fraction
 * of a millimetre would otherwise hand the solver hundreds of boundary
 * particles that buy nothing but constraint iterations. Corners survive
 * because a point only collapses while the run stays within a deviation
 * tolerance of its chord.
 *
 * The pitch varies along the loop because one part of it cannot be sampled
 * like the rest: where a crease runs out to the cut edge, the boundary has to
 * turn through the whole bend. Sampled at the piece's pitch it spans the arc
 * in one segment and cannot follow it, and the leather flares at the ends of
 * the fold — 7 mm proud of a 3.7 mm bend on the wallet, which is exactly the
 * spike you see edge-on.
 */
/** A stretch of one boundary segment that wants a pitch of its own. */
type PitchBand = { from: number; to: number; pitch: number }

/**
 * Where a segment runs close enough to a crease to be sampled finely, as an
 * interval of the segment's own parameter.
 *
 * Distance from a crease's line is linear along a straight segment, so the
 * band is exact rather than sampled: solve |off(t)| <= zoneWidth for t and
 * clamp to the segment. Returns null when the segment never comes close.
 */
function creaseBand(offA: number, offB: number, zoneWidth: number): { from: number; to: number } | null {
  const slope = offB - offA
  if (Math.abs(slope) <= 1e-9) {
    return Math.abs(offA) <= zoneWidth ? { from: 0, to: 1 } : null
  }
  const first = (-zoneWidth - offA) / slope
  const second = (zoneWidth - offA) / slope
  const from = Math.max(0, Math.min(first, second))
  const to = Math.min(1, Math.max(first, second))
  return to > from ? { from, to } : null
}

function resampleLoop(
  loop: Point[],
  pitchAt: (point: Point) => number,
  bandsFor: (a: Point, b: Point) => PitchBand[],
  coarsePitch: number,
) {
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
    if (offChord <= deviation && alongChord < pitchAt(point)) {
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
    // The pitch varies ALONG the segment, not across it as a whole.
    //
    // A crease usually crosses a cut edge in the middle of one segment, and
    // both of that segment's ends can be a long way from the bend. Asking the
    // whole segment and taking the finer answer refines the crossing -- and
    // also the entire rest of the edge, which on a rectangle is the whole
    // thousand-millimetre side. That cost the mesh 1064 vertices where 646
    // would do, and put the piece over MAX_CLOTH_VERTICES. So cut the segment
    // into the stretches that actually run near a crease and the stretches
    // that do not, and give each its own pitch.
    const bands = bandsFor(a, b)
    const edges = new Set<number>([0, 1])
    for (const band of bands) {
      edges.add(Math.max(0, band.from))
      edges.add(Math.min(1, band.to))
    }
    const stops = [...edges].sort((left, right) => left - right)
    for (let stop = 0; stop < stops.length - 1; stop += 1) {
      const from = stops[stop]
      const to = stops[stop + 1]
      if (to - from <= 1e-9) continue
      const middle = (from + to) / 2
      // The finest band covering this stretch wins; nothing covering it is
      // the piece's own pitch.
      let pitch = coarsePitch
      for (const band of bands) {
        if (middle >= band.from && middle <= band.to) pitch = Math.min(pitch, band.pitch)
      }
      const steps = Math.max(1, Math.ceil(((to - from) * length) / pitch))
      for (let step = 0; step < steps; step += 1) {
        const t = from + ((to - from) * step) / steps
        resampled.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      }
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
/**
 * How far each vertex ended up inside another piece, in millimetres.
 *
 * The collider is told to hold surfaces one leather-thickness apart, so a
 * settled fold should read zero: this measures the promise the solve makes,
 * not a new opinion about geometry. It is a check on the solver rather than
 * on the pattern, and it is worth having because the two ways it can come
 * back non-zero are both real. The collider can run out of iterations where a
 * fold closes hard onto a stack; and an obstacle is the *flat* slab of another
 * piece, so a fold that closes over a piece which is itself folded is avoiding
 * a shape that is not where that piece actually went.
 *
 * Only the interior of an obstacle triangle counts. A vertex nearest an
 * obstacle's edge or corner is beside the slab rather than inside it, and
 * counting those would light up every fold that closes flush to a piece's
 * cut edge — which is what a well-made one does.
 */
function clashDepthPerVertex(params: {
  positions: Float32Array
  clothCount: number
  obstaclePositions: number[]
  obstacleTriangles: number[]
  clearanceMm: number
}) {
  const { positions, clothCount, obstaclePositions, obstacleTriangles, clearanceMm } = params
  const depth = new Float32Array(clothCount)
  if (obstacleTriangles.length === 0 || clearanceMm <= 0) return depth
  // Obstacle triangles index into the combined particle array, whose cloth
  // half is `positions`; the slabs start right after it.
  const corner = (vertex: number, axis: number) =>
    obstaclePositions[(vertex - clothCount) * 3 + axis]
  for (let index = 0; index < clothCount; index += 1) {
    const px = positions[index * 3]
    const py = positions[index * 3 + 1]
    const pz = positions[index * 3 + 2]
    let nearest = Infinity
    for (let face = 0; face < obstacleTriangles.length; face += 3) {
      const a = obstacleTriangles[face]
      const b = obstacleTriangles[face + 1]
      const c = obstacleTriangles[face + 2]
      const hit = pointInsideTriangle(
        px, py, pz,
        corner(a, 0), corner(a, 1), corner(a, 2),
        corner(b, 0), corner(b, 1), corner(b, 2),
        corner(c, 0), corner(c, 1), corner(c, 2),
      )
      if (hit !== null && hit < nearest) nearest = hit
    }
    depth[index] = nearest < clearanceMm ? clearanceMm - nearest : 0
  }
  return depth
}

/**
 * Distance from a point to a triangle's interior, or null if the closest
 * point on that triangle is on one of its edges instead.
 *
 * Written out in scalars rather than vectors: this runs over every vertex
 * against every obstacle face on the solve's hot path.
 */
function pointInsideTriangle(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
) {
  const abx = bx - ax
  const aby = by - ay
  const abz = bz - az
  const acx = cx - ax
  const acy = cy - ay
  const acz = cz - az
  let nx = aby * acz - abz * acy
  let ny = abz * acx - abx * acz
  let nz = abx * acy - aby * acx
  const length = Math.hypot(nx, ny, nz)
  if (length <= 1e-12) return null
  nx /= length
  ny /= length
  nz /= length
  const apx = px - ax
  const apy = py - ay
  const apz = pz - az
  const signed = apx * nx + apy * ny + apz * nz
  // The foot of the perpendicular, in the triangle's own barycentric frame.
  const qx = apx - nx * signed
  const qy = apy - ny * signed
  const qz = apz - nz * signed
  const d00 = abx * abx + aby * aby + abz * abz
  const d01 = abx * acx + aby * acy + abz * acz
  const d11 = acx * acx + acy * acy + acz * acz
  const denominator = d00 * d11 - d01 * d01
  if (Math.abs(denominator) <= 1e-12) return null
  const d20 = qx * abx + qy * aby + qz * abz
  const d21 = qx * acx + qy * acy + qz * acz
  const v = (d11 * d20 - d01 * d21) / denominator
  const w = (d00 * d21 - d01 * d20) / denominator
  if (v < 0 || w < 0 || v + w > 1) return null
  return Math.abs(signed)
}

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
  const idealSpacing = Math.min(16, Math.max(3, Math.sqrt(area / 140)))

  const creases = creasesForFolds(params.folds, MIN_BEND_ZONE_MM, params.thicknessMm)
  if (creases.length === 0) {
    return null
  }

  /** Signed distance from a crease's line: sign tells which half it is on. */
  const offCrease = (crease: CreaseFold, point: Point) => {
    const dx = crease.end.x - crease.start.x
    const dy = crease.end.y - crease.start.y
    const length = Math.hypot(dx, dy)
    if (length <= 1e-9) return Infinity
    return (dx * (point.y - crease.start.y) - dy * (point.x - crease.start.x)) / length
  }

  const mesher = (spacing: number, floor: number) => {
  // Fine where the boundary crosses a bend, the piece's own pitch elsewhere.
  const coarsePitch = spacing * 0.9
  const finePitch = (crease: CreaseFold) =>
    Math.max(floor, crease.zoneWidth / 4)
  const boundaryPitch = (point: Point) => {
    let pitch = coarsePitch
    for (const crease of creases) {
      if (Math.abs(offCrease(crease, point)) <= crease.zoneWidth) {
        pitch = Math.min(pitch, finePitch(crease))
      }
    }
    return pitch
  }
  const boundaryBands = (a: Point, b: Point): PitchBand[] => {
    const bands: PitchBand[] = []
    for (const crease of creases) {
      const band = creaseBand(offCrease(crease, a), offCrease(crease, b), crease.zoneWidth)
      if (band) bands.push({ ...band, pitch: finePitch(crease) })
    }
    return bands
  }
  const resampledOuter = resampleLoop(outer, boundaryPitch, boundaryBands, coarsePitch)
  const resampledHoles = holes
    .filter((hole) => hole.length >= 3)
    .map((hole) => resampleLoop(hole, boundaryPitch, boundaryBands, coarsePitch))
    try {
      const meshed = triangulate({
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
      return { mesh: meshed, resampledOuter, resampledHoles }
    } catch {
      // The triangulator throws rather than hand back a mesh with coverage
      // holes. A coarser attempt may still succeed, so this is not the end.
      return null
    }
  }

  // Coarsen until it fits, rather than giving up.
  //
  // A mesh over the cap used to return null, and null is not a neutral answer:
  // the store caches it, so the piece falls back to the rigid pivot fold — the
  // one path in the renderer that collides with nothing — permanently and
  // without saying so. Worse, the trigger is counter-intuitive. A crease's
  // boundary pitch is `zoneWidth / 4` and `zoneWidth` scales with the radius,
  // so a *tighter* fold cuts a *finer* mesh: a 1000mm strap turned at 4.5mm
  // radius overflowed while the same strap at 5mm meshed to 644 vertices and
  // settled. A maker tightening a bend would have watched the simulation
  // silently switch itself off.
  //
  // So back off and try again. Each pass widens the piece's own pitch and the
  // floor under the crease band by half, which is the same trade the mesher
  // already makes between a fold's detail and its cost.
  let built: ReturnType<typeof mesher> = null
  let spacing = idealSpacing
  let floor = MIN_BOUNDARY_PITCH_MM
  for (let attempt = 0; attempt < MAX_MESH_ATTEMPTS; attempt += 1) {
    const candidate = mesher(spacing, floor)
    if (candidate && candidate.mesh.triangles.length > 0 && candidate.mesh.points.length <= MAX_CLOTH_VERTICES) {
      built = candidate
      break
    }
    spacing *= 1.5
    floor *= 1.5
  }
  if (!built) {
    return null
  }
  const { mesh, resampledOuter, resampledHoles } = built

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
  const { constraints, edges } = buildClothConstraints(
    { restPositions, triangles },
    {
      // Not exactly rigid: the boundary ring the outline forces into the
      // lattice can only follow the fold by giving a whisker, exactly as
      // real leather does.
      stretchCompliance: 1e-6,
      bendCompliance: BEND_COMPLIANCE,
      bendComplianceBeyond: BEND_COMPLIANCE,
    },
  )
  // One compliance came back for the whole piece; each crease answers for the
  // leather in its own bend zone, which is the band the pose rolls its
  // curvature across and so the hinges that actually carry the fold. Only the
  // bending regime is re-dialled: a bend constraint's `complianceBeyond` is
  // its opposite pair pulling past rest separation, which is stretch, and
  // stretch is the distance constraints' answer to give.
  for (const constraint of constraints) {
    if (constraint.kind !== 'bend') continue
    const hinge = {
      x: (restPositions[constraint.hingeA * 2] + restPositions[constraint.hingeB * 2]) / 2,
      y: (restPositions[constraint.hingeA * 2 + 1] + restPositions[constraint.hingeB * 2 + 1]) / 2,
    }
    let owner: LatticeCrease | null = null
    let nearest = Infinity
    for (const crease of creases) {
      // Two folds running close together can have overlapping zones; the
      // nearer crease owns the hinge.
      const off = Math.abs(offCrease(crease, hinge))
      if (off <= crease.zoneWidth / 2 && off < nearest) {
        nearest = off
        owner = crease
      }
    }
    if (owner) {
      constraint.compliance = owner.bendCompliance
    }
  }

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

  const colliderThicknessMm = Math.max(0.2, params.thicknessMm)
  const collider = createTriangleCollider({
    triangles: [...triangles, ...obstacleTriangles],
    restPositions: [...restPositions, ...obstacleRest],
    config: { thickness: colliderThicknessMm, friction: 0.2 },
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
    thicknessScale: skiveProfile(creases, restPositions),
    clash: clashDepthPerVertex({
      positions,
      clothCount,
      obstaclePositions,
      obstacleTriangles,
      // The same separation the collider was configured to hold, so a
      // non-zero reading is the collider not keeping its own promise.
      clearanceMm: colliderThicknessMm,
    }),
    stress: foldStressPerVertex({
      positions,
      restPositions,
      edges,
      constraints,
      creases,
      // Leather with no crease through it still cannot roll tighter than its
      // own thickness, and there is nothing else out there for it to clear.
      panelRadiusMm: minimumBendRadiusMm(Math.max(0, params.thicknessMm) / 2, 0),
    }),
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
