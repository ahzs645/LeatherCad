import { describe, expect, it } from 'vitest'
import type { ThreePreviewSettings } from '../cad/cad-types'
import { isOnlyFinalFoldProgressChange } from './three-bridge'

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

describe('isOnlyFinalFoldProgressChange', () => {
  it('detects progress-only updates so the bridge can preserve the camera', () => {
    expect(isOnlyFinalFoldProgressChange(previewSettings(), previewSettings({ finalFoldProgress: 0.42 }))).toBe(true)
  })

  it('does not suppress fitting when the final camera preset changes', () => {
    expect(isOnlyFinalFoldProgressChange(
      previewSettings(),
      previewSettings({ finalFoldProgress: 0, finalFoldCamera: 'pattern' }),
    )).toBe(false)
  })
})
