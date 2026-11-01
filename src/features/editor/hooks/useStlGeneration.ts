import { useEffect, useState } from 'react'
import type { DocFile } from '../cad/cad-types'
import type { StlExportOptions, StlExportResult } from '../io/io-stl'
import type { ManufacturingFace } from '../io/manufacturing/manufacturing-regions'

type GenerationState = { doc: DocFile; options: Partial<StlExportOptions>; fontBuffer?: ArrayBuffer; result: StlExportResult | null; error: string; faces: ManufacturingFace[]; faceScope: string }

function faceScope(doc: DocFile, options: Partial<StlExportOptions>) {
  const settings = { ...doc.manufacturing, ...options }
  return JSON.stringify({ mode: settings.mode, tolerance: settings.toleranceMm, roles: settings.targetRoles?.slice().sort(),
    outer: settings.jigOuterMode, width: settings.jigWidthMm, height: settings.jigHeightMm, margin: settings.jigMarginMm,
    clearance: settings.jigClearanceMm, selection: options.selectedShapeIds ? [...options.selectedShapeIds].sort() : null })
}
function sameDrawing(a: DocFile, b: DocFile) {
  return a.objects === b.objects && a.layers === b.layers && a.lineTypes === b.lineTypes && a.sketchGroups === b.sketchGroups
}

/** A fresh worker per request makes cancelling stale CPU work effective, including during a large Boolean. */
export function useStlGeneration(doc: DocFile, options: Partial<StlExportOptions>, enabled: boolean, fontBuffer?: ArrayBuffer) {
  const [state, setState] = useState<GenerationState | null>(null)
  useEffect(() => {
    if (!enabled) return
    if (typeof Worker === 'undefined') return
    const generation: { worker?: Worker; timeout?: number } = {}
    let active = true
    const finish = (result: StlExportResult | null, error = '') => {
      if (!active) return
      window.clearTimeout(generation.timeout)
      setState((previous) => ({ doc, options, fontBuffer, result, error, faceScope: faceScope(doc, options),
        faces: result?.faces ?? (previous && sameDrawing(previous.doc, doc) && previous.faceScope === faceScope(doc, options) ? previous.faces : []) }))
      active = false; generation.worker?.terminate()
    }
    try {
      const worker = new Worker(new URL('../io/manufacturing/manufacturing.worker.ts', import.meta.url), { type: 'module' })
      generation.worker = worker
      worker.onmessage = (event: MessageEvent<{ result?: StlExportResult; error?: string }>) => finish(event.data.result ?? null, event.data.error)
      worker.onerror = () => finish(null, 'The manufacturing worker could not load. Save the drawing, then reload to try again.')
      generation.timeout = window.setTimeout(() => finish(null, 'Manufacturing generation exceeded 30 seconds. Export fewer shapes or increase the curve tolerance.'), 30_000)
      // Avoid cloning the same embedded base64 font a second time with its binary bytes.
      const workerDoc = fontBuffer && doc.manufacturing ? { ...doc, manufacturing: { ...doc.manufacturing, engravingFont: undefined } } : doc
      worker.postMessage({ doc: workerDoc, options, fontBuffer })
    } catch {
      generation.worker?.terminate(); window.clearTimeout(generation.timeout)
      queueMicrotask(() => finish(null, 'Could not start background manufacturing. Save the drawing, then try reloading or another browser.'))
    }
    return () => { active = false; window.clearTimeout(generation.timeout); generation.worker?.terminate() }
  }, [doc, options, enabled, fontBuffer])
  if (!enabled) return { result: null, error: '', pending: false, faces: [] }
  if (typeof Worker === 'undefined') return { result: null, error: 'This browser does not support background manufacturing generation.', pending: false, faces: [] }
  const current = state?.doc === doc && state.options === options && state.fontBuffer === fontBuffer
  const sameFaces = state && sameDrawing(state.doc, doc) && state.faceScope === faceScope(doc, options)
  return { result: current ? state.result : null, error: current ? state.error : '', pending: !current, faces: sameFaces ? state.faces : [] }
}
