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
import { buildFinalProductRegions } from '../three/final-product-regions'
import { solveFinalProduct } from '../three/final-product-solver'
import { LEATHER_PRESETS } from '../three/material-presets'
import type {
  OutlinePolygon,
  ThreeBridge as ThreeBridgeClass,
} from '../three/three-bridge'
import type {
  ThreeBridgeDocument,
  ThreeBridgePresentationState,
  ThreeMaterialState,
} from '../three/three-bridge-types'

export type ThreePreviewControllerProps = {
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

const DEFAULT_MATERIAL_STATE: ThreeMaterialState = {
  presetId: null,
  leatherColor: null,
  shadowsEnabled: false,
}

function buildFinalProductDocumentBounds(
  shapes: Shape[],
  foldLines: FoldLine[],
  outlinePolygons: OutlinePolygon[],
) {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const includePoint = (point: { x: number; y: number }) => {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  for (const outline of outlinePolygons) {
    outline.polygon.forEach(includePoint)
  }
  for (const shape of shapes) {
    sampleShapePoints(shape, shape.type === 'line' ? 1 : 20).forEach(includePoint)
  }
  for (const foldLine of foldLines) {
    includePoint(foldLine.start)
    includePoint(foldLine.end)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { minX: -220, maxX: 220, minY: -140, maxY: 140 }
  }

  const width = Math.max(maxX - minX, 80)
  const height = Math.max(maxY - minY, 80)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  return {
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: centerY - height / 2,
    maxY: centerY + height / 2,
  }
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

export function useThreePreviewController(props: ThreePreviewControllerProps) {
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
  const bridgeRef = useRef<ThreeBridgeClass | null>(null)
  const [isBridgeReady, setIsBridgeReady] = useState(false)

  const [textureForm, setTextureForm] = useState<TextureSource>(() => threeTextureSource ?? DEFAULT_TEXTURE_FORM)
  const [textureStatus, setTextureStatus] = useState('Default leather material active')
  const [hidden3dLayerIds, setHidden3dLayerIds] = useState<string[]>([])
  const [materialState, setMaterialState] = useState<ThreeMaterialState>(DEFAULT_MATERIAL_STATE)

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

  const finalProductSolveResult = useMemo(() => {
    if (threePreviewSettings.mode !== 'final') {
      return null
    }

    return solveFinalProduct({
      foldLines,
      stitchHoles,
      regions: buildFinalProductRegions({
        layers: layersFor3d,
        lineTypes,
        shapes: shapesIn3dView,
        outlinePolygons,
      }),
      outlinePolygons,
      documentBounds: buildFinalProductDocumentBounds(shapesIn3dView, foldLines, outlinePolygons),
      thicknessMm: threePreviewSettings.thicknessMm,
    })
  }, [
    foldLines,
    layersFor3d,
    lineTypes,
    outlinePolygons,
    shapesIn3dView,
    stitchHoles,
    threePreviewSettings.mode,
    threePreviewSettings.thicknessMm,
  ])

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

  const documentState = useMemo<ThreeBridgeDocument>(
    () => ({
      layers: layersFor3d,
      lineTypes,
      shapes: shapesIn3dView,
      foldLines,
      stitchHoles,
      outlinePolygons,
      patternPieces,
      piecePlacements3d,
      seamConnections,
      avatars,
    }),
    [
      layersFor3d,
      lineTypes,
      shapesIn3dView,
      foldLines,
      stitchHoles,
      outlinePolygons,
      patternPieces,
      piecePlacements3d,
      seamConnections,
      avatars,
    ],
  )

  const presentationState = useMemo<ThreeBridgePresentationState>(
    () => ({
      themeMode,
      previewSettings: threePreviewSettings,
      textureSource: threeTextureSource,
      textureShapeIds: threeTextureShapeIds,
      threadColor: stitchThreadColor,
      material: materialState,
    }),
    [
      themeMode,
      threePreviewSettings,
      threeTextureSource,
      threeTextureShapeIds,
      stitchThreadColor,
      materialState,
    ],
  )

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    let cancelled = false
    let observer: ResizeObserver | null = null
    let activeBridge: ThreeBridgeClass | null = null

    void import('../three/three-bridge')
      .then(({ ThreeBridge }) => {
        if (cancelled || !canvasRef.current) {
          return
        }

        const bridge = new ThreeBridge(canvasRef.current)
        activeBridge = bridge
        bridgeRef.current = bridge
        setIsBridgeReady(true)

        observer = new ResizeObserver(() => {
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
      })
      .catch((error) => {
        console.error('Failed to load 3D preview bridge', error)
      })

    return () => {
      cancelled = true
      setIsBridgeReady(false)
      observer?.disconnect()
      activeBridge?.dispose()
      bridgeRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isBridgeReady) {
      return
    }
    bridgeRef.current?.updateDocument(documentState)
  }, [documentState, isBridgeReady])

  const lastTextureSyncRef = useRef('')

  useEffect(() => {
    const bridge = bridgeRef.current
    if (!bridge || !isBridgeReady) {
      return
    }

    let cancelled = false
    const textureSyncKey = JSON.stringify({
      textureSource: threeTextureSource,
      textureShapeIds: threeTextureShapeIds,
    })
    const textureChanged = lastTextureSyncRef.current !== textureSyncKey

    const apply = async () => {
      try {
        await bridge.updatePresentation(presentationState)
        if (!textureChanged || cancelled) {
          return
        }
        if (!threeTextureSource || !threeTextureSource.albedoUrl.trim()) {
          setTextureStatus('Default leather material active')
          return
        }
        setTextureStatus(
          threeTextureShapeIds.length > 0
            ? `Texture loaded for ${threeTextureShapeIds.length} shape${threeTextureShapeIds.length === 1 ? '' : 's'}`
            : 'Texture loaded (no shapes assigned yet)',
        )
      } catch (error) {
        if (!textureChanged || cancelled) {
          return
        }
        const message = error instanceof Error ? error.message : 'unknown error'
        setTextureStatus(`Texture load failed: ${message}`)
      } finally {
        lastTextureSyncRef.current = textureSyncKey
      }
    }

    void apply()
    return () => {
      cancelled = true
    }
  }, [isBridgeReady, presentationState, threeTextureShapeIds, threeTextureSource])

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
    if (!presetId) {
      return
    }
    setMaterialState((previous) => ({
      ...previous,
      presetId,
    }))
    setTextureStatus(`Applied ${LEATHER_PRESETS[presetId]?.label ?? presetId} preset`)
  }

  const setLeatherColor = (color: string) => {
    if (!color) {
      return
    }
    setMaterialState((previous) => ({
      ...previous,
      leatherColor: color,
    }))
  }

  const enableShadows = (enabled: boolean) => {
    setMaterialState((previous) => ({
      ...previous,
      shadowsEnabled: enabled,
    }))
  }

  const rotateLeatherTexture = (deltaDeg: number) => {
    const bridge = bridgeRef.current
    if (!bridge) {
      return
    }
    const nextDeg = deltaDeg === 0 ? 0 : bridge.getLeatherTextureRotationDeg() + deltaDeg
    bridge.setLeatherTextureRotationDeg(nextDeg)
    setTextureStatus(
      deltaDeg === 0
        ? 'Reset leather texture rotation'
        : `Rotated leather texture to ${Math.round(((nextDeg % 360) + 360) % 360)}°`,
    )
  }

  const applyTextureToSelection = async () => {
    if (selectedClosedShapeIds.length === 0) {
      setTextureStatus('Select one or more closed shapes in 2D first')
      return
    }

    const nextSource = normalizeTextureSource(textureForm)
    if (!nextSource.albedoUrl) {
      setTextureStatus('Set at least an albedo URL before applying texture')
      return
    }

    setTextureStatus('Loading texture set...')
    setTextureForm(nextSource)
    const nextAssignedIds = Array.from(new Set([...threeTextureShapeIds, ...selectedClosedShapeIds]))
    onSetThreeTextureSource(nextSource)
    onSetThreeTextureShapeIds(nextAssignedIds)
  }

  const applyTextureGlobally = async () => {
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

    setTextureStatus('Loading texture set...')
    setTextureForm(nextSource)
    onSetThreeTextureSource(nextSource)
    onSetThreeTextureShapeIds(allShapeIds)
  }

  const clearSelectionTexture = () => {
    if (selectedClosedShapeIds.length === 0) {
      setTextureStatus('Select one or more closed shapes in 2D first')
      return
    }
    const selectedIdSet = new Set(selectedClosedShapeIds)
    const nextAssignedIds = threeTextureShapeIds.filter((shapeId) => !selectedIdSet.has(shapeId))
    onSetThreeTextureShapeIds(nextAssignedIds)
    setTextureStatus(`Removed texture assignment from ${selectedClosedShapeIds.length} selected closed shape${selectedClosedShapeIds.length === 1 ? '' : 's'}`)
  }

  const resetMaterial = () => {
    onSetThreeTextureSource(null)
    onSetThreeTextureShapeIds([])
    setMaterialState(DEFAULT_MATERIAL_STATE)
    setTextureForm(DEFAULT_TEXTURE_FORM)
    setTextureStatus('Switched back to default leather material')
  }

  return {
    ...props,
    containerRef,
    canvasRef,
    bridgeRef,
    isBridgeReady,
    documentState,
    presentationState,
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
    finalProductSolveResult,
    activeAvatarId,
    avatarFormResetKey,
    selectedClosedShapeIds,
    piecePlacementById,
    materialState,
    setMaterialState,
    updatePlacement,
    handleSpreadPieces,
    handleStackByLayer,
    handleMirrorPairLayout,
    handleResetAssembly,
    applyPreset,
    setLeatherColor,
    enableShadows,
    rotateLeatherTexture,
    applyTextureToSelection,
    applyTextureGlobally,
    clearSelectionTexture,
    resetMaterial,
    onUpdateFoldLine,
  }
}

export type ThreePreviewController = ReturnType<typeof useThreePreviewController>
