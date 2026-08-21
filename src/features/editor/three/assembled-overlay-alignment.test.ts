import { describe, expect, it } from 'vitest'
import { Box3, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, Vector2 } from 'three'
import { addPanelOutline } from './outline-renderer'
import { createPieceShape, projectPiecePoint, type PieceMeshData } from './piece-mesh'

/**
 * A piece deliberately asymmetric in document Y. A symmetric one hides a Y-axis
 * mirror completely, which is why this went unnoticed: the bundled trifold is
 * near enough symmetric that its overlays looked correct.
 */
function wedge(): PieceMeshData {
  const outer = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 100 },
    { x: 30, y: 100 },
  ]
  return {
    pieceId: 'wedge',
    name: 'Wedge',
    outer,
    holes: [],
    shapeSegments: [],
    bounds: { minX: 0, minY: 0, maxX: 40, maxY: 100, width: 40, height: 100 },
    center: { x: 20, y: 50 },
    edges: [],
  }
}

describe('assembled overlays sit on the piece they describe', () => {
  it('puts the panel outline in the same place as the extruded body', () => {
    const mesh = wedge()
    const scale = 0.01

    const geometry = new ExtrudeGeometry(createPieceShape(mesh, scale, 0, 0), {
      depth: 0.01,
      bevelEnabled: false,
    })
    geometry.rotateX(-Math.PI / 2)
    const bodyBounds = new Box3().setFromObject(new Mesh(geometry, new MeshBasicMaterial()))

    // The negation the assembled builder applies before handing points to
    // addPanelOutline, which maps (x, y) to (x, yOffset, y).
    const outlinePoints = mesh.outer.map((point) => {
      const projected = projectPiecePoint(point, scale, 0, 0)
      return new Vector2(projected.x, -projected.y)
    })
    const outlineGroup = new Group()
    addPanelOutline(outlinePoints, outlineGroup, '#ffffff', 0)
    const outlineBounds = new Box3().setFromObject(outlineGroup)

    expect(outlineBounds.min.x).toBeCloseTo(bodyBounds.min.x, 4)
    expect(outlineBounds.max.x).toBeCloseTo(bodyBounds.max.x, 4)
    expect(outlineBounds.min.z).toBeCloseTo(bodyBounds.min.z, 4)
    expect(outlineBounds.max.z).toBeCloseTo(bodyBounds.max.z, 4)
  })

  it('maps a document point to viewport Z without flipping it', () => {
    // Higher document Y must mean higher world Z, so overlays and bodies agree.
    const near = projectPiecePoint({ x: 0, y: 10 }, 1, 0, 0)
    const far = projectPiecePoint({ x: 0, y: 90 }, 1, 0, 0)

    expect(-far.y).toBeGreaterThan(-near.y)
  })
})
