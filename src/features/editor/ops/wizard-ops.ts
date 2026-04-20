import type { Point, Shape, LineShape } from '../cad/cad-types'
import { uid, round } from '../cad/cad-geometry'
import { computeFrustumUnroll } from './frustum-ops'
import {
  makeArc,
  makeBezier,
  makeCircleArcs,
  makeLine,
  makeRect,
  makeRoundedRect,
} from './wizard-shape-builders'
import type {
  BoxJointParams,
  CapPatternParams,
  DiceCupParams,
  JigsawParams,
  PassCaseParams,
  WatchStrapParams,
  WizardResult,
} from './wizard-types'
export { getDefaultWizardParams } from './wizard-defaults'
export type {
  BoxJointParams,
  CapPatternParams,
  DiceCupParams,
  JigsawParams,
  PassCaseParams,
  WatchStrapParams,
  WizardResult,
  WizardType,
} from './wizard-types'

// ---------------------------------------------------------------------------
// 1. Watch Strap
// ---------------------------------------------------------------------------

export function generateWatchStrap(params: WatchStrapParams): WizardResult {
  const {
    totalLength, width, buckleEndWidth, taperLength,
    holeCount, holeSpacing, holeStartOffset, holeDiameter,
    tipShape, keeperWidth, layerId, lineTypeId,
  } = params

  const shapes: Shape[] = []
  const groupId = uid()
  const halfW = width / 2
  const halfBW = buckleEndWidth / 2
  const cy = halfW // centerline y

  // --- Buckle end (left side) ---
  if (buckleEndWidth < width && taperLength > 0) {
    // Tapered left end
    const topTaperStart: Point = { x: round(0), y: round(cy - halfBW) }
    const topTaperEnd: Point = { x: round(taperLength), y: round(0) }
    const bottomTaperStart: Point = { x: round(0), y: round(cy + halfBW) }
    const bottomTaperEnd: Point = { x: round(taperLength), y: round(width) }

    // Left edge (buckle end)
    shapes.push(makeLine(topTaperStart, bottomTaperStart, layerId, lineTypeId, groupId))
    // Taper lines
    shapes.push(makeLine(topTaperStart, topTaperEnd, layerId, lineTypeId, groupId))
    shapes.push(makeLine(bottomTaperStart, bottomTaperEnd, layerId, lineTypeId, groupId))
    // Top edge from taper to tip region
    shapes.push(makeLine(topTaperEnd, { x: round(totalLength), y: round(0) }, layerId, lineTypeId, groupId))
    // Bottom edge from taper to tip region
    shapes.push(makeLine(bottomTaperEnd, { x: round(totalLength), y: round(width) }, layerId, lineTypeId, groupId))
  } else {
    // No taper: straight rectangle edges
    const tl: Point = { x: round(0), y: round(0) }
    const bl: Point = { x: round(0), y: round(width) }
    shapes.push(makeLine(tl, bl, layerId, lineTypeId, groupId))
    shapes.push(makeLine(tl, { x: round(totalLength), y: round(0) }, layerId, lineTypeId, groupId))
    shapes.push(makeLine(bl, { x: round(totalLength), y: round(width) }, layerId, lineTypeId, groupId))
  }

  // --- Tip end (right side) ---
  const tipX = round(totalLength)
  if (tipShape === 'pointed') {
    const tipPoint: Point = { x: round(totalLength + halfW), y: round(cy) }
    shapes.push(makeLine({ x: tipX, y: round(0) }, tipPoint, layerId, lineTypeId, groupId))
    shapes.push(makeLine(tipPoint, { x: tipX, y: round(width) }, layerId, lineTypeId, groupId))
  } else if (tipShape === 'round') {
    const arcMid: Point = { x: round(totalLength + halfW), y: round(cy) }
    shapes.push(makeArc(
      { x: tipX, y: round(0) },
      arcMid,
      { x: tipX, y: round(width) },
      layerId, lineTypeId, groupId,
    ))
  } else {
    // square tip
    shapes.push(makeLine(
      { x: tipX, y: round(0) },
      { x: tipX, y: round(width) },
      layerId, lineTypeId, groupId,
    ))
  }

  // --- Sizing holes ---
  const holeR = holeDiameter / 2
  for (let i = 0; i < holeCount; i++) {
    const hx = totalLength - holeStartOffset - i * holeSpacing
    shapes.push(...makeCircleArcs(round(hx), round(cy), holeR, layerId, lineTypeId, groupId))
  }

  // --- Keeper piece (separate rectangle below strap, 10mm gap) ---
  const keeperGroupId = uid()
  const keeperPerimeter = round(width * Math.PI)
  const keeperY = width + 10
  shapes.push(...makeRect(0, keeperY, keeperWidth, keeperPerimeter, layerId, lineTypeId, keeperGroupId))

  return {
    shapes,
    description: `Watch strap: ${totalLength}mm total, ${width}mm wide, ${tipShape} tip, ${holeCount} holes, with keeper`,
  }
}

// ---------------------------------------------------------------------------
// 2. Pass Case
// ---------------------------------------------------------------------------

export function generatePassCase(params: PassCaseParams): WizardResult {
  const {
    cardWidth, cardHeight, margin, cornerRadius,
    flapHeight, pocketCount, layerId, lineTypeId,
  } = params

  const shapes: Shape[] = []
  const groupId = uid()

  const bodyW = cardWidth + 2 * margin
  const bodyH = cardHeight * 2 + 2 * margin + flapHeight
  // Centered at origin
  const ox = round(-bodyW / 2)
  const oy = round(-bodyH / 2)

  // Main body outline
  if (cornerRadius > 0) {
    shapes.push(...makeRoundedRect(ox, oy, bodyW, bodyH, cornerRadius, layerId, lineTypeId, groupId))
  } else {
    shapes.push(...makeRect(ox, oy, bodyW, bodyH, layerId, lineTypeId, groupId))
  }

  // Fold line at the center (between the two card halves)
  const foldY = round(oy + margin + cardHeight)
  shapes.push(makeLine(
    { x: round(ox), y: foldY },
    { x: round(ox + bodyW), y: foldY },
    layerId, lineTypeId, groupId,
  ))

  // Pocket slot lines
  if (pocketCount > 0) {
    const pocketRegionTop = foldY
    const pocketRegionBottom = round(oy + bodyH - margin)
    const pocketRegionH = pocketRegionBottom - pocketRegionTop
    const slotSpacing = pocketRegionH / (pocketCount + 1)

    for (let i = 1; i <= pocketCount; i++) {
      const slotY = round(pocketRegionTop + slotSpacing * i)
      const slotInset = margin + 5
      shapes.push(makeLine(
        { x: round(ox + slotInset), y: slotY },
        { x: round(ox + bodyW - slotInset), y: slotY },
        layerId, lineTypeId, groupId,
      ))
    }
  }

  return {
    shapes,
    description: `Pass case: ${round(bodyW)}x${round(bodyH)}mm body, ${cornerRadius}mm corners, ${pocketCount} pocket(s)${flapHeight > 0 ? `, ${flapHeight}mm flap` : ''}`,
  }
}

// ---------------------------------------------------------------------------
// 3. Box Joint
// ---------------------------------------------------------------------------

/** Generate a horizontal finger-joint edge. Tabs protrude downward (positive y)
 *  by materialThickness from the baseline at startY. */
function makeFingerEdge(
  startX: number,
  startY: number,
  edgeLength: number,
  fingerCount: number,
  materialThickness: number,
  startWithTab: boolean,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): LineShape[] {
  const segments = 2 * fingerCount + 1
  const segW = edgeLength / segments
  const lines: LineShape[] = []
  let curX = startX
  const baseY = startY
  const tabY = startY + materialThickness

  for (let i = 0; i < segments; i++) {
    const isTab = startWithTab ? i % 2 === 0 : i % 2 === 1
    const nextX = round(startX + (i + 1) * segW)

    if (isTab) {
      lines.push(makeLine(
        { x: round(curX), y: round(baseY) },
        { x: round(curX), y: round(tabY) },
        layerId, lineTypeId, groupId,
      ))
      lines.push(makeLine(
        { x: round(curX), y: round(tabY) },
        { x: nextX, y: round(tabY) },
        layerId, lineTypeId, groupId,
      ))
      lines.push(makeLine(
        { x: nextX, y: round(tabY) },
        { x: nextX, y: round(baseY) },
        layerId, lineTypeId, groupId,
      ))
    } else {
      lines.push(makeLine(
        { x: round(curX), y: round(baseY) },
        { x: nextX, y: round(baseY) },
        layerId, lineTypeId, groupId,
      ))
    }
    curX = nextX
  }
  return lines
}

/** Vertical variant of makeFingerEdge. Tabs protrude horizontally. */
function makeFingerEdgeVertical(
  startX: number,
  startY: number,
  edgeLength: number,
  fingerCount: number,
  materialThickness: number,
  startWithTab: boolean,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): LineShape[] {
  const segments = 2 * fingerCount + 1
  const segH = edgeLength / segments
  const lines: LineShape[] = []
  let curY = startY
  const baseX = startX
  const tabX = startX + materialThickness

  for (let i = 0; i < segments; i++) {
    const isTab = startWithTab ? i % 2 === 0 : i % 2 === 1
    const nextY = round(startY + (i + 1) * segH)

    if (isTab) {
      lines.push(makeLine(
        { x: round(baseX), y: round(curY) },
        { x: round(tabX), y: round(curY) },
        layerId, lineTypeId, groupId,
      ))
      lines.push(makeLine(
        { x: round(tabX), y: round(curY) },
        { x: round(tabX), y: nextY },
        layerId, lineTypeId, groupId,
      ))
      lines.push(makeLine(
        { x: round(tabX), y: nextY },
        { x: round(baseX), y: nextY },
        layerId, lineTypeId, groupId,
      ))
    } else {
      lines.push(makeLine(
        { x: round(baseX), y: round(curY) },
        { x: round(baseX), y: nextY },
        layerId, lineTypeId, groupId,
      ))
    }
    curY = nextY
  }
  return lines
}

export function generateBoxJoint(params: BoxJointParams): WizardResult {
  const { length, width, height, materialThickness, fingerCount, layerId, lineTypeId } = params
  const shapes: Shape[] = []
  const groupId = uid()

  // Cross / plus layout:
  //           [back]
  //  [left]  [bottom]  [right]
  //           [front]
  const gap = 2

  // Bottom panel position (center of the cross)
  const bx = height + gap
  const by = height + gap

  // Bottom panel: simple rectangle
  shapes.push(...makeRect(bx, by, length, width, layerId, lineTypeId, groupId))

  // --- Front panel (below bottom) ---
  const fx = bx
  const fy = by + width + gap
  shapes.push(makeLine(
    { x: round(fx), y: round(fy) },
    { x: round(fx), y: round(fy + height) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(
    { x: round(fx + length), y: round(fy) },
    { x: round(fx + length), y: round(fy + height) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(...makeFingerEdge(fx, fy, length, fingerCount, -materialThickness, true, layerId, lineTypeId, groupId))
  shapes.push(...makeFingerEdge(fx, fy + height, length, fingerCount, materialThickness, false, layerId, lineTypeId, groupId))

  // --- Back panel (above bottom) ---
  const backX = bx
  const backY = by - gap - height
  shapes.push(makeLine(
    { x: round(backX), y: round(backY) },
    { x: round(backX), y: round(backY + height) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(
    { x: round(backX + length), y: round(backY) },
    { x: round(backX + length), y: round(backY + height) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(...makeFingerEdge(backX, backY, length, fingerCount, -materialThickness, false, layerId, lineTypeId, groupId))
  shapes.push(...makeFingerEdge(backX, backY + height, length, fingerCount, materialThickness, true, layerId, lineTypeId, groupId))

  // --- Left panel (left of bottom) ---
  const lx = bx - gap - width
  const ly = by
  shapes.push(makeLine(
    { x: round(lx), y: round(ly) },
    { x: round(lx + width), y: round(ly) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(
    { x: round(lx), y: round(ly + height) },
    { x: round(lx + width), y: round(ly + height) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(...makeFingerEdgeVertical(lx, ly, height, fingerCount, -materialThickness, false, layerId, lineTypeId, groupId))
  shapes.push(...makeFingerEdgeVertical(lx + width, ly, height, fingerCount, materialThickness, true, layerId, lineTypeId, groupId))

  // --- Right panel (right of bottom) ---
  const rx = bx + length + gap
  const ry = by
  shapes.push(makeLine(
    { x: round(rx), y: round(ry) },
    { x: round(rx + width), y: round(ry) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(
    { x: round(rx), y: round(ry + height) },
    { x: round(rx + width), y: round(ry + height) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(...makeFingerEdgeVertical(rx, ry, height, fingerCount, -materialThickness, true, layerId, lineTypeId, groupId))
  shapes.push(...makeFingerEdgeVertical(rx + width, ry, height, fingerCount, materialThickness, false, layerId, lineTypeId, groupId))

  return {
    shapes,
    description: `Box with finger joints: ${length}x${width}x${height}mm, ${materialThickness}mm thick, ${fingerCount} fingers per edge`,
  }
}

// ---------------------------------------------------------------------------
// 4. Jigsaw
// ---------------------------------------------------------------------------

/** Create a jigsaw edge between two points with a bezier tab in the middle. */
function makeJigsawEdge(
  start: Point,
  end: Point,
  tabDepth: number,
  tabWidth: number,
  tabPositive: boolean,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): Shape[] {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const edgeLen = Math.hypot(dx, dy)
  if (edgeLen < 1e-6) return []

  // Unit vectors along and perpendicular to the edge
  const ux = dx / edgeLen
  const uy = dy / edgeLen
  const sign = tabPositive ? 1 : -1
  // Perpendicular (rotated 90 degrees)
  const px = sign * uy
  const py = sign * -ux

  const halfTab = tabWidth / 2
  const tabCenter = edgeLen / 2
  const neckStart = tabCenter - halfTab
  const neckEnd = tabCenter + halfTab

  const pAt = (along: number, perp: number): Point => ({
    x: round(start.x + ux * along + px * perp),
    y: round(start.y + uy * along + py * perp),
  })

  const p1 = pAt(neckStart, 0)
  const p2 = pAt(neckStart, tabDepth * 0.4)
  const p3 = pAt(neckStart - halfTab * 0.3, tabDepth)
  const p4 = pAt(tabCenter, tabDepth)
  const p5 = pAt(neckEnd + halfTab * 0.3, tabDepth)
  const p6 = pAt(neckEnd, tabDepth * 0.4)
  const p7 = pAt(neckEnd, 0)

  const result: Shape[] = []

  // Straight segment before tab
  if (neckStart > 1e-3) {
    result.push(makeLine(start, p1, layerId, lineTypeId, groupId))
  }

  // Tab shape using bezier curves
  result.push(makeBezier(p1, p2, p3, layerId, lineTypeId, groupId))
  result.push(makeBezier(p3, p4, p5, layerId, lineTypeId, groupId))
  result.push(makeBezier(p5, p6, p7, layerId, lineTypeId, groupId))

  // Straight segment after tab
  if (edgeLen - neckEnd > 1e-3) {
    result.push(makeLine(p7, end, layerId, lineTypeId, groupId))
  }

  return result
}

export function generateJigsaw(params: JigsawParams): WizardResult {
  const { columns, rows, pieceSize, tabDepth, tabWidth, layerId, lineTypeId } = params
  const shapes: Shape[] = []
  const groupId = uid()
  const totalW = columns * pieceSize
  const totalH = rows * pieceSize

  // External border
  shapes.push(...makeRect(0, 0, totalW, totalH, layerId, lineTypeId, groupId))

  // Internal vertical edges
  for (let col = 1; col < columns; col++) {
    const x = col * pieceSize
    for (let row = 0; row < rows; row++) {
      const yStart = row * pieceSize
      const yEnd = (row + 1) * pieceSize
      const tabOut = (col + row) % 2 === 0
      shapes.push(...makeJigsawEdge(
        { x: round(x), y: round(yStart) },
        { x: round(x), y: round(yEnd) },
        tabDepth, tabWidth, tabOut, layerId, lineTypeId, groupId,
      ))
    }
  }

  // Internal horizontal edges
  for (let row = 1; row < rows; row++) {
    const y = row * pieceSize
    for (let col = 0; col < columns; col++) {
      const xStart = col * pieceSize
      const xEnd = (col + 1) * pieceSize
      const tabOut = (col + row) % 2 === 0
      shapes.push(...makeJigsawEdge(
        { x: round(xStart), y: round(y) },
        { x: round(xEnd), y: round(y) },
        tabDepth, tabWidth, tabOut, layerId, lineTypeId, groupId,
      ))
    }
  }

  return {
    shapes,
    description: `Jigsaw puzzle: ${columns}x${rows} grid, ${pieceSize}mm pieces, ${tabDepth}mm tab depth`,
  }
}

// ---------------------------------------------------------------------------
// 5. Dice Cup
// ---------------------------------------------------------------------------

export function generateDiceCup(params: DiceCupParams): WizardResult {
  const {
    topDiameter, bottomDiameter, height, segments, includeBottom,
    leatherThickness = 0,
    compensationFactor = 0,
    stitchOffsetBottomRim = 0,
    stitchOffsetTopRim = 0,
    stitchOffsetSide = 0,
    stitchOffsetBottomDisc = 0,
    stitchTopRim = false,
    layerId, lineTypeId,
  } = params

  const shapes: Shape[] = []
  const groupId = uid()

  // Thickness compensation: shrink effective radii so assembled cup matches target.
  const compensation = leatherThickness * compensationFactor
  const rTop = Math.max(0, topDiameter / 2 - compensation)
  const rBottom = Math.max(0, bottomDiameter / 2 - compensation)
  const unroll = computeFrustumUnroll({ topRadius: rTop, bottomRadius: rBottom, height })

  if (!unroll) {
    // Cylinder degenerate case: each panel unfolds to a rectangle.
    const slantHeight = height
    const circumference = 2 * Math.PI * rBottom
    const panelWidth = circumference / segments
    const panelGap = 5

    for (let i = 0; i < segments; i++) {
      const px = round(i * (panelWidth + panelGap))
      shapes.push(...makeRect(px, 0, round(panelWidth), round(slantHeight), layerId, lineTypeId, groupId))

      if (stitchOffsetBottomRim > 0) {
        const y = round(slantHeight - stitchOffsetBottomRim)
        shapes.push(makeLine({ x: px, y }, { x: round(px + panelWidth), y }, layerId, lineTypeId, groupId))
      }
      if (stitchTopRim && stitchOffsetTopRim > 0) {
        const y = round(stitchOffsetTopRim)
        shapes.push(makeLine({ x: px, y }, { x: round(px + panelWidth), y }, layerId, lineTypeId, groupId))
      }
      if (stitchOffsetSide > 0) {
        shapes.push(makeLine(
          { x: round(px + stitchOffsetSide), y: 0 },
          { x: round(px + stitchOffsetSide), y: round(slantHeight) },
          layerId, lineTypeId, groupId,
        ))
        shapes.push(makeLine(
          { x: round(px + panelWidth - stitchOffsetSide), y: 0 },
          { x: round(px + panelWidth - stitchOffsetSide), y: round(slantHeight) },
          layerId, lineTypeId, groupId,
        ))
      }
    }

    if (includeBottom) {
      const totalPanelSpan = segments * (panelWidth + panelGap) - panelGap
      const bottomCx = round(totalPanelSpan / 2)
      const bottomCy = round(slantHeight + 10 + rBottom)
      shapes.push(...makeCircleArcs(bottomCx, bottomCy, rBottom, layerId, lineTypeId, groupId))
      if (stitchOffsetBottomDisc > 0) {
        const inner = Math.max(0, rBottom - stitchOffsetBottomDisc)
        shapes.push(...makeCircleArcs(bottomCx, bottomCy, inner, layerId, lineTypeId, groupId))
      }
    }
  } else {
    // Truncated cone: unfolds to annular sector.
    const { innerRadius, outerRadius, sectorAngleRad } = unroll
    const segAngle = sectorAngleRad / segments
    const stitchInnerR = innerRadius + stitchOffsetTopRim
    const stitchOuterR = outerRadius - stitchOffsetBottomRim

    let angleOffset = 0
    for (let i = 0; i < segments; i++) {
      const a0 = angleOffset
      const a1 = angleOffset + segAngle
      const aMid = (a0 + a1) / 2
      const radialOffsetAngle = stitchOffsetSide > 0
        ? stitchOffsetSide / ((innerRadius + outerRadius) / 2)
        : 0

      const pointAt = (r: number, a: number): Point => ({
        x: round(r * Math.cos(a)),
        y: round(r * Math.sin(a)),
      })

      const innerStart = pointAt(innerRadius, a0)
      const innerEnd = pointAt(innerRadius, a1)
      const innerMid = pointAt(innerRadius, aMid)
      const outerStart = pointAt(outerRadius, a0)
      const outerEnd = pointAt(outerRadius, a1)
      const outerMid = pointAt(outerRadius, aMid)

      shapes.push(makeArc(innerStart, innerMid, innerEnd, layerId, lineTypeId, groupId))
      shapes.push(makeArc(outerStart, outerMid, outerEnd, layerId, lineTypeId, groupId))
      shapes.push(makeLine(innerStart, outerStart, layerId, lineTypeId, groupId))
      shapes.push(makeLine(innerEnd, outerEnd, layerId, lineTypeId, groupId))

      if (stitchOffsetBottomRim > 0 && stitchOuterR > innerRadius) {
        shapes.push(makeArc(
          pointAt(stitchOuterR, a0),
          pointAt(stitchOuterR, aMid),
          pointAt(stitchOuterR, a1),
          layerId, lineTypeId, groupId,
        ))
      }
      if (stitchTopRim && stitchOffsetTopRim > 0 && stitchInnerR < outerRadius) {
        shapes.push(makeArc(
          pointAt(stitchInnerR, a0),
          pointAt(stitchInnerR, aMid),
          pointAt(stitchInnerR, a1),
          layerId, lineTypeId, groupId,
        ))
      }
      if (stitchOffsetSide > 0) {
        shapes.push(makeLine(
          pointAt(innerRadius, a0 + radialOffsetAngle),
          pointAt(outerRadius, a0 + radialOffsetAngle),
          layerId, lineTypeId, groupId,
        ))
        shapes.push(makeLine(
          pointAt(innerRadius, a1 - radialOffsetAngle),
          pointAt(outerRadius, a1 - radialOffsetAngle),
          layerId, lineTypeId, groupId,
        ))
      }

      angleOffset = a1
    }

    if (includeBottom) {
      const bottomCx = round(0)
      const bottomCy = round(-outerRadius - 10 - rBottom)
      shapes.push(...makeCircleArcs(bottomCx, bottomCy, rBottom, layerId, lineTypeId, groupId))
      if (stitchOffsetBottomDisc > 0) {
        const inner = Math.max(0, rBottom - stitchOffsetBottomDisc)
        shapes.push(...makeCircleArcs(bottomCx, bottomCy, inner, layerId, lineTypeId, groupId))
      }
    }
  }

  return {
    shapes,
    description: `Dice cup: ${topDiameter}mm top, ${bottomDiameter}mm bottom, ${height}mm tall, ${segments} panels${includeBottom ? ', with bottom' : ''}${leatherThickness > 0 ? `, ${leatherThickness}mm leather (comp ${compensationFactor})` : ''}`,
  }
}

// ---------------------------------------------------------------------------
// 6. Cap Pattern
// ---------------------------------------------------------------------------

export function generateCapPattern(params: CapPatternParams): WizardResult {
  const {
    seamMM, crownBulge, baseSmile,
    brimDepthMM, brimWidthMM, brimBackRiseMM,
    layerId, lineTypeId,
  } = params

  const shapes: Shape[] = []
  const panelCount = 6
  const panelBaseWidth = brimWidthMM / panelCount
  const panelHeight = brimWidthMM * 0.55
  const panelGap = 10

  for (let i = 0; i < panelCount; i++) {
    const groupId = uid()
    const x0 = i * (panelBaseWidth + panelGap)
    const cx = x0 + panelBaseWidth / 2

    const baseLeft: Point = { x: round(x0), y: round(panelHeight) }
    const baseMid: Point = { x: round(cx), y: round(panelHeight + baseSmile) }
    const baseRight: Point = { x: round(x0 + panelBaseWidth), y: round(panelHeight) }
    const apex: Point = { x: round(cx), y: round(0) }

    const leftBulge: Point = { x: round(x0 - crownBulge), y: round(panelHeight / 2) }
    const rightBulge: Point = { x: round(x0 + panelBaseWidth + crownBulge), y: round(panelHeight / 2) }

    shapes.push(makeBezier(baseLeft, leftBulge, apex, layerId, lineTypeId, groupId))
    shapes.push(makeBezier(apex, rightBulge, baseRight, layerId, lineTypeId, groupId))
    shapes.push(makeArc(baseLeft, baseMid, baseRight, layerId, lineTypeId, groupId))
  }

  const brimGroupId = uid()
  const brimY = panelHeight + baseSmile + 30
  const crownSpan = panelCount * panelBaseWidth + (panelCount - 1) * panelGap
  const brimCx = crownSpan / 2

  const innerLeft: Point = { x: round(brimCx - brimWidthMM / 2), y: round(brimY) }
  const innerMid: Point = { x: round(brimCx), y: round(brimY - brimBackRiseMM) }
  const innerRight: Point = { x: round(brimCx + brimWidthMM / 2), y: round(brimY) }

  const outerLeft: Point = { x: round(brimCx - brimWidthMM / 2), y: round(brimY + brimDepthMM) }
  const outerMid: Point = { x: round(brimCx), y: round(brimY + brimDepthMM + brimBackRiseMM) }
  const outerRight: Point = { x: round(brimCx + brimWidthMM / 2), y: round(brimY + brimDepthMM) }

  shapes.push(makeArc(innerLeft, innerMid, innerRight, layerId, lineTypeId, brimGroupId))
  shapes.push(makeArc(outerLeft, outerMid, outerRight, layerId, lineTypeId, brimGroupId))
  shapes.push(makeLine(innerLeft, outerLeft, layerId, lineTypeId, brimGroupId))
  shapes.push(makeLine(innerRight, outerRight, layerId, lineTypeId, brimGroupId))

  return {
    shapes,
    description: `Cap pattern: ${panelCount} crown panels (base ${round(panelBaseWidth)}mm, bulge ${crownBulge}mm, smile ${baseSmile}mm), brim ${brimWidthMM}×${brimDepthMM}mm (back rise ${brimBackRiseMM}mm), seam ${seamMM}mm`,
  }
}
