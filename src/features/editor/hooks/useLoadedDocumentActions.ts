import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import { normalizeLineTypes, resolveActiveLineTypeId } from '../cad/line-types'
import type {
  DocFile,
  HardwareMarker,
  Layer,
  LineType,
  ParametricConstraint,
  SeamAllowance,
  Shape,
  SketchGroup,
  StitchHole,
  Tool,
  TracingOverlay,
} from '../cad/cad-types'
import { DEFAULT_SNAP_SETTINGS } from '../editor-constants'
import { parseSnapSettings } from '../editor-parsers'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import { createDefaultLayer } from '../editor-utils'
import { sanitizeSketchGroupLinks } from '../ops/sketch-link-ops'

type UseLoadedDocumentActionsParams = {
  clearDraft: () => void
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setActiveSketchGroupId: Dispatch<SetStateAction<string | null>>
  setLineTypes: Dispatch<SetStateAction<LineType[]>>
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setFoldLines: Dispatch<SetStateAction<import('../cad/cad-types').FoldLine[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setSeamAllowances: Dispatch<SetStateAction<SeamAllowance[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setSnapSettings: Dispatch<SetStateAction<import('../cad/cad-types').SnapSettings>>
  setShowAnnotations: Dispatch<SetStateAction<boolean>>
  setTracingOverlays: Dispatch<SetStateAction<TracingOverlay[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setLayerColorOverrides: Dispatch<SetStateAction<Record<string, string>>>
  setTool: Dispatch<SetStateAction<Tool>>
  setShowPrintAreas: Dispatch<SetStateAction<boolean>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useLoadedDocumentActions(params: UseLoadedDocumentActionsParams) {
  const {
    clearDraft,
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setSeamAllowances,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setTool,
    setShowPrintAreas,
    setStatus,
  } = params

  const applyLoadedDocument = useCallback((doc: DocFile, statusMessage: string) => {
    const normalizedLayers = doc.layers.length > 0 ? doc.layers : [createDefaultLayer(uid())]
    const normalizedActiveLayerId = normalizedLayers.some((layer) => layer.id === doc.activeLayerId)
      ? doc.activeLayerId
      : normalizedLayers[0].id
    const layerIdSet = new Set(normalizedLayers.map((layer) => layer.id))
    const normalizedSketchGroups = sanitizeSketchGroupLinks((doc.sketchGroups ?? []).filter((group) => layerIdSet.has(group.layerId)))
    const sketchGroupIdSet = new Set(normalizedSketchGroups.map((group) => group.id))
    const normalizedShapes = doc.objects.map((shape) => {
      if (!shape.groupId || !sketchGroupIdSet.has(shape.groupId)) {
        return {
          ...shape,
          groupId: undefined,
        }
      }

      const group = normalizedSketchGroups.find((entry) => entry.id === shape.groupId)
      if (!group || group.layerId !== shape.layerId) {
        return {
          ...shape,
          groupId: undefined,
        }
      }

      return shape
    })
    const shapeIdSet = new Set(normalizedShapes.map((shape) => shape.id))
    const normalizedConstraints = (doc.constraints ?? []).filter((constraint) => {
      if (!shapeIdSet.has(constraint.shapeId)) {
        return false
      }
      if (constraint.type === 'edge-offset') {
        return layerIdSet.has(constraint.referenceLayerId)
      }
      return shapeIdSet.has(constraint.referenceShapeId)
    })
    const normalizedSeamAllowances = (doc.seamAllowances ?? []).filter((entry) => shapeIdSet.has(entry.shapeId))
    const normalizedHardwareMarkers = (doc.hardwareMarkers ?? []).filter((marker) => {
      if (!layerIdSet.has(marker.layerId)) {
        return false
      }
      if (!marker.groupId) {
        return true
      }
      return sketchGroupIdSet.has(marker.groupId)
    })
    const normalizedActiveSketchGroupId =
      doc.activeSketchGroupId && sketchGroupIdSet.has(doc.activeSketchGroupId) ? doc.activeSketchGroupId : null
    const nextLineTypes = normalizeLineTypes(doc.lineTypes ?? [])

    setLayers(normalizedLayers)
    setActiveLayerId(normalizedActiveLayerId)
    setSketchGroups(normalizedSketchGroups)
    setActiveSketchGroupId(normalizedActiveSketchGroupId)
    setLineTypes(nextLineTypes)
    setActiveLineTypeId(resolveActiveLineTypeId(nextLineTypes, doc.activeLineTypeId))
    setShapes(normalizedShapes)
    setFoldLines(doc.foldLines)
    setStitchHoles(normalizeStitchHoleSequences(doc.stitchHoles ?? []))
    setConstraints(normalizedConstraints)
    setSeamAllowances(normalizedSeamAllowances)
    setHardwareMarkers(normalizedHardwareMarkers)
    setSnapSettings(parseSnapSettings(doc.snapSettings) ?? DEFAULT_SNAP_SETTINGS)
    setShowAnnotations(typeof doc.showAnnotations === 'boolean' ? doc.showAnnotations : true)
    setTracingOverlays(doc.tracingOverlays ?? [])
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
    setLayerColorOverrides({})
    setTool('pan')
    setShowPrintAreas(false)
    clearDraft()
    setStatus(statusMessage)
  }, [
    clearDraft,
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setSeamAllowances,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setTool,
    setShowPrintAreas,
    setStatus,
  ])

  return { applyLoadedDocument }
}
