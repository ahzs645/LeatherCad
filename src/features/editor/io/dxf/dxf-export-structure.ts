type Record = { type: string; pairs: string[] }

/** R13+ entities require subclass markers and ownership, even in a tiny file. */
export function completeModernDxf(body: string[]): string[] {
  let handle = 0x10
  const allocate = () => (handle++).toString(16).toUpperCase()
  const tables = { LTYPE: allocate(), LAYER: allocate(), BLOCK_RECORD: allocate() }
  const model = allocate(), paper = allocate()
  const records: Record[] = []
  for (let index = 0; index < body.length; index += 2) {
    if (body[index] === '0') records.push({ type: body[index + 1], pairs: [] })
    else records.at(-1)!.pairs.push(body[index], body[index + 1])
  }
  const output: string[] = []
  let section = '', table = ''
  const blockRecords = () => {
    output.push('0', 'TABLE', '2', 'BLOCK_RECORD', '5', tables.BLOCK_RECORD, '330', '0', '100', 'AcDbSymbolTable', '70', '2')
    for (const [name, id] of [['*Model_Space', model], ['*Paper_Space', paper]]) output.push('0', 'BLOCK_RECORD', '5', id, '330', tables.BLOCK_RECORD, '100', 'AcDbSymbolTableRecord', '100', 'AcDbBlockTableRecord', '2', name, '70', '0')
    output.push('0', 'ENDTAB')
  }
  const blocks = () => {
    output.push('0', 'SECTION', '2', 'BLOCKS')
    for (const [name, owner] of [['*Model_Space', model], ['*Paper_Space', paper]]) {
      output.push('0', 'BLOCK', '5', allocate(), '330', owner, '100', 'AcDbEntity', '8', '0', '100', 'AcDbBlockBegin', '2', name, '70', '0', '10', '0', '20', '0', '30', '0', '3', name, '1', '')
      output.push('0', 'ENDBLK', '5', allocate(), '330', owner, '100', 'AcDbEntity', '8', '0', '100', 'AcDbBlockEnd')
    }
    output.push('0', 'ENDSEC')
  }
  for (const record of records) {
    if (record.type === 'SECTION') {
      section = record.pairs[1]
      if (section === 'ENTITIES') blocks()
    }
    if (record.type === 'ENDSEC' && section === 'TABLES') blockRecords()
    if (record.type === 'TABLE') {
      table = record.pairs[1]
      output.push('0', 'TABLE', '2', table, '5', tables[table as keyof typeof tables] ?? allocate(), '330', '0', '100', 'AcDbSymbolTable', ...record.pairs.slice(2))
      continue
    }
    if (record.type === 'LAYER' || record.type === 'LTYPE') {
      output.push('0', record.type, '5', allocate(), '330', tables[table as keyof typeof tables], '100', 'AcDbSymbolTableRecord', '100', record.type === 'LAYER' ? 'AcDbLayerTableRecord' : 'AcDbLinetypeTableRecord', ...record.pairs)
      continue
    }
    if (section === 'ENTITIES' && ['LINE', 'ARC', 'CIRCLE', 'SPLINE', 'ELLIPSE'].includes(record.type)) {
      const geometryCode = record.type === 'SPLINE' ? '70' : '10'
      const start = record.pairs.findIndex((value, index) => index % 2 === 0 && value === geometryCode)
      output.push('0', record.type, '5', allocate(), '330', model, '100', 'AcDbEntity', ...record.pairs.slice(0, start), '100', `AcDb${record.type === 'ARC' || record.type === 'CIRCLE' ? 'Circle' : record.type === 'LINE' ? 'Line' : record.type === 'SPLINE' ? 'Spline' : 'Ellipse'}`)
      const geometry = record.pairs.slice(start)
      if (record.type === 'ARC') {
        const angles = geometry.findIndex((value, index) => index % 2 === 0 && value === '50')
        output.push(...geometry.slice(0, angles), '100', 'AcDbArc', ...geometry.slice(angles))
      } else output.push(...geometry)
      continue
    }
    output.push('0', record.type, ...record.pairs)
  }
  const headerEnd = output.findIndex((value, index) => index % 2 === 0 && value === '0' && output[index + 1] === 'ENDSEC')
  output.splice(headerEnd, 0, '9', '$HANDSEED', '5', allocate())
  return output
}
