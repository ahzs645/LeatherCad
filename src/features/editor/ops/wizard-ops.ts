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
    totalLength, watchLength = 0, wristCircumference = 0, lugInnerWidth = 0, buckleInnerWidth = 0, buckleLength = 0,
    width, buckleEndWidth, taperLength,
    holeCount, holeSpacing, holeStartOffset, holeDiameter,
    tipShape, keeperWidth, layerId, lineTypeId,
  } = params

  const shapes: Shape[] = []
  const groupId = uid()
  const fittedTotalLength = wristCircumference > 0
    ? Math.max(50, wristCircumference - Math.max(0, watchLength) - Math.max(0, buckleLength) + holeStartOffset)
    : totalLength
  const workingTotalLength = Math.max(totalLength, fittedTotalLength)
  const workingWidth = lugInnerWidth > 0 ? lugInnerWidth : width
  const workingBuckleWidth = buckleInnerWidth > 0 ? buckleInnerWidth : buckleEndWidth
  const halfW = workingWidth / 2
  const halfBW = workingBuckleWidth / 2
  const cy = halfW // centerline y

  // --- Buckle end (left side) ---
  if (workingBuckleWidth < workingWidth && taperLength > 0) {
    // Tapered left end
    const topTaperStart: Point = { x: round(0), y: round(cy - halfBW) }
    const topTaperEnd: Point = { x: round(taperLength), y: round(0) }
    const bottomTaperStart: Point = { x: round(0), y: round(cy + halfBW) }
    const bottomTaperEnd: Point = { x: round(taperLength), y: round(workingWidth) }

    // Left edge (buckle end)
    shapes.push(makeLine(topTaperStart, bottomTaperStart, layerId, lineTypeId, groupId))
    // Taper lines
    shapes.push(makeLine(topTaperStart, topTaperEnd, layerId, lineTypeId, groupId))
    shapes.push(makeLine(bottomTaperStart, bottomTaperEnd, layerId, lineTypeId, groupId))
    // Top edge from taper to tip region
    shapes.push(makeLine(topTaperEnd, { x: round(workingTotalLength), y: round(0) }, layerId, lineTypeId, groupId))
    // Bottom edge from taper to tip region
    shapes.push(makeLine(bottomTaperEnd, { x: round(workingTotalLength), y: round(workingWidth) }, layerId, lineTypeId, groupId))
  } else {
    // No taper: straight rectangle edges
    const tl: Point = { x: round(0), y: round(0) }
    const bl: Point = { x: round(0), y: round(workingWidth) }
    shapes.push(makeLine(tl, bl, layerId, lineTypeId, groupId))
    shapes.push(makeLine(tl, { x: round(workingTotalLength), y: round(0) }, layerId, lineTypeId, groupId))
    shapes.push(makeLine(bl, { x: round(workingTotalLength), y: round(workingWidth) }, layerId, lineTypeId, groupId))
  }

  // --- Tip end (right side) ---
  const tipX = round(workingTotalLength)
  if (tipShape === 'pointed') {
    const tipPoint: Point = { x: round(workingTotalLength + halfW), y: round(cy) }
    shapes.push(makeLine({ x: tipX, y: round(0) }, tipPoint, layerId, lineTypeId, groupId))
    shapes.push(makeLine(tipPoint, { x: tipX, y: round(workingWidth) }, layerId, lineTypeId, groupId))
  } else if (tipShape === 'round') {
    const arcMid: Point = { x: round(workingTotalLength + halfW), y: round(cy) }
    shapes.push(makeArc(
      { x: tipX, y: round(0) },
      arcMid,
      { x: tipX, y: round(workingWidth) },
      layerId, lineTypeId, groupId,
    ))
  } else {
    // square tip
    shapes.push(makeLine(
      { x: tipX, y: round(0) },
      { x: tipX, y: round(workingWidth) },
      layerId, lineTypeId, groupId,
    ))
  }

  // --- Sizing holes ---
  const holeR = holeDiameter / 2
  for (let i = 0; i < holeCount; i++) {
    const hx = workingTotalLength - holeStartOffset - i * holeSpacing
    shapes.push(...makeCircleArcs(round(hx), round(cy), holeR, layerId, lineTypeId, groupId))
  }

  // --- Keeper piece (separate rectangle below strap, 10mm gap) ---
  const keeperGroupId = uid()
  const keeperPerimeter = round(workingWidth * Math.PI)
  const keeperY = workingWidth + 10
  shapes.push(...makeRect(0, keeperY, keeperWidth, keeperPerimeter, layerId, lineTypeId, keeperGroupId))

  return {
    shapes,
    description: `Watch strap: ${round(workingTotalLength)}mm total, ${workingWidth}mm lug width, ${workingBuckleWidth}mm buckle width, ${tipShape} tip, ${holeCount} holes, with keeper`,
  }
}

// ---------------------------------------------------------------------------
// 2. Pass Case
// ---------------------------------------------------------------------------

export function generatePassCase(params: PassCaseParams): WizardResult {
  const {
    cardWidth, cardHeight, sourceWidth, sourceHeight, stitchPitchMm = 0, stitchSpaceMm = 0, margin, cornerRadius,
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

  if (stitchSpaceMm > 0) {
    const stitchInset = Math.min(stitchSpaceMm, Math.max(1, bodyW / 4), Math.max(1, bodyH / 4))
    const stitchX = ox + stitchInset
    const stitchY = oy + stitchInset
    const stitchW = Math.max(1, bodyW - stitchInset * 2)
    const stitchH = Math.max(1, bodyH - stitchInset * 2)
    shapes.push(...makeRoundedRect(
      stitchX,
      stitchY,
      stitchW,
      stitchH,
      Math.max(0, cornerRadius - stitchInset),
      layerId,
      lineTypeId,
      groupId,
    ))
    if (stitchPitchMm > 0) {
      const pitch = Math.max(0.2, stitchPitchMm)
      const markRadius = Math.min(0.6, Math.max(0.25, pitch * 0.12))
      for (let x = stitchX; x <= stitchX + stitchW + 1e-6; x += pitch) {
        shapes.push(...makeCircleArcs(round(x), round(stitchY), markRadius, layerId, lineTypeId, groupId))
        shapes.push(...makeCircleArcs(round(x), round(stitchY + stitchH), markRadius, layerId, lineTypeId, groupId))
      }
      for (let y = stitchY + pitch; y < stitchY + stitchH - 1e-6; y += pitch) {
        shapes.push(...makeCircleArcs(round(stitchX), round(y), markRadius, layerId, lineTypeId, groupId))
        shapes.push(...makeCircleArcs(round(stitchX + stitchW), round(y), markRadius, layerId, lineTypeId, groupId))
      }
    }
  }

  return {
    shapes,
    description: `Pass case: ${round(bodyW)}x${round(bodyH)}mm body${sourceWidth && sourceHeight ? ` from ${sourceWidth}x${sourceHeight}mm source sizing` : ''}, pitch ${stitchPitchMm}mm, space ${stitchSpaceMm}mm, ${pocketCount} pocket(s)${flapHeight > 0 ? `, ${flapHeight}mm flap` : ''}`,
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
  const {
    length,
    width,
    height,
    materialThickness,
    lidMode = 'none',
    grooveDepthMm = 0,
    grooveOffsetMm = 0,
    kerfCompensationMm = 0,
    pinOverhangMm = 0,
    bottomOffsetMm = 0,
    sameThickness = true,
    frontThicknessMm = materialThickness,
    backThicknessMm = materialThickness,
    leftThicknessMm = materialThickness,
    rightThicknessMm = materialThickness,
    bottomThicknessMm = materialThickness,
    lidThicknessMm = materialThickness,
    fingerCount,
    layerId,
    lineTypeId,
  } = params
  const shapes: Shape[] = []
  const groupId = uid()
  const panelThickness = (value: number) => Math.max(0.1, sameThickness ? materialThickness : value)
  const frontThickness = panelThickness(frontThicknessMm)
  const backThickness = panelThickness(backThicknessMm)
  const leftThickness = panelThickness(leftThicknessMm)
  const rightThickness = panelThickness(rightThicknessMm)
  const bottomThickness = panelThickness(bottomThicknessMm)
  const effectiveLength = Math.max(1, length + kerfCompensationMm * 2)
  const effectiveWidth = Math.max(1, width + kerfCompensationMm * 2)
  const effectiveHeight = Math.max(1, height + pinOverhangMm)

  // Cross / plus layout:
  //           [back]
  //  [left]  [bottom]  [right]
  //           [front]
  const gap = 2

  // Bottom panel position (center of the cross)
  const bx = height + gap + bottomOffsetMm
  const by = height + gap + bottomOffsetMm

  // Bottom panel: simple rectangle
  shapes.push(...makeRect(bx, by, effectiveLength, effectiveWidth, layerId, lineTypeId, groupId))

  // --- Front panel (below bottom) ---
  const fx = bx
  const fy = by + effectiveWidth + gap
  shapes.push(makeLine(
    { x: round(fx), y: round(fy) },
    { x: round(fx), y: round(fy + effectiveHeight) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(
    { x: round(fx + effectiveLength), y: round(fy) },
    { x: round(fx + effectiveLength), y: round(fy + effectiveHeight) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(...makeFingerEdge(fx, fy, effectiveLength, fingerCount, -frontThickness, true, layerId, lineTypeId, groupId))
  shapes.push(...makeFingerEdge(fx, fy + effectiveHeight, effectiveLength, fingerCount, frontThickness, false, layerId, lineTypeId, groupId))

  // --- Back panel (above bottom) ---
  const backX = bx
  const backY = by - gap - effectiveHeight
  shapes.push(makeLine(
    { x: round(backX), y: round(backY) },
    { x: round(backX), y: round(backY + effectiveHeight) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(
    { x: round(backX + effectiveLength), y: round(backY) },
    { x: round(backX + effectiveLength), y: round(backY + effectiveHeight) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(...makeFingerEdge(backX, backY, effectiveLength, fingerCount, -backThickness, false, layerId, lineTypeId, groupId))
  shapes.push(...makeFingerEdge(backX, backY + effectiveHeight, effectiveLength, fingerCount, backThickness, true, layerId, lineTypeId, groupId))

  // --- Left panel (left of bottom) ---
  const lx = bx - gap - effectiveWidth
  const ly = by
  shapes.push(makeLine(
    { x: round(lx), y: round(ly) },
    { x: round(lx + effectiveWidth), y: round(ly) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(
    { x: round(lx), y: round(ly + effectiveHeight) },
    { x: round(lx + effectiveWidth), y: round(ly + effectiveHeight) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(...makeFingerEdgeVertical(lx, ly, effectiveHeight, fingerCount, -leftThickness, false, layerId, lineTypeId, groupId))
  shapes.push(...makeFingerEdgeVertical(lx + effectiveWidth, ly, effectiveHeight, fingerCount, leftThickness, true, layerId, lineTypeId, groupId))

  // --- Right panel (right of bottom) ---
  const rx = bx + effectiveLength + gap
  const ry = by
  shapes.push(makeLine(
    { x: round(rx), y: round(ry) },
    { x: round(rx + effectiveWidth), y: round(ry) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(
    { x: round(rx), y: round(ry + effectiveHeight) },
    { x: round(rx + effectiveWidth), y: round(ry + effectiveHeight) },
    layerId, lineTypeId, groupId,
  ))
  shapes.push(...makeFingerEdgeVertical(rx, ry, effectiveHeight, fingerCount, -rightThickness, true, layerId, lineTypeId, groupId))
  shapes.push(...makeFingerEdgeVertical(rx + effectiveWidth, ry, effectiveHeight, fingerCount, rightThickness, false, layerId, lineTypeId, groupId))

  if (lidMode !== 'none') {
    const lidGroupId = uid()
    const lidY = fy + effectiveHeight + gap + Math.max(2, lidThicknessMm)
    shapes.push(...makeRect(bx, lidY, effectiveLength, effectiveWidth, layerId, lineTypeId, lidGroupId))
    if (lidMode === 'sliding' && grooveDepthMm > 0) {
      const grooveInset = Math.max(0, grooveOffsetMm)
      shapes.push(makeLine(
        { x: round(bx + grooveInset), y: round(lidY + grooveInset) },
        { x: round(bx + effectiveLength - grooveInset), y: round(lidY + grooveInset) },
        layerId,
        lineTypeId,
        lidGroupId,
      ))
      shapes.push(makeLine(
        { x: round(bx + grooveInset), y: round(lidY + effectiveWidth - grooveInset) },
        { x: round(bx + effectiveLength - grooveInset), y: round(lidY + effectiveWidth - grooveInset) },
        layerId,
        lineTypeId,
        lidGroupId,
      ))
    }
  }

  return {
    shapes,
    description: `Box with finger joints: ${effectiveLength}x${effectiveWidth}x${effectiveHeight}mm, ${sameThickness ? `${materialThickness}mm` : 'independent'} thickness, bottom ${bottomThickness}mm, ${fingerCount} fingers per edge, lid ${lidMode}, groove ${grooveDepthMm}mm`,
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
  flattenPath: boolean,
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

  if (flattenPath) {
    result.push(makeLine(p1, p2, layerId, lineTypeId, groupId))
    result.push(makeLine(p2, p3, layerId, lineTypeId, groupId))
    result.push(makeLine(p3, p4, layerId, lineTypeId, groupId))
    result.push(makeLine(p4, p5, layerId, lineTypeId, groupId))
    result.push(makeLine(p5, p6, layerId, lineTypeId, groupId))
    result.push(makeLine(p6, p7, layerId, lineTypeId, groupId))
  } else {
    // Tab shape using bezier curves
    result.push(makeBezier(p1, p2, p3, layerId, lineTypeId, groupId))
    result.push(makeBezier(p3, p4, p5, layerId, lineTypeId, groupId))
    result.push(makeBezier(p5, p6, p7, layerId, lineTypeId, groupId))
  }

  // Straight segment after tab
  if (edgeLen - neckEnd > 1e-3) {
    result.push(makeLine(p7, end, layerId, lineTypeId, groupId))
  }

  return result
}

export function generateJigsaw(params: JigsawParams): WizardResult {
  const { columns, rows, pieceSize, tabDepth, tabWidth, randomSeed = 1, randomizeTabs = false, flatEdges = true, flattenPath = false, layerId, lineTypeId } = params
  const shapes: Shape[] = []
  const groupId = uid()
  const totalW = columns * pieceSize
  const totalH = rows * pieceSize
  let seed = Math.max(1, Math.round(randomSeed))
  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  if (flatEdges) {
    shapes.push(...makeRect(0, 0, totalW, totalH, layerId, lineTypeId, groupId))
  } else {
    for (let col = 0; col < columns; col++) {
      const xStart = col * pieceSize
      const xEnd = (col + 1) * pieceSize
      shapes.push(...makeJigsawEdge(
        { x: round(xStart), y: 0 },
        { x: round(xEnd), y: 0 },
        tabDepth, tabWidth, randomizeTabs ? nextRandom() >= 0.5 : col % 2 === 0, flattenPath, layerId, lineTypeId, groupId,
      ))
      shapes.push(...makeJigsawEdge(
        { x: round(xStart), y: totalH },
        { x: round(xEnd), y: totalH },
        tabDepth, tabWidth, randomizeTabs ? nextRandom() >= 0.5 : col % 2 !== 0, flattenPath, layerId, lineTypeId, groupId,
      ))
    }
    for (let row = 0; row < rows; row++) {
      const yStart = row * pieceSize
      const yEnd = (row + 1) * pieceSize
      shapes.push(...makeJigsawEdge(
        { x: 0, y: round(yStart) },
        { x: 0, y: round(yEnd) },
        tabDepth, tabWidth, randomizeTabs ? nextRandom() >= 0.5 : row % 2 !== 0, flattenPath, layerId, lineTypeId, groupId,
      ))
      shapes.push(...makeJigsawEdge(
        { x: totalW, y: round(yStart) },
        { x: totalW, y: round(yEnd) },
        tabDepth, tabWidth, randomizeTabs ? nextRandom() >= 0.5 : row % 2 === 0, flattenPath, layerId, lineTypeId, groupId,
      ))
    }
  }

  // Internal vertical edges
  for (let col = 1; col < columns; col++) {
    const x = col * pieceSize
    for (let row = 0; row < rows; row++) {
      const yStart = row * pieceSize
      const yEnd = (row + 1) * pieceSize
      const tabOut = randomizeTabs ? nextRandom() >= 0.5 : (col + row) % 2 === 0
      shapes.push(...makeJigsawEdge(
        { x: round(x), y: round(yStart) },
        { x: round(x), y: round(yEnd) },
        tabDepth, tabWidth, tabOut, flattenPath, layerId, lineTypeId, groupId,
      ))
    }
  }

  // Internal horizontal edges
  for (let row = 1; row < rows; row++) {
    const y = row * pieceSize
    for (let col = 0; col < columns; col++) {
      const xStart = col * pieceSize
      const xEnd = (col + 1) * pieceSize
      const tabOut = randomizeTabs ? nextRandom() >= 0.5 : (col + row) % 2 === 0
      shapes.push(...makeJigsawEdge(
        { x: round(xStart), y: round(y) },
        { x: round(xEnd), y: round(y) },
        tabDepth, tabWidth, tabOut, flattenPath, layerId, lineTypeId, groupId,
      ))
    }
  }

  return {
    shapes,
    description: `Jigsaw puzzle: ${columns}x${rows} grid, ${pieceSize}mm pieces, ${tabDepth}mm tab depth${flatEdges ? ', flat outer edges' : ', tabbed outer edges'}${randomizeTabs ? `, randomized seed ${randomSeed}` : ''}${flattenPath ? ', flattened path' : ''}`,
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
    panelCount = 6, crownHeightMM,
    panelGapMM = 10,
    seamMM, crownBulge, baseSmile,
    brimDepthMM, brimWidthMM, brimBackRiseMM,
    layerId, lineTypeId,
  } = params

  const shapes: Shape[] = []
  const safePanelCount = Math.max(1, Math.round(panelCount))
  const panelBaseWidth = brimWidthMM / safePanelCount
  const panelHeight = Math.max(20, crownHeightMM ?? brimWidthMM * 0.55)
  const panelGap = Math.max(0, panelGapMM)

  for (let i = 0; i < safePanelCount; i++) {
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
  const crownSpan = safePanelCount * panelBaseWidth + (safePanelCount - 1) * panelGap
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
    description: `Cap pattern: ${safePanelCount} crown panels (base ${round(panelBaseWidth)}mm, height ${round(panelHeight)}mm, gap ${panelGap}mm, bulge ${crownBulge}mm, smile ${baseSmile}mm), brim ${brimWidthMM}×${brimDepthMM}mm (back rise ${brimBackRiseMM}mm), seam ${seamMM}mm`,
  }
}
