import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { sampleShapePoints } from '../cad/cad-geometry'
import type {
  AvatarSpec,
  FoldLine,
  Layer,
  LineType,
  PatternPiece,
  PiecePlacement3D,
  SeamConnection,
  Shape,
  StitchHole,
  TextureSource,
  ThreePreviewSettings,
} from '../cad/cad-types'
import { ThreeBridge, type OutlinePolygon } from '../three/three-bridge'
import { detectOutlines } from '../ops/outline-detection'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from '../ops/fold-line-ops'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { LEATHER_COLORS, LEATHER_PRESETS, PRESET_IDS } from '../three/material-presets'

type WorkbenchThreePreviewProps = {
  shapes: Shape[]
  selectedShapeIds: string[]
  stitchHoles: StitchHole[]
  stitchThreadColor: string
  onSetStitchThreadColor: (color: string) => void
  patternPieces: PatternPiece[]
  piecePlacements3d: PiecePlacement3D[]
  seamConnections: SeamConnection[]
  threePreviewSettings: ThreePreviewSettings
  avatars: AvatarSpec[]
  onSetPiecePlacements3d: Dispatch<SetStateAction<PiecePlacement3D[]>>
  onSetThreePreviewSettings: Dispatch<SetStateAction<ThreePreviewSettings>>
  onSetAvatars: Dispatch<SetStateAction<AvatarSpec[]>>
  threeTextureSource: TextureSource | null
  onSetThreeTextureSource: (source: TextureSource | null) => void
  threeTextureShapeIds: string[]
  onSetThreeTextureShapeIds: (shapeIds: string[]) => void
  foldLines: FoldLine[]
  layers: Layer[]
  lineTypes: LineType[]
  themeMode: 'dark' | 'light'
  onUpdateFoldLine: (foldLineId: string, updates: Partial<FoldLine>) => void
}

const DEFAULT_TEXTURE_FORM: TextureSource = {
  sourceUrl: '',
  license: '',
  albedoUrl: '',
  normalUrl: '',
  roughnessUrl: '',
}

function normalizeTextureSource(value: TextureSource): TextureSource {
  const source: TextureSource = {
    sourceUrl: value.sourceUrl.trim(),
    license: value.license.trim(),
    albedoUrl: value.albedoUrl.trim(),
  }

  const normalUrl = (value.normalUrl ?? '').trim()
  if (normalUrl.length > 0) {
    source.normalUrl = normalUrl
  }

  const roughnessUrl = (value.roughnessUrl ?? '').trim()
  if (roughnessUrl.length > 0) {
    source.roughnessUrl = roughnessUrl
  }

  return source
}

function defaultPiecePlacement(pieceId: string): PiecePlacement3D {
  return {
    pieceId,
    translationMm: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    flipped: false,
  }
}

function defaultAvatarForm() {
  return {
    id: '',
    name: 'Avatar',
    sourceUrl: '',
    scaleMm: 1700,
  } satisfies AvatarSpec
}

function getAvatarFormValue(activeAvatarId: string, avatars: AvatarSpec[]) {
  const activeAvatar = avatars.find((entry) => entry.id === activeAvatarId)
  return activeAvatar ? { ...activeAvatar } : defaultAvatarForm()
}

type AvatarFormFieldsProps = {
  activeAvatarId: string
  avatars: AvatarSpec[]
  onSetAvatars: Dispatch<SetStateAction<AvatarSpec[]>>
  onSetThreePreviewSettings: Dispatch<SetStateAction<ThreePreviewSettings>>
}

function AvatarFormFields({
  activeAvatarId,
  avatars,
  onSetAvatars,
  onSetThreePreviewSettings,
}: AvatarFormFieldsProps) {
  const [avatarForm, setAvatarForm] = useState<AvatarSpec>(() => getAvatarFormValue(activeAvatarId, avatars))

  const handleSaveAvatar = () => {
    const trimmedId = avatarForm.id.trim()
    const trimmedName = avatarForm.name.trim()
    if (!trimmedId || !trimmedName) {
      return
    }

    const nextAvatar: AvatarSpec = {
      id: trimmedId,
      name: trimmedName,
      sourceUrl: avatarForm.sourceUrl.trim(),
      scaleMm: Math.max(200, avatarForm.scaleMm),
    }

    onSetAvatars((previous) => {
      const existingIndex = previous.findIndex((entry) => entry.id === nextAvatar.id)
      if (existingIndex === -1) {
        return [...previous, nextAvatar]
      }
      return previous.map((entry, index) => (index === existingIndex ? nextAvatar : entry))
    })
    onSetThreePreviewSettings((previous) => ({
      ...previous,
      avatarId: nextAvatar.id,
    }))
  }

  const handleDeleteAvatar = () => {
    if (!activeAvatarId) {
      return
    }

    onSetAvatars((previous) => previous.filter((entry) => entry.id !== activeAvatarId))
    onSetThreePreviewSettings((previous) => ({
      ...previous,
      avatarId: previous.avatarId === activeAvatarId ? undefined : previous.avatarId,
    }))
  }

  return (
    <>
      <label className="field-row">
        <span>Avatar ID</span>
        <input
          value={avatarForm.id}
          placeholder="mannequin-a"
          onChange={(event) => setAvatarForm((previous) => ({ ...previous, id: event.target.value }))}
        />
      </label>
      <label className="field-row">
        <span>Name</span>
        <input
          value={avatarForm.name}
          placeholder="Workshop mannequin"
          onChange={(event) => setAvatarForm((previous) => ({ ...previous, name: event.target.value }))}
        />
      </label>
      <label className="field-row">
        <span>glTF/glb URL</span>
        <input
          value={avatarForm.sourceUrl}
          placeholder="https://.../avatar.glb"
          onChange={(event) => setAvatarForm((previous) => ({ ...previous, sourceUrl: event.target.value }))}
        />
      </label>
      <label className="field-row">
        <span>Height (mm)</span>
        <input
          type="number"
          min={200}
          step={10}
          value={avatarForm.scaleMm}
          onChange={(event) =>
            setAvatarForm((previous) => ({
              ...previous,
              scaleMm: Number(event.target.value),
            }))
          }
        />
      </label>
      <div className="button-row">
        <button onClick={handleSaveAvatar}>Save Avatar</button>
        <button onClick={handleDeleteAvatar} disabled={!activeAvatarId}>
          Delete Avatar
        </button>
      </div>
      <p className="hint">Avatar mode loads the selected glTF/GLB asset when a URL is configured. Otherwise the built-in mannequin is used.</p>
    </>
  )
}

export function useWorkbenchThreePreviewController(props: WorkbenchThreePreviewProps) {
  const {
    shapes,
    selectedShapeIds,
    stitchHoles,
    stitchThreadColor,
    patternPieces,
    piecePlacements3d,
    seamConnections,
    threePreviewSettings,
    avatars,
    onSetPiecePlacements3d,
    threeTextureSource,
    onSetThreeTextureSource,
    threeTextureShapeIds,
    onSetThreeTextureShapeIds,
    foldLines,
    layers,
    lineTypes,
    themeMode,
    onUpdateFoldLine,
  } = props

  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bridgeRef = useRef<ThreeBridge | null>(null)

  const [textureForm, setTextureForm] = useState<TextureSource>(() => threeTextureSource ?? DEFAULT_TEXTURE_FORM)
  const [textureStatus, setTextureStatus] = useState('Default leather material active')
  const [hidden3dLayerIds, setHidden3dLayerIds] = useState<string[]>([])

  const effectiveHidden3dLayerIds = useMemo(
    () => hidden3dLayerIds.filter((layerId) => layers.some((layer) => layer.id === layerId)),
    [hidden3dLayerIds, layers],
  )

  const visible3dLayerIdSet = useMemo(
    () =>
      new Set(
        layers
          .filter((layer) => layer.visible && !effectiveHidden3dLayerIds.includes(layer.id))
          .map((layer) => layer.id),
      ),
    [layers, effectiveHidden3dLayerIds],
  )

  const layersFor3d = useMemo(
    () =>
      layers.map((layer) =>
        effectiveHidden3dLayerIds.includes(layer.id)
          ? {
              ...layer,
              visible: false,
            }
          : layer,
      ),
    [layers, effectiveHidden3dLayerIds],
  )

  const shapesIn3dView = useMemo(
    () => shapes.filter((shape) => visible3dLayerIdSet.has(shape.layerId)),
    [shapes, visible3dLayerIdSet],
  )

  const visibleLayerCountIn3d = useMemo(
    () => layers.filter((layer) => layer.visible && !effectiveHidden3dLayerIds.includes(layer.id)).length,
    [layers, effectiveHidden3dLayerIds],
  )

  const closedShapeIdSet = useMemo(() => {
    const result = new Set<string>()
    for (const shape of shapes) {
      if (shape.type === 'text') {
        continue
      }
      const sampled = sampleShapePoints(shape, shape.type === 'line' ? 2 : 40)
      if (sampled.length < 3) {
        continue
      }
      const first = sampled[0]
      const last = sampled[sampled.length - 1]
      if (Math.hypot(last.x - first.x, last.y - first.y) <= 0.5) {
        result.add(shape.id)
      }
    }
    return result
  }, [shapes])

  const outlinePolygons = useMemo<OutlinePolygon[]>(() => {
    const chains = detectOutlines(shapesIn3dView, lineTypes)
    const result: OutlinePolygon[] = []
    for (const chain of chains) {
      if (!chain.isClosed || chain.area < 1) continue
      const firstShape = shapesIn3dView.find((shape) => shape.id === chain.shapeIds[0])
      if (!firstShape) continue
      result.push({
        polygon: chain.polygon,
        shapeIds: chain.shapeIds,
        layerId: firstShape.layerId,
      })
    }
    return result
  }, [shapesIn3dView, lineTypes])

  const piecePlacementById = useMemo(
    () => Object.fromEntries(piecePlacements3d.map((placement) => [placement.pieceId, placement])),
    [piecePlacements3d],
  )

  const visiblePatternPieces = useMemo(
    () => patternPieces.filter((piece) => visible3dLayerIdSet.has(piece.layerId)),
    [patternPieces, visible3dLayerIdSet],
  )
  const invalidPatternPieces = useMemo(
    () =>
      visiblePatternPieces.filter(
        (piece) => !outlinePolygons.some((outline) => outline.shapeIds.includes(piece.boundaryShapeId)),
      ),
    [visiblePatternPieces, outlinePolygons],
  )

  const activeAvatarId = threePreviewSettings.avatarId ?? avatars[0]?.id ?? ''
  const activeAvatar = useMemo(() => avatars.find((entry) => entry.id === activeAvatarId), [avatars, activeAvatarId])
  const avatarFormResetKey = activeAvatar
    ? `${activeAvatar.id}:${activeAvatar.name}:${activeAvatar.sourceUrl}:${activeAvatar.scaleMm}`
    : '__default-avatar__'

  const selectedClosedShapeIds = useMemo(
    () => selectedShapeIds.filter((shapeId) => closedShapeIdSet.has(shapeId)),
    [selectedShapeIds, closedShapeIdSet],
  )

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const bridge = new ThreeBridge(canvasRef.current)
    bridgeRef.current = bridge

    const observer = new ResizeObserver(() => {
      const container = containerRef.current
      if (!container) {
        return
      }
      bridge.resize(container.clientWidth, container.clientHeight)
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
      bridge.resize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }

    return () => {
      observer.disconnect()
      bridge.dispose()
      bridgeRef.current = null
    }
  }, [])

  useEffect(() => {
    bridgeRef.current?.setDocument(
      layersFor3d,
      shapesIn3dView,
      foldLines,
      lineTypes,
      stitchHoles,
      outlinePolygons,
      patternPieces,
      piecePlacements3d,
      seamConnections,
      threePreviewSettings,
      avatars,
    )
  }, [
    layersFor3d,
    shapesIn3dView,
    foldLines,
    lineTypes,
    stitchHoles,
    outlinePolygons,
    patternPieces,
    piecePlacements3d,
    seamConnections,
    threePreviewSettings,
    avatars,
  ])

  useEffect(() => {
    bridgeRef.current?.setTheme(themeMode)
  }, [themeMode])

  useEffect(() => {
    bridgeRef.current?.setThreadColor(stitchThreadColor)
  }, [stitchThreadColor])

  useEffect(() => {
    bridgeRef.current?.setTextureAssignments(threeTextureShapeIds)
  }, [threeTextureShapeIds])

  useEffect(() => {
    const bridge = bridgeRef.current
    if (!bridge) {
      return
    }

    let cancelled = false

    const apply = async () => {
      if (!threeTextureSource || !threeTextureSource.albedoUrl.trim()) {
        bridge.useDefaultTexture()
        if (!cancelled) {
          setTextureStatus('Default leather material active')
        }
        return
      }

      try {
        await bridge.setTexture(threeTextureSource)
        bridge.setTextureAssignments(threeTextureShapeIds)
        if (!cancelled) {
          setTextureStatus(
            threeTextureShapeIds.length > 0
              ? `Texture loaded for ${threeTextureShapeIds.length} shape${threeTextureShapeIds.length === 1 ? '' : 's'}`
              : 'Texture loaded (no shapes assigned yet)',
          )
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'unknown error'
          setTextureStatus(`Texture load failed: ${message}`)
        }
      }
    }

    void apply()
    return () => {
      cancelled = true
    }
  }, [threeTextureSource, threeTextureShapeIds])

  const updatePlacement = (pieceId: string, updater: (current: PiecePlacement3D) => PiecePlacement3D) => {
    onSetPiecePlacements3d((previous) => {
      const existing = previous.find((entry) => entry.pieceId === pieceId) ?? defaultPiecePlacement(pieceId)
      const next = updater(existing)
      const others = previous.filter((entry) => entry.pieceId !== pieceId)
      return [...others, next]
    })
  }

  const updateVisiblePlacements = (factory: (piece: PatternPiece, index: number, total: number) => PiecePlacement3D) => {
    onSetPiecePlacements3d((previous) => {
      const nextById = new Map(previous.map((entry) => [entry.pieceId, entry]))
      visiblePatternPieces.forEach((piece, index) => {
        nextById.set(piece.id, factory(piece, index, visiblePatternPieces.length))
      })
      return Array.from(nextById.values())
    })
  }

  const handleSpreadPieces = () => {
    updateVisiblePlacements((piece, index, total) => ({
      ...(piecePlacementById[piece.id] ?? defaultPiecePlacement(piece.id)),
      translationMm: {
        x: (index - (total - 1) / 2) * 140,
        y: 0,
        z: 0,
      },
      rotationDeg: { x: 0, y: 0, z: 0 },
    }))
  }

  const handleStackByLayer = () => {
    const layerOrder = new Map(layers.map((layer, index) => [layer.id, index]))
    updateVisiblePlacements((piece, index) => ({
      ...(piecePlacementById[piece.id] ?? defaultPiecePlacement(piece.id)),
      translationMm: {
        x: 0,
        y: 0,
        z: (layerOrder.get(piece.layerId) ?? index) * 12,
      },
      rotationDeg: { x: 0, y: 0, z: 0 },
      flipped: false,
    }))
  }

  const handleMirrorPairLayout = () => {
    const mirrorPieces = visiblePatternPieces.filter((piece) => piece.mirrorPair)
    updateVisiblePlacements((piece, index) => {
      const mirrorIndex = mirrorPieces.findIndex((entry) => entry.id === piece.id)
      const mirrored = mirrorIndex >= 0
      const spreadIndex = mirrored ? mirrorIndex : index
      const direction = spreadIndex % 2 === 0 ? -1 : 1
      return {
        ...(piecePlacementById[piece.id] ?? defaultPiecePlacement(piece.id)),
        translationMm: {
          x: mirrored ? direction * (120 + Math.floor(spreadIndex / 2) * 55) : 0,
          y: 0,
          z: mirrored ? Math.floor(spreadIndex / 2) * 18 : 0,
        },
        rotationDeg: { x: 0, y: mirrored ? direction * 8 : 0, z: 0 },
        flipped: mirrored ? direction < 0 : false,
      }
    })
  }

  const handleResetAssembly = () => {
    onSetPiecePlacements3d((previous) => previous.filter((entry) => !visiblePatternPieces.some((piece) => piece.id === entry.pieceId)))
  }

  const applyPreset = (presetId: string) => {
    if (presetId && bridgeRef.current) {
      bridgeRef.current.applyLeatherPreset(presetId)
      setTextureStatus(`Applied ${LEATHER_PRESETS[presetId]?.label ?? presetId} preset`)
    }
  }

  const setLeatherColor = (color: string) => {
    if (color && bridgeRef.current) {
      bridgeRef.current.setLeatherColor(color)
    }
  }

  const enableShadows = (enabled: boolean) => {
    bridgeRef.current?.enableShadows(enabled)
  }

  const applyTextureToSelection = async () => {
    const bridge = bridgeRef.current
    if (!bridge) {
      return
    }

    if (selectedClosedShapeIds.length === 0) {
      setTextureStatus('Select one or more closed shapes in 2D first')
      return
    }

    const nextSource = normalizeTextureSource(textureForm)
    if (!nextSource.albedoUrl) {
      setTextureStatus('Set at least an albedo URL before applying texture')
      return
    }

    try {
      setTextureStatus('Loading texture set...')
      await bridge.setTexture(nextSource)
      setTextureForm(nextSource)
      const nextAssignedIds = Array.from(new Set([...threeTextureShapeIds, ...selectedClosedShapeIds]))
      onSetThreeTextureSource(nextSource)
      onSetThreeTextureShapeIds(nextAssignedIds)
      bridge.setTextureAssignments(nextAssignedIds)
      setTextureStatus(`Applied texture to ${selectedClosedShapeIds.length} selected closed shape${selectedClosedShapeIds.length === 1 ? '' : 's'}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setTextureStatus(`Texture load failed: ${message}`)
    }
  }

  const applyTextureGlobally = async () => {
    const bridge = bridgeRef.current
    if (!bridge) {
      return
    }

    const nextSource = normalizeTextureSource(textureForm)
    if (!nextSource.albedoUrl) {
      setTextureStatus('Set at least an albedo URL before applying texture')
      return
    }

    const allShapeIds = shapes.filter((shape) => closedShapeIdSet.has(shape.id)).map((shape) => shape.id)
    if (allShapeIds.length === 0) {
      setTextureStatus('No closed shapes available for texture application')
      return
    }

    try {
      setTextureStatus('Loading texture set...')
      await bridge.setTexture(nextSource)
      setTextureForm(nextSource)
      onSetThreeTextureSource(nextSource)
      onSetThreeTextureShapeIds(allShapeIds)
      bridge.setTextureAssignments(allShapeIds)
      setTextureStatus(`Applied texture to all ${allShapeIds.length} closed shape${allShapeIds.length === 1 ? '' : 's'}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setTextureStatus(`Texture load failed: ${message}`)
    }
  }

  const clearSelectionTexture = () => {
    if (selectedClosedShapeIds.length === 0) {
      setTextureStatus('Select one or more closed shapes in 2D first')
      return
    }
    const selectedIdSet = new Set(selectedClosedShapeIds)
    const nextAssignedIds = threeTextureShapeIds.filter((shapeId) => !selectedIdSet.has(shapeId))
    onSetThreeTextureShapeIds(nextAssignedIds)
    bridgeRef.current?.setTextureAssignments(nextAssignedIds)
    setTextureStatus(`Removed texture assignment from ${selectedClosedShapeIds.length} selected closed shape${selectedClosedShapeIds.length === 1 ? '' : 's'}`)
  }

  const resetMaterial = () => {
    onSetThreeTextureSource(null)
    onSetThreeTextureShapeIds([])
    setTextureForm(DEFAULT_TEXTURE_FORM)
    bridgeRef.current?.useDefaultTexture()
    setTextureStatus('Switched back to default leather material')
  }

  return {
    ...props,
    containerRef,
    canvasRef,
    textureForm,
    setTextureForm,
    textureStatus,
    hidden3dLayerIds,
    setHidden3dLayerIds,
    effectiveHidden3dLayerIds,
    shapesIn3dView,
    visibleLayerCountIn3d,
    visiblePatternPieces,
    invalidPatternPieces,
    activeAvatarId,
    avatarFormResetKey,
    selectedClosedShapeIds,
    piecePlacementById,
    updatePlacement,
    handleSpreadPieces,
    handleStackByLayer,
    handleMirrorPairLayout,
    handleResetAssembly,
    applyPreset,
    setLeatherColor,
    enableShadows,
    applyTextureToSelection,
    applyTextureGlobally,
    clearSelectionTexture,
    resetMaterial,
    bridgeRef,
    onUpdateFoldLine,
  }
}

type WorkbenchThreePreviewController = ReturnType<typeof useWorkbenchThreePreviewController>

type WorkbenchThreePreviewViewportProps = {
  controller: WorkbenchThreePreviewController
  compact?: boolean
  interactive?: boolean
}

export function WorkbenchThreePreviewViewport({
  controller,
  compact = false,
  interactive = true,
}: WorkbenchThreePreviewViewportProps) {
  return (
    <div className={`workbench-three-viewport ${compact ? 'compact' : ''} ${interactive ? '' : 'read-only'}`}>
      <div className="workbench-three-viewport-header">
        <div>
          <strong>3D Preview</strong>
          <span>{` ${controller.shapesIn3dView.length} shapes | ${controller.visiblePatternPieces.length} pieces`}</span>
        </div>
        {!compact && (
          <span className="hint">
            {`Mode ${controller.threePreviewSettings.mode} | ${controller.foldLines.length} folds | ${controller.seamConnections.length} seams`}
          </span>
        )}
      </div>
      <div
        ref={controller.containerRef}
        className="three-preview-canvas-wrap workbench-three-canvas-wrap"
        style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      >
        <canvas ref={controller.canvasRef} className="three-preview-canvas" />
      </div>
      {controller.invalidPatternPieces.length > 0 && !compact && (
        <p className="hint workbench-three-warning">
          {controller.invalidPatternPieces.length} piece(s) are missing valid closed boundaries for 3D.
        </p>
      )}
    </div>
  )
}

type WorkbenchThreePreviewInspectorProps = {
  controller: WorkbenchThreePreviewController
}

export function WorkbenchThreePreviewInspector({
  controller,
}: WorkbenchThreePreviewInspectorProps) {
  const {
    threePreviewSettings,
    onSetThreePreviewSettings,
    avatars,
    activeAvatarId,
    avatarFormResetKey,
    onSetAvatars,
    visibleLayerCountIn3d,
    layers,
    effectiveHidden3dLayerIds,
    setHidden3dLayerIds,
    foldLines,
    onUpdateFoldLine,
    visiblePatternPieces,
    piecePlacementById,
    updatePlacement,
    handleSpreadPieces,
    handleStackByLayer,
    handleMirrorPairLayout,
    handleResetAssembly,
    stitchThreadColor,
    onSetStitchThreadColor,
    textureForm,
    setTextureForm,
    textureStatus,
    applyPreset,
    setLeatherColor,
    enableShadows,
    selectedClosedShapeIds,
    applyTextureToSelection,
    applyTextureGlobally,
    clearSelectionTexture,
    resetMaterial,
    threeTextureShapeIds,
  } = controller

  return (
    <>
      <div className="control-block">
        <h3>Preview Mode</h3>
        <label className="field-row">
          <span>Mode</span>
          <select
            value={threePreviewSettings.mode}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                mode:
                  event.target.value === 'assembled' || event.target.value === 'avatar'
                    ? event.target.value
                    : 'fold',
              }))
            }
          >
            <option value="fold">Fold</option>
            <option value="assembled">Assembled</option>
            <option value="avatar">Avatar</option>
          </select>
        </label>
        <label className="field-row">
          <span>Exploded View</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={threePreviewSettings.explodedFactor}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                explodedFactor: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="field-row">
          <span>Thickness (mm)</span>
          <input
            type="number"
            min={0.2}
            max={20}
            step={0.1}
            value={threePreviewSettings.thicknessMm}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                thicknessMm: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={threePreviewSettings.showSeams}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                showSeams: event.target.checked,
              }))
            }
          />
          <span>Show seam guides</span>
        </label>
        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={threePreviewSettings.showStressOverlay}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                showStressOverlay: event.target.checked,
              }))
            }
          />
          <span>Show seam stress tint</span>
        </label>
        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={threePreviewSettings.showEdgeLabels}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                showEdgeLabels: event.target.checked,
              }))
            }
          />
          <span>Show edge labels</span>
        </label>
        <div className="button-row">
          <button onClick={() => onSetThreePreviewSettings(DEFAULT_THREE_PREVIEW_SETTINGS)}>Reset 3D Settings</button>
        </div>
      </div>

      <div className="control-block">
        <h3>3D Layer Visibility</h3>
        <p className="hint">{`Showing ${visibleLayerCountIn3d} of ${layers.length} layers in 3D.`}</p>
        {layers.length === 0 ? (
          <p className="hint">No layers available.</p>
        ) : (
          <>
            <div className="layer-toggle-list">
              {layers.map((layer) => {
                const checked = layer.visible && !effectiveHidden3dLayerIds.includes(layer.id)
                const disabled = !layer.visible
                return (
                  <label key={layer.id} className="layer-toggle-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() =>
                        setHidden3dLayerIds((previous) =>
                          previous.includes(layer.id) ? previous.filter((entry) => entry !== layer.id) : [...previous, layer.id],
                        )
                      }
                    />
                    <span>
                      {layer.name}
                      {layer.visible ? '' : ' (hidden in 2D)'}
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="button-row">
              <button onClick={() => setHidden3dLayerIds(layers.filter((layer) => layer.visible).map((layer) => layer.id))}>
                Hide All
              </button>
              <button onClick={() => setHidden3dLayerIds([])}>Show All</button>
            </div>
          </>
        )}
      </div>

      <div className="control-block">
        <h3>Bend Controls</h3>
        {threePreviewSettings.mode !== 'fold' ? (
          <p className="hint">Fold controls are only active in Fold mode.</p>
        ) : foldLines.length === 0 ? (
          <p className="hint">Use the Fold tool in 2D canvas to assign bend lines.</p>
        ) : (
          foldLines.map((foldLine) => (
            <div key={foldLine.id} className="fold-control-card">
              <label className="field-row">
                <span>
                  {foldLine.name}: {Math.round(foldLine.angleDeg)} deg
                </span>
                <input
                  type="range"
                  min={-foldLine.maxAngleDeg}
                  max={foldLine.maxAngleDeg}
                  step={1}
                  value={foldLine.angleDeg}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { angleDeg: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Direction</span>
                <select
                  value={foldLine.direction ?? DEFAULT_FOLD_DIRECTION}
                  onChange={(event) =>
                    onUpdateFoldLine(foldLine.id, {
                      direction: event.target.value === 'valley' ? 'valley' : 'mountain',
                    })
                  }
                >
                  <option value="mountain">Mountain</option>
                  <option value="valley">Valley</option>
                </select>
              </label>
              <label className="field-row">
                <span>Fold Radius (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  value={foldLine.radiusMm ?? DEFAULT_FOLD_RADIUS_MM}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { radiusMm: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Material Thickness (mm)</span>
                <input
                  type="number"
                  min={0.2}
                  max={20}
                  step={0.1}
                  value={foldLine.thicknessMm ?? DEFAULT_FOLD_THICKNESS_MM}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { thicknessMm: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Clearance (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.05}
                  value={foldLine.clearanceMm ?? DEFAULT_FOLD_CLEARANCE_MM}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { clearanceMm: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Neutral Axis Ratio</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={foldLine.neutralAxisRatio ?? DEFAULT_FOLD_NEUTRAL_AXIS_RATIO}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { neutralAxisRatio: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Stiffness</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={foldLine.stiffness ?? DEFAULT_FOLD_STIFFNESS}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { stiffness: Number(event.target.value) })}
                />
              </label>
            </div>
          ))
        )}
      </div>

      <div className="control-block">
        <h3>Piece Placement</h3>
        {visiblePatternPieces.length === 0 ? (
          <p className="hint">Create pattern pieces in 2D to unlock assembled 3D placement.</p>
        ) : (
          <>
            <p className="hint">{`${visiblePatternPieces.length} piece${visiblePatternPieces.length === 1 ? '' : 's'} in the current 3D view.`}</p>
            {visiblePatternPieces.map((piece) => {
              const placement = piecePlacementById[piece.id] ?? defaultPiecePlacement(piece.id)
              return (
                <div key={piece.id} className="fold-control-card">
                  <strong>{piece.name}</strong>
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <label key={`${piece.id}-translate-${axis}`} className="field-row">
                      <span>{`Translate ${axis.toUpperCase()}`}</span>
                      <input
                        type="number"
                        step={1}
                        value={placement.translationMm[axis]}
                        onChange={(event) =>
                          updatePlacement(piece.id, (current) => ({
                            ...current,
                            translationMm: {
                              ...current.translationMm,
                              [axis]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <label key={`${piece.id}-rotate-${axis}`} className="field-row">
                      <span>{`Rotate ${axis.toUpperCase()}`}</span>
                      <input
                        type="number"
                        step={1}
                        value={placement.rotationDeg[axis]}
                        onChange={(event) =>
                          updatePlacement(piece.id, (current) => ({
                            ...current,
                            rotationDeg: {
                              ...current.rotationDeg,
                              [axis]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                  <label className="layer-toggle-item">
                    <input
                      type="checkbox"
                      checked={placement.flipped}
                      onChange={(event) =>
                        updatePlacement(piece.id, (current) => ({
                          ...current,
                          flipped: event.target.checked,
                        }))
                      }
                    />
                    <span>Flip piece</span>
                  </label>
                  <div className="button-row">
                    <button
                      onClick={() =>
                        updatePlacement(piece.id, () => ({
                          pieceId: piece.id,
                          translationMm: { x: 0, y: 0, z: 0 },
                          rotationDeg: { x: 0, y: 0, z: 0 },
                          flipped: false,
                        }))
                      }
                    >
                      Reset Piece
                    </button>
                  </div>
                </div>
              )
            })}
            <div className="button-row">
              <button onClick={handleSpreadPieces}>Spread Pieces</button>
              <button onClick={handleStackByLayer}>Stack by Layer</button>
              <button onClick={handleMirrorPairLayout}>Mirror Pair Layout</button>
              <button onClick={handleResetAssembly}>Reset Assembly</button>
            </div>
          </>
        )}
      </div>

      <div className="control-block">
        <h3>Avatar Assets</h3>
        <label className="field-row">
          <span>Active avatar</span>
          <select
            value={activeAvatarId}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                avatarId: event.target.value || undefined,
              }))
            }
          >
            <option value="">Built-in mannequin</option>
            {avatars.map((avatar) => (
              <option key={avatar.id} value={avatar.id}>
                {avatar.name}
              </option>
            ))}
          </select>
        </label>
        <AvatarFormFields
          key={avatarFormResetKey}
          activeAvatarId={activeAvatarId}
          avatars={avatars}
          onSetAvatars={onSetAvatars}
          onSetThreePreviewSettings={onSetThreePreviewSettings}
        />
      </div>

      <div className="control-block">
        <h3>Stitch Simulator</h3>
        <label className="field-row">
          <span>Thread Color</span>
          <input type="color" value={stitchThreadColor} onChange={(event) => onSetStitchThreadColor(event.target.value)} />
        </label>
      </div>

      <div className="control-block">
        <h3>Leather Material Preset</h3>
        <div className="line-type-edit-grid">
          <label className="field-row">
            <span>Preset</span>
            <select onChange={(event) => applyPreset(event.target.value)} defaultValue="">
              <option value="" disabled>Select preset...</option>
              {PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {LEATHER_PRESETS[id].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Color</span>
            <select onChange={(event) => setLeatherColor(event.target.value)} defaultValue="">
              <option value="" disabled>Select color...</option>
              {LEATHER_COLORS.map((color) => (
                <option key={color.id} value={color.color}>
                  {color.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Shadows</span>
            <input type="checkbox" onChange={(event) => enableShadows(event.target.checked)} />
          </label>
        </div>
      </div>

      <div className="control-block">
        <h3>Texture Source</h3>
        <label className="field-row">
          <span>Texture source URL</span>
          <input
            value={textureForm.sourceUrl}
            placeholder="https://..."
            onChange={(event) => setTextureForm((previous) => ({ ...previous, sourceUrl: event.target.value }))}
          />
        </label>
        <label className="field-row">
          <span>License note</span>
          <input
            value={textureForm.license}
            placeholder="CC0 / paid / attribution required"
            onChange={(event) => setTextureForm((previous) => ({ ...previous, license: event.target.value }))}
          />
        </label>
        <label className="field-row">
          <span>Albedo/base color URL</span>
          <input
            value={textureForm.albedoUrl}
            placeholder="https://..."
            onChange={(event) => setTextureForm((previous) => ({ ...previous, albedoUrl: event.target.value }))}
          />
        </label>
        <label className="field-row">
          <span>Normal map URL</span>
          <input
            value={textureForm.normalUrl ?? ''}
            placeholder="https://..."
            onChange={(event) => setTextureForm((previous) => ({ ...previous, normalUrl: event.target.value }))}
          />
        </label>
        <label className="field-row">
          <span>Roughness map URL</span>
          <input
            value={textureForm.roughnessUrl ?? ''}
            placeholder="https://..."
            onChange={(event) => setTextureForm((previous) => ({ ...previous, roughnessUrl: event.target.value }))}
          />
        </label>
        <div className="button-row">
          <button onClick={() => void applyTextureToSelection()}>Apply to Selection</button>
          <button onClick={() => void applyTextureGlobally()}>Apply Globally</button>
          <button onClick={clearSelectionTexture}>Clear Selection Texture</button>
          <button onClick={resetMaterial}>Reset Material</button>
        </div>
        <p className="hint">{`Texture assignments: ${threeTextureShapeIds.length} shapes`}</p>
        <p className="hint">{`Closed selected shapes: ${selectedClosedShapeIds.length}`}</p>
        <p className="hint">{textureStatus}</p>
      </div>
    </>
  )
}
