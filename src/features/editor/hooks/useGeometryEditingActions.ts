import type { Dispatch, SetStateAction } from 'react'
import type { Shape, BezierShape, ArcShape, LineShape, Point } from '../cad/cad-types'
import { distance, uid } from '../cad/cad-geometry'
import {
  buildBoundaryLines,
  buildCenterLineBetween,
  buildDistanceMarks,
  buildNotchOnShape,
  convertArcToBezier,
  convertShapeToPathBeziers,
  extendLineToShape,
  filletAdjacentCorners,
  filletCorner,
  findNearestIntersection,
  makeBezierCpFlat,
  makeBezierCpSameLength,
  makeBezierCpSymmetric,
  mirrorShape,
  removeDuplicateShapes,
  resizeShapeToDimensions,
  setLineAngle,
  splitShapeIntoN,
  trimShapeAtPoint,
} from '../ops/geometry-editing-ops'

type UseGeometryEditingActionsParams = {
  shapes: Shape[]
  setShapes: Dispatch<SetStateAction<Shape[]>>
  selectedShapeIdSet: Set<string>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  activeLayerId: string
  activeLineTypeId: string
  setStatus: Dispatch<SetStateAction<string>>
  showBezierOffsetLines: boolean
  setShowBezierOffsetLines: Dispatch<SetStateAction<boolean>>
}

export function useGeometryEditingActions(params: UseGeometryEditingActionsParams) {
  const {
    shapes,
    setShapes,
    selectedShapeIdSet,
    setSelectedShapeIds,
    activeLayerId,
    activeLineTypeId,
    setStatus,
    showBezierOffsetLines,
    setShowBezierOffsetLines,
  } = params

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getSelectedShapes = (): Shape[] =>
    shapes.filter((shape) => selectedShapeIdSet.has(shape.id))

  function getSelectionBoundingBox(selected: Shape[]): {
    minX: number
    minY: number
    maxX: number
    maxY: number
    centerX: number
    centerY: number
    width: number
    height: number
  } {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const shape of selected) {
      const points = getShapePoints(shape)
      for (const p of points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
    }

    const width = maxX - minX
    const height = maxY - minY

    return {
      minX,
      minY,
      maxX,
      maxY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width,
      height,
    }
  }

  function getShapePoints(shape: Shape): Point[] {
    if (shape.type === 'line') return [shape.start, shape.end]
    if (shape.type === 'arc') return [shape.start, shape.mid, shape.end]
    if (shape.type === 'bezier') return [shape.start, shape.control, shape.end]
    return [shape.start, shape.end]
  }

  function replaceShapeById(prev: Shape[], id: string, replacements: Shape[]): Shape[] {
    const result: Shape[] = []
    for (const shape of prev) {
      if (shape.id === id) {
        result.push(...replacements)
      } else {
        result.push(shape)
      }
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // handleConvertArcToBezier
  // ---------------------------------------------------------------------------

  const handleConvertSelectionToPath = (duplicate = false) => {
    const selected = getSelectedShapes()
    if (selected.length === 0) {
      setStatus('Select one or more shapes to convert to a path')
      return
    }

    setShapes((prev) => {
      if (duplicate) {
        const copies: Shape[] = selected.flatMap((shape) =>
          convertShapeToPathBeziers(shape).map((converted) =>
            converted === shape ? { ...converted, id: uid() } : { ...converted, id: uid() },
          ),
        )
        return [...prev, ...copies]
      }
      let updated = prev
      for (const shape of selected) {
        const replacements = convertShapeToPathBeziers(shape)
        if (replacements.length === 1 && replacements[0] === shape) {
          continue
        }
        updated = replaceShapeById(updated, shape.id, replacements)
      }
      return updated
    })
    setStatus(duplicate ? `Converted a copy of ${selected.length} shape(s) to path` : `Converted ${selected.length} shape(s) to path`)
  }

  const handleConvertArcToBezier = () => {
    const selectedArcs = getSelectedShapes().filter(
      (shape): shape is ArcShape => shape.type === 'arc',
    )

    if (selectedArcs.length === 0) {
      setStatus('Select one or more arcs first')
      return
    }

    setShapes((prev) => {
      let updated = prev
      for (const arc of selectedArcs) {
        const beziers = convertArcToBezier(arc)
        updated = replaceShapeById(updated, arc.id, beziers)
      }
      return updated
    })

    setStatus(`Converted ${selectedArcs.length} arc(s) to bezier`)
  }

  // ---------------------------------------------------------------------------
  // Bezier control point helpers (shared logic)
  // ---------------------------------------------------------------------------

  function findSharedBezierPairInfo(selected: Shape[]): {
    bezier: BezierShape
    adjacentBezier: BezierShape
    sharedPoint: 'start' | 'end'
  } | null {
    const beziers = selected.filter(
      (shape): shape is BezierShape => shape.type === 'bezier',
    )

    if (beziers.length !== 2) return null

    const [a, b] = beziers
    const tolerance = 1e-6

    // Check all endpoint combinations to find the shared point
    if (distance(a.end, b.start) < tolerance) {
      return { bezier: a, adjacentBezier: b, sharedPoint: 'start' }
    }
    if (distance(a.end, b.end) < tolerance) {
      return { bezier: a, adjacentBezier: b, sharedPoint: 'end' }
    }
    if (distance(a.start, b.start) < tolerance) {
      return { bezier: a, adjacentBezier: b, sharedPoint: 'start' }
    }
    if (distance(a.start, b.end) < tolerance) {
      return { bezier: a, adjacentBezier: b, sharedPoint: 'end' }
    }

    return null
  }

  // ---------------------------------------------------------------------------
  // handleMakeBezierCpFlat
  // ---------------------------------------------------------------------------

  const handleMakeBezierCpFlat = () => {
    const selected = getSelectedShapes()
    const pairInfo = findSharedBezierPairInfo(selected)

    if (!pairInfo) {
      setStatus('Select exactly 2 bezier shapes that share an endpoint')
      return
    }

    const { bezier, adjacentBezier, sharedPoint } = pairInfo
    const updated = makeBezierCpFlat(bezier, adjacentBezier, sharedPoint)

    setShapes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setStatus('Made bezier control point collinear (flat)')
  }

  // ---------------------------------------------------------------------------
  // handleMakeBezierCpSameLength
  // ---------------------------------------------------------------------------

  const handleMakeBezierCpSameLength = () => {
    const selected = getSelectedShapes()
    const pairInfo = findSharedBezierPairInfo(selected)

    if (!pairInfo) {
      setStatus('Select exactly 2 bezier shapes that share an endpoint')
      return
    }

    const { bezier, adjacentBezier, sharedPoint } = pairInfo
    const updated = makeBezierCpSameLength(bezier, adjacentBezier, sharedPoint)

    setShapes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setStatus('Made bezier control point same length')
  }

  // ---------------------------------------------------------------------------
  // handleMakeBezierCpSymmetric
  // ---------------------------------------------------------------------------

  const handleMakeBezierCpSymmetric = () => {
    const selected = getSelectedShapes()
    const pairInfo = findSharedBezierPairInfo(selected)

    if (!pairInfo) {
      setStatus('Select exactly 2 bezier shapes that share an endpoint')
      return
    }

    const { bezier, adjacentBezier, sharedPoint } = pairInfo
    const updated = makeBezierCpSymmetric(bezier, adjacentBezier, sharedPoint)

    setShapes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setStatus('Made bezier control point symmetric')
  }

  // ---------------------------------------------------------------------------
  // handleSmoothBezierJointAtControl — invoked by a double-click on a bezier's
  // control-point handle. Looks at both endpoints of the source bezier and:
  //   - if an adjacent bezier shares one of the endpoints, mirror that bezier's
  //     CP through the shared joint so the curves meet smoothly (source v1.7.0)
  //   - if instead only a straight line is connected, rotate the line endpoint
  //     so it lies on the line through the joint and the source bezier's CP,
  //     same length as the line (source v2.8.3)
  // ---------------------------------------------------------------------------

  const handleSmoothBezierJointAtControl = (bezierId: string) => {
    const target = shapes.find((entry): entry is BezierShape => entry.id === bezierId && entry.type === 'bezier')
    if (!target) {
      return
    }
    const tolerance = 1e-6
    const tryEndpoint = (endpoint: 'start' | 'end') => {
      const joint = endpoint === 'start' ? target.start : target.end
      for (const other of shapes) {
        if (other.id === target.id) continue
        if (other.type !== 'bezier' && other.type !== 'line') continue
        const otherStartShared = distance(other.start, joint) < tolerance
        const otherEndShared = distance(other.end, joint) < tolerance
        if (!otherStartShared && !otherEndShared) continue
        if (other.type === 'bezier') {
          const sharedSide: 'start' | 'end' = otherStartShared ? 'start' : 'end'
          const updated = makeBezierCpSymmetric(target, other, sharedSide)
          setShapes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
          setStatus('Smoothed bezier joint (adjacent bezier CP set symmetric)')
          return true
        }
        // Connected straight line: rotate its non-joint endpoint along the joint
        // through the source bezier's control point, keeping its current length.
        const lineOther = other
        const farEndpointKey: 'start' | 'end' = otherStartShared ? 'end' : 'start'
        const farPoint = farEndpointKey === 'start' ? lineOther.start : lineOther.end
        const lineLength = distance(joint, farPoint)
        if (lineLength < tolerance) return false
        const cpDirX = joint.x - target.control.x
        const cpDirY = joint.y - target.control.y
        const cpDirLen = Math.hypot(cpDirX, cpDirY)
        if (cpDirLen < tolerance) return false
        const ux = cpDirX / cpDirLen
        const uy = cpDirY / cpDirLen
        const rotated: Point = { x: joint.x + ux * lineLength, y: joint.y + uy * lineLength }
        setShapes((prev) =>
          prev.map((shape) => {
            if (shape.id !== lineOther.id) return shape
            return farEndpointKey === 'start'
              ? { ...shape, start: rotated }
              : { ...shape, end: rotated }
          }),
        )
        setStatus('Smoothed bezier joint (line rotated to bezier handle axis)')
        return true
      }
      return false
    }
    if (!tryEndpoint('start') && !tryEndpoint('end')) {
      setStatus('No adjacent bezier or line found at this bezier endpoint')
    }
  }

  // ---------------------------------------------------------------------------
  // handleExtendOrTrimLines
  // ---------------------------------------------------------------------------

  const handleExtendOrTrimLines = () => {
    const selected = getSelectedShapes()

    if (selected.length !== 2) {
      setStatus('Select exactly 2 shapes: one line to extend/trim and one target shape')
      return
    }

    // Determine which is the line and which is the target
    const lineShape = selected.find((s): s is LineShape => s.type === 'line')
    const targetShape = selected.find((s) => s.id !== lineShape?.id)

    if (!lineShape || !targetShape) {
      setStatus('One of the selected shapes must be a line')
      return
    }

    // Try finding intersection via findNearestIntersection
    const intersection = findNearestIntersection(lineShape, [targetShape])

    if (!intersection) {
      setStatus('No intersection found between selected shapes')
      return
    }

    // Determine which end of the line is closer to the intersection point
    const distToStart = distance(lineShape.start, intersection.point)
    const distToEnd = distance(lineShape.end, intersection.point)

    let updatedLine: LineShape | Shape
    if (distToEnd <= distToStart) {
      // Intersection is closer to end -- try extend end, then trim
      const extended = extendLineToShape(lineShape, targetShape, 'end')
      updatedLine = extended ?? trimShapeAtPoint(lineShape, intersection.point, 'start')
    } else {
      // Intersection is closer to start
      const extended = extendLineToShape(lineShape, targetShape, 'start')
      updatedLine = extended ?? trimShapeAtPoint(lineShape, intersection.point, 'end')
    }

    setShapes((prev) => prev.map((s) => (s.id === lineShape.id ? updatedLine : s)))
    setStatus('Extended/trimmed line to target shape')
  }

  // ---------------------------------------------------------------------------
  // handleMirrorShapes
  // ---------------------------------------------------------------------------

  const handleMirrorShapes = (axis?: { start: Point; end: Point }) => {
    const selected = getSelectedShapes()

    if (selected.length === 0) {
      setStatus('Select one or more shapes to mirror')
      return
    }

    // Determine the mirror axis
    let axisStart: Point
    let axisEnd: Point

    if (axis) {
      axisStart = axis.start
      axisEnd = axis.end
    } else {
      // Default: vertical axis through the center of selection bounding box
      const bbox = getSelectionBoundingBox(selected)
      axisStart = { x: bbox.centerX, y: bbox.minY - 10 }
      axisEnd = { x: bbox.centerX, y: bbox.maxY + 10 }
    }

    const mirroredCopies = selected.map((shape) => mirrorShape(shape, axisStart, axisEnd))

    setShapes((prev) => [...prev, ...mirroredCopies])
    setStatus(`Mirrored ${selected.length} shape(s)`)
  }

  // ---------------------------------------------------------------------------
  // handleToggleBezierOffsetLines
  // ---------------------------------------------------------------------------

  const handleToggleBezierOffsetLines = () => {
    const next = !showBezierOffsetLines
    setShowBezierOffsetLines(next)
    setStatus(`Bezier support lines ${next ? 'ON' : 'OFF'}`)
  }

  // ---------------------------------------------------------------------------
  // handleResizeShapes
  // ---------------------------------------------------------------------------

  const handleResizeShapes = (
    newWidth: number,
    newHeight: number,
    lockAspectRatio: boolean,
  ) => {
    const selected = getSelectedShapes()

    if (selected.length === 0) {
      setStatus('Select one or more shapes to resize')
      return
    }

    const bbox = getSelectionBoundingBox(selected)

    if (bbox.width < 1e-10 && bbox.height < 1e-10) {
      setStatus('Selected shapes have no measurable dimensions')
      return
    }

    let targetWidth = newWidth
    let targetHeight = newHeight

    if (lockAspectRatio) {
      const scaleX = bbox.width > 1e-10 ? newWidth / bbox.width : 1
      const scaleY = bbox.height > 1e-10 ? newHeight / bbox.height : 1
      const uniformScale = Math.min(scaleX, scaleY)
      targetWidth = bbox.width > 1e-10 ? bbox.width * uniformScale : newWidth
      targetHeight = bbox.height > 1e-10 ? bbox.height * uniformScale : newHeight
    }

    const selectedIds = new Set(selected.map((s) => s.id))

    setShapes((prev) =>
      prev.map((shape) => {
        if (!selectedIds.has(shape.id)) return shape
        return resizeShapeToDimensions(shape, targetWidth, targetHeight)
      }),
    )

    setStatus(
      `Resized ${selected.length} shape(s) to ${targetWidth.toFixed(1)} \u00d7 ${targetHeight.toFixed(1)} mm`,
    )
  }

  // ---------------------------------------------------------------------------
  // handleLineSymmetry
  // ---------------------------------------------------------------------------

  const handleLineSymmetry = (axis?: { start: Point; end: Point }) => {
    const selected = getSelectedShapes()

    if (selected.length === 0) {
      setStatus('Select one or more shapes to create symmetric copies')
      return
    }

    let axisStart: Point
    let axisEnd: Point
    let sourceShapes = selected

    if (axis) {
      axisStart = axis.start
      axisEnd = axis.end
    } else {
      const selectedLines = selected.filter((shape): shape is LineShape => shape.type === 'line')
      if (selected.length > 1 && selectedLines.length === 1) {
        const axisLine = selectedLines[0]
        axisStart = axisLine.start
        axisEnd = axisLine.end
        sourceShapes = selected.filter((shape) => shape.id !== axisLine.id)
      } else {
        const bbox = getSelectionBoundingBox(selected)
        axisStart = { x: bbox.centerX, y: bbox.minY - 10 }
        axisEnd = { x: bbox.centerX, y: bbox.maxY + 10 }
      }
    }

    if (sourceShapes.length === 0) {
      setStatus('Select shapes plus one line to use as the symmetry axis')
      return
    }

    const mirroredCopies = sourceShapes.map((shape) => mirrorShape(shape, axisStart, axisEnd))

    setShapes((prev) => [...prev, ...mirroredCopies])
    setStatus(`Created ${mirroredCopies.length} symmetric ${mirroredCopies.length === 1 ? 'copy' : 'copies'}`)
  }

  // ---------------------------------------------------------------------------
  // handleCenterLineBetweenSelection
  // ---------------------------------------------------------------------------

  const handleCenterLineBetweenSelection = () => {
    const selected = getSelectedShapes()
    if (selected.length !== 2) {
      setStatus('Select exactly two shapes to build a center line')
      return
    }
    const newLine = buildCenterLineBetween(selected[0], selected[1], {
      layerId: activeLayerId,
      lineTypeId: activeLineTypeId,
    })
    setShapes((prev) => [...prev, newLine])
    setSelectedShapeIds([newLine.id])
    setStatus('Drew center line between selected shapes')
  }

  // ---------------------------------------------------------------------------
  // handleEditSelectedLineAngle
  // ---------------------------------------------------------------------------

  const handleEditSelectedLineAngle = (angleDeg: number) => {
    const selected = getSelectedShapes()
    const line = selected.find((shape): shape is LineShape => shape.type === 'line')
    if (!line) {
      setStatus('Select a single line whose angle you want to edit')
      return
    }
    if (!Number.isFinite(angleDeg)) {
      setStatus('Invalid angle')
      return
    }
    const updated = setLineAngle(line, angleDeg)
    setShapes((prev) => prev.map((shape) => (shape.id === line.id ? updated : shape)))
    setStatus(`Line angle set to ${angleDeg.toFixed(2)}°`)
  }

  // ---------------------------------------------------------------------------
  // handleDeleteDuplicates
  // ---------------------------------------------------------------------------

  const handleDeleteDuplicates = (tolerance = 0.05) => {
    const { shapes: kept, removedIds } = removeDuplicateShapes(shapes, tolerance)
    if (removedIds.length === 0) {
      setStatus('No duplicate shapes found')
      return
    }
    const removedSet = new Set(removedIds)
    setShapes(kept)
    setSelectedShapeIds((prev) => prev.filter((id) => !removedSet.has(id)))
    setStatus(`Removed ${removedIds.length} duplicate shape${removedIds.length === 1 ? '' : 's'}`)
  }

  // ---------------------------------------------------------------------------
  // handleSplitIntoN
  // ---------------------------------------------------------------------------

  const handleSplitIntoN = (count: number) => {
    if (!Number.isInteger(count) || count < 2) {
      setStatus('Split count must be an integer ≥ 2')
      return
    }
    const selected = getSelectedShapes()
    if (selected.length === 0) {
      setStatus('Select one or more paths to split')
      return
    }
    setShapes((prev) => {
      let updated = prev
      for (const shape of selected) {
        const parts = splitShapeIntoN(shape, count)
        if (parts.length > 1 || parts[0].id !== shape.id) {
          updated = replaceShapeById(updated, shape.id, parts)
        }
      }
      return updated
    })
    setStatus(`Split ${selected.length} path${selected.length === 1 ? '' : 's'} into ${count} segments`)
  }

  // ---------------------------------------------------------------------------
  // handleDistanceMarkSelectedPath (DistMarking)
  // ---------------------------------------------------------------------------

  const handleDistanceMarkSelectedPath = (distancesMm: number[]) => {
    const selected = getSelectedShapes()
    if (selected.length !== 1) {
      setStatus('Select exactly one path to mark distances on')
      return
    }
    const marks = buildDistanceMarks(selected[0], distancesMm, {
      layerId: activeLayerId,
      lineTypeId: activeLineTypeId,
    })
    if (marks.length === 0) {
      setStatus('No distance marks produced (out of range or unsupported shape)')
      return
    }
    setShapes((prev) => [...prev, ...marks])
    setSelectedShapeIds(marks.map((mark) => mark.id))
    setStatus(`Placed ${marks.length} distance mark${marks.length === 1 ? '' : 's'}`)
  }

  // ---------------------------------------------------------------------------
  // handleNotchSelectedShape (Kama / notching)
  // ---------------------------------------------------------------------------

  const handleNotchSelectedShape = (depthMm: number, widthMm: number) => {
    const selected = getSelectedShapes()
    if (selected.length !== 1) {
      setStatus('Select exactly one path to notch')
      return
    }
    const notchLines = buildNotchOnShape(selected[0], 0.5, depthMm, widthMm, {
      layerId: activeLayerId,
      lineTypeId: activeLineTypeId,
    })
    if (notchLines.length === 0) {
      setStatus('Could not build a notch on the selected shape')
      return
    }
    setShapes((prev) => [...prev, ...notchLines])
    setStatus(`Notched path with ${depthMm}mm depth, ${widthMm}mm width`)
  }

  // ---------------------------------------------------------------------------
  // handleFilletSelectedCorner (Mentori / chamfer)
  // ---------------------------------------------------------------------------

  const handleFilletSelectedCorner = (radiusMm: number) => {
    const selected = getSelectedShapes()
    const lines = selected.filter((shape): shape is LineShape => shape.type === 'line')
    if (lines.length < 2) {
      setStatus('Select at least two lines to fillet')
      return
    }
    if (!Number.isFinite(radiusMm) || radiusMm <= 0) {
      setStatus('Fillet radius must be positive')
      return
    }
    if (lines.length === 2) {
      const result = filletCorner(lines[0], lines[1], radiusMm)
      if (!result) {
        setStatus('Could not fillet: lines are parallel, non-intersecting, or too short')
        return
      }
      setShapes((prev) => {
        const next = prev.map((shape) => {
          if (shape.id === result.trimmedA.id) return result.trimmedA
          if (shape.id === result.trimmedB.id) return result.trimmedB
          return shape
        })
        return [...next, result.arc]
      })
      setStatus(`Filleted corner with radius ${radiusMm.toFixed(2)}mm`)
      return
    }
    // Source v2.3.1: batch beveling across a multi-line selection.
    const batch = filletAdjacentCorners(lines, radiusMm)
    if (batch.appliedCornerCount === 0) {
      setStatus('No adjacent corners found in selection to fillet')
      return
    }
    setShapes((prev) => {
      const next = prev.map((shape) => batch.trimmedLinesById.get(shape.id) ?? shape)
      return [...next, ...batch.arcs]
    })
    setStatus(`Filleted ${batch.appliedCornerCount} corner${batch.appliedCornerCount === 1 ? '' : 's'} (r=${radiusMm.toFixed(2)}mm)`)
  }

  // ---------------------------------------------------------------------------
  // handleConvertSelectionToPaintedPart
  //   Source-app v2.0.7: "When converting selected shapes into a template
  //   object, closed portions will be converted to a template path object
  //   filled with the selected color." We treat the active line type's color
  //   as the fill color and tag each closed shape in the selection.
  // ---------------------------------------------------------------------------

  const handleConvertSelectionToPaintedPart = (fillColor?: string) => {
    const selected = getSelectedShapes()
    if (selected.length === 0) {
      setStatus('Select one or more closed shapes to convert to painted parts')
      return
    }
    const tolerance = 1e-3
    const isClosed = (shape: Shape) => {
      const start = shape.start
      const end = shape.end
      return Math.hypot(start.x - end.x, start.y - end.y) < tolerance
    }
    const targets = selected.filter((shape) => shape.type !== 'text' && isClosed(shape))
    if (targets.length === 0) {
      setStatus('Selection has no closed shapes (start ≈ end) to paint')
      return
    }
    const color = fillColor && /^#[0-9a-fA-F]{6}$/.test(fillColor) ? fillColor.toLowerCase() : undefined
    setShapes((previous) =>
      previous.map((shape) => {
        if (!targets.some((target) => target.id === shape.id)) return shape
        return { ...shape, fillColor: color }
      }),
    )
    setStatus(`Painted ${targets.length} shape${targets.length === 1 ? '' : 's'} as template fill`)
  }

  // ---------------------------------------------------------------------------
  // handleDrawBoundaryAroundSelection
  // ---------------------------------------------------------------------------

  const handleDrawBoundaryAroundSelection = (marginMm?: number) => {
    const selected = getSelectedShapes()
    if (selected.length === 0) {
      setStatus('Select one or more shapes to draw a boundary around')
      return
    }
    let resolvedMargin = typeof marginMm === 'number' && Number.isFinite(marginMm) ? marginMm : NaN
    if (Number.isNaN(resolvedMargin) && typeof window !== 'undefined') {
      const raw = window.prompt('Boundary margin (mm)?', '0')
      if (raw === null) return
      const parsed = Number.parseFloat(raw)
      resolvedMargin = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    } else if (Number.isNaN(resolvedMargin)) {
      resolvedMargin = 0
    }
    const boundary = buildBoundaryLines(selected, {
      layerId: activeLayerId,
      lineTypeId: activeLineTypeId,
      marginMm: resolvedMargin,
    })
    if (boundary.length === 0) {
      setStatus('Could not compute a boundary from the selection')
      return
    }
    setShapes((prev) => [...prev, ...boundary])
    setSelectedShapeIds(boundary.map((line) => line.id))
    setStatus(
      resolvedMargin > 0
        ? `Drew boundary with ${boundary.length} segments (margin ${resolvedMargin}mm)`
        : `Drew boundary with ${boundary.length} segments`,
    )
  }

  // ---------------------------------------------------------------------------
  // Return all handlers
  // ---------------------------------------------------------------------------

  return {
    handleConvertArcToBezier,
    handleMakeBezierCpFlat,
    handleMakeBezierCpSameLength,
    handleMakeBezierCpSymmetric,
    handleSmoothBezierJointAtControl,
    handleExtendOrTrimLines,
    handleMirrorShapes,
    handleToggleBezierOffsetLines,
    handleResizeShapes,
    handleLineSymmetry,
    handleCenterLineBetweenSelection,
    handleEditSelectedLineAngle,
    handleDeleteDuplicates,
    handleSplitIntoN,
    handleDrawBoundaryAroundSelection,
    handleFilletSelectedCorner,
    handleDistanceMarkSelectedPath,
    handleConvertSelectionToPath,
    handleConvertSelectionToPaintedPart,
    handleNotchSelectedShape,
  }
}
