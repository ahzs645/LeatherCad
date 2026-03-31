import type { Point, Shape, LineShape, ArcShape, BezierShape } from '../cad/cad-types'
import { uid, round } from '../cad/cad-geometry'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLine(
  start: Point,
  end: Point,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): LineShape {
  return { id: uid(), type: 'line', start, end, layerId, lineTypeId, groupId }
}

function makeArc(
  start: Point,
  mid: Point,
  end: Point,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): ArcShape {
  return { id: uid(), type: 'arc', start, mid, end, layerId, lineTypeId, groupId }
}

function makeBezier(
  start: Point,
  control: Point,
  end: Point,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): BezierShape {
  return { id: uid(), type: 'bezier', start, control, end, layerId, lineTypeId, groupId }
}

/** Approximate a circle as four quarter-arc shapes. */
function makeCircleArcs(
  cx: number,
  cy: number,
  r: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): ArcShape[] {
  const p = (x: number, y: number): Point => ({ x: round(x), y: round(y) })
  const top = p(cx, cy - r)
  const right = p(cx + r, cy)
  const bottom = p(cx, cy + r)
  const left = p(cx - r, cy)
  const d = r * Math.SQRT2 / 2
  const tr = p(cx + d, cy - d)
  const br = p(cx + d, cy + d)
  const bl = p(cx - d, cy + d)
  const tl = p(cx - d, cy - d)
  return [
    makeArc(top, tr, right, layerId, lineTypeId, groupId),
    makeArc(right, br, bottom, layerId, lineTypeId, groupId),
    makeArc(bottom, bl, left, layerId, lineTypeId, groupId),
    makeArc(left, tl, top, layerId, lineTypeId, groupId),
  ]
}

/** Build a rectangle from four lines. Returns top, right, bottom, left. */
function makeRect(
  x: number,
  y: number,
  w: number,
  h: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): LineShape[] {
  const tl: Point = { x: round(x), y: round(y) }
  const tr: Point = { x: round(x + w), y: round(y) }
  const br: Point = { x: round(x + w), y: round(y + h) }
  const bl: Point = { x: round(x), y: round(y + h) }
  return [
    makeLine(tl, tr, layerId, lineTypeId, groupId),
    makeLine(tr, br, layerId, lineTypeId, groupId),
    makeLine(br, bl, layerId, lineTypeId, groupId),
    makeLine(bl, tl, layerId, lineTypeId, groupId),
  ]
}

/** Build a rounded-corner rectangle. cornerRadius is clamped to half the smallest dimension. */
function makeRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  cr: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): Shape[] {
  const r = Math.min(cr, w / 2, h / 2)
  if (r <= 0) return makeRect(x, y, w, h, layerId, lineTypeId, groupId)

  const p = (px: number, py: number): Point => ({ x: round(px), y: round(py) })
  const k = r * (Math.SQRT2 - 1)
  const shapes: Shape[] = []

  // Top edge
  shapes.push(makeLine(p(x + r, y), p(x + w - r, y), layerId, lineTypeId, groupId))
  // Top-right corner arc
  shapes.push(makeArc(
    p(x + w - r, y),
    p(x + w - k, y + k),
    p(x + w, y + r),
    layerId, lineTypeId, groupId,
  ))
  // Right edge
  shapes.push(makeLine(p(x + w, y + r), p(x + w, y + h - r), layerId, lineTypeId, groupId))
  // Bottom-right corner arc
  shapes.push(makeArc(
    p(x + w, y + h - r),
    p(x + w - k, y + h - k),
    p(x + w - r, y + h),
    layerId, lineTypeId, groupId,
  ))
  // Bottom edge
  shapes.push(makeLine(p(x + w - r, y + h), p(x + r, y + h), layerId, lineTypeId, groupId))
  // Bottom-left corner arc
  shapes.push(makeArc(
    p(x + r, y + h),
    p(x + k, y + h - k),
    p(x, y + h - r),
    layerId, lineTypeId, groupId,
  ))
  // Left edge
  shapes.push(makeLine(p(x, y + h - r), p(x, y + r), layerId, lineTypeId, groupId))
  // Top-left corner arc
  shapes.push(makeArc(
    p(x, y + r),
    p(x + k, y + k),
    p(x + r, y),
    layerId, lineTypeId, groupId,
  ))

  return shapes
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WizardType = 'watch-strap' | 'pass-case' | 'box-joint' | 'jigsaw' | 'dice-cup'

export type WatchStrapParams = {
  totalLength: number
  width: number
  buckleEndWidth: number
  taperLength: number
  holeCount: number
  holeSpacing: number
  holeStartOffset: number
  holeDiameter: number
  tipShape: 'pointed' | 'round' | 'square'
  keeperWidth: number
  layerId: string
  lineTypeId: string
}

export type PassCaseParams = {
  cardWidth: number
  cardHeight: number
  margin: number
  cornerRadius: number
  flapHeight: number
  pocketCount: number
  layerId: string
  lineTypeId: string
}

export type BoxJointParams = {
  length: number
  width: number
  height: number
  materialThickness: number
  fingerCount: number
  layerId: string
  lineTypeId: string
}

export type JigsawParams = {
  columns: number
  rows: number
  pieceSize: number
  tabDepth: number
  tabWidth: number
  layerId: string
  lineTypeId: string
}

export type DiceCupParams = {
  topDiameter: number
  bottomDiameter: number
  height: number
  segments: number
  includeBottom: boolean
  layerId: string
  lineTypeId: string
}

export type WizardResult = {
  shapes: Shape[]
  description: string
}

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

/** Compute the outer radius of the annular sector for a truncated cone. */
function computeConeRadii(params: DiceCupParams): { innerR: number; outerR: number; sectorAngleRad: number } {
  const rTop = params.topDiameter / 2
  const rBottom = params.bottomDiameter / 2
  const slantHeight = Math.sqrt(
    params.height * params.height + (rTop - rBottom) * (rTop - rBottom),
  )
  const apexDist = rBottom * slantHeight / Math.abs(rTop - rBottom)
  const innerR = apexDist
  const outerR = apexDist + slantHeight
  const sectorAngleRad = (2 * Math.PI * rBottom) / apexDist
  return { innerR, outerR, sectorAngleRad }
}

export function generateDiceCup(params: DiceCupParams): WizardResult {
  const {
    topDiameter, bottomDiameter, height, segments, includeBottom,
    layerId, lineTypeId,
  } = params

  const shapes: Shape[] = []
  const groupId = uid()

  const rTop = topDiameter / 2
  const rBottom = bottomDiameter / 2
  const slantHeight = Math.sqrt(height * height + (rTop - rBottom) * (rTop - rBottom))
  const isCylinder = Math.abs(rTop - rBottom) < 1e-6

  if (isCylinder) {
    // Cylinder: each panel unfolds to a rectangle
    const circumference = Math.PI * bottomDiameter
    const panelWidth = circumference / segments

    for (let i = 0; i < segments; i++) {
      const px = round(i * (panelWidth + 5))
      shapes.push(...makeRect(px, 0, round(panelWidth), round(slantHeight), layerId, lineTypeId, groupId))
    }

    // Bottom circle
    if (includeBottom) {
      const totalPanelSpan = segments * (panelWidth + 5) - 5
      const bottomCx = round(totalPanelSpan / 2)
      const bottomCy = round(slantHeight + 10 + rBottom)
      shapes.push(...makeCircleArcs(bottomCx, bottomCy, rBottom, layerId, lineTypeId, groupId))
    }
  } else {
    // Truncated cone: unfolds to annular sector
    const { innerR, outerR, sectorAngleRad } = computeConeRadii(params)
    const segAngle = sectorAngleRad / segments

    let angleOffset = 0
    for (let i = 0; i < segments; i++) {
      const a0 = angleOffset
      const a1 = angleOffset + segAngle
      const aMid = (a0 + a1) / 2

      const innerStart: Point = { x: round(innerR * Math.cos(a0)), y: round(innerR * Math.sin(a0)) }
      const innerEnd: Point = { x: round(innerR * Math.cos(a1)), y: round(innerR * Math.sin(a1)) }
      const innerMid: Point = { x: round(innerR * Math.cos(aMid)), y: round(innerR * Math.sin(aMid)) }

      const outerStart: Point = { x: round(outerR * Math.cos(a0)), y: round(outerR * Math.sin(a0)) }
      const outerEnd: Point = { x: round(outerR * Math.cos(a1)), y: round(outerR * Math.sin(a1)) }
      const outerMid: Point = { x: round(outerR * Math.cos(aMid)), y: round(outerR * Math.sin(aMid)) }

      // Inner arc
      shapes.push(makeArc(innerStart, innerMid, innerEnd, layerId, lineTypeId, groupId))
      // Outer arc
      shapes.push(makeArc(outerStart, outerMid, outerEnd, layerId, lineTypeId, groupId))
      // Radial side edges
      shapes.push(makeLine(innerStart, outerStart, layerId, lineTypeId, groupId))
      shapes.push(makeLine(innerEnd, outerEnd, layerId, lineTypeId, groupId))

      angleOffset = a1
    }

    // Bottom circle
    if (includeBottom) {
      const bottomCx = round(0)
      const bottomCy = round(-outerR - 10 - rBottom)
      shapes.push(...makeCircleArcs(bottomCx, bottomCy, rBottom, layerId, lineTypeId, groupId))
    }
  }

  return {
    shapes,
    description: `Dice cup: ${topDiameter}mm top, ${bottomDiameter}mm bottom, ${height}mm tall, ${segments} panels${includeBottom ? ', with bottom' : ''}`,
  }
}

// ---------------------------------------------------------------------------
// 6. Defaults
// ---------------------------------------------------------------------------

export function getDefaultWizardParams(type: 'watch-strap'): WatchStrapParams
export function getDefaultWizardParams(type: 'pass-case'): PassCaseParams
export function getDefaultWizardParams(type: 'box-joint'): BoxJointParams
export function getDefaultWizardParams(type: 'jigsaw'): JigsawParams
export function getDefaultWizardParams(type: 'dice-cup'): DiceCupParams
export function getDefaultWizardParams(
  type: WizardType,
): WatchStrapParams | PassCaseParams | BoxJointParams | JigsawParams | DiceCupParams {
  switch (type) {
    case 'watch-strap':
      return {
        totalLength: 220,
        width: 22,
        buckleEndWidth: 18,
        taperLength: 30,
        holeCount: 5,
        holeSpacing: 8,
        holeStartOffset: 35,
        holeDiameter: 2.5,
        tipShape: 'pointed',
        keeperWidth: 12,
        layerId: '',
        lineTypeId: '',
      }
    case 'pass-case':
      return {
        cardWidth: 86,
        cardHeight: 54,
        margin: 5,
        cornerRadius: 3,
        flapHeight: 0,
        pocketCount: 1,
        layerId: '',
        lineTypeId: '',
      }
    case 'box-joint':
      return {
        length: 100,
        width: 80,
        height: 50,
        materialThickness: 2,
        fingerCount: 3,
        layerId: '',
        lineTypeId: '',
      }
    case 'jigsaw':
      return {
        columns: 3,
        rows: 3,
        pieceSize: 40,
        tabDepth: 8,
        tabWidth: 12,
        layerId: '',
        lineTypeId: '',
      }
    case 'dice-cup':
      return {
        topDiameter: 70,
        bottomDiameter: 50,
        height: 90,
        segments: 4,
        includeBottom: true,
        layerId: '',
        lineTypeId: '',
      }
  }
}
