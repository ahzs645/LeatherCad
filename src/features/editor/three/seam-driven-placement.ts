/**
 * Solve where pieces sit in 3D from the seams that join them.
 *
 * The alternative, and what this replaces, is typing six numbers per piece into
 * the inspector — three translations and three rotations — which is how the
 * assembled view worked. Seamer Studio never asks for that: it arranges pieces
 * on a body and lets the seams pull them together. Leather panels are stiff
 * rather than draping, so the equivalent here is not a cloth solve but a rigid
 * one: walk the seam graph and place each piece so its seam edge meets the edge
 * it is sewn to.
 *
 * The solve produces a flat, connected layout at an assembly angle of 0 — every
 * piece in one plane, folded open like a paper net. Raising the angle rotates
 * each piece about the seam it hangs from, so 90 degrees stands a gusset up and
 * 180 folds a lining back onto its panel. That single scrubber is what turns the
 * net into the object.
 *
 * Coordinates here are document millimetres in the viewport's axis convention:
 * X is document X, Z is document Y, and Y is up out of the flat plane.
 */

import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import type { PiecePlacement3D, SeamConnection } from '../cad/cad-types'
import { resolveSeamSpans } from '../assembly/seam-spans'
import { resolveSeamSide, seamSidePolyline } from '../assembly/seam-geometry'
import { seamsInSewOrder } from '../assembly/seam-spans'
import type { PieceMeshData } from './piece-mesh'

const FLAT_NORMAL = new Vector3(0, 1, 0)
const MIN_AXIS_LENGTH = 1e-6

export type SeamPlacementDiagnostic = {
  seamId: string
  pieceId: string
  /** Distance still separating the far ends of the two seam sides, in mm. */
  residualGapMm: number
  /**
   * The two sides are the same length but turn differently, so no rigid
   * placement closes them — the piece has to crease, as a boxed gusset does at
   * each corner. The solve still lays it along the first stretch.
   */
  requiresCrease: boolean
}

export type SeamDrivenPlacementResult = {
  placements: PiecePlacement3D[]
  /** Pieces no seam reaches, left where they were. */
  unplacedPieceIds: string[]
  /** Seams that could not be used, because a side would not resolve. */
  skippedSeamIds: string[]
  diagnostics: SeamPlacementDiagnostic[]
}

export type SeamDrivenPlacementOptions = {
  /**
   * Dihedral angle applied at every seam, in degrees. 0 lays the pieces out
   * flat and connected; 90 stands them up; 180 folds them closed.
   */
  assemblyAngleDeg?: number
  /** Piece to hold fixed. Defaults to the one with the largest area. */
  rootPieceId?: string
}

function toVector(point: { x: number; y: number }) {
  return new Vector3(point.x, 0, point.y)
}

function polygonCentroid(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return new Vector3()
  }
  let x = 0
  let y = 0
  for (const point of points) {
    x += point.x
    y += point.y
  }
  return new Vector3(x / points.length, 0, y / points.length)
}

function polygonArea(points: Array<{ x: number; y: number }>) {
  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    total += current.x * next.y - next.x * current.y
  }
  return Math.abs(total) / 2
}

/** Rotation of `angle` about the line through `origin` along unit `axis`. */
function rotationAboutLine(origin: Vector3, axis: Vector3, angle: number) {
  return new Matrix4()
    .makeTranslation(origin.x, origin.y, origin.z)
    .multiply(new Matrix4().makeRotationAxis(axis, angle))
    .multiply(new Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z))
}

/**
 * A seam side as an ordered polyline in flat document space. Returns null when
 * the side does not resolve against the current geometry.
 */
function flatSidePolyline(
  pieceMeshesById: Map<string, PieceMeshData>,
  connection: SeamConnection,
  side: 'from' | 'to',
) {
  const resolved = resolveSeamSide(pieceMeshesById, resolveSeamSpans(connection, side))
  if (!resolved) {
    return null
  }
  const points = seamSidePolyline(resolved).map(toVector)
  return {
    points,
    pieceIds: resolved.pieceIds,
    lengthMm: resolved.lengthMm,
  }
}

/** Rigid transform taking segment (b0 → b1) onto (a0 → a1). */
function alignSegments(b0: Vector3, b1: Vector3, a0: Vector3, a1: Vector3) {
  const source = b1.clone().sub(b0)
  const target = a1.clone().sub(a0)
  if (source.length() <= MIN_AXIS_LENGTH || target.length() <= MIN_AXIS_LENGTH) {
    return new Matrix4().makeTranslation(a0.x - b0.x, a0.y - b0.y, a0.z - b0.z)
  }
  const rotation = new Matrix4().makeRotationFromQuaternion(
    new Quaternion().setFromUnitVectors(source.clone().normalize(), target.clone().normalize()),
  )
  const rotatedB0 = b0.clone().applyMatrix4(rotation)
  return new Matrix4()
    .makeTranslation(a0.x - rotatedB0.x, a0.y - rotatedB0.y, a0.z - rotatedB0.z)
    .multiply(rotation)
}

/**
 * Express a solved world transform as a `PiecePlacement3D`.
 *
 * The viewport rotates a piece about its own centroid (see
 * `assembled-model-builder`), so the stored translation is the residue left
 * after that rotation, and the Z component is negated to match the viewport's
 * left-handed document mapping.
 */
function toPlacement(pieceId: string, matrix: Matrix4, centroid: Vector3): PiecePlacement3D {
  const rotationOnly = new Matrix4().extractRotation(matrix)
  const euler = new Euler().setFromRotationMatrix(rotationOnly, 'XYZ')
  // Rotating about the centroid leaves the centroid's own displacement as the
  // whole of the translation: M*c = R*(c - c) + c + T, so T = M*c - c.
  const translation = centroid.clone().applyMatrix4(matrix).sub(centroid)

  return {
    pieceId,
    translationMm: {
      x: translation.x,
      y: translation.y,
      z: -translation.z,
    },
    rotationDeg: {
      x: (euler.x * 180) / Math.PI,
      y: (euler.y * 180) / Math.PI,
      z: (euler.z * 180) / Math.PI,
    },
    flipped: false,
  }
}

export function solveSeamDrivenPlacements(params: {
  pieceMeshes: PieceMeshData[]
  seamConnections: SeamConnection[]
  options?: SeamDrivenPlacementOptions
}): SeamDrivenPlacementResult {
  const { pieceMeshes, seamConnections } = params
  const assemblyAngle = ((params.options?.assemblyAngleDeg ?? 0) * Math.PI) / 180
  const pieceMeshesById = new Map(pieceMeshes.map((mesh) => [mesh.pieceId, mesh]))
  const centroidById = new Map(pieceMeshes.map((mesh) => [mesh.pieceId, polygonCentroid(mesh.outer)]))

  if (pieceMeshes.length === 0) {
    return { placements: [], unplacedPieceIds: [], skippedSeamIds: [], diagnostics: [] }
  }

  const rootPieceId =
    params.options?.rootPieceId && pieceMeshesById.has(params.options.rootPieceId)
      ? params.options.rootPieceId
      : [...pieceMeshes]
          .sort((left, right) => polygonArea(right.outer) - polygonArea(left.outer))[0]
          .pieceId

  const transforms = new Map<string, Matrix4>([[rootPieceId, new Matrix4()]])
  const skippedSeamIds: string[] = []
  const diagnostics: SeamPlacementDiagnostic[] = []

  // Sewing order is the natural traversal order: it is the order a maker would
  // attach the pieces in, so the piece a seam hangs from is usually already placed.
  const orderedSeams = seamsInSewOrder(seamConnections).filter(
    (connection) => connection.kind === 'sewn' || connection.kind === 'hinge',
  )

  // Repeat until no further progress: a seam whose parent is not yet placed on
  // one pass may become usable on the next.
  let progressed = true
  const consumedSeamIds = new Set<string>()
  while (progressed) {
    progressed = false

    for (const connection of orderedSeams) {
      if (consumedSeamIds.has(connection.id)) {
        continue
      }

      const fromSide = flatSidePolyline(pieceMeshesById, connection, 'from')
      const toSide = flatSidePolyline(pieceMeshesById, connection, 'to')
      if (!fromSide || !toSide) {
        consumedSeamIds.add(connection.id)
        skippedSeamIds.push(connection.id)
        continue
      }

      // A seam may span several pieces per side; only a single unplaced piece
      // on one side can be solved for.
      const fromPlaced = fromSide.pieceIds.every((pieceId) => transforms.has(pieceId))
      const toPlaced = toSide.pieceIds.every((pieceId) => transforms.has(pieceId))
      if (fromPlaced && toPlaced) {
        consumedSeamIds.add(connection.id)
        continue
      }
      if (!fromPlaced && !toPlaced) {
        continue
      }

      const parentSide = fromPlaced ? fromSide : toSide
      const childSide = fromPlaced ? toSide : fromSide
      const childPieceIds = childSide.pieceIds.filter((pieceId) => !transforms.has(pieceId))
      if (childPieceIds.length !== 1) {
        // Two pieces meeting the same side at once is under-determined; leave it
        // for a seam that pins one of them down first.
        continue
      }
      const childPieceId = childPieceIds[0]

      const parentTransform = transforms.get(parentSide.pieceIds[0]) ?? new Matrix4()
      const placedParent = parentSide.points.map((point) => point.clone().applyMatrix4(parentTransform))
      // Sewn sides run against each other, so the child's start meets the
      // parent's end unless the seam says the two run the same way.
      const runsOpposite = connection.reversed !== false
      const targetPath = runsOpposite ? [...placedParent].reverse() : placedParent

      // Align the first stretch of each side. Using the two far ends instead
      // would try to make a straight piece span a run that turns corners, and
      // would land it at an angle that matches neither.
      const targetStart = targetPath[0]
      const targetEnd = targetPath[1] ?? targetPath[targetPath.length - 1]
      const childStart = childSide.points[0]
      const childEnd = childSide.points[1] ?? childSide.points[childSide.points.length - 1]

      let transform = alignSegments(childStart, childEnd, targetStart, targetEnd)

      const axis = targetEnd.clone().sub(targetStart)
      const hasAxis = axis.length() > MIN_AXIS_LENGTH
      if (hasAxis) {
        axis.normalize()
        const parentNormal = FLAT_NORMAL.clone()
          .applyMatrix4(new Matrix4().extractRotation(parentTransform))
          .normalize()
        // In-plane direction across the seam, used to tell which side of it a
        // piece lies on.
        const across = new Vector3().crossVectors(parentNormal, axis).normalize()
        const parentCentroid = (centroidById.get(parentSide.pieceIds[0]) ?? new Vector3())
          .clone()
          .applyMatrix4(parentTransform)
        const childCentroid = (centroidById.get(childPieceId) ?? new Vector3())
          .clone()
          .applyMatrix4(transform)
        const parentOffset = parentCentroid.clone().sub(targetStart).dot(across)
        const childOffset = childCentroid.clone().sub(targetStart).dot(across)
        // Landing on the parent's own side means the piece would sit on top of
        // it. Half a turn about the seam puts it where a maker would lay it.
        if (parentOffset * childOffset > 0) {
          transform = rotationAboutLine(targetStart, axis, Math.PI).multiply(transform)
        }
        if (Math.abs(assemblyAngle) > 1e-9) {
          transform = rotationAboutLine(targetStart, axis, assemblyAngle).multiply(transform)
        }
      }

      transforms.set(childPieceId, transform)
      consumedSeamIds.add(connection.id)
      progressed = true

      const placedChildFar = childSide.points[childSide.points.length - 1].clone().applyMatrix4(transform)
      const targetFar = targetPath[targetPath.length - 1]
      const residualGapMm = placedChildFar.distanceTo(targetFar)
      // Same length, different shape: the run turns and the piece would have to
      // turn with it. That is a crease, not a solver failure.
      const lengthsAgree = Math.abs(parentSide.lengthMm - childSide.lengthMm) < 0.5
      diagnostics.push({
        seamId: connection.id,
        pieceId: childPieceId,
        residualGapMm,
        requiresCrease: residualGapMm > 0.5 && lengthsAgree,
      })
    }
  }

  const placements: PiecePlacement3D[] = []
  const unplacedPieceIds: string[] = []
  for (const mesh of pieceMeshes) {
    const transform = transforms.get(mesh.pieceId)
    if (!transform) {
      unplacedPieceIds.push(mesh.pieceId)
      continue
    }
    placements.push(toPlacement(mesh.pieceId, transform, centroidById.get(mesh.pieceId) ?? new Vector3()))
  }

  return { placements, unplacedPieceIds, skippedSeamIds, diagnostics }
}
