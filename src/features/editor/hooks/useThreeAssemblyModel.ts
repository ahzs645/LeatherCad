import { useMemo } from 'react'
import type {
  AssemblyConnection,
  FoldLine,
  HardwareMarker,
  Layer,
  PatternPiece,
  PieceInterface,
  SeamConnection,
  Shape,
  ThreePreviewSettings,
} from '../cad/cad-types'
import { buildAssemblyDiagnostics } from '../assembly/assembly-diagnostics'
import { compileAssemblyConnections, mergeCompiledSeams } from '../assembly/assembly-connection-compiler'
import { compileExplicitSeams } from '../assembly/seam-stitch-compiler'
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

  const effectiveSeamConnections = useMemo(() => {
    const compiled = compileAssemblyConnections({
      pieceInterfaces: params.pieceInterfaces,
      assemblyConnections: params.assemblyConnections,
    })
    return mergeCompiledSeams({
      existingSeams: params.seamConnections,
      compiledSeams: compiled.seamConnections,
    })
  }, [params.assemblyConnections, params.pieceInterfaces, params.seamConnections])

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
    explicitSeams,
    assemblyDiagnostics,
  }
}
