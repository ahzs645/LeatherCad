import { describe, it, expect } from 'vitest'
import { importLccDocument } from './io-lcc'

const MINIMAL_LCC = JSON.stringify({
  meta: { file_type: 'LeathercraftCAD', version: '2.8.3' },
  layers: [
    { id: 0, chk: '-1', nam: 'Cut/Holes', indp: '0' },
    { id: 1, chk: '-1', nam: 'Fold/Crease', indp: '0' },
  ],
  shapes: [
    {
      id: '1',
      type: 'LINE',
      sp: [0, 0],
      ep: [10, 20],
      ct: [5, 10],
      w: '0.0',
      h: '0.0',
      color: 'Aqua',
      dash: 'Solid',
      opc: '0.5',
      path: 'M0,0 L10,20',
      rt: '0.0',
      st: '',
      inv: '0',
      bz1: [0, 0],
      bz2: [0, 0],
      thk: '1.5',
      la: '0.0',
      lb: '0.0',
      iv: '-1',
      ih: '0',
      sta: '0.0',
      swa: '0.0',
      tx: '',
      fs: '10.0',
      ff: 'Meiryo UI',
      txst: '1.0',
      txrd: '0.0',
      guid: '{TEST-GUID}',
      nm: '',
      gid: '0',
      dim: '0',
      arst: '0',
      ared: '0',
      layer: '0',
      plidx: '0',
    },
  ],
  backdrops: [],
  printareas: [],
})

describe('importLccDocument', () => {
  it('parses a minimal LCC document', () => {
    const result = importLccDocument(MINIMAL_LCC)
    expect(result.doc.version).toBe(1)
    expect(result.doc.units).toBe('mm')
    expect(result.doc.layers).toHaveLength(2)
    expect(result.doc.layers[0].name).toBe('Cut/Holes')
    expect(result.doc.layers[1].name).toBe('Fold/Crease')
    expect(result.summary.shapeCount).toBe(1)
    expect(result.warnings).toHaveLength(0)
  })

  it('converts LINE shapes to line type with correct coordinates', () => {
    const result = importLccDocument(MINIMAL_LCC)
    const shape = result.doc.objects[0]
    expect(shape.type).toBe('line')
    if (shape.type === 'line') {
      expect(shape.start).toEqual({ x: 0, y: 0 })
      expect(shape.end).toEqual({ x: 10, y: 20 })
    }
  })

  it('strips UTF-8 BOM', () => {
    const withBom = '\uFEFF' + MINIMAL_LCC
    const result = importLccDocument(withBom)
    expect(result.doc.layers).toHaveLength(2)
    expect(result.summary.shapeCount).toBe(1)
  })

  it('converts ELLIPSE to arc shapes', () => {
    const lcc = JSON.stringify({
      meta: { file_type: 'LeathercraftCAD', version: '2.8.3' },
      layers: [{ id: 0, chk: '-1', nam: 'Cut', indp: '0' }],
      shapes: [
        {
          id: '100',
          type: 'ELLIPSE',
          sp: [10, 10],
          ep: [13, 13],
          ct: [10, 10],
          w: '6.0',
          h: '6.0',
          color: 'Aqua',
          dash: 'Solid',
          opc: '0.5',
          path: '',
          rt: '0.0',
          st: '',
          inv: '0',
          bz1: [0, 0],
          bz2: [0, 0],
          thk: '1.5',
          la: '0.0',
          lb: '0.0',
          iv: '0',
          ih: '0',
          sta: '0.0',
          swa: '0.0',
          tx: '',
          fs: '10.0',
          ff: 'Meiryo UI',
          txst: '1.0',
          txrd: '0.0',
          guid: '{TEST}',
          nm: '',
          gid: '0',
          dim: '0',
          arst: '0',
          ared: '0',
          layer: '0',
          plidx: '0',
        },
      ],
      backdrops: [],
      printareas: [],
    })

    const result = importLccDocument(lcc)
    // Ellipse becomes 4 arc quadrants
    expect(result.summary.shapeCount).toBe(4)
    expect(result.summary.ellipseCount).toBe(1)
    expect(result.doc.objects.every((s) => s.type === 'arc')).toBe(true)
  })

  it('converts S_HOLE to stitch holes with linked sequences', () => {
    const lcc = JSON.stringify({
      meta: { file_type: 'LeathercraftCAD', version: '2.8.3' },
      layers: [{ id: 3, chk: '-1', nam: 'Stitching', indp: '0' }],
      shapes: [
        {
          id: '10',
          type: 'S_HOLE',
          sp: [2, 0],
          ep: [0, 0],
          ct: [2, 0],
          w: '1.2',
          h: '1.2',
          color: 'White',
          dash: 'Solid',
          opc: '0.5',
          path: '',
          rt: '-90.0',
          st: 'R',
          inv: '0',
          bz1: [0, 0],
          bz2: [0, 0],
          thk: '1.0',
          la: '0.0',
          lb: '0.0',
          iv: '0',
          ih: '0',
          sta: '0.0',
          swa: '0.0',
          tx: '',
          fs: '10.0',
          ff: 'Meiryo UI',
          txst: '1.0',
          txrd: '0.0',
          guid: '{H1}',
          nm: '',
          gid: '0',
          dim: '0',
          arst: '0',
          ared: '0',
          PrevStId: '-1',
          NextStId: '11',
          layer: '3',
          plidx: '0',
        },
        {
          id: '11',
          type: 'S_HOLE',
          sp: [5, 0],
          ep: [0, 0],
          ct: [5, 0],
          w: '1.2',
          h: '1.2',
          color: 'White',
          dash: 'Solid',
          opc: '0.5',
          path: '',
          rt: '-90.0',
          st: 'R',
          inv: '0',
          bz1: [0, 0],
          bz2: [0, 0],
          thk: '1.0',
          la: '0.0',
          lb: '0.0',
          iv: '0',
          ih: '0',
          sta: '0.0',
          swa: '0.0',
          tx: '',
          fs: '10.0',
          ff: 'Meiryo UI',
          txst: '1.0',
          txrd: '0.0',
          guid: '{H2}',
          nm: '',
          gid: '0',
          dim: '0',
          arst: '0',
          ared: '0',
          PrevStId: '10',
          NextStId: '-1',
          layer: '3',
          plidx: '1',
        },
      ],
      backdrops: [],
      printareas: [],
    })

    const result = importLccDocument(lcc)
    expect(result.summary.stitchHoleCount).toBe(2)
    expect(result.doc.stitchHoles).toHaveLength(2)

    // First hole in chain should have sequence 0
    const hole0 = result.doc.stitchHoles!.find((h) => h.sequence === 0)
    const hole1 = result.doc.stitchHoles!.find((h) => h.sequence === 1)
    expect(hole0).toBeDefined()
    expect(hole1).toBeDefined()
    expect(hole0!.point).toEqual({ x: 2, y: 0 })
    expect(hole1!.point).toEqual({ x: 5, y: 0 })
    expect(hole0!.holeType).toBe('round')
  })

  it('converts TEXT shapes', () => {
    const lcc = JSON.stringify({
      meta: { file_type: 'LeathercraftCAD', version: '2.8.3' },
      layers: [{ id: 4, chk: '-1', nam: 'Dimensions', indp: '0' }],
      shapes: [
        {
          id: '200',
          type: 'TEXT',
          sp: [-9, 8],
          ep: [-2, 14],
          ct: [-3, -5],
          w: '5.0',
          h: '2.5',
          color: 'Orange',
          dash: 'Solid',
          opc: '0.5',
          path: '',
          rt: '270.0',
          st: '',
          inv: '0',
          bz1: [0, 0],
          bz2: [0, 0],
          thk: '1.5',
          la: '0.0',
          lb: '0.0',
          iv: '0',
          ih: '0',
          sta: '0.0',
          swa: '0.0',
          tx: '28mm',
          fs: '2.0',
          ff: 'Yu Gothic UI',
          txst: '1.0',
          txrd: '0.0',
          guid: '{TEXT1}',
          nm: '',
          gid: '0',
          dim: '-1',
          arst: '0',
          ared: '0',
          layer: '4',
          plidx: '7',
        },
      ],
      backdrops: [],
      printareas: [],
    })

    const result = importLccDocument(lcc)
    expect(result.summary.textCount).toBe(1)
    expect(result.summary.shapeCount).toBe(1)

    const textShape = result.doc.objects[0]
    expect(textShape.type).toBe('text')
    if (textShape.type === 'text') {
      expect(textShape.text).toBe('28mm')
      expect(textShape.fontFamily).toBe('Yu Gothic UI')
      expect(textShape.fontSizeMm).toBe(2)
    }
  })

  it('creates layers from LCC layer definitions', () => {
    const result = importLccDocument(MINIMAL_LCC)
    expect(result.doc.layers[0].name).toBe('Cut/Holes')
    expect(result.doc.layers[0].visible).toBe(true)
    expect(result.doc.layers[1].name).toBe('Fold/Crease')
  })

  it('warns on non-LeathercraftCAD file type', () => {
    const lcc = JSON.stringify({
      meta: { file_type: 'SomeOtherApp', version: '1.0' },
      layers: [],
      shapes: [],
    })
    const result = importLccDocument(lcc)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('SomeOtherApp')
  })

  it('handles empty shapes array gracefully', () => {
    const lcc = JSON.stringify({
      meta: { file_type: 'LeathercraftCAD', version: '2.8.3' },
      layers: [{ id: 0, chk: '-1', nam: 'Cut', indp: '0' }],
      shapes: [],
    })
    const result = importLccDocument(lcc)
    expect(result.doc.objects).toHaveLength(0)
    expect(result.summary.shapeCount).toBe(0)
  })

  it('maps LCC color names to hex colors in line types', () => {
    const result = importLccDocument(MINIMAL_LCC)
    // Aqua Solid on layer 0 should produce a line type with #00ffff
    const shape = result.doc.objects[0]
    const lineType = result.doc.lineTypes.find((lt) => lt.id === shape.lineTypeId)
    expect(lineType).toBeDefined()
    // Either matches our default cut type or a custom one with aqua color
    expect(lineType!.role).toBe('cut')
  })

  it('maps LCC dash styles to line type styles', () => {
    const lcc = JSON.stringify({
      meta: { file_type: 'LeathercraftCAD', version: '2.8.3' },
      layers: [{ id: 1, chk: '-1', nam: 'Fold', indp: '0' }],
      shapes: [
        {
          id: '1',
          type: 'LINE',
          sp: [0, 0],
          ep: [10, 10],
          ct: [5, 5],
          w: '0.0',
          h: '0.0',
          color: 'Pink',
          dash: 'Dash',
          opc: '0.5',
          path: '',
          rt: '0.0',
          st: '',
          inv: '0',
          bz1: [0, 0],
          bz2: [0, 0],
          thk: '1.5',
          la: '0.0',
          lb: '0.0',
          iv: '0',
          ih: '0',
          sta: '0.0',
          swa: '0.0',
          tx: '',
          fs: '10.0',
          ff: 'Meiryo UI',
          txst: '1.0',
          txrd: '0.0',
          guid: '{TEST}',
          nm: '',
          gid: '0',
          dim: '0',
          arst: '0',
          ared: '0',
          layer: '1',
          plidx: '0',
        },
      ],
    })

    const result = importLccDocument(lcc)
    const shape = result.doc.objects[0]
    const lineType = result.doc.lineTypes.find((lt) => lt.id === shape.lineTypeId)
    expect(lineType).toBeDefined()
    expect(lineType!.style).toBe('dashed')
  })
})
