import { describe, expect, it } from 'vitest'
import type { Point } from '../cad/cad-types'
import {
  solveFoldDrape,
  solveFoldDrapeData,
  type DrapeFoldInput,
  type FoldDrapeData,
} from './assembled-fold-drape'

const SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 40 },
]

/** The fixture crease: y = 20 across the square, the y < 20 half swinging. */
function fold(overrides: Partial<DrapeFoldInput> = {}): DrapeFoldInput {
  return {
    foldLineId: 'fold-1',
    start: { x: 0, y: 20 },
    end: { x: 40, y: 20 },
    angleDeg: 90,
    bendRadiusMm: 3,
    swingSample: { x: 20, y: 10 },
    ...overrides,
  }
}

/**
 * A slab parked over the base, taller than the fold's own bend diameter and
 * attached to nothing: a front face at z = 22 and a top at height 14.
 */
const SLAB_TOP = 14
const SLAB = {
  positions: [
    5, SLAB_TOP, 22, 35, SLAB_TOP, 22, 5, SLAB_TOP, 38, 35, SLAB_TOP, 38, 5, 0, 22, 35, 0, 22,
  ],
  triangles: [0, 1, 3, 0, 3, 2, 4, 1, 0, 4, 5, 1],
}

/** The fixture folded right over onto the slab, at whatever stiffness is set. */
function overSlab(overrides: Partial<DrapeFoldInput> = {}) {
  return {
    outer: SQUARE,
    holes: [],
    folds: [fold({ angleDeg: -180, bendRadiusMm: 3, ...overrides })],
    thicknessMm: 2,
    obstacles: [SLAB],
  }
}

function solve(overrides: Partial<DrapeFoldInput> = {}) {
  const result = solveFoldDrape({
    outer: SQUARE,
    holes: [],
    folds: [fold(overrides)],
    thicknessMm: 2,
  })
  expect(result).not.toBeNull()
  return result!
}

/** The same fixture as data, so a test can read the crease the solve built. */
function solveData(overrides: Partial<DrapeFoldInput> = {}, thicknessMm = 2) {
  const result = solveFoldDrapeData({
    outer: SQUARE,
    holes: [],
    folds: [fold(overrides)],
    thicknessMm,
  })
  expect(result).not.toBeNull()
  return result!
}

/** The fixture's fold angle in radians, worked out the way the solver does. */
const FIXTURE_ANGLE_RAD = (90 * Math.PI) / 180

function warmStartFrom(data: FoldDrapeData) {
  return {
    positions: data.positions,
    restPositions: data.restPositions,
    creases: data.creases,
  }
}

/** The vertex that moved most between two solves of the same mesh. */
function furthestApart(a: FoldDrapeData, b: FoldDrapeData) {
  let worst = 0
  for (let index = 0; index < a.positions.length; index += 3) {
    worst = Math.max(
      worst,
      Math.hypot(
        a.positions[index] - b.positions[index],
        a.positions[index + 1] - b.positions[index + 1],
        a.positions[index + 2] - b.positions[index + 2],
      ),
    )
  }
  return worst
}

describe('solveFoldDrape', () => {
  it('coarsens a mesh that overflows rather than silently giving up on the fold', { timeout: 60000 }, () => {
    // A long strap turned tight. The boundary pitch through a crease is
    // `zoneWidth / 4` and `zoneWidth` scales with the radius, so a *tighter*
    // fold cuts a *finer* mesh -- this geometry used to cross
    // MAX_CLOTH_VERTICES and return null. Null is not a neutral answer: the
    // drape store caches it, and the renderer then falls back to the rigid
    // pivot fold, which is the one path that collides with nothing. A maker
    // tightening a bend would have watched the simulation switch itself off.
    const strap: Point[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 38 },
      { x: 0, y: 38 },
    ]
    const data = solveFoldDrapeData({
      outer: strap,
      holes: [],
      thicknessMm: 3,
      folds: [
        {
          foldLineId: 'buckle-fold',
          start: { x: 90, y: -10 },
          end: { x: 90, y: 48 },
          angleDeg: 180,
          bendRadiusMm: 2.4,
          swingSample: { x: 20, y: 19 },
        },
      ],
    })
    expect(data).not.toBeNull()
    // Coarsened to fit, not squeezed past the cap.
    expect(data!.restPositions.length / 2).toBeLessThanOrEqual(700)
    // And it is a real solve, not an empty one.
    expect(data!.triangles.length).toBeGreaterThan(0)
    expect(data!.settled).toBe(true)
  })

  // Three full solves, so it needs more than the five-second default when the
  // suite is running files in parallel.
  it('reads a clash only as deep as the solve actually left one', { timeout: 60000 }, () => {
    // A fold with nothing to hit cannot clash with anything, and says so
    // exactly rather than nearly.
    expect(Math.max(...solveData({ angleDeg: 180 }).clash)).toBe(0)

    // Folded right over onto a slab it can land on. The collider is told to
    // hold surfaces a thickness apart and very nearly manages it: 0.08 mm on
    // 2 mm leather. That residue is the collider running out of iterations
    // where a fold closes hard, not two pieces in the same place.
    const resting = solveFoldDrapeData(overSlab())
    expect(resting).not.toBeNull()
    const restingWorst = Math.max(...resting!.clash)
    expect(restingWorst).toBeGreaterThan(0)
    expect(restingWorst).toBeLessThan(0.2)

    // The same fold driven into a slab standing where the flap wants to be.
    // The anchors carry the pose and the slab cannot move, so the leather ends
    // up inside it, and far deeper than when it is merely resting.
    const through = solveFoldDrapeData({
      ...overSlab(),
      obstacles: [
        { positions: [-40, 6, -40, 40, 6, -40, -40, 6, 40, 40, 6, 40], triangles: [0, 1, 3, 0, 3, 2] },
      ],
    })
    expect(through).not.toBeNull()
    const throughWorst = Math.max(...through!.clash)
    expect(throughWorst).toBeGreaterThan(0.4)
    // The gap between resting on a slab and being driven into one is what the
    // overlay exists to show, and it is close to an order of magnitude.
    expect(throughWorst).toBeGreaterThan(restingWorst * 5)
    // The gap between resting on a slab and being driven into one is what the
    // overlay exists to show, and it is close to an order of magnitude.


    // Lit where it overlaps and nowhere else: an overlay that painted the
    // whole piece would not say where to look.
    const lit = [...through!.clash].filter((depth) => depth > 0).length
    expect(lit).toBeGreaterThan(0)
    expect(lit).toBeLessThan(through!.clash.length)
  })

  it('folds the way the rigid hinge convention folds', () => {
    // The pivot chain rotates by the document's signed angle about the
    // authored crease direction: with the flap on the crease's document-right
    // — this fixture — a valley (positive) fold carries it down and a
    // mountain (negative) fold carries it up. The drape must agree, or
    // dialling a fold would flip the model the day the solver ships.
    const valley = solve({ angleDeg: 90 })
    expect(valley.mapPoint({ x: 20, y: 2 }).y).toBeLessThan(-5)
    const mountain = solve({ angleDeg: -90 })
    expect(mountain.mapPoint({ x: 20, y: 2 }).y).toBeGreaterThan(5)
  })

  it('keeps the staying half where it lay', () => {
    const result = solve()
    for (const point of [
      { x: 5, y: 35 },
      { x: 35, y: 30 },
      { x: 20, y: 38 },
    ]) {
      const solved = result.mapPoint(point)
      expect(solved.x).toBeCloseTo(point.x, 0)
      expect(Math.abs(solved.y)).toBeLessThan(0.5)
      expect(solved.z).toBeCloseTo(point.y, 0)
    }
  })

  it('bends the leather instead of stretching it', () => {
    const result = solve({ angleDeg: 180 })
    // A chord along the flap, from its root to its tip: folding may only
    // shorten it (the surface curls), never grow it.
    const near = result.mapPoint({ x: 20, y: 16 })
    const far = result.mapPoint({ x: 20, y: 2 })
    const chord = Math.hypot(far.x - near.x, far.y - near.y, far.z - near.z)
    expect(chord).toBeLessThanOrEqual(14 * 1.05)
    expect(chord).toBeGreaterThan(3)
  })

  it('lands a full fold a bend diameter clear of the half that stays', () => {
    const radius = 4
    const result = solveFoldDrape({
      outer: SQUARE,
      holes: [],
      folds: [fold({ angleDeg: -180, bendRadiusMm: radius })],
      thicknessMm: 2,
    })
    expect(result).not.toBeNull()
    // Mountain 180: the flap lies back over the base, lifted by the bend.
    const tip = result!.mapPoint({ x: 20, y: 2 })
    expect(tip.y).toBeGreaterThan(radius)
    expect(tip.y).toBeLessThan(4 * radius)
    expect(tip.z).toBeGreaterThan(20)
  })

  it('drapes over an obstacle it is not sewn to', () => {
    // The analytic fold cannot know the slab is there; the drape lands on it.
    const through = solveFoldDrape({
      outer: SQUARE, holes: [], folds: [fold({ angleDeg: -180, bendRadiusMm: 3 })], thicknessMm: 2,
    })
    const draped = solveFoldDrape(overSlab())
    expect(through).not.toBeNull()
    expect(draped).not.toBeNull()
    // The wall stands right past the crease, so the near flap tents against
    // it; the flap's far end has to ride up and over the top.
    const tip = { x: 20, y: 2 }
    expect(through!.mapPoint(tip).y).toBeLessThan(SLAB_TOP - 4)
    expect(draped!.mapPoint(tip).y).toBeGreaterThan(SLAB_TOP - 1)
    expect(draped!.mapPoint(tip).y).toBeGreaterThan(through!.mapPoint(tip).y + 4)
  })

  it('turns a rounder arc when the crease is dialled stiff', { timeout: 60000 }, () => {
    // Stiffness is a bending compliance, so what it changes is the shape of
    // the crease's own arc: limp leather takes the tight turn the pose asks
    // for, stiff leather refuses it and rounds out, riding higher.
    //
    // Measured on a FREE fold, deliberately. The obvious test is a fold onto
    // a slab, reading how far the flap lands across it -- and that test used
    // to live here, asserting the soft crease reached a millimetre further.
    // It was measuring mesh noise. Sweeping the boundary pitch from 0.9 to
    // 0.25 of the piece's spacing, soft-minus-stiff came out -0.32, +0.16,
    // -0.73, +1.36, -0.15: five refinements, five sign changes. Where a flap
    // settles against an obstacle is contact-chaotic, and no margin asserted
    // on it means anything.
    //
    // The crease's own crown is not. Across that same sweep it reads 6.219 at
    // stiffness 0 -- identical to three decimals every time -- against 6.80 to
    // 6.85 at stiffness 1. That is the knob, and it is worth an assertion.
    const crown = (data: FoldDrapeData) => {
      let highest = -Infinity
      for (let index = 0; index < data.positions.length; index += 3) {
        highest = Math.max(highest, data.positions[index + 1])
      }
      return highest
    }
    const soft = solveData({ angleDeg: -180, bendRadiusMm: 3, stiffness: 0 })
    const stiff = solveData({ angleDeg: -180, bendRadiusMm: 3, stiffness: 1 })
    expect(crown(stiff)).toBeGreaterThan(crown(soft) + 0.4)
  })

  it('still gets a fold over an obstacle whatever its stiffness', () => {
    // What the slab fixture can still be asked, because it is the part that
    // does not move with the mesh: both creases clear the slab. How they lie
    // on it once they are over is the unstable half, and is not asserted.
    const soft = solveFoldDrape(overSlab({ stiffness: 0 }))
    const stiff = solveFoldDrape(overSlab({ stiffness: 1 }))
    expect(soft).not.toBeNull()
    expect(stiff).not.toBeNull()
    const tip = { x: 20, y: 2 }
    expect(soft!.mapPoint(tip).y).toBeGreaterThan(SLAB_TOP)
    expect(stiff!.mapPoint(tip).y).toBeGreaterThan(SLAB_TOP)
  })

  it('is the fold it always was at the stiffness a fold defaults to', () => {
    // 0.3 is `DEFAULT_FOLD_STIFFNESS`, which every fold line in every saved
    // document already carries whether or not anyone has touched the slider.
    // Dialling it has to be indistinguishable from the knob never having
    // existed — identical, not close — or shipping it would restate every
    // model in the library.
    const dialled = solveFoldDrapeData(overSlab({ stiffness: 0.3 }))
    const untouched = solveFoldDrapeData(overSlab())
    expect(dialled).not.toBeNull()
    expect(untouched).not.toBeNull()
    expect(furthestApart(dialled!, untouched!)).toBe(0)
  })

  it('lands a warm-started fold where the cold solve lands it', () => {
    // The scrub's promise: starting from the drape next door has to be a
    // shortcut to the same leather, not a different answer. The tolerance is
    // real hysteresis — leather swept down from 180° does not retrace the way
    // up exactly — and half a millimetre of it on a 40 mm piece is the honest
    // size of that.
    const at90 = solveFoldDrapeData({
      outer: SQUARE, holes: [], folds: [fold({ angleDeg: 90 })], thicknessMm: 2,
    })
    expect(at90).not.toBeNull()
    const warm = solveFoldDrapeData({
      outer: SQUARE, holes: [], folds: [fold({ angleDeg: 120 })], thicknessMm: 2,
      warmStart: warmStartFrom(at90!),
    })
    const cold = solveFoldDrapeData({
      outer: SQUARE, holes: [], folds: [fold({ angleDeg: 120 })], thicknessMm: 2,
    })
    expect(warm).not.toBeNull()
    expect(cold).not.toBeNull()
    expect(warm!.positions.length).toBe(cold!.positions.length)
    expect(furthestApart(warm!, cold!)).toBeLessThan(1)
  })

  it('sweeps from flat when the warm start is another mesh', () => {
    // A cache key can be wrong; a mesh cannot lie about its own rest state.
    // Seeding one piece's solve with another's has to be caught here, because
    // what it would produce is leather in the shape of the wrong piece.
    const wide = solveFoldDrapeData({
      outer: [
        { x: 0, y: 0 },
        { x: 90, y: 0 },
        { x: 90, y: 40 },
        { x: 0, y: 40 },
      ],
      holes: [],
      folds: [fold({ angleDeg: 90 })],
      thicknessMm: 2,
    })
    expect(wide).not.toBeNull()
    const seeded = solveFoldDrapeData({
      outer: SQUARE, holes: [], folds: [fold({ angleDeg: 90 })], thicknessMm: 2,
      warmStart: warmStartFrom(wide!),
    })
    const cold = solveFoldDrapeData({
      outer: SQUARE, holes: [], folds: [fold({ angleDeg: 90 })], thicknessMm: 2,
    })
    expect(seeded).not.toBeNull()
    expect(furthestApart(seeded!, cold!)).toBeLessThan(1e-6)
  })

  it('folds to the radius it was given, whatever the piece is meshed at', () => {
    // What sets the tightness of a closed fold: the leather, or the lattice?
    // It used to be the lattice — the bend zone was floored at the mesh
    // spacing, so the same 1.8 mm bend closed to 3.8 mm on a small piece and
    // 10.3 mm on a big one, and a wallet stood twice as proud as its leather
    // said. A fold's closed thickness is 2 × its bend radius; that is a
    // property of the material, and it may not vary with how coarsely the
    // piece happens to be meshed.
    const radius = 1.8
    for (const size of [40, 130, 200]) {
      const square: Point[] = [
        { x: 0, y: 0 },
        { x: size, y: 0 },
        { x: size, y: size },
        { x: 0, y: size },
      ]
      const data = solveFoldDrapeData({
        outer: square,
        holes: [],
        thicknessMm: 1.8,
        folds: [
          {
            foldLineId: 'fold-1',
            start: { x: 0, y: size / 2 },
            end: { x: size, y: size / 2 },
            angleDeg: 180,
            bendRadiusMm: radius,
            swingSample: { x: size / 2, y: size / 4 },
          },
        ],
      })
      expect(data).not.toBeNull()
      // Where the swung half comes to rest, well clear of the bend itself.
      const heights: number[] = []
      for (let index = 0; index < data!.restPositions.length / 2; index += 1) {
        if (data!.restPositions[index * 2 + 1] > size / 2 - 12) continue
        heights.push(Math.abs(data!.positions[index * 3 + 1]))
      }
      heights.sort((a, b) => a - b)
      const rest = heights[Math.floor(heights.length / 2)]
      expect(rest).toBeGreaterThan(2 * radius * 0.9)
      expect(rest).toBeLessThan(2 * radius * 1.15)
    }
  })

  it('does not flare where the crease runs out to the cut edge', () => {
    // The ends of a fold are where the cut edge has to turn through the whole
    // bend in one step, and the outline is sampled for the piece, not for the
    // crease. On the wallet that left the leather standing 7.1 mm proud of a
    // 3.7 mm fold at both ends of the crease — a spike you cannot miss
    // edge-on, and one vertex pushed through the half that stays.
    const size = 130
    const radius = 1.8
    const data = solveFoldDrapeData({
      outer: [
        { x: 0, y: 0 },
        { x: size, y: 0 },
        { x: size, y: size },
        { x: 0, y: size },
      ],
      holes: [],
      thicknessMm: 1.8,
      folds: [
        {
          foldLineId: 'fold-1',
          // Deliberately not through the corners: the crease leaves the piece
          // part-way along two edges, in the middle of a boundary segment.
          start: { x: 0, y: size * 0.45 },
          end: { x: size, y: size * 0.55 },
          angleDeg: 180,
          bendRadiusMm: radius,
          swingSample: { x: size / 2, y: size * 0.2 },
        },
      ],
    })
    expect(data).not.toBeNull()
    let highest = 0
    let lowest = 0
    for (let index = 0; index < data!.positions.length / 3; index += 1) {
      const height = data!.positions[index * 3 + 1]
      highest = Math.max(highest, height)
      lowest = Math.min(lowest, height)
    }
    // The fold occupies one side of the flat half; which side is the sign
    // convention's business, not this test's.
    const crown = Math.max(highest, -lowest)
    const otherWay = crown === highest ? -lowest : highest
    // Nothing stands past the fold's own crown, and nothing crosses the half
    // that stays.
    expect(crown).toBeLessThan(2 * radius * 1.25)
    expect(otherWay).toBeLessThan(0.2)
  })

  it('folds the way the arithmetic says a bend of that radius folds', () => {
    // The fold worked out by hand: a bend zone A*R wide centred on the crease,
    // the half that stays, an arc of radius R, and the flap running straight
    // off the arc's far end. Position as a function of material distance from
    // the crease. At a full fold this lands the tip back on the mirror of the
    // flat piece — the arc bulges past the crease by exactly what it eats —
    // which is worth stating because it looks like a bend that spends nothing
    // and is the opposite.
    const textbook = (s: number, angleRad: number, radius: number) => {
      const half = (angleRad * radius) / 2
      if (s <= -half) return { across: s, height: 0 }
      const centre = { across: -half, height: -radius }
      const phi = Math.min(angleRad, (s + half) / radius)
      const point = {
        across: centre.across + radius * Math.sin(phi),
        height: centre.height + radius * Math.cos(phi),
      }
      if (s <= half) return point
      const run = s - half
      return {
        across: point.across + run * Math.cos(angleRad),
        height: point.height - run * Math.sin(angleRad),
      }
    }

    const size = 60
    for (const [angleDeg, radius] of [[90, 1.8], [180, 1.8], [180, 4], [120, 2.5]] as const) {
      const data = solveFoldDrapeData({
        outer: [
          { x: 0, y: 0 },
          { x: size, y: 0 },
          { x: size, y: size },
          { x: 0, y: size },
        ],
        holes: [],
        thicknessMm: 1.8,
        folds: [
          {
            foldLineId: 'fold-1',
            start: { x: 0, y: size / 2 },
            end: { x: size, y: size / 2 },
            angleDeg,
            bendRadiusMm: radius,
            swingSample: { x: size / 2, y: size / 4 },
          },
        ],
      })
      expect(data).not.toBeNull()
      const angleRad = (angleDeg * Math.PI) / 180
      let worst = 0
      // A column of vertices down the middle, clear of the outline's own ring.
      for (let index = 0; index < data!.restPositions.length / 2; index += 1) {
        if (Math.abs(data!.restPositions[index * 2] - size / 2) > 2) continue
        const s = size / 2 - data!.restPositions[index * 2 + 1]
        const expected = textbook(s, angleRad, radius)
        worst = Math.max(
          worst,
          Math.hypot(
            size / 2 - data!.positions[index * 3 + 2] - expected.across,
            data!.positions[index * 3 + 1] - expected.height,
          ),
        )
      }
      expect(worst).toBeLessThan(0.5)
    }
  })

  it('folds a crease that says nothing about its neutral axis exactly as it always did', () => {
    // Every pattern saved before a fold could say where its neutral axis sits
    // reads as the mid-surface, and the mid-surface arc is what the bend zone
    // has always been. So this is not a tolerance — it is the same leather,
    // vertex for vertex. Anything looser and shipping the knob would quietly
    // reshape every document in existence.
    const unsaid = solveData()
    const middle = solveData({ neutralAxisRatio: 0.5 })
    expect(unsaid.creases[0].zoneWidth).toBe(3 * FIXTURE_ANGLE_RAD)
    expect(middle.creases[0].zoneWidth).toBe(unsaid.creases[0].zoneWidth)
    expect([...middle.positions]).toEqual([...unsaid.positions])
    expect([...middle.thicknessScale]).toEqual([...unsaid.thicknessScale])
  })

  it('narrows the bend zone by exactly what a low neutral axis saves', () => {
    // Leather gives up in compression long before it gives up in tension, so
    // its neutral axis rides below the middle of the sheet and the turn eats
    // less flat material than the mid-surface arc would suggest. How much
    // less is arithmetic, not taste: the allowance is A·(R_inner + K·T), our
    // radius measures the mid-surface so R_inner = R − T/2, and the whole
    // correction collapses to A·(K − ½)·T.
    const panel = 2
    const ratio = 0.35
    const middle = solveData({}, panel)
    const low = solveData({ neutralAxisRatio: ratio }, panel)
    const saved = FIXTURE_ANGLE_RAD * (0.5 - ratio) * panel
    expect(low.creases[0].zoneWidth).toBeCloseTo(middle.creases[0].zoneWidth - saved, 12)
    expect(low.creases[0].zoneWidth).toBeLessThan(middle.creases[0].zoneWidth)
  })

  it('spends more leather through a skived crease and draws it thinner', () => {
    // Skiving thins the leather along the fold line so a stiff panel can turn
    // at all. Both halves of that show up here. Less material inside the turn
    // is less material to compress, so the neutral axis has less far to sink
    // and the bend eats *more* flat leather, not less — and the leather is
    // drawn to the thickness it was skived to rather than the panel's.
    const panel = 2
    const ratio = 0.35
    const skivedMm = 1.1
    const full = solveData({ neutralAxisRatio: ratio, foldThicknessMm: panel }, panel)
    const skived = solveData({ neutralAxisRatio: ratio, foldThicknessMm: skivedMm }, panel)
    expect(skived.creases[0].zoneWidth).toBeGreaterThan(full.creases[0].zoneWidth)
    expect(skived.creases[0].zoneWidth - full.creases[0].zoneWidth).toBeCloseTo(
      FIXTURE_ANGLE_RAD * (0.5 - ratio) * (panel - skivedMm),
      12,
    )
    expect(Math.min(...skived.thicknessScale)).toBeCloseTo(skivedMm / panel, 6)
    expect(Math.min(...full.thicknessScale)).toBe(1)
  })

  it('leaves the bend zone alone when a skived crease turns about its middle', () => {
    // Worth pinning because it reads as a bug and is not: at K = ½ the
    // thickness cancels out of the allowance — R − T/2 + T/2 is R — so
    // skiving a mid-axis fold moves no material whatever and only makes the
    // leather thinner to look at. It is the neutral axis, not the skive, that
    // decides whether thickness is spent.
    const panel = 2
    const skived = solveData({ foldThicknessMm: 1 }, panel)
    expect(skived.creases[0].zoneWidth).toBe(solveData({}, panel).creases[0].zoneWidth)
    expect(Math.min(...skived.thicknessScale)).toBe(0.5)
  })

  it('cannot fold leather the panel was never cut from', () => {
    // A fold thicker than its own panel is a document saying something
    // impossible; the panel is the ceiling.
    const panel = 2
    const asked = solveData({ neutralAxisRatio: 0.35, foldThicknessMm: 6 }, panel)
    const capped = solveData({ neutralAxisRatio: 0.35, foldThicknessMm: panel }, panel)
    expect(asked.creases[0].zoneWidth).toBe(capped.creases[0].zoneWidth)
    expect(Math.min(...asked.thicknessScale)).toBe(1)
  })

  it('bevels a skive instead of stepping it', () => {
    // A real skive is a long shallow bevel. Drawn as a step it would put a
    // hard line down each side of the fold — a second crease parallel to the
    // real one, which is the very thing skiving is done to avoid — so the
    // thickness has to climb back to the panel monotonically and through
    // genuinely intermediate values.
    const panel = 2
    const skived = solveData({ angleDeg: 180, foldThicknessMm: 1 }, panel)
    const rows: Array<{ across: number; scale: number }> = []
    for (let index = 0; index < skived.thicknessScale.length; index += 1) {
      rows.push({
        across: Math.abs(skived.restPositions[index * 2 + 1] - 20),
        scale: skived.thicknessScale[index],
      })
    }
    rows.sort((a, b) => a.across - b.across)
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index].scale).toBeGreaterThanOrEqual(rows[index - 1].scale - 1e-6)
    }
    expect(Math.min(...skived.thicknessScale)).toBe(0.5)
    expect(Math.max(...skived.thicknessScale)).toBe(1)
    const bevel = rows.filter((row) => row.scale > 0.51 && row.scale < 0.99)
    expect(bevel.length).toBeGreaterThan(3)
  })

  it('reports a stress value for every vertex, on scale', () => {
    const result = solve()
    expect(result.stress).toHaveLength(result.positions.length / 3)
    for (let index = 0; index < result.stress.length; index += 1) {
      expect(Number.isFinite(result.stress[index])).toBe(true)
      expect(result.stress[index]).toBeGreaterThanOrEqual(0)
      expect(result.stress[index]).toBeLessThanOrEqual(1)
    }
  })

  it('leaves a fold the leather can make unmarked', () => {
    // 1.5 mm leather with nothing inside the fold closes to a 0.75 mm radius;
    // this one rolls at six, eight times the room it needs. Nowhere on the
    // piece is the leather being asked for anything.
    const result = solveFoldDrape({
      outer: SQUARE,
      holes: [],
      folds: [fold({ bendRadiusMm: 6 })],
      thicknessMm: 1.5,
    })
    expect(result).not.toBeNull()
    expect(Math.max(...result!.stress)).toBeLessThan(0.05)
  })

  it('marks a fold turning tighter than its stack allows, at the crease', () => {
    // A flap folded flat over a ten-millimetre stack: closed, the bend has to
    // hold that plus the leather's own thickness, so it cannot roll tighter
    // than six millimetres — and this one is asked for one.
    const result = solveFoldDrape({
      outer: SQUARE,
      holes: [],
      folds: [fold({ angleDeg: 180, bendRadiusMm: 1, wrappedThicknessMm: 10 })],
      thicknessMm: 2,
    })
    expect(result).not.toBeNull()
    const stress = result!.stress
    const fromCrease = (index: number) => Math.abs(result!.restPositions[index * 2 + 1] - 20)

    // Loud, and loud in the one place a leatherworker would take a skiving
    // knife to: not merely present somewhere on the piece.
    let worst = 0
    for (let index = 1; index < stress.length; index += 1) {
      if (stress[index] > stress[worst]) worst = index
    }
    expect(stress[worst]).toBeGreaterThan(0.6)
    expect(fromCrease(worst)).toBeLessThan(2)

    const inBend = [...stress.keys()].filter((index) => fromCrease(index) <= 3)
    expect(inBend.length).toBeGreaterThan(10)
    const mean = inBend.reduce((total, index) => total + stress[index], 0) / inBend.length
    expect(mean).toBeGreaterThan(0.3)
    for (const index of stress.keys()) {
      if (fromCrease(index) > 4) {
        expect(stress[index]).toBeLessThan(0.05)
      }
    }
  })

  it('leaves the flat leather either side of the crease alone', () => {
    // Both halves, well clear of the bend zone: the half that stays never
    // moved and the half that swings went rigidly, so neither has been
    // stretched or turned, and both must read as untouched. The wrapped stack
    // belongs to the crease, not to the panel — leather out here has only its
    // own thickness to clear.
    for (const drapeFold of [fold(), fold({ angleDeg: 180, bendRadiusMm: 1, wrappedThicknessMm: 10 })]) {
      const result = solveFoldDrape({ outer: SQUARE, holes: [], folds: [drapeFold], thicknessMm: 2 })
      expect(result).not.toBeNull()
      for (const index of result!.stress.keys()) {
        const y = result!.restPositions[index * 2 + 1]
        if (y > 26 || y < 14) {
          expect(result!.stress[index]).toBeLessThan(0.02)
        }
      }
    }
  })

  it('reads the fold against the leather at the crease, not the panel', () => {
    // Four-millimetre leather turning about 1.2 mm is over-bent: half its own
    // thickness is two, and that is all the room there is inside the turn.
    // Skive the spine to one millimetre and the same turn is comfortable —
    // which is the whole reason a leatherworker skives, so the threshold has
    // to be the leather at the crease and not the leather in the panel. The
    // fold itself is unchanged: a skive about the mid-surface spends no more
    // material, so this is the same geometry read against a different limit.
    const turn = { angleDeg: 90, bendRadiusMm: 1.2 }
    const panel = solveFoldDrape({ outer: SQUARE, holes: [], folds: [fold(turn)], thicknessMm: 4 })
    const skived = solveFoldDrape({
      outer: SQUARE,
      holes: [],
      folds: [fold({ ...turn, foldThicknessMm: 1 })],
      thicknessMm: 4,
    })
    expect(panel).not.toBeNull()
    expect(skived).not.toBeNull()
    expect(Math.max(...panel!.stress)).toBeGreaterThan(0.3)
    expect(Math.max(...skived!.stress)).toBeLessThan(0.05)
  })

  it('returns null when there is nothing to fold', () => {
    expect(
      solveFoldDrape({ outer: SQUARE, holes: [], folds: [], thicknessMm: 2 }),
    ).toBeNull()
    expect(
      solveFoldDrape({
        outer: SQUARE,
        holes: [],
        folds: [fold({ angleDeg: 0 })],
        thicknessMm: 2,
      }),
    ).toBeNull()
  })
})
