import { useLayoutEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import type { Layer, LineType, Shape } from '../cad/cad-types'
import type { DxfImportOptions, DxfImportResult } from '../io/io-dxf-import'
import type { DocumentTransferReview } from '../components/DocumentTransferReviewModal'
import { parseDxfFile } from '../io/parse-file-import'

type Setter<T> = Dispatch<SetStateAction<T>>
export type DxfImportActionsParams = {
  setLayers: Setter<Layer[]>
  setLineTypes: Setter<LineType[]>
  setShapes: Setter<Shape[]>
  setSelectedShapeIds: Setter<string[]>
  setStatus: Setter<string>
  /** Change this when replacing the open document without closing the importer. */
  importSessionKey?: string | number | readonly Shape[] | null
  onImported?: (result: DxfImportResult) => void
}
type Feedback = { kind: 'success' | 'error'; message: string; warnings: string[] }
type SessionState = { sessionKey: DxfImportActionsParams['importSessionKey']; pending: boolean; feedback: Feedback | null; review?: DocumentTransferReview }

export function useDxfImportActions(params: DxfImportActionsParams) {
  const inputRef = useRef<HTMLInputElement>(null)
  const lifetime = useRef({ requestId: 0, active: false, controller: new AbortController() })
  const [session, setSession] = useState<SessionState>({ sessionKey: params.importSessionKey, pending: false, feedback: null })
  const [units, setUnits] = useState<NonNullable<DxfImportOptions['units']>>('auto')
  const matchesSession = session.sessionKey === params.importSessionKey
  const isImporting = matchesSession && session.pending
  // Successful feedback remains visible after our own append changes the
  // parent's immutable shapes identity; only in-flight work is session-bound.
  const feedback = session.feedback
  // Invalidate the old operation at commit, before an asynchronous file read
  // can write to a new document or an importer that has been closed.
  useLayoutEffect(() => {
    const current = lifetime.current
    current.active = true
    return () => { current.active = false; current.requestId++; current.controller.abort() }
  }, [params.importSessionKey])

  const handleImportDxf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || isImporting) return
    const current = lifetime.current
    current.controller.abort()
    current.controller = new AbortController()
    const requestId = ++current.requestId
    const isCurrent = () => current.active && current.requestId === requestId
    const publish = (next: Feedback) => {
      if (!isCurrent()) return
      setSession({ sessionKey: params.importSessionKey, pending: false, feedback: next })
      params.setStatus([next.message, ...next.warnings].join(' '))
    }
    if (!file.name.toLowerCase().endsWith('.dxf')) { publish({ kind: 'error', message: 'Choose an ASCII DXF (.dxf) file', warnings: [] }); return }
    if (file.size > 50 * 1024 * 1024) { publish({ kind: 'error', message: 'DXF import failed: file exceeds the 50 MB import limit', warnings: [] }); return }
    setSession({ sessionKey: params.importSessionKey, pending: true, feedback: null })
    let result: DxfImportResult
    try {
      const raw = await file.text()
      if (!isCurrent()) return
      result = await parseDxfFile(raw, file.name, { units }, current.controller.signal)
    } catch (error) {
      publish({ kind: 'error', message: `DXF import failed: ${error instanceof Error ? error.message : 'unknown error'}`, warnings: [] })
      return
    }
    if (!isCurrent()) return
    const close = () => { current.requestId++; current.controller.abort(); setSession({ sessionKey: params.importSessionKey, pending: false, feedback: null }) }
    const review: DocumentTransferReview = {
      fileName: file.name, title: 'Review DXF import', actionLabel: 'Append selected layers',
      summary: [{ label: 'Shapes', value: String(result.summary.shapeCount) }, { label: 'Skipped entities', value: String(result.summary.skippedEntityCount) }, { label: 'Source scale', value: `${result.summary.unitScaleMm} mm / source unit` }, { label: 'Curve tolerance', value: '0.05 mm target' }],
      warnings: result.warnings, shapes: result.shapes,
      layers: result.layers.map(layer => ({ id: layer.id, name: layer.name, count: result.shapes.filter(shape => shape.layerId === layer.id).length })),
      onClose: close,
      onApply: layerIds => {
        if (!isCurrent()) return
        const shapes = result.shapes.filter(shape => !layerIds || layerIds.has(shape.layerId))
        if (!shapes.length) return
        const usedLayers = new Set(shapes.map(shape => shape.layerId)), usedStyles = new Set(shapes.map(shape => shape.lineTypeId))
        const imported = { ...result, shapes, layers: result.layers.filter(layer => usedLayers.has(layer.id)), lineTypes: result.lineTypes.filter(type => usedStyles.has(type.id)), summary: { ...result.summary, shapeCount: shapes.length, layerCount: usedLayers.size } }
        params.setLayers(previous => [...previous, ...imported.layers])
        params.setLineTypes(previous => [...previous, ...imported.lineTypes])
        params.setShapes(previous => [...previous, ...shapes])
        params.setSelectedShapeIds(shapes.map(shape => shape.id))
        publish({ kind: 'success', message: `Imported ${shapes.length} DXF shapes on ${usedLayers.size} layers`, warnings: result.warnings })
        params.onImported?.(imported)
        current.requestId++
      },
    }
    setSession({ sessionKey: params.importSessionKey, pending: false, feedback: null, review })
    params.setStatus(`Review "${file.name}" before appending DXF geometry`)
  }
  return { review: matchesSession ? session.review ?? null : null, inputRef, units, setUnits, isImporting, feedback, handleImportDxf, openImportDxf: () => inputRef.current?.click() }
}
