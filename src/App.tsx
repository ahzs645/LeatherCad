import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  WheelEvent as ReactWheelEvent,
} from 'react'
import './App.css'
import {
  arcPath,
  clamp,
  distance,
  getBounds,
  isPointLike,
  isShapeLike,
  round,
  shapeToSvg,
  uid,
} from './cad-geometry'
import type { DocFile, FoldLine, Layer, Point, Shape, Tool, Viewport } from './cad-types'
import { ThreePreviewPanel } from './components/ThreePreviewPanel'
import { DEFAULT_PRESET_ID, PRESET_DOCS } from './sample-doc'

const GRID_STEP = 100
const GRID_EXTENT = 4000
const MIN_ZOOM = 0.2
const MAX_ZOOM = 6
const MOBILE_MEDIA_QUERY = '(max-width: 1100px)'
const DEFAULT_FRONT_LAYER_COLOR = '#60a5fa'
const DEFAULT_BACK_LAYER_COLOR = '#f97316'
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const STITCH_COLOR_DARK = '#f59e0b'
const STITCH_COLOR_LIGHT = '#b45309'

type MobileViewMode = 'editor' | 'preview' | 'split'
type MobileOptionsTab = 'view' | 'layers' | 'file'
type ThemeMode = 'dark' | 'light'
type LegendMode = 'layer' | 'stack'
type MobileLayerAction =
  | 'add'
  | 'rename'
  | 'toggle-visibility'
  | 'toggle-lock'
  | 'move-up'
  | 'move-down'
  | 'delete'
  | 'colors'
type MobileFileAction = 'save-json' | 'load-json' | 'load-preset' | 'export-svg' | 'toggle-3d' | 'clear'

const TOOL_OPTIONS: Array<{ value: Tool; label: string }> = [
  { value: 'pan', label: 'Move' },
  { value: 'line', label: 'Line' },
  { value: 'arc', label: 'Arc' },
  { value: 'bezier', label: 'Bezier' },
  { value: 'fold', label: 'Fold' },
]

const MOBILE_OPTIONS_TABS: Array<{ value: MobileOptionsTab; label: string }> = [
  { value: 'view', label: 'View' },
  { value: 'layers', label: 'Layers' },
  { value: 'file', label: 'File' },
]

function toolLabel(tool: Tool) {
  return TOOL_OPTIONS.find((entry) => entry.value === tool)?.label ?? tool
}

function channelToHex(value: number) {
  const clamped = clamp(Math.round(value), 0, 255)
  return clamped.toString(16).padStart(2, '0')
}

function normalizeHexColor(value: string, fallback: string) {
  const candidate = value.trim()
  if (HEX_COLOR_PATTERN.test(candidate)) {
    return candidate.toLowerCase()
  }
  return fallback
}

function interpolateHexColor(startHex: string, endHex: string, ratio: number) {
  const clampedRatio = clamp(ratio, 0, 1)
  const parseChannel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16)

  const start = normalizeHexColor(startHex, DEFAULT_FRONT_LAYER_COLOR)
  const end = normalizeHexColor(endHex, DEFAULT_BACK_LAYER_COLOR)

  const red = parseChannel(start, 1) + (parseChannel(end, 1) - parseChannel(start, 1)) * clampedRatio
  const green = parseChannel(start, 3) + (parseChannel(end, 3) - parseChannel(start, 3)) * clampedRatio
  const blue = parseChannel(start, 5) + (parseChannel(end, 5) - parseChannel(start, 5)) * clampedRatio

  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
}

function looksLikeStitch(shape: Shape, layerName: string) {
  const fingerprint = `${shape.id} ${layerName}`.toLowerCase()
  return fingerprint.includes('stitch') || fingerprint.includes('seam') || fingerprint.includes('thread')
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function parseFoldLine(value: unknown): FoldLine | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    name?: unknown
    start?: unknown
    end?: unknown
    angleDeg?: unknown
    maxAngleDeg?: unknown
  }

  if (!isPointLike(candidate.start) || !isPointLike(candidate.end)) {
    return null
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    name: typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'Fold',
    start: candidate.start,
    end: candidate.end,
    angleDeg: typeof candidate.angleDeg === 'number' ? clamp(candidate.angleDeg, 0, 180) : 0,
    maxAngleDeg: typeof candidate.maxAngleDeg === 'number' ? clamp(candidate.maxAngleDeg, 10, 180) : 180,
  }
}

function parseLayer(value: unknown): Layer | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    name?: unknown
    visible?: unknown
    locked?: unknown
    stackLevel?: unknown
  }

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }

  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'Layer',
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    locked: typeof candidate.locked === 'boolean' ? candidate.locked : false,
    stackLevel:
      typeof candidate.stackLevel === 'number' && Number.isFinite(candidate.stackLevel)
        ? Math.max(0, Math.round(candidate.stackLevel))
        : undefined,
  }
}

function newLayerName(index: number) {
  return `Layer ${index + 1}`
}

function App() {
  const initialLayerIdRef = useRef(uid())
  const [tool, setTool] = useState<Tool>('pan')
  const [shapes, setShapes] = useState<Shape[]>([])
  const [foldLines, setFoldLines] = useState<FoldLine[]>([])
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      id: initialLayerIdRef.current,
      name: 'Layer 1',
      visible: true,
      locked: false,
      stackLevel: 0,
    },
  ])
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayerIdRef.current)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null)
  const [status, setStatus] = useState('Ready')
  const [isPanning, setIsPanning] = useState(false)
  const [showThreePreview, setShowThreePreview] = useState(true)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('editor')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [mobileOptionsTab, setMobileOptionsTab] = useState<MobileOptionsTab>('view')
  const [mobileLayerAction, setMobileLayerAction] = useState<MobileLayerAction>('add')
  const [mobileFileAction, setMobileFileAction] = useState<MobileFileAction>('save-json')
  const [showLayerColorModal, setShowLayerColorModal] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark')
  const [legendMode, setLegendMode] = useState<LegendMode>('layer')
  const [frontLayerColor, setFrontLayerColor] = useState(DEFAULT_FRONT_LAYER_COLOR)
  const [backLayerColor, setBackLayerColor] = useState(DEFAULT_BACK_LAYER_COLOR)
  const [layerColorOverrides, setLayerColorOverrides] = useState<Record<string, string>>({})
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID)
  const [viewport, setViewport] = useState<Viewport>({ x: 560, y: 360, scale: 1 })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number; pointerId: number } | null>(
    null,
  )

  const activeLayer = useMemo(() => layers.find((layer) => layer.id === activeLayerId) ?? layers[0] ?? null, [layers, activeLayerId])
  const visibleShapes = useMemo(() => {
    const visibleLayerIds = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id))
    return shapes.filter((shape) => visibleLayerIds.has(shape.layerId))
  }, [layers, shapes])
  const layerColorsById = useMemo(() => {
    const colorMap: Record<string, string> = {}
    const denominator = Math.max(layers.length - 1, 1)

    for (const [index, layer] of layers.entries()) {
      const continuumColor = interpolateHexColor(frontLayerColor, backLayerColor, index / denominator)
      colorMap[layer.id] = layerColorOverrides[layer.id] ?? continuumColor
    }

    return colorMap
  }, [layers, frontLayerColor, backLayerColor, layerColorOverrides])
  const layerStackLevels = useMemo(() => {
    const stackMap: Record<string, number> = {}
    for (const [index, layer] of layers.entries()) {
      stackMap[layer.id] =
        typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel)
          ? Math.max(0, Math.round(layer.stackLevel))
          : index
    }
    return stackMap
  }, [layers])
  const stackColorsByLevel = useMemo(() => {
    const uniqueStackLevels = Array.from(new Set(layers.map((layer) => layerStackLevels[layer.id] ?? 0))).sort(
      (left, right) => left - right,
    )
    const denominator = Math.max(uniqueStackLevels.length - 1, 1)
    const colorMap: Record<number, string> = {}

    uniqueStackLevels.forEach((stackLevel, index) => {
      colorMap[stackLevel] = interpolateHexColor(frontLayerColor, backLayerColor, index / denominator)
    })

    return colorMap
  }, [layers, layerStackLevels, frontLayerColor, backLayerColor])
  const stackColorsByLayerId = useMemo(() => {
    const colorMap: Record<string, string> = {}
    for (const [index, layer] of layers.entries()) {
      const stackLevel = layerStackLevels[layer.id] ?? index
      colorMap[layer.id] = stackColorsByLevel[stackLevel] ?? DEFAULT_FRONT_LAYER_COLOR
    }
    return colorMap
  }, [layers, layerStackLevels, stackColorsByLevel])
  const stackLegendEntries = useMemo(() => {
    const grouped = new Map<number, string[]>()
    for (const layer of layers) {
      const stackLevel = layerStackLevels[layer.id] ?? 0
      const names = grouped.get(stackLevel) ?? []
      names.push(layer.name)
      grouped.set(stackLevel, names)
    }

    return Array.from(grouped.entries())
      .map(([stackLevel, layerNames]) => ({
        stackLevel,
        layerNames,
        color: stackColorsByLevel[stackLevel] ?? DEFAULT_FRONT_LAYER_COLOR,
      }))
      .sort((left, right) => left.stackLevel - right.stackLevel)
  }, [layers, layerStackLevels, stackColorsByLevel])
  const displayLayerColorsById = legendMode === 'stack' ? stackColorsByLayerId : layerColorsById
  const activeLayerColor = activeLayer
    ? displayLayerColorsById[activeLayer.id] ?? DEFAULT_FRONT_LAYER_COLOR
    : DEFAULT_FRONT_LAYER_COLOR

  const gridLines = useMemo(() => {
    const lines: ReactElement[] = []
    for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i += GRID_STEP) {
      lines.push(
        <line key={`v-${i}`} x1={i} y1={-GRID_EXTENT} x2={i} y2={GRID_EXTENT} className="grid-line" />,
        <line key={`h-${i}`} x1={-GRID_EXTENT} y1={i} x2={GRID_EXTENT} y2={i} className="grid-line" />,
      )
    }
    lines.push(
      <line key="axis-y" x1={0} y1={-GRID_EXTENT} x2={0} y2={GRID_EXTENT} className="axis-line" />,
      <line key="axis-x" x1={-GRID_EXTENT} y1={0} x2={GRID_EXTENT} y2={0} className="axis-line" />,
    )
    return lines
  }, [])

  const previewElement = useMemo(() => {
    if (!cursorPoint || draftPoints.length === 0) {
      return null
    }

    if (tool === 'line' || tool === 'fold') {
      return (
        <line
          x1={draftPoints[0].x}
          y1={draftPoints[0].y}
          x2={cursorPoint.x}
          y2={cursorPoint.y}
          className={tool === 'fold' ? 'fold-preview' : 'shape-preview'}
          style={tool === 'fold' ? undefined : { stroke: activeLayerColor }}
        />
      )
    }

    if (tool === 'arc') {
      if (draftPoints.length === 1) {
        return (
          <line
            x1={draftPoints[0].x}
            y1={draftPoints[0].y}
            x2={cursorPoint.x}
            y2={cursorPoint.y}
            className="shape-preview"
            style={{ stroke: activeLayerColor }}
          />
        )
      }

      return <path d={arcPath(draftPoints[0], draftPoints[1], cursorPoint)} className="shape-preview" style={{ stroke: activeLayerColor }} />
    }

    if (tool === 'bezier') {
      if (draftPoints.length === 1) {
        return (
          <line
            x1={draftPoints[0].x}
            y1={draftPoints[0].y}
            x2={cursorPoint.x}
            y2={cursorPoint.y}
            className="shape-preview"
            style={{ stroke: activeLayerColor }}
          />
        )
      }

      return (
        <path
          d={`M ${round(draftPoints[0].x)} ${round(draftPoints[0].y)} Q ${round(draftPoints[1].x)} ${round(
            draftPoints[1].y,
          )} ${round(cursorPoint.x)} ${round(cursorPoint.y)}`}
          className="shape-preview"
          style={{ stroke: activeLayerColor }}
        />
      )
    }

    return null
  }, [cursorPoint, draftPoints, tool, activeLayerColor])

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

    if (visibleShapes.length === 0) {
      handleResetView()
      return
    }

    const rect = svg.getBoundingClientRect()
    const bounds = getBounds(visibleShapes)
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
    setStatus('View fit to visible shapes')
  }

  const beginPan = (clientX: number, clientY: number, pointerId: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: viewport.x,
      originY: viewport.y,
      pointerId,
    }
    setIsPanning(true)
  }

  const clearDraft = () => {
    setDraftPoints([])
    setCursorPoint(null)
  }

  const ensureActiveLayerWritable = () => {
    if (!activeLayer) {
      setStatus('No active layer available')
      return false
    }

    if (!activeLayer.visible) {
      setStatus('Active layer is hidden. Show it before drawing.')
      return false
    }

    if (activeLayer.locked) {
      setStatus('Active layer is locked. Unlock it before drawing.')
      return false
    }

    return true
  }

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const sync = () => {
      if (media.matches) {
        setIsMobileLayout(true)
        setMobileViewMode('editor')
        setShowMobileMenu(false)
        setMobileOptionsTab('view')
        setTool('pan')
      } else {
        setIsMobileLayout(false)
        setMobileViewMode('split')
        setShowMobileMenu(true)
      }
    }

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (layers.length === 0) {
      return
    }
    if (!layers.some((layer) => layer.id === activeLayerId)) {
      setActiveLayerId(layers[0].id)
    }
  }, [layers, activeLayerId])

  useEffect(() => {
    setLayerColorOverrides((previous) => {
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      let changed = false
      const next: Record<string, string> = {}

      for (const [layerId, color] of Object.entries(previous)) {
        if (layerIdSet.has(layerId)) {
          next[layerId] = color
        } else {
          changed = true
        }
      }

      return changed ? next : previous
    })
  }, [layers])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearDraft()
        setStatus('Draft cancelled')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) {
      return
    }

    setCursorPoint(point)

    if (tool === 'line') {
      if (!ensureActiveLayerWritable()) {
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
          start,
          end: point,
        },
      ])
      clearDraft()
      setStatus('Line created')
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
        {
          id: uid(),
          name: `Fold ${previous.length + 1}`,
          start,
          end: point,
          angleDeg: 0,
          maxAngleDeg: 180,
        },
      ])
      clearDraft()
      setStatus('Fold line assigned')
      return
    }

    if (tool === 'arc') {
      if (!ensureActiveLayerWritable()) {
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
      if (!ensureActiveLayerWritable()) {
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
          start: draftPoints[0],
          control: draftPoints[1],
          end: point,
        },
      ])
      clearDraft()
      setStatus('Bezier created')
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panState = panRef.current
    if (isPanning && panState) {
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

    if (draftPoints.length === 0) {
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (point) {
      setCursorPoint(point)
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panState = panRef.current
    if (!isPanning || !panState) {
      return
    }

    if (event.pointerType === 'touch' && event.pointerId !== panState.pointerId) {
      return
    }

    setIsPanning(false)
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

  const handleExportSvg = () => {
    const bounds = getBounds(visibleShapes)
    const objectMarkup = visibleShapes.map(shapeToSvg).join('\n  ')
    const foldMarkup = foldLines
      .map(
        (foldLine) =>
          `<line x1="${round(foldLine.start.x)}" y1="${round(foldLine.start.y)}" x2="${round(foldLine.end.x)}" y2="${round(foldLine.end.y)}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6 4" fill="none" data-type="fold-line"/>`,
      )
      .join('\n  ')

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(bounds.minX)} ${round(bounds.minY)} ${round(bounds.width)} ${round(bounds.height)}">\n  <rect x="${round(bounds.minX)}" y="${round(bounds.minY)}" width="${round(bounds.width)}" height="${round(bounds.height)}" fill="white"/>\n  ${objectMarkup}\n  ${foldMarkup}\n</svg>`

    downloadFile('leathercraft-export.svg', svg, 'image/svg+xml;charset=utf-8')
    setStatus(`Exported SVG (${visibleShapes.length} visible shapes, ${foldLines.length} folds)`)
  }

  const handleSaveJson = () => {
    const doc: DocFile = {
      version: 1,
      units: 'mm',
      layers,
      activeLayerId,
      objects: shapes,
      foldLines,
    }

    downloadFile('leathercraft-doc.json', JSON.stringify(doc, null, 2), 'application/json;charset=utf-8')
    setStatus('Document JSON saved')
  }

  const handleLoadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as {
        objects?: unknown[]
        foldLines?: unknown[]
        layers?: unknown[]
        activeLayerId?: unknown
      }

      if (!Array.isArray(parsed.objects)) {
        throw new Error('Missing objects array')
      }

      const parsedLayers =
        Array.isArray(parsed.layers)
          ? parsed.layers.map(parseLayer).filter((layer): layer is Layer => layer !== null)
          : []

      const nextLayers =
        parsedLayers.length > 0
          ? parsedLayers
          : [
              {
                id: uid(),
                name: 'Layer 1',
                visible: true,
                locked: false,
                stackLevel: 0,
              },
            ]

      const nextActiveLayerId =
        typeof parsed.activeLayerId === 'string' && nextLayers.some((layer) => layer.id === parsed.activeLayerId)
          ? parsed.activeLayerId
          : nextLayers[0].id

      const nextShapes: Shape[] = []
      for (const candidate of parsed.objects) {
        if (!isShapeLike(candidate)) {
          throw new Error('Invalid shape in objects array')
        }

        const rawLayerId =
          typeof (candidate as { layerId?: unknown }).layerId === 'string'
            ? (candidate as { layerId: string }).layerId
            : nextActiveLayerId
        const layerId = nextLayers.some((layer) => layer.id === rawLayerId) ? rawLayerId : nextActiveLayerId

        if (candidate.type === 'line') {
          nextShapes.push({
            id: uid(),
            type: 'line',
            layerId,
            start: candidate.start,
            end: candidate.end,
          })
        } else if (candidate.type === 'arc') {
          nextShapes.push({
            id: uid(),
            type: 'arc',
            layerId,
            start: candidate.start,
            mid: candidate.mid,
            end: candidate.end,
          })
        } else {
          nextShapes.push({
            id: uid(),
            type: 'bezier',
            layerId,
            start: candidate.start,
            control: candidate.control,
            end: candidate.end,
          })
        }
      }

      const nextFoldLines: FoldLine[] = []
      if (Array.isArray(parsed.foldLines)) {
        for (const foldCandidate of parsed.foldLines) {
          const foldLine = parseFoldLine(foldCandidate)
          if (foldLine) {
            nextFoldLines.push(foldLine)
          }
        }
      }

      setLayers(nextLayers)
      setActiveLayerId(nextActiveLayerId)
      setShapes(nextShapes)
      setFoldLines(nextFoldLines)
      setLayerColorOverrides({})
      clearDraft()
      setStatus(`Loaded JSON (${nextShapes.length} shapes, ${nextFoldLines.length} folds, ${nextLayers.length} layers)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Load failed: ${message}`)
    }
  }

  const handleLoadPreset = (presetId = selectedPresetId) => {
    const preset = PRESET_DOCS.find((entry) => entry.id === presetId)
    if (!preset) {
      setStatus('Preset not found')
      return
    }

    const sample =
      typeof structuredClone === 'function'
        ? structuredClone(preset.doc)
        : (JSON.parse(JSON.stringify(preset.doc)) as DocFile)

    setLayers(sample.layers)
    setActiveLayerId(sample.activeLayerId)
    setShapes(sample.objects)
    setFoldLines(sample.foldLines)
    setLayerColorOverrides({})
    setTool('pan')
    setShowThreePreview(true)
    if (isMobileLayout) {
      setMobileViewMode('editor')
      setShowMobileMenu(false)
    }
    clearDraft()
    setStatus(
      `Loaded preset: ${preset.label} (${sample.objects.length} shapes, ${sample.foldLines.length} folds)`,
    )
  }

  const handleAddLayer = () => {
    const nextLayerId = uid()
    setLayers((previous) => [
      ...previous,
      {
        id: nextLayerId,
        name: newLayerName(previous.length),
        visible: true,
        locked: false,
        stackLevel:
          previous.reduce(
            (maximum, layer, index) =>
              Math.max(
                maximum,
                typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel) ? layer.stackLevel : index,
              ),
            -1,
          ) + 1,
      },
    ])
    setActiveLayerId(nextLayerId)
    setStatus('Layer added')
  }

  const handleRenameActiveLayer = () => {
    if (!activeLayer) {
      setStatus('No active layer to rename')
      return
    }

    const nextName = window.prompt('Layer name', activeLayer.name)?.trim()
    if (!nextName) {
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              name: nextName,
            }
          : layer,
      ),
    )
    setStatus(`Renamed layer to "${nextName}"`)
  }

  const handleToggleLayerVisibility = () => {
    if (!activeLayer) {
      setStatus('No active layer to update')
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              visible: !layer.visible,
            }
          : layer,
      ),
    )
    setStatus(activeLayer.visible ? 'Active layer hidden' : 'Active layer shown')
  }

  const handleToggleLayerLock = () => {
    if (!activeLayer) {
      setStatus('No active layer to update')
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              locked: !layer.locked,
            }
          : layer,
      ),
    )
    setStatus(activeLayer.locked ? 'Active layer unlocked' : 'Active layer locked')
  }

  const handleMoveLayer = (direction: -1 | 1) => {
    if (!activeLayer) {
      return
    }

    setLayers((previous) => {
      const index = previous.findIndex((layer) => layer.id === activeLayer.id)
      if (index < 0) {
        return previous
      }

      const target = index + direction
      if (target < 0 || target >= previous.length) {
        return previous
      }

      const next = [...previous]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setStatus(direction < 0 ? 'Moved layer up' : 'Moved layer down')
  }

  const handleDeleteLayer = () => {
    if (!activeLayer) {
      setStatus('No active layer to delete')
      return
    }

    if (layers.length === 1) {
      setStatus('Cannot delete the last remaining layer')
      return
    }

    const activeIndex = layers.findIndex((layer) => layer.id === activeLayer.id)
    if (activeIndex < 0) {
      return
    }

    const fallbackLayer = layers[activeIndex > 0 ? activeIndex - 1 : 1]
    const deleteLayerId = activeLayer.id

    setLayers((previous) => previous.filter((layer) => layer.id !== deleteLayerId))
    setActiveLayerId(fallbackLayer.id)
    setShapes((previous) =>
      previous.map((shape) =>
        shape.layerId === deleteLayerId
          ? {
              ...shape,
              layerId: fallbackLayer.id,
            }
          : shape,
      ),
    )
    setStatus(`Deleted layer and moved its shapes to "${fallbackLayer.name}"`)
  }

  const handleSetLayerColorOverride = (layerId: string, nextColor: string) => {
    const normalizedColor = normalizeHexColor(nextColor, layerColorsById[layerId] ?? DEFAULT_FRONT_LAYER_COLOR)
    setLayerColorOverrides((previous) => ({
      ...previous,
      [layerId]: normalizedColor,
    }))
  }

  const handleClearLayerColorOverride = (layerId: string) => {
    setLayerColorOverrides((previous) => {
      if (!(layerId in previous)) {
        return previous
      }
      const next = { ...previous }
      delete next[layerId]
      return next
    })
  }

  const handleResetLayerColors = () => {
    setFrontLayerColor(DEFAULT_FRONT_LAYER_COLOR)
    setBackLayerColor(DEFAULT_BACK_LAYER_COLOR)
    setLayerColorOverrides({})
    setStatus('Layer color continuum reset')
  }

  const handleRunMobileLayerAction = () => {
    if (mobileLayerAction === 'add') {
      handleAddLayer()
      return
    }

    if (mobileLayerAction === 'rename') {
      handleRenameActiveLayer()
      return
    }

    if (mobileLayerAction === 'toggle-visibility') {
      handleToggleLayerVisibility()
      return
    }

    if (mobileLayerAction === 'toggle-lock') {
      handleToggleLayerLock()
      return
    }

    if (mobileLayerAction === 'move-up') {
      handleMoveLayer(-1)
      return
    }

    if (mobileLayerAction === 'move-down') {
      handleMoveLayer(1)
      return
    }

    if (mobileLayerAction === 'delete') {
      handleDeleteLayer()
      return
    }

    setShowLayerColorModal(true)
  }

  const handleRunMobileFileAction = () => {
    if (mobileFileAction === 'save-json') {
      handleSaveJson()
      return
    }

    if (mobileFileAction === 'load-json') {
      fileInputRef.current?.click()
      return
    }

    if (mobileFileAction === 'load-preset') {
      handleLoadPreset()
      return
    }

    if (mobileFileAction === 'export-svg') {
      handleExportSvg()
      return
    }

    if (mobileFileAction === 'toggle-3d') {
      setShowThreePreview((previous) => !previous)
      return
    }

    const baseLayerId = uid()
    setLayers([
      {
        id: baseLayerId,
        name: 'Layer 1',
        visible: true,
        locked: false,
        stackLevel: 0,
      },
    ])
    setActiveLayerId(baseLayerId)
    setShapes([])
    setFoldLines([])
    setLayerColorOverrides({})
    clearDraft()
    setStatus('Document cleared and reset to Layer 1')
  }

  const handleToggleTheme = () => {
    setThemeMode((previous) => {
      const next = previous === 'dark' ? 'light' : 'dark'
      setStatus(next === 'light' ? 'White mode enabled' : 'Dark mode enabled')
      return next
    })
  }

  const setActiveTool = (nextTool: Tool) => {
    setTool(nextTool)
    clearDraft()
    setStatus(`Tool selected: ${toolLabel(nextTool)}`)
  }

  const workspaceClassName = `workspace ${isMobileLayout ? `mobile-${mobileViewMode}` : 'desktop'}`
  const topbarClassName = `topbar ${isMobileLayout ? 'topbar-mobile' : ''} ${
    isMobileLayout && !showMobileMenu ? 'topbar-compact' : ''
  }`
  const hideCanvasPane = isMobileLayout && showThreePreview && mobileViewMode === 'preview'
  const hidePreviewPane = isMobileLayout && (mobileViewMode === 'editor' || !showThreePreview)
  const showViewOptions = !isMobileLayout || (showMobileMenu && mobileOptionsTab === 'view')
  const showLayerOptions = !isMobileLayout || (showMobileMenu && mobileOptionsTab === 'layers')
  const showFileOptions = !isMobileLayout || (showMobileMenu && mobileOptionsTab === 'file')
  const showMeta = !isMobileLayout || showMobileMenu
  const showLayerLegend = !(isMobileLayout && mobileViewMode === 'split')
  const fallbackLayerStroke = themeMode === 'light' ? '#0f172a' : '#e2e8f0'
  const stitchStrokeColor = themeMode === 'light' ? STITCH_COLOR_LIGHT : STITCH_COLOR_DARK

  return (
    <div className={`app-shell ${themeMode === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <header className={topbarClassName}>
        <div className="group tool-group">
          {isMobileLayout ? (
            <>
              <select
                className="tool-select-mobile"
                value={tool}
                onChange={(event) => setActiveTool(event.target.value as Tool)}
              >
                {TOOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Tool: {option.label}
                  </option>
                ))}
              </select>
              <div className="mobile-view-inline-tabs" role="tablist" aria-label="Mobile view mode">
                <button
                  className={mobileViewMode === 'editor' ? 'active' : ''}
                  onClick={() => setMobileViewMode('editor')}
                  disabled={!isMobileLayout}
                >
                  2D
                </button>
                <button
                  className={mobileViewMode === 'preview' ? 'active' : ''}
                  onClick={() => setMobileViewMode('preview')}
                  disabled={!isMobileLayout || !showThreePreview}
                >
                  3D
                </button>
                <button
                  className={mobileViewMode === 'split' ? 'active' : ''}
                  onClick={() => setMobileViewMode('split')}
                  disabled={!isMobileLayout || !showThreePreview}
                >
                  Split
                </button>
              </div>
            </>
          ) : (
            <>
              <button className={tool === 'pan' ? 'active' : ''} onClick={() => setActiveTool('pan')}>
                Move
              </button>
              <button className={tool === 'line' ? 'active' : ''} onClick={() => setActiveTool('line')}>
                Line
              </button>
              <button className={tool === 'arc' ? 'active' : ''} onClick={() => setActiveTool('arc')}>
                Arc
              </button>
              <button className={tool === 'bezier' ? 'active' : ''} onClick={() => setActiveTool('bezier')}>
                Bezier
              </button>
              <button className={tool === 'fold' ? 'active' : ''} onClick={() => setActiveTool('fold')}>
                Fold
              </button>
            </>
          )}
          {isMobileLayout && (
            <button
              className="mobile-menu-toggle"
              onClick={() =>
                setShowMobileMenu((previous) => {
                  const next = !previous
                  if (next) {
                    setMobileOptionsTab('view')
                  }
                  return next
                })
              }
            >
              {showMobileMenu ? 'Close' : 'Options'}
            </button>
          )}
        </div>

        {isMobileLayout && showMobileMenu && (
          <div className="group mobile-options-tabs">
            {MOBILE_OPTIONS_TABS.map((tab) => (
              <button
                key={tab.value}
                className={mobileOptionsTab === tab.value ? 'active' : ''}
                onClick={() => setMobileOptionsTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className={`group preset-controls ${showViewOptions ? '' : 'mobile-hidden'}`}>
          <select
            className="preset-select"
            value={selectedPresetId}
            onChange={(event) => setSelectedPresetId(event.target.value)}
          >
            {PRESET_DOCS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <button onClick={() => handleLoadPreset()}>Load Preset</button>
          <button onClick={handleToggleTheme}>{themeMode === 'dark' ? 'White Mode' : 'Dark Mode'}</button>
        </div>

        <div className={`group zoom-controls ${showViewOptions ? '' : 'mobile-hidden'}`}>
          <button onClick={() => handleZoomStep(0.85)}>-</button>
          <button onClick={() => handleZoomStep(1.15)}>+</button>
          <button onClick={handleFitView}>Fit</button>
          <button onClick={handleResetView}>Reset</button>
        </div>

        <div className={`group layer-controls ${showLayerOptions ? '' : 'mobile-hidden'}`}>
          <span className="layer-label">Layer</span>
          <select
            className="layer-select"
            value={activeLayer?.id ?? ''}
            onChange={(event) => {
              setActiveLayerId(event.target.value)
              clearDraft()
            }}
          >
            {layers.map((layer, index) => (
              <option key={layer.id} value={layer.id}>
                {index + 1}. {layer.name}
                {` [z${layerStackLevels[layer.id] ?? index}]`}
                {layer.visible ? '' : ' (hidden)'}
                {layer.locked ? ' (locked)' : ''}
              </option>
            ))}
          </select>
          {isMobileLayout ? (
            <div className="group mobile-action-row">
              <select
                className="action-select"
                value={mobileLayerAction}
                onChange={(event) => setMobileLayerAction(event.target.value as MobileLayerAction)}
              >
                <option value="add">Add Layer</option>
                <option value="rename">Rename Layer</option>
                <option value="toggle-visibility">{activeLayer?.visible ? 'Hide Layer' : 'Show Layer'}</option>
                <option value="toggle-lock">{activeLayer?.locked ? 'Unlock Layer' : 'Lock Layer'}</option>
                <option value="move-up">Move Layer Up</option>
                <option value="move-down">Move Layer Down</option>
                <option value="delete">Delete Layer</option>
                <option value="colors">Layer Colors</option>
              </select>
              <button onClick={handleRunMobileLayerAction} disabled={layers.length === 0}>
                Apply
              </button>
            </div>
          ) : (
            <>
              <button onClick={handleAddLayer}>+ Layer</button>
              <button onClick={handleRenameActiveLayer} disabled={!activeLayer}>
                Rename
              </button>
              <button onClick={handleToggleLayerVisibility} disabled={!activeLayer}>
                {activeLayer?.visible ? 'Hide' : 'Show'}
              </button>
              <button onClick={handleToggleLayerLock} disabled={!activeLayer}>
                {activeLayer?.locked ? 'Unlock' : 'Lock'}
              </button>
              <button onClick={() => handleMoveLayer(-1)} disabled={!activeLayer || layers.length < 2}>
                Up
              </button>
              <button onClick={() => handleMoveLayer(1)} disabled={!activeLayer || layers.length < 2}>
                Down
              </button>
              <button onClick={handleDeleteLayer} disabled={!activeLayer || layers.length < 2}>
                Delete
              </button>
              <button onClick={() => setShowLayerColorModal(true)} disabled={layers.length === 0}>
                Colors
              </button>
            </>
          )}
        </div>

        <div className={`group file-controls ${showFileOptions ? '' : 'mobile-hidden'}`}>
          {isMobileLayout ? (
            <div className="group mobile-action-row">
              <select
                className="action-select"
                value={mobileFileAction}
                onChange={(event) => setMobileFileAction(event.target.value as MobileFileAction)}
              >
                <option value="save-json">Save JSON</option>
                <option value="load-json">Load JSON</option>
                <option value="load-preset">Load Preset</option>
                <option value="export-svg">Export SVG</option>
                <option value="toggle-3d">{showThreePreview ? 'Hide 3D Panel' : 'Show 3D Panel'}</option>
                <option value="clear">Clear Document</option>
              </select>
              <button onClick={handleRunMobileFileAction}>Apply</button>
            </div>
          ) : (
            <>
              <button onClick={handleSaveJson}>Save JSON</button>
              <button onClick={() => fileInputRef.current?.click()}>Load JSON</button>
              <button onClick={() => handleLoadPreset()}>Load Preset</button>
              <button onClick={handleExportSvg}>Export SVG</button>
              <button onClick={() => setShowThreePreview((previous) => !previous)}>
                {showThreePreview ? 'Hide 3D' : 'Show 3D'}
              </button>
              <button
                onClick={() => {
                  const baseLayerId = uid()
                  setLayers([
                    {
                      id: baseLayerId,
                      name: 'Layer 1',
                      visible: true,
                      locked: false,
                      stackLevel: 0,
                    },
                  ])
                  setActiveLayerId(baseLayerId)
                  setShapes([])
                  setFoldLines([])
                  setLayerColorOverrides({})
                  clearDraft()
                  setStatus('Document cleared and reset to Layer 1')
                }}
              >
                Clear
              </button>
            </>
          )}
        </div>

        <div className={`group meta ${showMeta ? '' : 'mobile-hidden'}`}>
          <span>{Math.round(viewport.scale * 100)}% zoom</span>
          <span>{visibleShapes.length}/{shapes.length} visible shapes</span>
          <span>{layers.length} layers</span>
          <span>{foldLines.length} bends</span>
        </div>
      </header>

      <main className={workspaceClassName}>
        <section className={`canvas-pane ${hideCanvasPane ? 'panel-hidden' : ''}`}>
          <svg
            ref={svgRef}
            className="canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(event) => event.preventDefault()}
          >
            <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
              {gridLines}

              {visibleShapes.map((shape) => {
                const layerName = layers.find((layer) => layer.id === shape.layerId)?.name ?? ''
                const layerStroke = looksLikeStitch(shape, layerName)
                  ? stitchStrokeColor
                  : displayLayerColorsById[shape.layerId] ?? fallbackLayerStroke
                if (shape.type === 'line') {
                  return (
                    <line
                      key={shape.id}
                      x1={shape.start.x}
                      y1={shape.start.y}
                      x2={shape.end.x}
                      y2={shape.end.y}
                      className="shape-line"
                      style={{ stroke: layerStroke }}
                    />
                  )
                }

                if (shape.type === 'arc') {
                  return (
                    <path
                      key={shape.id}
                      d={arcPath(shape.start, shape.mid, shape.end)}
                      className="shape-line"
                      style={{ stroke: layerStroke }}
                    />
                  )
                }

                return (
                  <path
                    key={shape.id}
                    d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(
                      shape.control.y,
                    )} ${round(shape.end.x)} ${round(shape.end.y)}`}
                    className="shape-line"
                    style={{ stroke: layerStroke }}
                  />
                )
              })}

              {foldLines.map((foldLine) => (
                <line
                  key={foldLine.id}
                  x1={foldLine.start.x}
                  y1={foldLine.start.y}
                  x2={foldLine.end.x}
                  y2={foldLine.end.y}
                  className="fold-line"
                />
              ))}

              {previewElement}
            </g>
          </svg>

          {showLayerLegend && (
            <div className="legend-stack">
              <div
                className="legend-panel legend-single"
                aria-label={legendMode === 'layer' ? 'Layer order legend' : 'Stack height legend'}
              >
                <div className="layer-legend-header">
                  <span>{legendMode === 'layer' ? 'Layer Legend' : 'Stack Legend'}</span>
                  <span>{legendMode === 'layer' ? 'Front -&gt; Back' : 'Height'}</span>
                </div>
                <div className="legend-mode-tabs" role="tablist" aria-label="Legend mode">
                  <button
                    className={legendMode === 'layer' ? 'active' : ''}
                    onClick={() => setLegendMode('layer')}
                    aria-pressed={legendMode === 'layer'}
                  >
                    Layer
                  </button>
                  <button
                    className={legendMode === 'stack' ? 'active' : ''}
                    onClick={() => setLegendMode('stack')}
                    aria-pressed={legendMode === 'stack'}
                  >
                    Stack
                  </button>
                </div>

                {legendMode === 'layer' ? (
                  <>
                    <div className="layer-legend-items">
                      {layers.map((layer, index) => (
                        <div key={layer.id} className="layer-legend-item">
                          <span
                            className="layer-legend-swatch"
                            style={{ backgroundColor: layerColorsById[layer.id] ?? fallbackLayerStroke }}
                          />
                          <span className="layer-legend-label">
                            {index + 1}. {layer.name}
                            {layer.visible ? '' : ' (hidden)'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="layer-legend-key">
                      <span className="layer-legend-swatch" style={{ backgroundColor: stitchStrokeColor }} />
                      <span>Stitch lines</span>
                    </div>
                  </>
                ) : (
                  <div className="stack-legend-items">
                    {stackLegendEntries.map((entry) => (
                      <div key={`stack-${entry.stackLevel}`} className="stack-legend-item">
                        <span className="layer-legend-swatch" style={{ backgroundColor: entry.color }} />
                        <span className="stack-level-chip">{`z${entry.stackLevel}`}</span>
                        <span className="stack-level-label">{entry.layerNames.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {showThreePreview && (
          <aside
            className={`preview-pane ${hidePreviewPane ? 'panel-hidden' : ''} ${
              isMobileLayout && mobileViewMode === 'split' ? 'preview-pane-mobile-split' : ''
            }`}
          >
            <ThreePreviewPanel
              key={isMobileLayout ? 'mobile-preview' : 'desktop-preview'}
              shapes={visibleShapes}
              foldLines={foldLines}
              layers={layers}
              themeMode={themeMode}
              isMobileLayout={isMobileLayout}
              onUpdateFoldLine={(foldLineId, angleDeg) =>
                setFoldLines((previous) =>
                  previous.map((foldLine) =>
                    foldLine.id === foldLineId
                      ? {
                          ...foldLine,
                          angleDeg,
                        }
                      : foldLine,
                  ),
                )
              }
            />
          </aside>
        )}
      </main>

      {showLayerColorModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowLayerColorModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowLayerColorModal(false)
            }
          }}
          role="presentation"
        >
          <div className="layer-color-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="layer-color-modal-header">
              <h2>Layer Color Settings</h2>
              <button onClick={() => setShowLayerColorModal(false)}>Done</button>
            </div>

            <p className="hint">Layer 1 is treated as front. Lower rows move toward back.</p>

            <div className="layer-color-range">
              <label className="field-row">
                <span>Front color</span>
                <input
                  type="color"
                  value={frontLayerColor}
                  onChange={(event) =>
                    setFrontLayerColor(normalizeHexColor(event.target.value, DEFAULT_FRONT_LAYER_COLOR))
                  }
                />
              </label>
              <label className="field-row">
                <span>Back color</span>
                <input
                  type="color"
                  value={backLayerColor}
                  onChange={(event) =>
                    setBackLayerColor(normalizeHexColor(event.target.value, DEFAULT_BACK_LAYER_COLOR))
                  }
                />
              </label>
            </div>

            <div
              className="layer-color-gradient-preview"
              style={{
                background: `linear-gradient(90deg, ${frontLayerColor}, ${backLayerColor})`,
              }}
            />

            <div className="layer-color-list">
              {layers.map((layer, index) => {
                const color = layerColorsById[layer.id] ?? DEFAULT_FRONT_LAYER_COLOR
                const hasOverride = layer.id in layerColorOverrides
                return (
                  <div key={layer.id} className="layer-color-item">
                    <span className="layer-color-order">{index + 1}</span>
                    <span className="layer-color-name">{layer.name}</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => handleSetLayerColorOverride(layer.id, event.target.value)}
                    />
                    <button
                      onClick={() => handleClearLayerColorOverride(layer.id)}
                      disabled={!hasOverride}
                      title={hasOverride ? 'Remove custom color override' : 'Using continuum color'}
                    >
                      Auto
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="layer-color-modal-actions">
              <button onClick={handleResetLayerColors}>Reset Colors</button>
            </div>
          </div>
        </div>
      )}

      <footer className="statusbar">
        <span>Tool: {toolLabel(tool)}</span>
        <span>{status}</span>
        <span>Tip: wheel/zoom buttons for zoom, Move tool to pan, Fold tool assigns bend lines for 3D.</span>
        <span>Mobile: use 2D / 3D / Split buttons to focus workspace.</span>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={handleLoadJson}
      />
    </div>
  )
}

export default App
