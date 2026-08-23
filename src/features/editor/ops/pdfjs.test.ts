import { describe, expect, it } from 'vitest'
import { getDocument, OPS } from './pdfjs'

describe('the pdf.js build the app talks to', () => {
  it('brings the polyfills the default build assumes the browser has', async () => {
    // The default build calls `Map.prototype.getOrInsertComputed`, which no
    // released browser has, and every page render goes through it. Importing
    // this module has to be enough to make that method exist — if this fails,
    // `getOperatorList` throws in the browser and every PDF feature is dead.
    // Not in TypeScript's lib yet, which is the point: it is a proposal.
    const mapProto = Map.prototype as unknown as Record<string, unknown>
    const weakMapProto = WeakMap.prototype as unknown as Record<string, unknown>
    expect(typeof mapProto.getOrInsertComputed).toBe('function')
    expect(typeof weakMapProto.getOrInsertComputed).toBe('function')
  })

  it('exposes the operator codes the vector reader decodes against', () => {
    expect(OPS.constructPath).toBeTypeOf('number')
    expect(OPS.stroke).toBeTypeOf('number')
    expect(OPS.fill).toBeTypeOf('number')
    expect(getDocument).toBeTypeOf('function')
  })
})
