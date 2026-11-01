import { buildPrinterFitCalibration } from './manufacturing-calibration'

self.onmessage = () => {
  try {
    const { content, checklist, manifest } = buildPrinterFitCalibration()
    self.postMessage({ calibration: { content, checklist, manifest } })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not generate the printer fit gauge.' })
  }
}
