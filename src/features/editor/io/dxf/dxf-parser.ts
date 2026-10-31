export type DxfPair = { code: number; value: string }
export type DxfRecord = { type: string; pairs: DxfPair[] }
export type DxfBlock = { name: string; x: number; y: number; records: DxfRecord[] }
export type ParsedDxf = {
  entities: DxfRecord[]
  blocks: Map<string, DxfBlock>
  layers: DxfRecord[]
  unitCode: number
}

export function dxfValue(record: DxfRecord, code: number): string | undefined {
  return record.pairs.find((pair) => pair.code === code)?.value
}

export function dxfNumber(record: DxfRecord, code: number, fallback = 0): number {
  const raw = dxfValue(record, code)
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric group ${code} in ${record.type}`)
  return value
}

export function dxfPoints(record: DxfRecord, xCode = 10): Array<{ x: number; y: number; bulge: number }> {
  const points: Array<{ x: number; y: number; bulge: number }> = []
  for (const pair of record.pairs) {
    if (pair.code === xCode) points.push({ x: Number(pair.value), y: 0, bulge: 0 })
    else if (pair.code === xCode + 10 && points.length) points[points.length - 1].y = Number(pair.value)
    else if (pair.code === 42 && xCode === 10 && points.length) points[points.length - 1].bulge = Number(pair.value)
  }
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.bulge))) {
    throw new Error(`Invalid coordinate in ${record.type}`)
  }
  return points
}

function recordsFromPairs(pairs: DxfPair[]): DxfRecord[] {
  const records: DxfRecord[] = []
  for (const pair of pairs) {
    if (pair.code === 0) records.push({ type: pair.value.toUpperCase(), pairs: [] })
    else records[records.length - 1]?.pairs.push(pair)
  }
  return records
}

export function parseAsciiDxf(raw: string): ParsedDxf {
  if (/^AutoCAD Binary DXF/i.test(raw) || raw.includes('\0')) throw new Error('Binary DXF is not supported. Save as ASCII DXF.')
  if (raw.length > 50 * 1024 * 1024) throw new Error('DXF exceeds the 50 MB import limit')
  const lines = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  if (lines.length % 2 !== 0) throw new Error('Malformed DXF: an incomplete group-code/value pair was found')
  const pairs: DxfPair[] = []
  for (let index = 0; index < lines.length; index += 2) {
    const codeText = lines[index].trim()
    const code = Number(codeText)
    if (!/^\d+$/.test(codeText) || !Number.isInteger(code) || code > 1071) {
      throw new Error(`Malformed DXF group code at line ${index + 1}`)
    }
    if (code !== 999) pairs.push({ code, value: lines[index + 1].trim() })
  }
  const result: ParsedDxf = { entities: [], blocks: new Map(), layers: [], unitCode: 0 }
  let section = '', hasEntities = false
  for (let index = 0; index < pairs.length; index++) {
    const pair = pairs[index]
    if (pair.code === 0 && pair.value.toUpperCase() === 'SECTION') {
      section = pairs[index + 1]?.code === 2 ? pairs[++index].value.toUpperCase() : ''
      if (!section) throw new Error('Malformed DXF SECTION header')
      const start = index + 1
      while (++index < pairs.length && !(pairs[index].code === 0 && pairs[index].value.toUpperCase() === 'ENDSEC')) { /* section scan */ }
      if (index === pairs.length) throw new Error(`Malformed DXF: ${section} has no ENDSEC`)
      const body = pairs.slice(start, index)
      if (section === 'HEADER') {
        const unitIndex = body.findIndex((item) => item.code === 9 && item.value === '$INSUNITS')
        if (unitIndex >= 0 && body[unitIndex + 1]?.code === 70) result.unitCode = Number(body[unitIndex + 1].value)
      }
      if (section === 'ENTITIES') {
        hasEntities = true
        result.entities.push(...recordsFromPairs(body))
      }
      if (section === 'TABLES') result.layers.push(...recordsFromPairs(body).filter((record) => record.type === 'LAYER'))
      if (section === 'BLOCKS') {
        let block: DxfBlock | null = null
        for (const record of recordsFromPairs(body)) {
          if (record.type === 'BLOCK') {
            const name = dxfValue(record, 2) ?? dxfValue(record, 3) ?? ''
            block = { name, x: dxfNumber(record, 10), y: dxfNumber(record, 20), records: [] }
          } else if (record.type === 'ENDBLK') {
            if (block) result.blocks.set(block.name.toUpperCase(), block)
            block = null
          } else if (block) block.records.push(record)
        }
      }
    }
  }
  if (!hasEntities) throw new Error('No ENTITIES section found in this ASCII DXF file')
  return result
}
