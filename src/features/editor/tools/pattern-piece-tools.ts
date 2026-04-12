import { findNearestPatternPieceEdge, resolvePatternPieceChains } from '../ops/pattern-piece-ops'
import type { PieceNotch } from '../cad/cad-types'
import type { ToolDefinition } from './tool-types'
import { pickToolPoint, uid } from './tool-helpers'

export const patternPieceToolDefinitions = {
  'piece-notch': {
    onPointerDown(point, runtime) {
      if (!runtime.ensureActiveLayerWritable()) {
        return
      }

      const pieceChains = resolvePatternPieceChains(runtime.stitchTargetShapes, Object.values(runtime.lineTypesById))
      const nearest = findNearestPatternPieceEdge(point, runtime.patternPieces, pieceChains.byShapeId)
      if (!nearest) {
        runtime.setStatus('Piece notch: click a pattern piece boundary')
        return
      }

      const nextNotch: PieceNotch = {
        id: uid(),
        pieceId: nearest.piece.id,
        edgeIndex: nearest.edgeIndex,
        t: nearest.t,
        style: 'single',
        lengthMm: 4,
        widthMm: 2,
        angleMode: 'normal',
        showOnSeam: true,
      }
      runtime.setPieceNotches((previous) => [...previous, nextNotch])
      pickToolPoint(runtime, point)
      runtime.setStatus(`Added notch to ${nearest.piece.name}`)
    },
    getHint() {
      return 'Piece Notch: click a pattern piece edge'
    },
  },
} satisfies Partial<Record<string, ToolDefinition>>
