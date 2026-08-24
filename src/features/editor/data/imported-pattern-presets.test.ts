import { describe, expect, it } from 'vitest'
import { PRESET_META } from './sample-doc-meta'
import { PRESET_DOCS } from './sample-doc'
import { IMPORTED_PATTERN_PRESETS, MAKESUPPLY_KEYCHAIN_SNAP_WALLET_ID } from './imported-pattern-presets'

function walletPreset() {
  const preset = PRESET_DOCS.find((entry) => entry.id === MAKESUPPLY_KEYCHAIN_SNAP_WALLET_ID)
  expect(preset).toBeDefined()
  return preset!
}

describe('the imported wallet preset', () => {
  it('reaches the preset list the Load Preset button reads', () => {
    expect(IMPORTED_PATTERN_PRESETS).toHaveLength(1)
    expect(walletPreset().label).toBe('Keychain Snap Wallet (imported)')
  })

  it('carries the three pieces the sheet was separated into', () => {
    const pieces = walletPreset().doc.patternPieces ?? []
    expect(pieces.map((piece) => piece.name)).toEqual([
      'MAIN BODY PANEL',
      'CARD SLOT PANEL',
      'KEYCHAIN ATTACHMENT',
    ])
  })

  it('keeps the seam the stitch runs were paired into', () => {
    // The pocket is sewn to the body: without this the assembled view has three
    // pieces lying apart rather than a wallet.
    expect(walletPreset().doc.seamConnections ?? []).toHaveLength(1)
    expect((walletPreset().doc.stitchHoles ?? []).length).toBeGreaterThan(80)
  })

  it('keeps its creases attributed to the pieces they bend', () => {
    const doc = walletPreset().doc
    const pieceIds = new Set((doc.patternPieces ?? []).map((piece) => piece.id))
    expect(doc.foldLines.length).toBeGreaterThan(0)
    for (const foldLine of doc.foldLines) {
      expect(pieceIds.has(foldLine.pieceId ?? '')).toBe(true)
    }
  })

  it('opens into the assembled view, which is where an import is worth seeing', () => {
    expect(walletPreset().doc.threePreviewSettings?.mode).toBe('assembled')
  })
})

describe('preset lists', () => {
  // Two hand-maintained lists: the dropdown reads the light one and the loader
  // reads the heavy one, so a preset added to only one either cannot be picked
  // or silently loads something else.
  it('offer exactly the presets that can be loaded', () => {
    expect(PRESET_META.map((preset) => preset.id).sort()).toEqual(
      PRESET_DOCS.map((preset) => preset.id).sort(),
    )
  })

  it('label each preset the same way in both', () => {
    const labelById = new Map(PRESET_DOCS.map((preset) => [preset.id, preset.label]))
    for (const preset of PRESET_META) {
      expect(preset.label).toBe(labelById.get(preset.id))
    }
  })
})
