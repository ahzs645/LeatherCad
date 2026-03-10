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
import { detectOutlines } from '../ops/outline-detection'
import { ThreeBridge, type OutlinePolygon } from '../three/three-bridge'
import { LEATHER_PRESETS } from '../three/material-presets'

export type WorkbenchThreePreviewProps = {
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

export type WorkbenchThreePreviewController = ReturnType<typeof useWorkbenchThreePreviewController>
