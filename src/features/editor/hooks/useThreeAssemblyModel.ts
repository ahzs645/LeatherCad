import { useMemo } from 'react'
import type {
  AssemblyConnection,
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  PatternPiece,
  PieceInterface,
  SeamConnection,
  Shape,
  ThreePreviewSettings,
} from '../cad/cad-types'
import { buildAssemblyDiagnostics } from '../assembly/assembly-diagnostics'
import { compileAssemblyConnections, mergeCompiledSeams } from '../assembly/assembly-connection-compiler'
import { compileExplicitSeams } from '../assembly/seam-stitch-compiler'
import { reconcileSeamConnections } from '../assembly/seam-spans'
import { resolvePatternPieceChains } from '../ops/pattern-piece-ops'
import { buildModelLayout } from '../three/model-builder'
import type { OutlinePolygon } from '../three/three-bridge'

export function useThreeAssemblyModel(params: {
  patternPieces: PatternPiece[]
  pieceInterfaces: PieceInterface[]
  assemblyConnections: AssemblyConnection[]
  seamConnections: SeamConnection[]
  hardwareMarkers: HardwareMarker[]
  foldLines: FoldLine[]
  outlinePolygons: OutlinePolygon[]
  shapesIn3dView: Shape[]
  layersFor3d: Layer[]
  lineTypes: LineType[]
  threePreviewSettings: ThreePreviewSettings
}) {
  const pieceMeshes = useMemo(
    () => buildModelLayout({
      patternPieces: params.patternPieces,
      outlinePolygons: params.outlinePolygons,
      shapes: params.shapesIn3dView,
      foldLines: params.foldLines,
    }).pieceMeshes,
    [params.foldLines, params.outlinePolygons, params.patternPieces, params.shapesIn3dView],
  )

  const { effectiveSeamConnections, repairedSeamIds } = useMemo(() => {
    const compiled = compileAssemblyConnections({
      pieceInterfaces: params.pieceInterfaces,
      assemblyConnections: params.assemblyConnections,
    })
    const merged = mergeCompiledSeams({
      existingSeams: params.seamConnections,
      compiledSeams: compiled.seamConnections,
    })
    // Reconcile on read rather than rewriting the document: a seam authored
    // before a fillet or a path reversal still names its boundary shape, so the
    // stale index can be re-derived every time the geometry is walked. Repairing
    // in place would mean mutating the document on render.
    const reconciled = reconcileSeamConnections({
      seamConnections: merged,
      patternPieces: params.patternPieces,
      chainsByShapeId: resolvePatternPieceChains(params.shapesIn3dView, params.lineTypes).byShapeId,
    })
    return {
      effectiveSeamConnections: reconciled.connections,
      repairedSeamIds: reconciled.repairedSeamIds,
    }
  }, [
    params.assemblyConnections,
    params.lineTypes,
    params.patternPieces,
    params.pieceInterfaces,
    params.seamConnections,
    params.shapesIn3dView,
  ])

  const explicitSeams = useMemo(
    () => compileExplicitSeams({ pieceMeshes, seamConnections: effectiveSeamConnections }),
    [effectiveSeamConnections, pieceMeshes],
  )

  const assemblyDiagnostics = useMemo(
    () => buildAssemblyDiagnostics({
      patternPieces: params.patternPieces,
      pieceMeshes,
      seamConnections: effectiveSeamConnections,
      foldLines: params.foldLines,
      fallbackThicknessMm: params.threePreviewSettings.thicknessMm,
      layers: params.layersFor3d,
      hardwareMarkers: params.hardwareMarkers,
    }),
    [
      effectiveSeamConnections,
      params.foldLines,
      params.hardwareMarkers,
      params.layersFor3d,
      params.patternPieces,
      params.threePreviewSettings.thicknessMm,
      pieceMeshes,
    ],
  )

  return {
    pieceMeshes,
    effectiveSeamConnections,
    repairedSeamIds,
    explicitSeams,
    assemblyDiagnostics,
  }
}
