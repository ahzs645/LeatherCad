export type ManufacturingFontData = { name: string; dataUrl: string }
export const MAX_MANUFACTURING_FONT_BYTES = 4 * 1024 * 1024

export function parseManufacturingFontData(value: unknown): ManufacturingFontData {
  if (!value || typeof value !== 'object') throw new Error('Invalid embedded manufacturing font.')
  const font = value as Record<string, unknown>
  if (typeof font.name !== 'string' || !font.name.trim() || font.name.length > 200 || typeof font.dataUrl !== 'string') throw new Error('Invalid embedded manufacturing font name or data.')
  if (font.dataUrl.length > Math.ceil(MAX_MANUFACTURING_FONT_BYTES / 3) * 4 + 80) throw new Error('Embedded manufacturing fonts must be no larger than 4 MB.')
  const match = /^data:font\/(ttf|otf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(font.dataUrl)
  if (!match || match[2].length % 4 !== 0) throw new Error('The embedded manufacturing font must be a base64 TTF or OTF file.')
  let bytes: string
  try { bytes = atob(match[2]) } catch { throw new Error('The embedded manufacturing font has invalid base64 data.') }
  if (bytes.length > MAX_MANUFACTURING_FONT_BYTES) throw new Error('Embedded manufacturing fonts must be no larger than 4 MB.')
  const sfnt = bytes.slice(0, 4)
  if (bytes.length < 12 || !(sfnt === 'OTTO' || sfnt === '\u0000\u0001\u0000\u0000' || sfnt === 'true')) throw new Error('The embedded manufacturing font has no supported OpenType/TrueType signature.')
  return { name: font.name, dataUrl: font.dataUrl }
}

export function manufacturingFontBuffer(font: ManufacturingFontData): ArrayBuffer {
  const valid = parseManufacturingFontData(font)
  const raw = atob(valid.dataUrl.slice(valid.dataUrl.indexOf(',') + 1))
  return Uint8Array.from(raw, (character) => character.charCodeAt(0)).buffer
}

export function embedManufacturingFont(name: string, buffer: ArrayBuffer): ManufacturingFontData {
  if (buffer.byteLength > MAX_MANUFACTURING_FONT_BYTES) throw new Error('Choose an engraving font no larger than 4 MB.')
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  const mime = binary.slice(0, 4) === 'OTTO' ? 'otf' : 'ttf'
  let boundedName = ''
  for (const character of name.trim() || 'engraving.ttf') { if (boundedName.length + character.length > 200) break; boundedName += character }
  return parseManufacturingFontData({ name: boundedName, dataUrl: `data:font/${mime};base64,${btoa(binary)}` })
}
