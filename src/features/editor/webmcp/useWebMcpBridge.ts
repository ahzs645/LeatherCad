/**
 * Registering LeatherCad's tools with the browser's model context.
 *
 * Registration happens once, on mount, and is torn down by aborting the signal
 * the spec takes for exactly that purpose. The tools themselves close over a
 * ref rather than over render-time state, so a tool called ten minutes later
 * still reads the document as it is now.
 *
 * The one subtlety is ordering. An agent can call two tools back to back
 * faster than React re-renders, and the second call would otherwise read the
 * document as it was before the first one wrote. So a write parks its result in
 * `docOverrideRef`, reads prefer that over the rendered state, and the override
 * clears as soon as a render comes back carrying the shapes it was holding.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { compileAiBuilderDocument } from '../ai-builder/ai-builder-compile'
import { uid } from '../cad/cad-geometry'
import { createDefaultLineTypes, DEFAULT_ACTIVE_LINE_TYPE_ID } from '../cad/line-types'
import { createDefaultLayer } from '../editor-utils'
import type { AiBuilderDocumentV1 } from '../ai-builder/ai-builder-types'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import type {
  DocFile,
  FoldLine,
  HardwareMarker,
  Layer,
  PatternPiece,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  StitchHole,
} from '../cad/cad-types'
import { getModelContext } from './webmcp-api'
import type { ApplyOutcome, ExportFormat, WebMcpBridge } from './webmcp-bridge-types'
import { isPieceSeamAllowance, mergeCompiledDocument } from './webmcp-merge'
import { buildWebMcpTools, WEBMCP_TOOL_NAMES } from './webmcp-tools'

export type WebMcpExportHandlers = Record<ExportFormat, () => void>

export type UseWebMcpBridgeParams = {
  buildCurrentDocFile: () => DocFile
  applyLoadedDocument: (doc: DocFile, statusMessage: string) => void
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setPatternPieces: Dispatch<SetStateAction<PatternPiece[]>>
  setSeamAllowances: Dispatch<SetStateAction<PieceSeamAllowance[]>>
  setSeamConnections: Dispatch<SetStateAction<SeamConnection[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setDocumentName: Dispatch<SetStateAction<string | null>>
  setStatus: Dispatch<SetStateAction<string>>
  handleUndo: () => void
  /** Zoom the canvas to the geometry on it. Called after an agent writes. */
  fitView: () => void
  exportHandlers: WebMcpExportHandlers
}

export type WebMcpBridgeState = {
  /** Whether this browser exposes `document.modelContext` at all. */
  supported: boolean
  registered: boolean
  toolNames: string[]
  error: string | null
}

function summarizeApply(
  label: string,
  merged: ReturnType<typeof mergeCompiledDocument>,
  before: { shapes: number; stitchHoles: number },
): Pick<ApplyOutcome, 'message' | 'insertedPieceIds' | 'insertedShapeCount' | 'insertedStitchHoleCount'> {
  return {
    message: `${label}: ${merged.insertedShapeIds.length} shape(s), ${merged.insertedPieceIds.length} piece(s), ${merged.stitchHoles.length - before.stitchHoles} stitch hole(s).`,
    insertedPieceIds: merged.insertedPieceIds,
    insertedShapeCount: merged.shapes.length - before.shapes,
    insertedStitchHoleCount: merged.stitchHoles.length - before.stitchHoles,
  }
}

export function useWebMcpBridge(params: UseWebMcpBridgeParams): WebMcpBridgeState {
  const paramsRef = useRef(params)
  // Kept current in an effect rather than during render: the tools read it
  // from callbacks the browser invokes, never from a render pass.
  useEffect(() => {
    paramsRef.current = params
  })

  const docOverrideRef = useRef<DocFile | null>(null)
  // An agent that draws off-screen has not shown the user anything, so a write
  // asks for a fit. It cannot happen at write time: fitting reads the shapes
  // the canvas is currently rendering, which are still the ones from before.
  const fitPendingRef = useRef(false)
  // Read once, lazily: whether this browser has a model context is a fact
  // about the page, not something that changes under us.
  const [supported] = useState(() => getModelContext() !== null)
  const [registration, setRegistration] = useState<{ registered: boolean; error: string | null }>({
    registered: false,
    error: null,
  })

  // Clear the write-ahead snapshot once the rendered document has caught up
  // with it, so reads go back to the single source of truth. `buildCurrentDocFile`
  // is memoised on the document's own state, so its identity changing is exactly
  // the signal that a write has landed.
  const buildCurrentDocFile = params.buildCurrentDocFile
  useEffect(() => {
    if (fitPendingRef.current) {
      fitPendingRef.current = false
      paramsRef.current.fitView()
    }

    const override = docOverrideRef.current
    if (!override) {
      return
    }
    const renderedShapeIds = new Set(buildCurrentDocFile().objects.map((shape) => shape.id))
    if (override.objects.every((shape) => renderedShapeIds.has(shape.id))) {
      docOverrideRef.current = null
    }
  }, [buildCurrentDocFile])

  const bridge = useMemo<WebMcpBridge>(() => {
    const readDoc = () => docOverrideRef.current ?? paramsRef.current.buildCurrentDocFile()

    const merge = (document: AiBuilderDocumentV1, label: string): ApplyOutcome => {
      const compiled = compileAiBuilderDocument(document)
      const current = readDoc()
      const merged = mergeCompiledDocument(
        {
          layers: current.layers,
          shapes: current.objects,
          foldLines: current.foldLines,
          stitchHoles: current.stitchHoles ?? [],
          patternPieces: current.patternPieces ?? [],
          seamAllowances: (current.seamAllowances ?? []).filter(isPieceSeamAllowance),
          seamConnections: current.seamConnections ?? [],
          hardwareMarkers: current.hardwareMarkers ?? [],
        },
        compiled.doc,
      )

      const stitchHoles = normalizeStitchHoleSequences(merged.stitchHoles)
      const nextDoc: DocFile = {
        ...current,
        layers: merged.layers,
        objects: merged.shapes,
        foldLines: merged.foldLines,
        stitchHoles,
        patternPieces: merged.patternPieces,
        seamAllowances: merged.seamAllowances,
        seamConnections: merged.seamConnections,
        hardwareMarkers: merged.hardwareMarkers,
        activeLayerId: merged.activeLayerId ?? current.activeLayerId,
      }
      docOverrideRef.current = nextDoc
      fitPendingRef.current = true

      const api = paramsRef.current
      api.setLayers(merged.layers)
      api.setShapes(merged.shapes)
      api.setFoldLines(merged.foldLines)
      api.setStitchHoles(stitchHoles)
      api.setPatternPieces(merged.patternPieces)
      api.setSeamAllowances(merged.seamAllowances)
      api.setSeamConnections(merged.seamConnections)
      api.setHardwareMarkers(merged.hardwareMarkers)
      api.setSelectedShapeIds(merged.insertedShapeIds)
      if (merged.activeLayerId) {
        api.setActiveLayerId(merged.activeLayerId)
      }

      const summary = summarizeApply(label, merged, {
        shapes: current.objects.length,
        stitchHoles: (current.stitchHoles ?? []).length,
      })
      api.setStatus(`Agent: ${summary.message}`)

      return {
        ok: true,
        ...summary,
        preflight: compiled.preflight,
      }
    }

    return {
      getDocument: readDoc,
      applyDocument: merge,
      replaceDocument: (document, label) => {
        const compiled = compileAiBuilderDocument(document)
        const next: DocFile = { ...compiled.doc, documentName: document.document_name }
        docOverrideRef.current = next
        fitPendingRef.current = true
        paramsRef.current.applyLoadedDocument(next, `Agent: ${label}`)
        return {
          ok: true,
          message: `${label}: replaced the document with ${next.objects.length} shape(s) and ${(next.patternPieces ?? []).length} piece(s).`,
          preflight: compiled.preflight,
          insertedPieceIds: (next.patternPieces ?? []).map((piece) => piece.id),
          insertedShapeCount: next.objects.length,
          insertedStitchHoleCount: (next.stitchHoles ?? []).length,
        }
      },
      clearDocument: () => {
        const layer = createDefaultLayer(uid())
        const lineTypes = createDefaultLineTypes()
        const empty: DocFile = {
          version: 1,
          units: 'mm',
          layers: [layer],
          activeLayerId: layer.id,
          lineTypes,
          activeLineTypeId: DEFAULT_ACTIVE_LINE_TYPE_ID,
          objects: [],
          foldLines: [],
          stitchHoles: [],
          patternPieces: [],
          seamAllowances: [],
          seamConnections: [],
          hardwareMarkers: [],
        }
        docOverrideRef.current = empty
        paramsRef.current.applyLoadedDocument(empty, 'Agent: cleared the document')
      },
      renameDocument: (name) => {
        paramsRef.current.setDocumentName(name)
        paramsRef.current.setStatus(`Agent renamed the document to "${name}"`)
      },
      selectPieces: (pieceIds) => {
        const doc = readDoc()
        const wanted = new Set(pieceIds)
        const shapeIds = (doc.patternPieces ?? [])
          .filter((piece) => wanted.has(piece.id))
          .flatMap((piece) => [piece.boundaryShapeId, ...piece.internalShapeIds])
        paramsRef.current.setSelectedShapeIds(shapeIds)
        fitPendingRef.current = true
        paramsRef.current.setStatus(`Agent highlighted ${wanted.size} piece(s)`)
        return shapeIds.length
      },
      undo: () => {
        docOverrideRef.current = null
        fitPendingRef.current = true
        paramsRef.current.handleUndo()
      },
      exportDocument: (format) => {
        const handler = paramsRef.current.exportHandlers[format]
        if (!handler) {
          return { ok: false, message: `No exporter is wired up for "${format}".` }
        }
        handler()
        return { ok: true, message: `Started a ${format.toUpperCase()} download.` }
      },
      setStatus: (message) => paramsRef.current.setStatus(message),
    }
  }, [])

  useEffect(() => {
    const modelContext = getModelContext()
    if (!modelContext) {
      return
    }

    const tools = buildWebMcpTools(bridge)
    const controller = new AbortController()
    let cancelled = false

    // `registerTool` may or may not return a promise depending on the
    // implementation, and may reject or throw outright; the async wrapper makes
    // all three arrive at the same catch instead of escaping the effect.
    Promise.all(
      tools.map(async (tool) => modelContext.registerTool(tool, { signal: controller.signal })),
    )
      .then(() => {
        if (!cancelled) {
          setRegistration({ registered: true, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRegistration({
            registered: false,
            error: error instanceof Error ? error.message : 'Tool registration failed.',
          })
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [bridge])

  return useMemo(
    () => ({
      supported,
      registered: registration.registered,
      toolNames: [...WEBMCP_TOOL_NAMES],
      error: registration.error,
    }),
    [supported, registration],
  )
}
