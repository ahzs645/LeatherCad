import { useLayoutEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import type { Layer, LineType, Shape } from '../cad/cad-types'
import type { DxfImportOptions, DxfImportResult } from '../io/io-dxf-import'

type Setter<T> = Dispatch<SetStateAction<T>>
export type DxfImportActionsParams = {
  setLayers: Setter<Layer[]>
  setLineTypes: Setter<LineType[]>
  setShapes: Setter<Shape[]>
  setSelectedShapeIds: Setter<string[]>
  setStatus: Setter<string>
  /** Change this when replacing the open document without closing the importer. */
  importSessionKey?: string | readonly Shape[] | null
  onImported?: (result: DxfImportResult) => void
}
type Feedback = { kind: 'success' | 'error'; message: string; warnings: string[] }
type SessionState = { sessionKey: DxfImportActionsParams['importSessionKey']; pending: boolean; feedback: Feedback | null }

export function useDxfImportActions(params: DxfImportActionsParams) {
  const inputRef = useRef<HTMLInputElement>(null)
  const lifetime = useRef<{ requestId: number; active: boolean }>({ requestId: 0, active: false })
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
    return () => { current.active = false; current.requestId++ }
  }, [params.importSessionKey])

  const handleImportDxf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || isImporting) return
    const current = lifetime.current
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
      const { importDxfDocument } = await import('../io/io-dxf-import')
      if (!isCurrent()) return
      result = importDxfDocument(raw, { units })
    } catch (error) {
      publish({ kind: 'error', message: `DXF import failed: ${error instanceof Error ? error.message : 'unknown error'}`, warnings: [] })
      return
    }
    if (!isCurrent()) return
    // Parse completely before mutating any document state. Appending preserves
    // the user's current document and every imported source layer/style.
    params.setLayers((previous) => [...previous, ...result.layers])
    params.setLineTypes((previous) => [...previous, ...result.lineTypes])
    params.setShapes((previous) => [...previous, ...result.shapes])
    params.setSelectedShapeIds(result.shapes.map((shape) => shape.id))
    publish({ kind: 'success', message: `Imported ${result.summary.shapeCount} DXF shapes on ${result.summary.layerCount} layers`, warnings: result.warnings })
    params.onImported?.(result)
  }
  return { inputRef, units, setUnits, isImporting, feedback, handleImportDxf, openImportDxf: () => inputRef.current?.click() }
}
