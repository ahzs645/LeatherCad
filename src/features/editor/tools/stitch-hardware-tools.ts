import type { HardwareMarker, SeamConnection } from '../cad/cad-types'
import { HARDWARE_PRESETS } from '../editor-constants'
import { findNearestPatternPieceEdge, resolvePatternPieceChains } from '../ops/pattern-piece-ops'
import { findNearestStitchAnchor, createStitchHole } from '../ops/stitch-hole-ops'
import { clamp, pickToolPoint, uid } from './tool-helpers'
import type { ToolDefinition } from './tool-types'

export const stitchHardwareToolDefinitions = {
  'stitch-hole': {
    onPointerDown(point, runtime) {
      const nearestStitchAnchor = findNearestStitchAnchor(
        point,
        runtime.stitchTargetShapes,
        runtime.lineTypesById,
        16 / Math.max(0.1, runtime.viewportScale),
        { allowNonStitchShapes: true },
      )
      if (!nearestStitchAnchor) {
        runtime.setStatus('No shape near pointer. Tap near a visible line, curve, or stitch path.')
        return
      }

      const targetShape = runtime.shapesById[nearestStitchAnchor.shapeId]
      if (!targetShape) {
        runtime.setStatus('Could not resolve stitch path')
        return
      }

      const targetLayer = runtime.layers.find((layer) => layer.id === targetShape.layerId)
      if (targetLayer?.locked) {
        runtime.setStatus('Target layer is locked. Unlock it before placing stitch holes.')
        return
      }

      let createdHoleId: string | null = null
      runtime.setStitchHoles((previous) => {
        const nextSequence =
          previous
            .filter((stitchHole) => stitchHole.shapeId === nearestStitchAnchor.shapeId)
            .reduce((maximum, stitchHole) => Math.max(maximum, stitchHole.sequence), -1) + 1
        const createdHole = {
          ...createStitchHole(nearestStitchAnchor, runtime.stitchHoleDefaults),
          sequence: nextSequence,
        }
        createdHoleId = createdHole.id
        return [...previous, createdHole]
      })
      runtime.setSelectedStitchHoleId(createdHoleId)
      pickToolPoint(runtime, point)
      const targetLineTypeRole = runtime.lineTypesById[targetShape.lineTypeId]?.role ?? 'cut'
      runtime.setStatus(
        targetLineTypeRole === 'stitch'
          ? `Stitch hole placed (${runtime.stitchHoleDefaults.presetName ?? runtime.stitchHoleDefaults.renderShape ?? runtime.stitchHoleDefaults.holeType})`
          : `Stitch hole placed on ${targetLineTypeRole} path (${runtime.stitchHoleDefaults.presetName ?? runtime.stitchHoleDefaults.renderShape ?? runtime.stitchHoleDefaults.holeType})`,
      )
    },
  },
  hardware: {
    onPointerDown(point, runtime) {
      if (!runtime.ensureActiveLayerWritable()) {
        return
      }

      const preset = runtime.hardwarePreset === 'custom' ? null : HARDWARE_PRESETS[runtime.hardwarePreset]
      const marker: HardwareMarker = {
        id: uid(),
        layerId: runtime.activeLayerId,
        groupId: runtime.activeSketchGroup?.id,
        point,
        kind: runtime.hardwarePreset,
        label: runtime.hardwarePreset === 'custom' ? 'Hardware' : preset?.label ?? 'Hardware',
        holeDiameterMm:
          runtime.hardwarePreset === 'custom'
            ? clamp(runtime.customHardwareDiameterMm || 4, 0.1, 120)
            : (preset?.holeDiameterMm ?? 4),
        spacingMm:
          runtime.hardwarePreset === 'custom'
            ? clamp(runtime.customHardwareSpacingMm || 0, 0, 300)
            : (preset?.spacingMm ?? 0),
        notes: '',
        visible: true,
      }
      runtime.setHardwareMarkers((previous) => [...previous, marker])
      runtime.setSelectedHardwareMarkerId(marker.id)
      pickToolPoint(runtime, point)
      runtime.setStatus(`Placed hardware marker (${marker.kind})`)
    },
  },
  seam: {
    onPointerDown(point, runtime) {
      if (!runtime.ensureActiveLayerWritable()) {
        return
      }

      const pieceChains = resolvePatternPieceChains(runtime.stitchTargetShapes, Object.values(runtime.lineTypesById))
      const nearest = findNearestPatternPieceEdge(point, runtime.patternPieces, pieceChains.byShapeId)
      if (!nearest) {
        runtime.setStatus('Seam: click a pattern piece edge')
        return
      }

      const pending = runtime.toolSession.getPendingSeamSelection()
      const selectedEdge = {
        pieceId: nearest.piece.id,
        pieceName: nearest.piece.name,
        edgeIndex: nearest.edgeIndex,
      }

      if (!pending) {
        runtime.toolSession.setPendingSeamSelection(selectedEdge)
        pickToolPoint(runtime, point)
        runtime.setStatus(`Seam start set: ${nearest.piece.name} edge ${nearest.edgeIndex + 1}. Click the matching edge.`)
        return
      }

      if (pending.pieceId === selectedEdge.pieceId && pending.edgeIndex === selectedEdge.edgeIndex) {
        runtime.toolSession.clearPendingSeamSelection()
        runtime.setStatus('Seam selection cleared')
        return
      }

      const duplicate = runtime.seamConnections.some(
        (connection) =>
          (connection.from.pieceId === pending.pieceId &&
            connection.from.edgeIndex === pending.edgeIndex &&
            connection.to.pieceId === selectedEdge.pieceId &&
            connection.to.edgeIndex === selectedEdge.edgeIndex) ||
          (connection.to.pieceId === pending.pieceId &&
            connection.to.edgeIndex === pending.edgeIndex &&
            connection.from.pieceId === selectedEdge.pieceId &&
            connection.from.edgeIndex === selectedEdge.edgeIndex),
      )

      if (duplicate) {
        runtime.toolSession.clearPendingSeamSelection()
        runtime.setStatus('A seam connection already exists between those edges')
        return
      }

      const connection: SeamConnection = {
        id: uid(),
        from: {
          pieceId: pending.pieceId,
          edgeIndex: pending.edgeIndex,
        },
        to: {
          pieceId: selectedEdge.pieceId,
          edgeIndex: selectedEdge.edgeIndex,
        },
        kind: 'sewn',
        reversed: false,
      }
      runtime.setSeamConnections((previous) => [...previous, connection])
      runtime.toolSession.clearPendingSeamSelection()
      pickToolPoint(runtime, point)
      runtime.setStatus(
        `Created seam: ${pending.pieceName} edge ${pending.edgeIndex + 1} to ${selectedEdge.pieceName} edge ${selectedEdge.edgeIndex + 1}`,
      )
    },
    getHint() {
      return 'Seam: click one piece edge, then the matching edge to create a seam'
    },
    resetSession(session, nextTool) {
      session.resetForTool(nextTool)
    },
  },
} satisfies Partial<Record<string, ToolDefinition>>
