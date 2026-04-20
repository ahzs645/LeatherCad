import { describe, it, expect } from 'vitest'
import { importRepositoryZip, readZipEntries } from './io-repository-zip'

function u16(value: number) {
  return [value & 0xff, (value >> 8) & 0xff]
}
function u32(value: number) {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]
}

function concatBytes(chunks: Array<Uint8Array | number[]>): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk), offset)
    offset += chunk.length
  }
  return out
}

/**
 * Build a minimal ZIP with a single stored (uncompressed) entry. Good enough
 * to prove the reader walks the central directory correctly.
 */
function buildSingleEntryZip(name: string, contents: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name)
  const localHeader = concatBytes([
    u32(0x04034b50), // local file header signature
    u16(20), // version needed
    u16(0), // flags
    u16(0), // method = stored
    u16(0), // mod time
    u16(0), // mod date
    u32(0), // crc32 (skipped; most parsers accept 0 for stored)
    u32(contents.length), // compressed size
    u32(contents.length), // uncompressed size
    u16(nameBytes.length), // file name length
    u16(0), // extra length
    Array.from(nameBytes),
    Array.from(contents),
  ])
  const cd = concatBytes([
    u32(0x02014b50),
    u16(20), // version made by
    u16(20), // version needed
    u16(0), // flags
    u16(0), // method
    u16(0),
    u16(0),
    u32(0),
    u32(contents.length),
    u32(contents.length),
    u16(nameBytes.length),
    u16(0), // extra
    u16(0), // comment
    u16(0), // disk number start
    u16(0), // internal attrs
    u32(0), // external attrs
    u32(0), // local header offset
    Array.from(nameBytes),
  ])
  const eocd = concatBytes([
    u32(0x06054b50),
    u16(0), // disk
    u16(0), // cd disk
    u16(1), // entries on disk
    u16(1), // total entries
    u32(cd.length), // cd size
    u32(localHeader.length), // cd offset
    u16(0), // comment length
  ])
  return concatBytes([localHeader, cd, eocd])
}

describe('readZipEntries', () => {
  it('reads a stored entry and returns its bytes', async () => {
    const payload = new TextEncoder().encode('hello, world')
    const zip = buildSingleEntryZip('hello.txt', payload)
    const entries = await readZipEntries(zip)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('hello.txt')
    expect(new TextDecoder().decode(entries[0].data)).toBe('hello, world')
  })

  it('throws on non-ZIP bytes', async () => {
    await expect(readZipEntries(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/ZIP/)
  })
})

describe('importRepositoryZip', () => {
  it('skips unrecognized entries and reports them', async () => {
    const zip = buildSingleEntryZip('readme.txt', new TextEncoder().encode('not a template'))
    const result = await importRepositoryZip(zip)
    expect(result.entries).toHaveLength(0)
    expect(result.skipped).toEqual([{ name: 'readme.txt', reason: 'unsupported entry type' }])
  })
})
