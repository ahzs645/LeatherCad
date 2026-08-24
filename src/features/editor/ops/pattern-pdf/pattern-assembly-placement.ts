/**
 * Places the pieces of an imported pattern in 3D.
 *
 * Split out from the document builder because it reaches into the three.js side
 * of the app: the builder produces a project that any surface can open, and
 * this adds the one thing that makes the assembled preview open *assembled*
 * rather than as a flat net waiting for someone to drag the angle slider.
 *
 * The angle is the assembly scrubber's, so 180° is a lining laid onto its
 * panel, 90° a gusset stood up, and 0° the flat connected net.
 */

import type { DocFile } from '../../cad/cad-types'
import { resolvePatternPieceChains } from '../pattern-piece-ops'
import { buildPieceMeshes } from '../../three/piece-mesh'
import {
  solveSeamDrivenPlacements,
  type SeamDrivenPlacementResult,
} from '../../three/seam-driven-placement'

export type PatternAssembly = {
  doc: DocFile
  placement: SeamDrivenPlacementResult
}

/** Returns a copy of `doc` with `piecePlacements3d` solved from its seams. */
export function assemblePatternDoc(doc: DocFile, assemblyAngleDeg = 180): PatternAssembly {
  const { byShapeId } = resolvePatternPieceChains(doc.objects, doc.lineTypes)
  const pieceMeshes = buildPieceMeshes(doc.patternPieces ?? [], byShapeId)
  const placement = solveSeamDrivenPlacements({
    pieceMeshes,
    seamConnections: doc.seamConnections ?? [],
    options: {
      assemblyAngleDeg,
      // The preview's own thickness, so the layers stack the way they will be
      // drawn rather than sharing one plane.
      materialThicknessMm: doc.threePreviewSettings?.thicknessMm,
    },
  })
  return {
    doc: { ...doc, piecePlacements3d: placement.placements },
    placement,
  }
}
