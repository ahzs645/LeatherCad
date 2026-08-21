import { describe, expect, it } from 'vitest'
import type { ThreePreviewSettings } from '../cad/cad-types'
import { isOnlyScrubChange } from './three-bridge'

function previewSettings(overrides: Partial<ThreePreviewSettings> = {}): ThreePreviewSettings {
  return {
    mode: 'final',
    explodedFactor: 0.35,
    finalFoldProgress: 1,
    finalFoldCamera: 'orbit',
    thicknessMm: 1.8,
    showSeams: true,
    showEdgeLabels: false,
    showStressOverlay: true,
    usePhysicsRelaxation: true,
    ...overrides,
  }
}

describe('isOnlyScrubChange', () => {
  it('detects progress-only updates so the bridge can preserve the camera', () => {
    expect(isOnlyScrubChange(previewSettings(), previewSettings({ finalFoldProgress: 0.42 }))).toBe(true)
  })

  it('treats the sew scrubber the same way', () => {
    expect(isOnlyScrubChange(previewSettings(), previewSettings({ sewnStitchCount: 12 }))).toBe(true)
    expect(
      isOnlyScrubChange(previewSettings({ sewnStitchCount: 12 }), previewSettings({ sewnStitchCount: 40 })),
    ).toBe(true)
  })

  it('does not suppress fitting when the final camera preset changes', () => {
    expect(isOnlyScrubChange(
      previewSettings(),
      previewSettings({ finalFoldProgress: 0, finalFoldCamera: 'pattern' }),
    )).toBe(false)
  })

  it('does not suppress fitting when a scrub rides along with a real change', () => {
    expect(
      isOnlyScrubChange(previewSettings(), previewSettings({ sewnStitchCount: 12, explodedFactor: 1.2 })),
    ).toBe(false)
  })

  it('is not a change at all when nothing moved', () => {
    expect(isOnlyScrubChange(previewSettings(), previewSettings())).toBe(false)
  })
})
