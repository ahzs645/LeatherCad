import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { createDefaultLineTypes } from '../cad/line-types'
import type {
  HardwareMarker,
  Layer,
  ParametricConstraint,
  SeamAllowance,
  Shape,
  SketchGroup,
  StitchHole,
  TracingOverlay,
} from '../cad/cad-types'
import { deepClone, pushHistorySnapshot, type HistoryState } from '../ops/history-ops'
import { HISTORY_LIMIT } from '../editor-constants'
import type { EditorSnapshot } from '../editor-types'
import { saveTemplateRepository, type TemplateRepositoryEntry } from '../templates/template-repository'

type UseEditorConsistencyEffectsParams = {
  layers: Layer[]
  activeLayerId: string
  setActiveLayerId: Dispatch<SetStateAction<string>>
  sketchGroups: SketchGroup[]
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setActiveSketchGroupId: Dispatch<SetStateAction<string | null>>
  lineTypes: import('../cad/cad-types').LineType[]
  activeLineTypeId: string
  setLineTypes: Dispatch<SetStateAction<import('../cad/cad-types').LineType[]>>
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  shapes: Shape[]
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSeamAllowances: Dispatch<SetStateAction<SeamAllowance[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  stitchHoles: StitchHole[]
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  hardwareMarkers: HardwareMarker[]
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setLayerColorOverrides: Dispatch<SetStateAction<Record<string, string>>>
  tracingOverlays: TracingOverlay[]
  setActiveTracingOverlayId: Dispatch<SetStateAction<string | null>>
  tracingObjectUrlsRef: MutableRefObject<Set<string>>
  templateRepository: TemplateRepositoryEntry[]
  setSelectedTemplateEntryId: Dispatch<SetStateAction<string | null>>
  applyingHistoryRef: MutableRefObject<boolean>
  lastSnapshotRef: MutableRefObject<EditorSnapshot | null>
  lastSnapshotSignatureRef: MutableRefObject<string | null>
  currentSnapshot: EditorSnapshot
  currentSnapshotSignature: string
  setHistoryState: Dispatch<SetStateAction<HistoryState<EditorSnapshot>>>
}

export function useEditorConsistencyEffects(params: UseEditorConsistencyEffectsParams) {
  const {
    layers,
    activeLayerId,
    setActiveLayerId,
    sketchGroups,
    setSketchGroups,
    setActiveSketchGroupId,
    lineTypes,
    activeLineTypeId,
    setLineTypes,
    setActiveLineTypeId,
    shapes,
    setSelectedShapeIds,
    setSeamAllowances,
    setConstraints,
    setStitchHoles,
    stitchHoles,
    setSelectedStitchHoleId,
    hardwareMarkers,
    setSelectedHardwareMarkerId,
    setHardwareMarkers,
    setLayerColorOverrides,
    tracingOverlays,
    setActiveTracingOverlayId,
    tracingObjectUrlsRef,
    templateRepository,
    setSelectedTemplateEntryId,
    applyingHistoryRef,
    lastSnapshotRef,
    lastSnapshotSignatureRef,
    currentSnapshot,
    currentSnapshotSignature,
    setHistoryState,
  } = params

  useEffect(() => {
    if (layers.length === 0) {
      return
    }
    if (!layers.some((layer) => layer.id === activeLayerId)) {
      setActiveLayerId(layers[0].id)
    }
  }, [layers, activeLayerId, setActiveLayerId])

  useEffect(() => {
    setActiveSketchGroupId((previous) => {
      if (!previous) {
        return previous
      }
      const match = sketchGroups.find((group) => group.id === previous)
      if (!match) {
        return null
      }
      return match.layerId === activeLayerId ? previous : null
    })
  }, [sketchGroups, activeLayerId, setActiveSketchGroupId])

  useEffect(() => {
    if (lineTypes.length === 0) {
      setLineTypes(createDefaultLineTypes())
      return
    }
    if (!lineTypes.some((lineType) => lineType.id === activeLineTypeId)) {
      setActiveLineTypeId(lineTypes[0].id)
    }
  }, [lineTypes, activeLineTypeId, setLineTypes, setActiveLineTypeId])

  useEffect(() => {
    setSelectedShapeIds((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const shapeIdSet = new Set(shapes.map((shape) => shape.id))
      const next = previous.filter((shapeId) => shapeIdSet.has(shapeId))
      return next.length === previous.length ? previous : next
    })
  }, [shapes, setSelectedShapeIds])

  useEffect(() => {
    setSeamAllowances((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const shapeIdSet = new Set(shapes.map((shape) => shape.id))
      const next = previous.filter((entry) => shapeIdSet.has(entry.shapeId))
      return next.length === previous.length ? previous : next
    })
  }, [shapes, setSeamAllowances])

  useEffect(() => {
    setConstraints((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const shapeIdSet = new Set(shapes.map((shape) => shape.id))
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      const next = previous.filter((entry) => {
        if (!shapeIdSet.has(entry.shapeId)) {
          return false
        }
        if (entry.type === 'edge-offset') {
          return layerIdSet.has(entry.referenceLayerId)
        }
        return shapeIdSet.has(entry.referenceShapeId)
      })
      return next.length === previous.length ? previous : next
    })
  }, [shapes, layers, setConstraints])

  useEffect(() => {
    setStitchHoles((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const shapeIdSet = new Set(shapes.map((shape) => shape.id))
      const next = previous.filter((stitchHole) => shapeIdSet.has(stitchHole.shapeId))
      return next.length === previous.length ? previous : next
    })
  }, [shapes, setStitchHoles])

  useEffect(() => {
    setSelectedStitchHoleId((previous) => {
      if (!previous) {
        return previous
      }
      return stitchHoles.some((stitchHole) => stitchHole.id === previous) ? previous : null
    })
  }, [stitchHoles, setSelectedStitchHoleId])

  useEffect(() => {
    setSelectedHardwareMarkerId((previous) => {
      if (!previous) {
        return previous
      }
      return hardwareMarkers.some((marker) => marker.id === previous) ? previous : null
    })
  }, [hardwareMarkers, setSelectedHardwareMarkerId])

  useEffect(() => {
    setSketchGroups((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      const next = previous.filter((group) => layerIdSet.has(group.layerId))
      return next.length === previous.length ? previous : next
    })
  }, [layers, setSketchGroups])

  useEffect(() => {
    setHardwareMarkers((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      const groupIdSet = new Set(sketchGroups.map((group) => group.id))
      const next = previous.filter((marker) => {
        if (!layerIdSet.has(marker.layerId)) {
          return false
        }
        if (!marker.groupId) {
          return true
        }
        return groupIdSet.has(marker.groupId)
      })
      return next.length === previous.length ? previous : next
    })
  }, [layers, sketchGroups, setHardwareMarkers])

  useEffect(() => {
    setLayerColorOverrides((previous) => {
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      let changed = false
      const next: Record<string, string> = {}

      for (const [layerId, color] of Object.entries(previous)) {
        if (layerIdSet.has(layerId)) {
          next[layerId] = color
        } else {
          changed = true
        }
      }

      return changed ? next : previous
    })
  }, [layers, setLayerColorOverrides])

  useEffect(() => {
    setActiveTracingOverlayId((previous) => {
      if (!previous) {
        return tracingOverlays[0]?.id ?? null
      }
      return tracingOverlays.some((overlay) => overlay.id === previous) ? previous : tracingOverlays[0]?.id ?? null
    })
  }, [tracingOverlays, setActiveTracingOverlayId])

  useEffect(() => {
    setSelectedTemplateEntryId((previous) => {
      if (!previous) {
        return templateRepository[0]?.id ?? null
      }
      return templateRepository.some((entry) => entry.id === previous) ? previous : templateRepository[0]?.id ?? null
    })
  }, [templateRepository, setSelectedTemplateEntryId])

  useEffect(() => {
    saveTemplateRepository(templateRepository)
  }, [templateRepository])

  useEffect(() => {
    const objectUrls = new Set(
      tracingOverlays
        .filter((overlay) => overlay.isObjectUrl)
        .map((overlay) => overlay.sourceUrl),
    )

    tracingObjectUrlsRef.current.forEach((url) => {
      if (!objectUrls.has(url)) {
        URL.revokeObjectURL(url)
      }
    })
    tracingObjectUrlsRef.current = objectUrls
  }, [tracingOverlays, tracingObjectUrlsRef])

  useEffect(
    () => () => {
      tracingObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      tracingObjectUrlsRef.current.clear()
    },
    [tracingObjectUrlsRef],
  )

  useEffect(() => {
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false
      lastSnapshotRef.current = deepClone(currentSnapshot)
      lastSnapshotSignatureRef.current = currentSnapshotSignature
      return
    }

    if (!lastSnapshotSignatureRef.current || !lastSnapshotRef.current) {
      lastSnapshotRef.current = deepClone(currentSnapshot)
      lastSnapshotSignatureRef.current = currentSnapshotSignature
      return
    }

    if (lastSnapshotSignatureRef.current === currentSnapshotSignature) {
      return
    }

    setHistoryState((previousHistory) =>
      pushHistorySnapshot(previousHistory, lastSnapshotRef.current as EditorSnapshot, HISTORY_LIMIT),
    )
    lastSnapshotRef.current = deepClone(currentSnapshot)
    lastSnapshotSignatureRef.current = currentSnapshotSignature
  }, [
    applyingHistoryRef,
    currentSnapshot,
    currentSnapshotSignature,
    lastSnapshotRef,
    lastSnapshotSignatureRef,
    setHistoryState,
  ])
}
