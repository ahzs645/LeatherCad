/**
 * The four questions the functional benchmark could not previously ask.
 *
 * `ai-builder-functional.test.ts` scores whether a document cuts, sews and
 * folds, and ten agents found the same four holes in it — each demonstrated
 * with a document that took full marks while carrying the defect:
 *
 * 1. two pieces occupying the same leather on the flat sheet,
 * 2. stitch holes, hardware and marks drawn off the piece they belong to,
 * 3. a crease that stops short of the cut edge and so cannot be folded,
 * 4. a seam whose two sides do not actually mate, which the one guard on
 *    seam correctness — a length comparison — cannot see.
 *
 * Every answer here is measured against resolved geometry through the app's
 * own resolvers: `resolvePatternPieceChains` and `buildPieceMeshes` for what a
 * piece is, `booleanOpPolygons` for what two of them share, `splitPieceByFolds`
 * for what a fold divides, `resolveSeamSide` for what a seam runs along. None
 * of it re-reads the AI JSON, because the JSON is what the defect looked
 * correct in.
 *
 * This lives beside the harness rather than inside it so the checks can be
 * tested on purpose-built documents — one with the defect, one without —
 * instead of only against whatever the benchmark corpus happens to contain.
 *
 * The shipped app reaches for it in one place: `check_pattern`, the WebMCP tool
 * that lets an agent score the document it just wrote before telling anyone the
 * pattern is ready. Same questions, asked live instead of on a corpus.
 */

import type { DocFile, FoldLine, PatternPiece, Point, SeamConnection } from '../cad/cad-types'
import { resolveSeamSide, sampleSide, type ResolvedSeamSide } from '../assembly/seam-geometry'
import { resolveSeamSpans } from '../assembly/seam-spans'
import { booleanOpPolygons } from '../ops/clipper-ops'
import { pointInPolygon } from '../ops/outline-detection'
import { resolvePatternPieceChains } from '../ops/pattern-piece-ops'
import { splitPieceByFolds } from '../three/assembled-fold-regions'
import { buildPieceMeshes, type PieceMeshData } from '../three/piece-mesh'
import { solveSeamDrivenPlacements } from '../three/seam-driven-placement'

export type FunctionalCheck = { name: string; points: number; max: number; note: string }

/**
 * Shared area of two pieces below this is a rounding artefact of the clipper's
 * micron grid or two pieces butted edge to edge, not a nesting that overlaps.
 */
export const PIECE_OVERLAP_TOLERANCE_MM2 = 1
/** How far off the leather a mark may sit before it counts as off it. */
export const OFF_LEATHER_TOLERANCE_MM = 0.5
/** How far short of a cut edge a crease may stop before it cannot be folded. */
export const FOLD_REACH_TOLERANCE_MM = 0.5
/** How far a seam's two sides may fail to mate before the seam twists. */
export const SEAM_MATE_TOLERANCE_MM = 0.5
/** Points sampled along each side of a seam when pairing the two runs up. */
const SEAM_MATE_SAMPLES = 16

/** A seam the assembly actually acts on: an alignment reference is neither. */
function isJoiningSeam(connection: SeamConnection) {
  return connection.kind === 'sewn' || connection.kind === 'hinge'
}

/**
 * Every pattern piece the app can resolve into a closed boundary with holes,
 * through the same two calls the editor and the 3D view make.
 */
export function resolvePieceMeshes(doc: DocFile): PieceMeshData[] {
  const { byShapeId } = resolvePatternPieceChains(doc.objects, doc.lineTypes)
  return buildPieceMeshes(doc.patternPieces ?? [], byShapeId)
}

function polygonSetAreaMm2(polygons: Point[][]) {
  let total = 0
  for (const polygon of polygons) {
    let sum = 0
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index]
      const next = polygon[(index + 1) % polygon.length]
      sum += current.x * next.y - next.x * current.y
    }
    total += Math.abs(sum) / 2
  }
  return total
}

/** The leather a piece actually occupies: its outline with its cutouts removed. */
function cutAreaPolygons(piece: PieceMeshData) {
  if (piece.holes.length === 0) {
    return [piece.outer]
  }
  return booleanOpPolygons([piece.outer], piece.holes, 'difference')
}

function distanceToPolygonMm(point: Point, polygon: Point[]) {
  let best = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared <= 1e-12
      ? 0
      : Math.min(Math.max(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0), 1)
    best = Math.min(best, Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t)))
  }
  return best
}

// ---------------------------------------------------------------------------
// 1. Pieces do not overlap on the flat sheet
// ---------------------------------------------------------------------------

/**
 * Two pattern pieces must not occupy the same leather.
 *
 * `assembled-model-builder` documents the convention this rests on: pieces are
 * laid out apart on the sheet and only come together once the seams place
 * them, so shared area in the document is not assembly intent — it is a
 * nesting that cannot be cut, and it silently poisons the drape clash score
 * besides, because `drapeObstaclesForPiece` reads a piece's document position
 * as its assembly position.
 *
 * Measured as the intersection area of the two pieces' cut areas — outline
 * minus cutouts — through the app's own clipper, so a piece nested inside
 * another's window counts as clear.
 */
export function checkPiecesDoNotOverlap(doc: DocFile): FunctionalCheck {
  const pieces = resolvePieceMeshes(doc)
  if (pieces.length < 2) {
    return {
      name: 'pieces-dont-overlap',
      points: 0,
      max: 0,
      note: `${pieces.length} resolved piece(s), nothing to overlap`,
    }
  }

  const areas = pieces.map((piece) => ({ piece, polygons: cutAreaPolygons(piece) }))
  let worstMm2 = 0
  let worstPair = ''
  for (let left = 0; left < areas.length; left += 1) {
    for (let right = left + 1; right < areas.length; right += 1) {
      const shared = polygonSetAreaMm2(
        booleanOpPolygons(areas[left].polygons, areas[right].polygons, 'intersection'),
      )
      if (shared > worstMm2) {
        worstMm2 = shared
        worstPair = `"${areas[left].piece.name}" and "${areas[right].piece.name}"`
      }
    }
  }

  const clear = worstMm2 <= PIECE_OVERLAP_TOLERANCE_MM2
  return {
    name: 'pieces-dont-overlap',
    points: clear ? 2 : 0,
    max: 2,
    note: clear
      ? `${pieces.length} piece(s), worst shared area ${worstMm2.toFixed(2)}mm2`
      : `${worstPair} share ${worstMm2.toFixed(2)}mm2 of sheet`,
  }
}

// ---------------------------------------------------------------------------
// 2. Stitch holes, hardware and marks sit on the leather
// ---------------------------------------------------------------------------

type LeatherMark = {
  kind: string
  id: string
  point: Point
  /** The pieces this mark belongs to, or every piece when the document says nothing. */
  owners: PieceMeshData[]
}

function ownersByInternalShape(pieces: PieceMeshData[], byPieceId: Map<string, PatternPiece>, shapeId: string) {
  return pieces.filter((piece) => byPieceId.get(piece.pieceId)?.internalShapeIds.includes(shapeId))
}

function collectLeatherMarks(doc: DocFile, pieces: PieceMeshData[]): LeatherMark[] {
  const byPieceId = new Map((doc.patternPieces ?? []).map((piece) => [piece.id, piece]))
  const orAll = (owners: PieceMeshData[]) => (owners.length > 0 ? owners : pieces)
  const marks: LeatherMark[] = []

  for (const hole of doc.stitchHoles ?? []) {
    marks.push({
      kind: 'stitch hole',
      id: hole.id,
      point: hole.point,
      owners: orAll(ownersByInternalShape(pieces, byPieceId, hole.shapeId)),
    })
  }

  for (const marker of doc.hardwareMarkers ?? []) {
    // Hardware carries no shape, so the layer is the only ownership the
    // document states. Where it names no piece, any piece will do.
    const onLayer = pieces.filter((piece) => byPieceId.get(piece.pieceId)?.layerId === marker.layerId)
    marks.push({ kind: 'hardware marker', id: marker.id, point: marker.point, owners: orAll(onLayer) })
  }

  const markLineTypeIds = new Set(
    doc.lineTypes.filter((lineType) => lineType.role === 'mark').map((lineType) => lineType.id),
  )
  for (const shape of doc.objects) {
    // Only marks: a mark is by definition stamped into the leather, where a
    // guide or a dimension is drawn on the sheet around it.
    if (shape.type !== 'text' || !markLineTypeIds.has(shape.lineTypeId)) {
      continue
    }
    marks.push({
      kind: 'label',
      id: shape.id,
      point: shape.start,
      owners: orAll(ownersByInternalShape(pieces, byPieceId, shape.id)),
    })
  }

  return marks
}

/** How far a point sits outside a piece, or 0 when it is on its leather. */
function distanceOffPieceMm(point: Point, piece: PieceMeshData) {
  const insideOutline = pointInPolygon(point, piece.outer)
  const inCutout = piece.holes.some((hole) => pointInPolygon(point, hole))
  if (insideOutline && !inCutout) {
    return 0
  }
  let edgeDistance = distanceToPolygonMm(point, piece.outer)
  for (const hole of piece.holes) {
    edgeDistance = Math.min(edgeDistance, distanceToPolygonMm(point, hole))
  }
  return edgeDistance
}

/**
 * Every stitch hole, hardware marker and mark must land on the piece it
 * belongs to.
 *
 * Ownership is the document's own: a stitch hole names the stitch path it was
 * generated from and a piece names that path in `internalShapeIds`, so a hole
 * resolves to the piece that authored it rather than to whichever piece it
 * happens to have drifted over. Marks the document attributes to nothing are
 * allowed to sit on any piece.
 *
 * Both stitch runs moved clean off the leather used to score full marks,
 * because nothing asked where the holes were — only how many there were.
 */
export function checkMarksOnLeather(doc: DocFile): FunctionalCheck {
  const pieces = resolvePieceMeshes(doc)
  const marks = pieces.length === 0 ? [] : collectLeatherMarks(doc, pieces)
  if (marks.length === 0) {
    return { name: 'marks-on-leather', points: 0, max: 0, note: 'no stitch holes, hardware or marks' }
  }

  let offCount = 0
  let worstMm = 0
  const offKinds = new Map<string, number>()
  for (const mark of marks) {
    const distance = Math.min(...mark.owners.map((piece) => distanceOffPieceMm(mark.point, piece)))
    if (distance <= OFF_LEATHER_TOLERANCE_MM) {
      continue
    }
    offCount += 1
    worstMm = Math.max(worstMm, distance)
    offKinds.set(mark.kind, (offKinds.get(mark.kind) ?? 0) + 1)
  }

  const onLeather = offCount === 0
  return {
    name: 'marks-on-leather',
    points: onLeather ? 2 : 0,
    max: 2,
    note: onLeather
      ? `${marks.length} mark(s) on the leather they belong to`
      : `${offCount}/${marks.length} off the leather (${[...offKinds]
          .map(([kind, count]) => `${count} ${kind}`)
          .join(', ')}), worst ${worstMm.toFixed(2)}mm out`,
  }
}

// ---------------------------------------------------------------------------
// 3. Creases reach the cut edges
// ---------------------------------------------------------------------------

/** Where a fold's infinite line enters and leaves a piece, in fold parameters. */
function foldChordRange(fold: FoldLine, polygon: Point[]) {
  const dx = fold.end.x - fold.start.x
  const dy = fold.end.y - fold.start.y
  const parameters: number[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const ex = end.x - start.x
    const ey = end.y - start.y
    const denominator = dx * ey - dy * ex
    if (Math.abs(denominator) < 1e-12) {
      continue
    }
    const t = ((start.x - fold.start.x) * ey - (start.y - fold.start.y) * ex) / denominator
    const u = ((start.x - fold.start.x) * dy - (start.y - fold.start.y) * dx) / denominator
    if (u >= -1e-9 && u <= 1 + 1e-9) {
      parameters.push(t)
    }
  }
  if (parameters.length < 2) {
    return null
  }
  return { min: Math.min(...parameters), max: Math.max(...parameters) }
}

/**
 * A crease must run cut edge to cut edge.
 *
 * `splitPieceByFolds` divides a piece with `clipPolygonByLine`, which extends
 * the fold to an infinite line — so a crease drawn across only the middle of a
 * piece still splits it into two regions and still folds cleanly in the
 * preview, while the real leather stays joined either side of it and will not
 * fold at all.
 *
 * The gate is the app's own splitter: only folds it treats as dividing a piece
 * are judged, and each is measured against where its line actually crosses
 * that piece's boundary. The shortfall reported is how much crease is missing
 * at the worst end.
 */
export function checkFoldsReachCutEdges(doc: DocFile): FunctionalCheck {
  const pieces = resolvePieceMeshes(doc)
  const folds = doc.foldLines ?? []
  if (folds.length === 0 || pieces.length === 0) {
    return { name: 'folds-reach-cut-edges', points: 0, max: 0, note: 'no fold lines' }
  }

  let divided = 0
  let shortCount = 0
  let worstMm = 0
  let worstLabel = ''
  for (const fold of folds) {
    const lengthMm = Math.hypot(fold.end.x - fold.start.x, fold.end.y - fold.start.y)
    if (lengthMm <= 1e-6) {
      continue
    }
    for (const piece of pieces) {
      if (splitPieceByFolds(piece.outer, [fold]).length < 2) {
        continue
      }
      const chord = foldChordRange(fold, piece.outer)
      if (!chord) {
        continue
      }
      divided += 1
      // The chord runs from `min` to `max`; the authored crease runs 0 to 1.
      // Anything the chord covers outside that is leather the crease never
      // reaches, and the piece stays joined across it.
      const shortfallMm = Math.max(
        Math.max(0, -chord.min) * lengthMm,
        Math.max(0, chord.max - 1) * lengthMm,
      )
      if (shortfallMm <= FOLD_REACH_TOLERANCE_MM) {
        continue
      }
      shortCount += 1
      if (shortfallMm > worstMm) {
        worstMm = shortfallMm
        worstLabel = `"${fold.name}" on "${piece.name}"`
      }
    }
  }

  if (divided === 0) {
    return { name: 'folds-reach-cut-edges', points: 0, max: 0, note: 'no fold divides a piece' }
  }

  const reaches = shortCount === 0
  return {
    name: 'folds-reach-cut-edges',
    points: reaches ? 2 : 0,
    max: 2,
    note: reaches
      ? `${divided} crease(s) reach both cut edges`
      : `${shortCount}/${divided} crease(s) stop short, worst ${worstLabel} by ${worstMm.toFixed(2)}mm`,
  }
}

// ---------------------------------------------------------------------------
// 4. Seams mate
// ---------------------------------------------------------------------------

function pointAlongSide(side: ResolvedSeamSide, distanceMm: number): Point {
  const { stretch, t } = sampleSide(side.stretches, distanceMm)
  return {
    x: stretch.edge.start.x + (stretch.edge.end.x - stretch.edge.start.x) * t,
    y: stretch.edge.start.y + (stretch.edge.end.y - stretch.edge.start.y) * t,
  }
}

/**
 * The point pairs a seam claims to bring together.
 *
 * The mating direction is the app's own rule, from `seam-driven-placement`:
 * sewn sides run against each other unless the seam says otherwise. Span-level
 * `reversed` flags are already baked into the resolved sides, so a span
 * reversed *and* a connection reversed compose here exactly as they do in the
 * 3D view — into a double flip.
 */
function matedPairs(from: ResolvedSeamSide, to: ResolvedSeamSide, connection: SeamConnection) {
  const runsOpposite = connection.reversed !== false
  const pairs: Array<{ a: Point; b: Point }> = []
  for (let index = 0; index <= SEAM_MATE_SAMPLES; index += 1) {
    const fraction = index / SEAM_MATE_SAMPLES
    pairs.push({
      a: pointAlongSide(from, fraction * from.lengthMm),
      b: pointAlongSide(to, (runsOpposite ? 1 - fraction : fraction) * to.lengthMm),
    })
  }
  return pairs
}

/**
 * How far these pairs are from being reflections in one straight crease, in mm.
 *
 * Folding a flat piece about a straight line is a reflection: every mated pair
 * straddles the crease along a common direction, and every pair's midpoint
 * lands on the crease itself. So the chords must be parallel, and their
 * midpoints must all project to the same place along that direction. Returns
 * null when the pairs carry no usable chord — two runs lying on top of each
 * other say nothing about a crease.
 */
function creaseDeviationMm(pairs: Array<{ a: Point; b: Point }>) {
  const chords = pairs
    .map((pair) => ({ x: pair.b.x - pair.a.x, y: pair.b.y - pair.a.y }))
    .map((chord) => ({ ...chord, length: Math.hypot(chord.x, chord.y) }))
    .filter((chord) => chord.length > 1e-3)
  if (chords.length < 2) {
    return null
  }

  let ux = 0
  let uy = 0
  for (const chord of chords) {
    const sign = ux * chord.x + uy * chord.y < 0 ? -1 : 1
    ux += (chord.x / chord.length) * sign
    uy += (chord.y / chord.length) * sign
  }
  const uLength = Math.hypot(ux, uy)
  if (uLength < 1e-9) {
    // Chords cancelling out means they point every which way, which is as far
    // from one crease direction as it is possible to be.
    return Number.POSITIVE_INFINITY
  }
  ux /= uLength
  uy /= uLength

  // Out-of-line component of each chord, in mm.
  let worst = 0
  for (const chord of chords) {
    worst = Math.max(worst, Math.abs(chord.x * uy - chord.y * ux))
  }
  // Spread of the midpoints along the crease normal, in mm.
  const projections = pairs.map((pair) => ((pair.a.x + pair.b.x) / 2) * ux + ((pair.a.y + pair.b.y) / 2) * uy)
  return Math.max(worst, Math.max(...projections) - Math.min(...projections))
}

/**
 * A seam has to do more than match lengths.
 *
 * `seam.length_mismatch` is the only guard the app has on seam correctness,
 * which leaves two failures invisible and both were found in committed
 * documents:
 *
 * - **A seam that joins a piece to itself must fold.** The two runs are on one
 *   rigid piece, so the only motion that brings them together is a crease, and
 *   a crease is a reflection. When the mated pairs are not reflections in one
 *   line the seam twists the leather instead of folding it — which is exactly
 *   what a span's `reversed` composed with the connection's own `reversed`
 *   produces, the double flip the committed `swarm-snap-coin-pouch.json`
 *   carries on both seams.
 * - **A seam graph has to reach every piece.** Running the app's own
 *   `solveSeamDrivenPlacements` says which pieces the seams can actually
 *   position; a piece it cannot reach is one no seam attaches, and no amount
 *   of matching edge lengths will assemble it.
 *
 * What this deliberately does not claim to catch: between two *different*
 * pieces, mating the wrong edge of equal length is a rigid re-seating of that
 * piece, and on the axis-aligned rectangles these documents are made of it
 * produces an assembly that is geometrically valid — the piece simply ends up
 * turned around. That is a semantic error the geometry cannot see, and saying
 * so is more useful than a rule that guesses.
 */
export function checkSeamsMateCorrectly(doc: DocFile): FunctionalCheck {
  const pieces = resolvePieceMeshes(doc)
  const seams = (doc.seamConnections ?? []).filter(isJoiningSeam)
  if (seams.length === 0 || pieces.length === 0) {
    return { name: 'seams-mate-correctly', points: 0, max: 0, note: 'no sewn or hinged seams' }
  }

  const piecesById = new Map(pieces.map((piece) => [piece.pieceId, piece]))
  const failures: string[] = []
  let worstMm = 0

  for (const seam of seams) {
    const from = resolveSeamSide(piecesById, resolveSeamSpans(seam, 'from'))
    const to = resolveSeamSide(piecesById, resolveSeamSpans(seam, 'to'))
    if (!from || !to) {
      failures.push(`${seam.id} does not resolve on both sides`)
      continue
    }
    const sameRigidPiece =
      from.pieceIds.length === 1 && to.pieceIds.length === 1 && from.pieceIds[0] === to.pieceIds[0]
    if (!sameRigidPiece) {
      continue
    }
    const deviationMm = creaseDeviationMm(matedPairs(from, to, seam))
    if (deviationMm === null) {
      continue
    }
    worstMm = Math.max(worstMm, deviationMm)
    if (deviationMm <= SEAM_MATE_TOLERANCE_MM) {
      continue
    }
    failures.push(`${seam.id} joins "${piecesById.get(from.pieceIds[0])?.name ?? from.pieceIds[0]}" to itself `
      + `but its two runs are ${Number.isFinite(deviationMm) ? `${deviationMm.toFixed(2)}mm` : 'infinitely'} `
      + 'from any single crease')
  }

  const placement = solveSeamDrivenPlacements({
    pieceMeshes: pieces,
    seamConnections: seams,
    options: { assemblyAngleDeg: 0 },
  })
  for (const seamId of placement.skippedSeamIds) {
    failures.push(`${seamId} could not be used to place anything`)
  }
  for (const pieceId of placement.unplacedPieceIds) {
    failures.push(`"${piecesById.get(pieceId)?.name ?? pieceId}" is not reached by any seam`)
  }

  const mates = failures.length === 0
  return {
    name: 'seams-mate-correctly',
    points: mates ? 2 : 0,
    max: 2,
    note: mates
      ? `${seams.length} seam(s) mate, worst crease deviation ${worstMm.toFixed(2)}mm`
      : failures.join('; '),
  }
}

/** Every geometric check, in the order the report reads best in. */
export function scoreDocumentGeometry(doc: DocFile): FunctionalCheck[] {
  return [
    checkPiecesDoNotOverlap(doc),
    checkMarksOnLeather(doc),
    checkFoldsReachCutEdges(doc),
    checkSeamsMateCorrectly(doc),
  ]
}
