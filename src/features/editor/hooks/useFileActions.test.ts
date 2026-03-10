import { describe, expect, it } from 'vitest'
import { resolveDocumentNameFromFileName } from './useFileActions'

describe('resolveDocumentNameFromFileName', () => {
  it('strips the final extension from a file name', () => {
    expect(resolveDocumentNameFromFileName('yubikey-5-nfc-leather-sheath.lcc')).toBe('yubikey-5-nfc-leather-sheath')
  })

  it('returns null for a blank file name', () => {
    expect(resolveDocumentNameFromFileName('   ')).toBeNull()
  })

  it('keeps the base name when multiple dots are present', () => {
    expect(resolveDocumentNameFromFileName('wallet.v2.template.json')).toBe('wallet.v2.template')
  })
})
