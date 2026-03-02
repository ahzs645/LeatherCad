import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
  WheelEvent as ReactWheelEvent,
} from 'react'
import {
  clamp,
  distance,
  getBounds,
  uid,
} from '../cad/cad-geometry'
import type {
  FoldLine,
  HardwareKind,
  HardwareMarker,
  Layer,
  LineType,
  Point,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  StitchHoleType,
  Tool,
  Viewport,
} from '../cad/cad-types'
import { snapPointToContext } from '../ops/pattern-ops'
import {
  createStitchHole,
  findNearestStitchAnchor,
} from '../ops/stitch-hole-ops'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from '../ops/fold-line-ops'
import { sanitizeFoldLine } from '../editor-parsers'
import { HARDWARE_PRESETS, MAX_ZOOM, MIN_ZOOM } from '../editor-constants'

type PanState = {
  startX: number
  startY: number
  originX: number
  originY: number
  pointerId: number
}

type UseCanvasInteractionsParams = {
  svgRef: RefObject<SVGSVGElement | null>
  panRef: RefObject<PanState | null>
  tool: Tool
  draftPoints: Point[]
  viewport: Viewport
  activeLayerId: string
  activeLineTypeId: string
  activeSketchGroup: SketchGroup | null
  snapSettings: SnapSettings
  foldLines: FoldLine[]
  displayShapes: Shape[]
  snapShapes: Shape[]
  stitchTargetShapes: Shape[]
  visibleHardwareMarkers: HardwareMarker[]
  lineTypesById: Record<string, LineType>
  shapesById: Record<string, Shape>
  layers: Layer[]
  hardwarePreset: HardwareKind
  customHardwareDiameterMm: number
  customHardwareSpacingMm: number
  stitchHoleType: StitchHoleType
  stitchHoles: StitchHole[]
  hardwareMarkers: HardwareMarker[]
  selectedStitchHoleId: string | null
  selectedHardwareMarkerId: string | null
  setStatus: Dispatch<SetStateAction<string>>
  setViewport: Dispatch<SetStateAction<Viewport>>
  setDraftPoints: Dispatch<SetStateAction<Point[]>>
  setCursorPoint: Dispatch<SetStateAction<Point | null>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  clearDraft: () => void
  ensureActiveLayerWritable: () => boolean
  ensureActiveLineTypeWritable: () => boolean
}

export function useCanvasInteractions(params: UseCanvasInteractionsParams) {
  const {
    svgRef,
    panRef,
    tool,
    draftPoints,
    viewport,
    activeLayerId,
    activeLineTypeId,
    activeSketchGroup,
    snapSettings,
    foldLines,
    displayShapes,
    snapShapes,
    stitchTargetShapes,
    visibleHardwareMarkers,
    lineTypesById,
    shapesById,
    layers,
    hardwarePreset,
    customHardwareDiameterMm,
    customHardwareSpacingMm,
    stitchHoleType,
    stitchHoles,
    hardwareMarkers,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    setStatus,
    setViewport,
    setDraftPoints,
    setCursorPoint,
    setShapes,
    setStitchHoles,
    setSelectedStitchHoleId,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    setFoldLines,
    setSelectedShapeIds,
    clearDraft,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
  } = params

  const toWorldPoint = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current
    if (!svg) {
      return null
    }

    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    }
  }

  const getSnappedPoint = (point: Point) =>
    snapPointToContext(point, snapSettings, {
      shapes: snapShapes,
      foldLines,
      hardwareMarkers: visibleHardwareMarkers,
      viewportScale: viewport.scale,
    })

  const zoomAtScreenPoint = (screenX: number, screenY: number, zoomFactor: number) => {
    setViewport((previous) => {
      const nextScale = clamp(previous.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM)
      const worldX = (screenX - previous.x) / previous.scale
      const worldY = (screenY - previous.y) / previous.scale
      return {
        x: screenX - worldX * nextScale,
        y: screenY - worldY * nextScale,
        scale: nextScale,
      }
    })
  }

  const handleZoomStep = (zoomFactor: number) => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    zoomAtScreenPoint(rect.width / 2, rect.height / 2, zoomFactor)
  }

  const handleResetView = () => {
    setViewport({ x: 560, y: 360, scale: 1 })
    setStatus('View reset')
  }

  const handleFitView = () => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    if (displayShapes.length === 0) {
      handleResetView()
      return
    }

    const rect = svg.getBoundingClientRect()
    const bounds = getBounds(displayShapes)
    const margin = 40
    const fitScale = clamp(
      Math.min((rect.width - margin * 2) / bounds.width, (rect.height - margin * 2) / bounds.height),
      MIN_ZOOM,
      MAX_ZOOM,
    )

    setViewport({
      scale: fitScale,
      x: rect.width / 2 - (bounds.minX + bounds.width / 2) * fitScale,
      y: rect.height / 2 - (bounds.minY + bounds.height / 2) * fitScale,
    })
      setStatus('View fit to current sketch view')
  }

  const beginPan = (clientX: number, clientY: number, pointerId: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: viewport.x,
      originY: viewport.y,
      pointerId,
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0 && !(event.button === 1 || event.button === 2)) {
      return
    }

    if (event.pointerType === 'touch' && panRef.current && panRef.current.pointerId !== event.pointerId) {
      return
    }

    if (tool === 'pan' || event.button === 1 || event.button === 2) {
      event.preventDefault()
      beginPan(event.clientX, event.clientY, event.pointerId)
      if (event.pointerType !== 'touch') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Touch browsers can throw here; pan still works without capture.
        }
      }
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const rawPoint = toWorldPoint(event.clientX, event.clientY)
    if (!rawPoint) {
      return
    }
    const snappedPoint = getSnappedPoint(rawPoint)
    const point = snappedPoint.point

    setCursorPoint(point)

    if (tool === 'line') {
      if (!ensureActiveLayerWritable() || !ensureActiveLineTypeWritable()) {
        return
      }

      if (draftPoints.length === 0) {
        setDraftPoints([point])
        setStatus('Line: pick end point')
        return
      }

      const start = draftPoints[0]
      if (distance(start, point) < 0.001) {
        setStatus('Line ignored: start and end overlap')
        clearDraft()
        return
      }

      setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'line',
          layerId: activeLayerId,
          lineTypeId: activeLineTypeId,
          groupId: activeSketchGroup?.id,
          start,
          end: point,
        },
      ])
      clearDraft()
      setStatus('Line created')
      return
    }

    if (tool === 'stitch-hole') {
      const nearestStitchAnchor = findNearestStitchAnchor(point, stitchTargetShapes, lineTypesById, 16 / viewport.scale)
      if (!nearestStitchAnchor) {
        setStatus('No stitch path near pointer. Tap near a visible stitch line.')
        return
      }

      const targetShape = shapesById[nearestStitchAnchor.shapeId]
      if (!targetShape) {
        setStatus('Could not resolve stitch path')
        return
      }

      const targetLayer = layers.find((layer) => layer.id === targetShape.layerId)
      if (targetLayer?.locked) {
        setStatus('Target layer is locked. Unlock it before placing stitch holes.')
        return
      }

      let createdHoleId: string | null = null
      setStitchHoles((previous) => {
        const nextSequence =
          previous
            .filter((stitchHole) => stitchHole.shapeId === nearestStitchAnchor.shapeId)
            .reduce((maximum, stitchHole) => Math.max(maximum, stitchHole.sequence), -1) + 1
        const createdHole = {
          ...createStitchHole(nearestStitchAnchor, stitchHoleType),
          sequence: nextSequence,
        }
        createdHoleId = createdHole.id
        return [
          ...previous,
          createdHole,
        ]
      })
      setSelectedStitchHoleId(createdHoleId)
      setStatus(`Stitch hole placed (${stitchHoleType})`)
      return
    }

    if (tool === 'hardware') {
      if (!ensureActiveLayerWritable()) {
        return
      }

      const preset = hardwarePreset === 'custom' ? null : HARDWARE_PRESETS[hardwarePreset]
      const marker: HardwareMarker = {
        id: uid(),
        layerId: activeLayerId,
        groupId: activeSketchGroup?.id,
        point,
        kind: hardwarePreset,
        label: hardwarePreset === 'custom' ? 'Hardware' : preset?.label ?? 'Hardware',
        holeDiameterMm:
          hardwarePreset === 'custom'
            ? clamp(customHardwareDiameterMm || 4, 0.1, 120)
            : (preset?.holeDiameterMm ?? 4),
        spacingMm:
          hardwarePreset === 'custom'
            ? clamp(customHardwareSpacingMm || 0, 0, 300)
            : (preset?.spacingMm ?? 0),
        notes: '',
        visible: true,
      }
      setHardwareMarkers((previous) => [...previous, marker])
      setSelectedHardwareMarkerId(marker.id)
      setStatus(`Placed hardware marker (${marker.kind})`)
      return
    }

    if (tool === 'fold') {
      if (draftPoints.length === 0) {
        setDraftPoints([point])
        setStatus('Fold line: pick end point')
        return
      }

      const start = draftPoints[0]
      if (distance(start, point) < 0.001) {
        setStatus('Fold line ignored: start and end overlap')
        clearDraft()
        return
      }

      setFoldLines((previous) => [
        ...previous,
        sanitizeFoldLine({
          id: uid(),
          name: `Fold ${previous.length + 1}`,
          start,
          end: point,
          angleDeg: 0,
          maxAngleDeg: 180,
          direction: DEFAULT_FOLD_DIRECTION,
          radiusMm: DEFAULT_FOLD_RADIUS_MM,
          thicknessMm: DEFAULT_FOLD_THICKNESS_MM,
          neutralAxisRatio: DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
          stiffness: DEFAULT_FOLD_STIFFNESS,
          clearanceMm: DEFAULT_FOLD_CLEARANCE_MM,
        }),
      ])
      clearDraft()
      setStatus('Fold line assigned')
      return
    }

    if (tool === 'arc') {
      if (!ensureActiveLayerWritable() || !ensureActiveLineTypeWritable()) {
        return
      }

      if (draftPoints.length < 2) {
        setDraftPoints((previous) => [...previous, point])
        setStatus(draftPoints.length === 0 ? 'Arc: pick midpoint' : 'Arc: pick end point')
        return
      }

      setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'arc',
          layerId: activeLayerId,
          lineTypeId: activeLineTypeId,
          groupId: activeSketchGroup?.id,
          start: draftPoints[0],
          mid: draftPoints[1],
          end: point,
        },
      ])
      clearDraft()
      setStatus('Arc created')
      return
    }

    if (tool === 'bezier') {
      if (!ensureActiveLayerWritable() || !ensureActiveLineTypeWritable()) {
        return
      }

      if (draftPoints.length < 2) {
        setDraftPoints((previous) => [...previous, point])
        setStatus(draftPoints.length === 0 ? 'Bezier: pick control point' : 'Bezier: pick end point')
        return
      }

      setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'bezier',
          layerId: activeLayerId,
          lineTypeId: activeLineTypeId,
          groupId: activeSketchGroup?.id,
          start: draftPoints[0],
          control: draftPoints[1],
          end: point,
        },
      ])
      clearDraft()
      setStatus('Bezier created')
    }
  }

  const handleShapePointerDown = (event: ReactPointerEvent<SVGElement>, shapeId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    event.stopPropagation()
    setSelectedHardwareMarkerId(null)

    setSelectedShapeIds((previous) => {
      const isAlreadySelected = previous.includes(shapeId)
      let next: string[]

      if (event.shiftKey) {
        next = isAlreadySelected ? previous.filter((entry) => entry !== shapeId) : [...previous, shapeId]
      } else {
        next = isAlreadySelected && previous.length === 1 ? [] : [shapeId]
      }

      setStatus(next.length === 0 ? 'Shape selection cleared' : `${next.length} shape${next.length === 1 ? '' : 's'} selected`)
      return next
    })
  }

  const handleStitchHolePointerDown = (event: ReactPointerEvent<SVGElement>, stitchHoleId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const stitchHole = stitchHoles.find((entry) => entry.id === stitchHoleId)
    if (!stitchHole) {
      return
    }

    event.stopPropagation()
    setSelectedShapeIds([])
    const nextId = selectedStitchHoleId === stitchHoleId ? null : stitchHoleId
    setSelectedStitchHoleId(nextId)
    setStatus(nextId ? `Stitch hole ${stitchHole.sequence + 1} selected` : 'Stitch-hole selection cleared')
  }

  const handleHardwarePointerDown = (event: ReactPointerEvent<SVGGElement>, markerId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const marker = hardwareMarkers.find((entry) => entry.id === markerId)
    if (!marker) {
      return
    }

    event.stopPropagation()
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    const nextId = selectedHardwareMarkerId === markerId ? null : markerId
    setSelectedHardwareMarkerId(nextId)
    setStatus(nextId ? `Hardware marker selected: ${marker.label}` : 'Hardware marker selection cleared')
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panState = panRef.current
    if (panState) {
      if (event.pointerType === 'touch' && event.pointerId !== panState.pointerId) {
        return
      }

      const deltaX = event.clientX - panState.startX
      const deltaY = event.clientY - panState.startY
      setViewport((previous) => ({
        ...previous,
        x: panState.originX + deltaX,
        y: panState.originY + deltaY,
      }))
      return
    }

    if (draftPoints.length === 0 && tool !== 'hardware') {
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (point) {
      setCursorPoint(getSnappedPoint(point).point)
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panState = panRef.current
    if (!panState) {
      return
    }

    if (event.pointerType === 'touch' && event.pointerId !== panState.pointerId) {
      return
    }

    panRef.current = null
    if (event.pointerType !== 'touch') {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      } catch {
        // Safe no-op for browsers that fail pointer capture checks.
      }
    }
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    zoomAtScreenPoint(screenX, screenY, zoomFactor)
  }

  return {
    handleZoomStep,
    handleResetView,
    handleFitView,
    handlePointerDown,
    handleShapePointerDown,
    handleStitchHolePointerDown,
    handleHardwarePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
  }
}
