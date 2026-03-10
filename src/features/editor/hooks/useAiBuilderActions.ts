import type { Dispatch, SetStateAction } from 'react'
import type {
  DocFile,
  FoldLine,
  Layer,
  LineType,
  Shape,
  StitchHole,
} from '../cad/cad-types'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import { insertTemplateDocIntoCurrent } from '../templates/template-repository'

type UseAiBuilderActionsParams = {
  applyLoadedDocument: (doc: DocFile, statusMessage: string) => void
  layers: Layer[]
  lineTypes: LineType[]
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  clearDraft: () => void
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setLineTypes: Dispatch<SetStateAction<LineType[]>>
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setStatus: Dispatch<SetStateAction<string>>
}

function resolveDocumentName(documentName: string) {
  return documentName.trim().length > 0 ? documentName.trim() : 'Untitled AI document'
}

export function useAiBuilderActions(params: UseAiBuilderActionsParams) {
  const {
    applyLoadedDocument,
    layers,
    lineTypes,
    shapes,
    foldLines,
    stitchHoles,
    clearDraft,
    setLayers,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setSelectedShapeIds,
    setActiveLayerId,
    setStatus,
  } = params

  const handleLoadAiBuilderDocument = (doc: DocFile, documentName: string) => {
    const resolvedName = resolveDocumentName(documentName)
    applyLoadedDocument(
      {
        ...doc,
        documentName: resolvedName,
      },
      `Loaded AI Builder document: ${resolvedName} (${doc.objects.length} shapes, ${doc.foldLines.length} folds, ${doc.layers.length} layers)`,
    )
  }

  const handleInsertAiBuilderDocument = (doc: DocFile, documentName: string) => {
    const resolvedName = resolveDocumentName(documentName)
    const inserted = insertTemplateDocIntoCurrent(
      doc,
      layers,
      lineTypes,
      shapes,
      foldLines,
      stitchHoles,
    )
    setLayers(inserted.layers)
    setLineTypes(inserted.lineTypes)
    setActiveLineTypeId(inserted.activeLineTypeId)
    setShapes(inserted.shapes)
    setFoldLines(inserted.foldLines)
    setStitchHoles(normalizeStitchHoleSequences(inserted.stitchHoles))
    setSelectedShapeIds(inserted.insertedShapeIds)
    if (inserted.insertedLayerIds.length > 0) {
      setActiveLayerId(inserted.insertedLayerIds[0])
    }
    clearDraft()
    setStatus(
      `Inserted AI Builder document: ${resolvedName} (${doc.objects.length} shapes, ${doc.foldLines.length} folds, ${doc.layers.length} layers)`,
    )
  }

  return {
    handleLoadAiBuilderDocument,
    handleInsertAiBuilderDocument,
  }
}
