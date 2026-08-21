import type { HardwareMarker, PieceEdgeSpan, SeamConnection } from '../cad/cad-types'
import { HARDWARE_PRESETS } from '../editor-constants'
import { shapeIdForEdgeIndex, shapeParameterForEdge } from '../ops/outline-detection'
import {
  findNearestPatternPieceEdge,
  getPatternPieceChain,
  resolvePatternPieceChains,
} from '../ops/pattern-piece-ops'
import { findNearestStitchAnchor, createPrickingIronStitchHoles } from '../ops/stitch-hole-ops'
import { withMirroredSingleRefs } from '../assembly/seam-spans'
import {
  advanceSeamToolPhase,
  applySeamPick,
  seamToolHint,
  type SeamPick,
  type SeamToolKind,
} from './seam-tool-state'
import { clamp, edgePickOptions, pickToolPoint, uid } from './tool-helpers'
import type { ToolDefinition, ToolRuntime } from './tool-types'

function spanFromPick(pick: SeamPick): PieceEdgeSpan {
  return {
    pieceId: pick.pieceId,
    edgeIndex: pick.edgeIndex,
    boundaryShapeId: pick.boundaryShapeId,
    t0: 0,
    t1: 1,
    reversed: pick.reversed,
  }
}

function seamAlreadyExists(runtime: ToolRuntime, from: SeamPick[], to: SeamPick[]) {
  const key = (spans: SeamPick[]) =>
    spans
      .map((span) => `${span.pieceId}:${span.edgeIndex}`)
      .sort()
      .join('|')
  const candidate = [key(from), key(to)].sort().join('~')
  return runtime.seamConnections.some((connection) => {
    const existingFrom = (connection.fromSpans ?? [connection.fromSpan ?? connection.from]).map((span) => ({
      pieceId: span.pieceId,
      edgeIndex: span.edgeIndex,
    })) as SeamPick[]
    const existingTo = (connection.toSpans ?? [connection.toSpan ?? connection.to]).map((span) => ({
      pieceId: span.pieceId,
      edgeIndex: span.edgeIndex,
    })) as SeamPick[]
    return [key(existingFrom), key(existingTo)].sort().join('~') === candidate
  })
}

/**
 * Turns a click into a pick that names the authored boundary shape, not just an
 * index into the sampled polygon, and infers the seam direction from where along
 * that shape the click landed.
 */
function resolveSeamPick(point: { x: number; y: number }, runtime: ToolRuntime): SeamPick | null {
  const pieceChains = resolvePatternPieceChains(runtime.stitchTargetShapes, Object.values(runtime.lineTypesById))
  const nearest = findNearestPatternPieceEdge(
    point,
    runtime.patternPieces,
    pieceChains.byShapeId,
    edgePickOptions(runtime),
  )
  if (!nearest) {
    return null
  }

  const chain = getPatternPieceChain(nearest.piece, pieceChains.byShapeId)
  const alongShape = chain ? shapeParameterForEdge(chain, nearest.edgeIndex, nearest.t) : null
  // A curve samples to 48 chords, so `t` within one chord says nothing about
  // which end of the side was pointed at. Use the position along the whole
  // authored shape when we can resolve it.
  const parameter = alongShape ? alongShape.parameter : nearest.t

  return {
    pieceId: nearest.piece.id,
    pieceName: nearest.piece.name,
    edgeIndex: nearest.edgeIndex,
    boundaryShapeId: alongShape?.shapeId ?? (chain ? shapeIdForEdgeIndex(chain, nearest.edgeIndex) ?? undefined : undefined),
    reversed: parameter > 0.5,
  }
}

function buildSeamTool(kind: SeamToolKind): ToolDefinition {
  const commit = (runtime: ToolRuntime, from: SeamPick[], to: SeamPick[]) => {
    if (seamAlreadyExists(runtime, from, to)) {
      runtime.setStatus('A seam already joins those edges')
      return
    }
    const fromSpans = from.map(spanFromPick)
    const toSpans = to.map(spanFromPick)
    const base: SeamConnection = {
      id: uid(),
      from: { pieceId: fromSpans[0].pieceId, edgeIndex: fromSpans[0].edgeIndex },
      to: { pieceId: toSpans[0].pieceId, edgeIndex: toSpans[0].edgeIndex },
      kind: 'sewn',
      // The two sides are stitched together, so they are traversed in opposite
      // directions unless exactly one of them was picked back to front.
      reversed: fromSpans[0].reversed !== toSpans[0].reversed,
    }
    runtime.setSeamConnections((previous) => [...previous, withMirroredSingleRefs(base, fromSpans, toSpans)])
    const describe = (spans: SeamPick[]) =>
      spans.length === 1
        ? `${spans[0].pieceName} edge ${spans[0].edgeIndex + 1}`
        : `${spans.length} edges on ${Array.from(new Set(spans.map((span) => span.pieceName))).join(' + ')}`
    runtime.setStatus(`Created seam: ${describe(from)} to ${describe(to)}`)
  }

  return {
    onPointerDown(point, runtime) {
      if (!runtime.ensureActiveLayerWritable()) {
        return
      }

      const pick = resolveSeamPick(point, runtime)
      if (!pick) {
        runtime.setStatus('Seam: click a pattern piece edge')
        return
      }

      const result = applySeamPick(kind, runtime.toolSession.getSeamToolState(), pick)
      runtime.toolSession.setSeamToolState(result.state)
      pickToolPoint(runtime, point)
      if (result.commit) {
        commit(runtime, result.commit.from, result.commit.to)
        return
      }
      if (result.message) {
        runtime.setStatus(result.message)
      }
    },
    onCommand(command, context) {
      const normalized = command.trim().toLowerCase()
      if (!['next', 'finish', 'done', 'enter'].includes(normalized)) {
        return ''
      }
      const result = advanceSeamToolPhase(context.runtime.toolSession.getSeamToolState())
      context.runtime.toolSession.setSeamToolState(result.state)
      if (result.commit) {
        commit(context.runtime, result.commit.from, result.commit.to)
        return 'Seam created'
      }
      return result.message ?? ''
    },
    getHint() {
      return seamToolHint(kind, { from: [], to: [], phase: 'from' })
    },
    resetSession(session, nextTool) {
      session.resetForTool(nextTool)
    },
  }
}

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
      let createdCount = 0
      runtime.setStitchHoles((previous) => {
        const nextSequence =
          previous
            .filter((stitchHole) => stitchHole.shapeId === nearestStitchAnchor.shapeId)
            .reduce((maximum, stitchHole) => Math.max(maximum, stitchHole.sequence), -1) + 1
        const createdHoles = createPrickingIronStitchHoles(
          targetShape,
          nearestStitchAnchor,
          runtime.stitchHoleDefaults,
          nextSequence,
        )
        createdHoleId = createdHoles[0]?.id ?? null
        createdCount = createdHoles.length
        return [...previous, ...createdHoles]
      })
      runtime.setSelectedStitchHoleId(createdHoleId)
      pickToolPoint(runtime, point)
      const targetLineTypeRole = runtime.lineTypesById[targetShape.lineTypeId]?.role ?? 'cut'
      const placedLabel = createdCount > 1 ? `${createdCount} stitch holes placed` : 'Stitch hole placed'
      runtime.setStatus(
        targetLineTypeRole === 'stitch'
          ? `${placedLabel} (${runtime.stitchHoleDefaults.presetName ?? runtime.stitchHoleDefaults.renderShape ?? runtime.stitchHoleDefaults.holeType})`
          : `${placedLabel} on ${targetLineTypeRole} path (${runtime.stitchHoleDefaults.presetName ?? runtime.stitchHoleDefaults.renderShape ?? runtime.stitchHoleDefaults.holeType})`,
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
  seam: buildSeamTool('single'),
  'seam-multi': buildSeamTool('multi'),
} satisfies Partial<Record<string, ToolDefinition>>
