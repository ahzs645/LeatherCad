import { buildStlExport } from '../io-stl'
import { loadFontFromBuffer } from '../../ops/opentype-ops'
import type { DocFile } from '../../cad/cad-types'
import type { StlExportOptions } from '../io-stl'

self.onmessage = (event: MessageEvent<{ doc: DocFile; options: Partial<StlExportOptions>; fontBuffer?: ArrayBuffer }>) => {
  try {
    const { doc, options, fontBuffer } = event.data
    if (fontBuffer) loadFontFromBuffer(fontBuffer, 'manufacturing-engraving')
    const result = buildStlExport(doc, { ...options, engravingFontKey: fontBuffer ? 'manufacturing-engraving' : undefined })
    self.postMessage({ result })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not generate manufacturing geometry.' })
  }
}
