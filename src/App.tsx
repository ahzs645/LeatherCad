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
import { SAMPLE_WALLET_DOC } from './sample-doc'

const GRID_STEP = 100
const GRID_EXTENT = 4000
const MIN_ZOOM = 0.2
const MAX_ZOOM = 6
const MOBILE_MEDIA_QUERY = '(max-width: 1100px)'

type MobileViewMode = 'editor' | 'preview' | 'split'

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
  }

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }

  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'Layer',
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    locked: typeof candidate.locked === 'boolean' ? candidate.locked : false,
  }
}

function newLayerName(index: number) {
  return `Layer ${index + 1}`
}

function App() {
  const initialLayerIdRef = useRef(uid())
  const [tool, setTool] = useState<Tool>('line')
  const [shapes, setShapes] = useState<Shape[]>([])
  const [foldLines, setFoldLines] = useState<FoldLine[]>([])
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      id: initialLayerIdRef.current,
      name: 'Layer 1',
      visible: true,
      locked: false,
    },
  ])
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayerIdRef.current)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null)
  const [status, setStatus] = useState('Ready')
  const [isPanning, setIsPanning] = useState(false)
  const [showThreePreview, setShowThreePreview] = useState(true)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('split')
  const [viewport, setViewport] = useState<Viewport>({ x: 560, y: 360, scale: 1 })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const activeLayer = useMemo(() => layers.find((layer) => layer.id === activeLayerId) ?? layers[0] ?? null, [layers, activeLayerId])
  const visibleShapes = useMemo(() => {
    const visibleLayerIds = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id))
    return shapes.filter((shape) => visibleLayerIds.has(shape.layerId))
  }, [layers, shapes])

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
          />
        )
      }

      return <path d={arcPath(draftPoints[0], draftPoints[1], cursorPoint)} className="shape-preview" />
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
          />
        )
      }

      return (
        <path
          d={`M ${round(draftPoints[0].x)} ${round(draftPoints[0].y)} Q ${round(draftPoints[1].x)} ${round(
            draftPoints[1].y,
          )} ${round(cursorPoint.x)} ${round(cursorPoint.y)}`}
          className="shape-preview"
        />
      )
    }

    return null
  }, [cursorPoint, draftPoints, tool])

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

  const beginPan = (clientX: number, clientY: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: viewport.x,
      originY: viewport.y,
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
      setIsMobileLayout(media.matches)
      if (!media.matches) {
        setMobileViewMode('split')
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
    if (event.button !== 0 && !(event.button === 1 || event.button === 2)) {
      return
    }

    if (tool === 'pan' || event.button === 1 || event.button === 2) {
      event.preventDefault()
      beginPan(event.clientX, event.clientY)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (event.button !== 0) {
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
    if (isPanning && panRef.current) {
      const deltaX = event.clientX - panRef.current.startX
      const deltaY = event.clientY - panRef.current.startY
      setViewport((previous) => ({
        ...previous,
        x: panRef.current!.originX + deltaX,
        y: panRef.current!.originY + deltaY,
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
    if (!isPanning) {
      return
    }

    setIsPanning(false)
    panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
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
      clearDraft()
      setStatus(`Loaded JSON (${nextShapes.length} shapes, ${nextFoldLines.length} folds, ${nextLayers.length} layers)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Load failed: ${message}`)
    }
  }

  const handleLoadSample = () => {
    const sample =
      typeof structuredClone === 'function'
        ? structuredClone(SAMPLE_WALLET_DOC)
        : (JSON.parse(JSON.stringify(SAMPLE_WALLET_DOC)) as DocFile)

    setLayers(sample.layers)
    setActiveLayerId(sample.activeLayerId)
    setShapes(sample.objects)
    setFoldLines(sample.foldLines)
    setShowThreePreview(true)
    if (isMobileLayout) {
      setMobileViewMode('split')
    }
    clearDraft()
    setStatus(
      `Loaded sample: Wallet demo (${sample.objects.length} shapes, ${sample.foldLines.length} folds, ${sample.layers.length} layers)`,
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

  const setActiveTool = (nextTool: Tool) => {
    setTool(nextTool)
    clearDraft()
    setStatus(`Tool selected: ${nextTool}`)
  }

  const workspaceClassName = `workspace ${isMobileLayout ? `mobile-${mobileViewMode}` : 'desktop'}`
  const hideCanvasPane = isMobileLayout && showThreePreview && mobileViewMode === 'preview'
  const hidePreviewPane = isMobileLayout && (mobileViewMode === 'editor' || !showThreePreview)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="group">
          <button className={tool === 'pan' ? 'active' : ''} onClick={() => setActiveTool('pan')}>
            Pan
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
        </div>

        <div className="group layer-controls">
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
                {layer.visible ? '' : ' (hidden)'}
                {layer.locked ? ' (locked)' : ''}
              </option>
            ))}
          </select>
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
        </div>

        <div className="group">
          <button onClick={handleSaveJson}>Save JSON</button>
          <button onClick={() => fileInputRef.current?.click()}>Load JSON</button>
          <button onClick={handleLoadSample}>Load Sample</button>
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
                },
              ])
              setActiveLayerId(baseLayerId)
              setShapes([])
              setFoldLines([])
              clearDraft()
              setStatus('Document cleared and reset to Layer 1')
            }}
          >
            Clear
          </button>
        </div>

        <div className="group mobile-view-controls">
          <button
            className={mobileViewMode === 'editor' ? 'active' : ''}
            onClick={() => setMobileViewMode('editor')}
            disabled={!isMobileLayout}
          >
            Editor
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

        <div className="group meta">
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
                if (shape.type === 'line') {
                  return (
                    <line
                      key={shape.id}
                      x1={shape.start.x}
                      y1={shape.start.y}
                      x2={shape.end.x}
                      y2={shape.end.y}
                      className="shape-line"
                    />
                  )
                }

                if (shape.type === 'arc') {
                  return <path key={shape.id} d={arcPath(shape.start, shape.mid, shape.end)} className="shape-line" />
                }

                return (
                  <path
                    key={shape.id}
                    d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(
                      shape.control.y,
                    )} ${round(shape.end.x)} ${round(shape.end.y)}`}
                    className="shape-line"
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
        </section>

        {showThreePreview && (
          <aside className={`preview-pane ${hidePreviewPane ? 'panel-hidden' : ''}`}>
            <ThreePreviewPanel
              shapes={visibleShapes}
              foldLines={foldLines}
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

      <footer className="statusbar">
        <span>Tool: {tool}</span>
        <span>{status}</span>
        <span>Tip: wheel to zoom, middle/right drag to pan, Fold tool assigns bend lines for 3D preview.</span>
        <span>Mobile: use Editor / 3D / Split buttons to focus workspace.</span>
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
