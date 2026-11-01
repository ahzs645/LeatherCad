import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import type { PrinterFitCalibrationDownload } from '../io/manufacturing/manufacturing-calibration'
import { PRINTER_FIT_CALIBRATION_CHECKLIST } from '../io/manufacturing/manufacturing-calibration-manifest'

const CALIBRATION_ERRORS = {
  download: 'Could not download calibration files. Check your browser download settings and try again.',
  unsupported: 'This browser does not support background manufacturing generation.',
  invalid: 'Could not prepare the fit gauge. Try again or download the measurement checklist.',
  load: 'The fit calibration could not load. Reload the page and try again.',
  timeout: 'Fit calibration exceeded 30 seconds. Reload the page and try again.',
  start: 'Could not start fit calibration. Reload the page or try another browser.',
} as const

function downloadCalibration(content: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  try {
    const link = document.createElement('a')
    link.href = url; link.download = filename; link.click()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }
}

/** A separate fixed test piece; this component never receives the current drawing. */
export function StlCalibrationDownload() {
  const t = useTranslate()
  const [packet, setPacket] = useState<PrinterFitCalibrationDownload | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const lifetime = useRef<{ active: boolean; generation: number; worker?: Worker; timeout?: number }>({ active: true, generation: 0 })
  useEffect(() => {
    const current = lifetime.current
    current.active = true
    return () => { current.active = false; current.generation++; window.clearTimeout(current.timeout); current.worker?.terminate() }
  }, [])
  const download = (content: string, mime: string, filename: string) => {
    try { downloadCalibration(content, mime, filename) }
    catch { setError(CALIBRATION_ERRORS.download) }
  }
  const downloadGauge = () => {
    setError('')
    if (packet) { download(packet.content, 'model/stl', 'leathercad-printer-fit-gauge.stl'); return }
    if (typeof Worker === 'undefined') { setError(CALIBRATION_ERRORS.unsupported); return }
    const current = lifetime.current, generation = ++current.generation
    window.clearTimeout(current.timeout); current.worker?.terminate()
    setPending(true)
    let settled = false
    const finish = (calibration: PrinterFitCalibrationDownload | null, failure = '') => {
      if (settled || !current.active || generation !== current.generation) return
      settled = true
      window.clearTimeout(current.timeout); current.worker?.terminate(); current.worker = undefined
      setPending(false)
      if (!calibration) { setError(failure || CALIBRATION_ERRORS.invalid); return }
      setPacket(calibration)
      download(calibration.content, 'model/stl', 'leathercad-printer-fit-gauge.stl')
    }
    try {
      const worker = new Worker(new URL('../io/manufacturing/printer-calibration.worker.ts', import.meta.url), { type: 'module' })
      current.worker = worker
      worker.onmessage = (event: MessageEvent<{ calibration?: PrinterFitCalibrationDownload; error?: string }>) => {
        const calibration = event.data?.calibration
        finish(calibration && typeof calibration.content === 'string' && calibration.content.trim() ? calibration : null, event.data?.error)
      }
      worker.onerror = () => finish(null, CALIBRATION_ERRORS.load)
      current.timeout = window.setTimeout(() => finish(null, CALIBRATION_ERRORS.timeout), 30_000)
      worker.postMessage({})
    } catch { finish(null, CALIBRATION_ERRORS.start) }
  }
  return <section className="control-block" aria-labelledby="printer-fit-calibration-title">
    <h4 id="printer-fit-calibration-title">{t('Printer fit calibration')}</h4>
    <p className="hint">{t('The gauge includes nominal holes, pocket clearances, a matching plug and a 20 mm measurement bar. Physical printing has not been verified.')}</p>
    <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
      <button type="button" disabled={pending} aria-busy={pending} onClick={downloadGauge}>{t('Download fit gauge STL')}</button>
      <button type="button" onClick={() => { setError(''); download(PRINTER_FIT_CALIBRATION_CHECKLIST, 'text/plain;charset=utf-8', 'leathercad-printer-fit-checklist.txt') }}>{t('Download measurement checklist')}</button>
    </div>
    {pending ? <p role="status">{t('Preparing fit gauge…')}</p> : null}
    {error ? <p role="alert">{t(error)}</p> : null}
  </section>
}
