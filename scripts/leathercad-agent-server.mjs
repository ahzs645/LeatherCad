#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const ROOT = process.cwd()
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4177
const DEFAULT_MODEL = 'gpt-5.2'
const OPENAI_API_URL = 'https://api.openai.com/v1/responses'

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
}

function parseArgs(argv) {
  const result = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    noOpen: false,
    distDir: path.join(ROOT, 'dist'),
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg === '--no-open') {
      result.noOpen = true
    } else if (arg === '--host') {
      result.host = argv[index + 1] ?? result.host
      index += 1
    } else if (arg.startsWith('--host=')) {
      result.host = arg.slice('--host='.length)
    } else if (arg === '--port') {
      result.port = Number(argv[index + 1] ?? result.port)
      index += 1
    } else if (arg.startsWith('--port=')) {
      result.port = Number(arg.slice('--port='.length))
    } else if (arg === '--dist') {
      result.distDir = path.resolve(argv[index + 1] ?? result.distDir)
      index += 1
    } else if (arg.startsWith('--dist=')) {
      result.distDir = path.resolve(arg.slice('--dist='.length))
    }
  }

  if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535) {
    throw new Error(`Invalid --port value: ${result.port}`)
  }

  return result
}

function printHelp() {
  console.log(`LeatherCad native agent server

Usage:
  leathercad [--host 127.0.0.1] [--port 4177] [--no-open] [--dist ./dist]

Environment:
  OPENAI_API_KEY              Enables OpenAI-backed template refinement.
  LEATHERCAD_OPENAI_MODEL     Optional model override. Defaults to ${DEFAULT_MODEL}.

Without OPENAI_API_KEY the server runs in local-draft mode, which still streams
deterministic template snapshots for testing the live canvas workflow.`)
}

function jsonResponse(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(body)
}

function textResponse(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(body)
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function serveStatic(request, response, distDir) {
  if (!fs.existsSync(distDir)) {
    textResponse(
      response,
      503,
      'LeatherCad dist/ is missing. Run `npm run build` first, or use `npm run agent` to build and serve.',
    )
    return
  }

  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const rawPath = decodeURIComponent(requestUrl.pathname)
  const safePath = rawPath === '/' ? '/index.html' : rawPath
  const candidate = path.resolve(distDir, `.${safePath}`)
  const filePath = isPathInside(distDir, candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : path.join(distDir, 'index.html')
  const extension = path.extname(filePath)
  response.writeHead(200, {
    'content-type': MIME_TYPES[extension] ?? 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
  })
  fs.createReadStream(filePath).pipe(response)
}

function agentStatus() {
  const hasOpenAiKey = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
  return {
    available: true,
    mode: hasOpenAiKey ? 'openai' : 'local-draft',
    model: hasOpenAiKey ? (process.env.LEATHERCAD_OPENAI_MODEL || DEFAULT_MODEL) : null,
    livePreview: true,
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function snake(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_') || 'generated_template'
}

function inferKind(request, currentJson) {
  const lower = `${request} ${currentJson ?? ''}`.toLowerCase()
  if (lower.includes('belt')) return 'belt'
  if (
    lower.includes('compact wallet') ||
    lower.includes('clasp wallet') ||
    lower.includes('snap wallet') ||
    lower.includes('maison') ||
    (lower.includes('wallet') && (lower.includes('snap') || lower.includes('clasp') || lower.includes('flap')))
  ) return 'compact_clasp_wallet'
  if (lower.includes('gusset')) return 'gusseted_pouch'
  if (lower.includes('coin') || lower.includes('snap') || lower.includes('pouch')) return 'snap_coin_pouch'
  if (lower.includes('bifold') || lower.includes('wallet')) return 'bifold_wallet'
  if (lower.includes('card') || lower.includes('sleeve')) return 'card_sleeve'
  return 'card_sleeve'
}

function firstNumberNear(lower, pattern) {
  const match = lower.match(pattern)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function inferPreferences(request) {
  const lower = request.toLowerCase()
  const seamAllowanceMm = firstNumberNear(lower, /(\d+(?:\.\d+)?)\s*mm\s+(?:seam\s+)?allowance/)
    ?? firstNumberNear(lower, /allowance\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*mm/)
  const stitchPitchMm = firstNumberNear(lower, /(\d+(?:\.\d+)?)\s*mm\s+(?:stitch\s+)?pitch/)
    ?? firstNumberNear(lower, /pitch\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*mm/)
  const hardwareDiameterMm = lower.includes('small') ? 3 : 4

  return {
    seamAllowanceMm: seamAllowanceMm ?? 3,
    stitchPitchMm: stitchPitchMm ?? 4,
    hardwareDiameterMm,
    wantsRivets: lower.includes('rivet'),
    wantsSnaps: lower.includes('snap'),
  }
}

function line(id, layerId, start, end, lineRole = 'cut') {
  return { id, type: 'line', layer_id: layerId, start, end, line_role: lineRole }
}

function rectangle(id, layerId, x, y, width, height) {
  return { id, type: 'rectangle', layer_id: layerId, x, y, width, height }
}

function stitchPath(id, layerId, start, end, pitch = 4) {
  return {
    id,
    type: 'stitch_path',
    layer_id: layerId,
    path_type: 'line',
    start,
    end,
    pitch_mm: pitch,
    hole_type: 'slit',
    render_shape: 'diamond',
    width_mm: 1.2,
    height_mm: 0.55,
    tilt_deg: 35,
  }
}

function label(id, layerId, position, value) {
  return {
    id,
    type: 'text',
    layer_id: layerId,
    position,
    value,
    font_size_mm: 6,
    line_role: 'mark',
  }
}

function piece(id, layerId, boundaryEntityId, name, extras = {}) {
  return {
    id,
    type: 'pattern_piece',
    layer_id: layerId,
    boundary_entity_id: boundaryEntityId,
    name,
    quantity: 1,
    material_side: 'either',
    ...extras,
  }
}

function allowance(id, pieceId, offset = 3) {
  return { id, type: 'seam_allowance', piece_id: pieceId, default_offset_mm: offset }
}

function seam(id, fromPiece, fromEdge, toPiece, toEdge, extras = {}) {
  return {
    id,
    type: 'seam_connection',
    from: { piece_id: fromPiece, edge_index: fromEdge },
    to: { piece_id: toPiece, edge_index: toEdge, reversed: true },
    kind: 'sewn',
    stitch_spacing_mm: 4,
    tolerance_mm: 2,
    ...extras,
  }
}

function hardware(id, layerId, point, kind, labelText, holeDiameterMm = 4) {
  return {
    id,
    type: 'hardware_marker',
    layer_id: layerId,
    point,
    kind,
    label: labelText,
    hole_diameter_mm: holeDiameterMm,
    installation_side: 'grain',
  }
}

function makeDoc(documentName, layers, entities) {
  return {
    schema_version: 1,
    document_name: documentName,
    units: 'mm',
    layers,
    entities,
  }
}

function buildCardSleeve(stage, preferences = inferPreferences('')) {
  const layers = [{ id: 'sleeve', name: 'Sleeve' }]
  const entities = [
    rectangle('back_panel_outline', 'sleeve', 0, 0, 72, 105),
    rectangle('front_pocket_outline', 'sleeve', 92, 27, 72, 78),
    piece('back_panel_piece', 'sleeve', 'back_panel_outline', 'Back Panel', { code: 'A' }),
    piece('front_pocket_piece', 'sleeve', 'front_pocket_outline', 'Front Pocket', { code: 'B' }),
  ]
  if (stage >= 2) {
    entities.push(
      allowance('back_panel_allowance', 'back_panel_piece', preferences.seamAllowanceMm),
      allowance('front_pocket_allowance', 'front_pocket_piece', preferences.seamAllowanceMm),
      stitchPath('back_left_stitches', 'sleeve', { x: 5, y: 28 }, { x: 5, y: 100 }, preferences.stitchPitchMm),
      stitchPath('back_bottom_stitches', 'sleeve', { x: 5, y: 100 }, { x: 67, y: 100 }, preferences.stitchPitchMm),
      stitchPath('back_right_stitches', 'sleeve', { x: 67, y: 28 }, { x: 67, y: 100 }, preferences.stitchPitchMm),
      stitchPath('front_left_stitches', 'sleeve', { x: 97, y: 32 }, { x: 97, y: 100 }, preferences.stitchPitchMm),
      stitchPath('front_bottom_stitches', 'sleeve', { x: 97, y: 100 }, { x: 159, y: 100 }, preferences.stitchPitchMm),
      stitchPath('front_right_stitches', 'sleeve', { x: 159, y: 32 }, { x: 159, y: 100 }, preferences.stitchPitchMm),
    )
  }
  if (stage >= 3) {
    entities.push(
      seam('left_side_seam', 'back_panel_piece', 3, 'front_pocket_piece', 3),
      seam('right_side_seam', 'back_panel_piece', 1, 'front_pocket_piece', 1),
      seam('bottom_seam', 'back_panel_piece', 2, 'front_pocket_piece', 2),
      label('back_panel_label', 'sleeve', { x: 20, y: 52 }, 'Back Panel'),
      label('front_pocket_label', 'sleeve', { x: 110, y: 70 }, 'Front Pocket'),
    )
    if (preferences.wantsRivets) {
      entities.push(
        hardware('top_left_rivet_marker', 'sleeve', { x: 8, y: 8 }, 'rivet', 'Top Rivet L', preferences.hardwareDiameterMm),
        hardware('top_right_rivet_marker', 'sleeve', { x: 64, y: 8 }, 'rivet', 'Top Rivet R', preferences.hardwareDiameterMm),
      )
    }
  }
  return makeDoc('live_card_sleeve', layers, entities)
}

function buildBifoldWallet(stage, preferences = inferPreferences('')) {
  const layers = [{ id: 'wallet', name: 'Wallet' }]
  const entities = [
    rectangle('outer_shell_outline', 'wallet', 0, 0, 220, 90),
    rectangle('left_pocket_outline', 'wallet', 8, 26, 95, 64),
    rectangle('right_pocket_outline', 'wallet', 117, 26, 95, 64),
    piece('outer_shell_piece', 'wallet', 'outer_shell_outline', 'Outer Shell', { code: 'A' }),
    piece('left_pocket_piece', 'wallet', 'left_pocket_outline', 'Left Pocket', { code: 'B' }),
    piece('right_pocket_piece', 'wallet', 'right_pocket_outline', 'Right Pocket', { code: 'C' }),
  ]
  if (stage >= 2) {
    entities.push(
      { id: 'center_fold', type: 'fold', start: { x: 110, y: 0 }, end: { x: 110, y: 90 }, name: 'Center Fold', direction: 'valley', angle_deg: 180, radius_mm: 2, thickness_mm: 1.4 },
      allowance('outer_shell_allowance', 'outer_shell_piece', preferences.seamAllowanceMm),
      allowance('left_pocket_allowance', 'left_pocket_piece', preferences.seamAllowanceMm),
      allowance('right_pocket_allowance', 'right_pocket_piece', preferences.seamAllowanceMm),
      stitchPath('left_pocket_left_stitches', 'wallet', { x: 12, y: 30 }, { x: 12, y: 84 }, preferences.stitchPitchMm),
      stitchPath('left_pocket_bottom_stitches', 'wallet', { x: 12, y: 84 }, { x: 99, y: 84 }, preferences.stitchPitchMm),
      stitchPath('right_pocket_right_stitches', 'wallet', { x: 208, y: 30 }, { x: 208, y: 84 }, preferences.stitchPitchMm),
      stitchPath('right_pocket_bottom_stitches', 'wallet', { x: 121, y: 84 }, { x: 208, y: 84 }, preferences.stitchPitchMm),
    )
  }
  if (stage >= 3) {
    entities.push(
      seam('left_pocket_bottom_seam', 'left_pocket_piece', 2, 'outer_shell_piece', 2, { to: { piece_id: 'outer_shell_piece', edge_index: 2, t0: 0.04, t1: 0.47, reversed: true } }),
      seam('left_pocket_outer_seam', 'left_pocket_piece', 3, 'outer_shell_piece', 3),
      seam('right_pocket_bottom_seam', 'right_pocket_piece', 2, 'outer_shell_piece', 2, { to: { piece_id: 'outer_shell_piece', edge_index: 2, t0: 0.53, t1: 0.96, reversed: true } }),
      seam('right_pocket_outer_seam', 'right_pocket_piece', 1, 'outer_shell_piece', 1),
      label('outer_shell_label', 'wallet', { x: 82, y: -8 }, 'Outer Shell 220x90'),
      label('center_fold_label', 'wallet', { x: 114, y: 46 }, 'Center Fold'),
      label('left_pocket_label', 'wallet', { x: 22, y: 86 }, 'Left Pocket 95x64'),
      label('right_pocket_label', 'wallet', { x: 132, y: 86 }, 'Right Pocket 95x64'),
    )
  }
  return makeDoc('live_bifold_wallet', layers, entities)
}

function buildCompactClaspWallet(stage, preferences = inferPreferences('')) {
  const layers = [
    { id: 'shell', name: 'Outer Shell and Flap' },
    { id: 'pockets', name: 'Card and Cash Pockets' },
    { id: 'hardware', name: 'Snap Hardware and Guides' },
  ]
  const entities = [
    rectangle('shell_rectangular_cut_envelope', 'shell', 0, 0, 92, 172),
    rectangle('back_cash_sleeve_outline', 'pockets', 112, 48, 82, 102),
    rectangle('middle_card_pocket_outline', 'pockets', 214, 72, 76, 54),
    rectangle('front_card_pocket_outline', 'pockets', 310, 104, 80, 48),
    piece('shell_piece', 'shell', 'shell_rectangular_cut_envelope', 'One-piece shell with rounded clasp flap', { code: 'A' }),
    piece('back_cash_sleeve_piece', 'pockets', 'back_cash_sleeve_outline', 'Back cash sleeve', { code: 'B' }),
    piece('middle_card_pocket_piece', 'pockets', 'middle_card_pocket_outline', 'Middle card pocket', { code: 'C' }),
    piece('front_card_pocket_piece', 'pockets', 'front_card_pocket_outline', 'Front card pocket', { code: 'D' }),
  ]

  if (stage >= 2) {
    entities.push(
      { id: 'rounded_flap_right_profile', type: 'bezier', layer_id: 'shell', start: { x: 92, y: 36 }, control: { x: 76, y: -10 }, end: { x: 46, y: 0 }, line_role: 'guide' },
      { id: 'rounded_flap_left_profile', type: 'bezier', layer_id: 'shell', start: { x: 46, y: 0 }, control: { x: 16, y: -10 }, end: { x: 0, y: 36 }, line_role: 'guide' },
      { id: 'visible_flap_lip', type: 'bezier', layer_id: 'shell', start: { x: 6, y: 54 }, control: { x: 46, y: 75 }, end: { x: 86, y: 54 }, line_role: 'guide' },
      { id: 'cash_sleeve_scoop', type: 'bezier', layer_id: 'pockets', start: { x: 112, y: 48 }, control: { x: 153, y: 68 }, end: { x: 194, y: 48 }, line_role: 'guide' },
      { id: 'middle_pocket_scoop', type: 'bezier', layer_id: 'pockets', start: { x: 214, y: 72 }, control: { x: 252, y: 93 }, end: { x: 290, y: 72 }, line_role: 'guide' },
      { id: 'front_pocket_scoop', type: 'bezier', layer_id: 'pockets', start: { x: 310, y: 104 }, control: { x: 350, y: 123 }, end: { x: 390, y: 104 }, line_role: 'guide' },
      { id: 'flap_fold', type: 'fold', start: { x: 8, y: 38 }, end: { x: 84, y: 38 }, name: 'Rounded flap fold', direction: 'mountain', angle_deg: 74, max_angle_deg: 180, radius_mm: 2.2, thickness_mm: 1.5, clearance_mm: 1.5 },
      { id: 'front_pocket_flex_fold', type: 'fold', start: { x: 310, y: 126 }, end: { x: 390, y: 126 }, name: 'Front pocket flex fold', direction: 'valley', angle_deg: 18, max_angle_deg: 90, radius_mm: 1, thickness_mm: 1.2, clearance_mm: 0.6 },
      allowance('shell_allowance', 'shell_piece', preferences.seamAllowanceMm),
      allowance('back_cash_sleeve_allowance', 'back_cash_sleeve_piece', preferences.seamAllowanceMm),
      allowance('middle_card_pocket_allowance', 'middle_card_pocket_piece', preferences.seamAllowanceMm),
      allowance('front_card_pocket_allowance', 'front_card_pocket_piece', preferences.seamAllowanceMm),
      stitchPath('shell_left_stitches', 'shell', { x: 7, y: 42 }, { x: 7, y: 160 }, preferences.stitchPitchMm),
      stitchPath('shell_bottom_stitches', 'shell', { x: 7, y: 160 }, { x: 85, y: 160 }, preferences.stitchPitchMm),
      stitchPath('shell_right_stitches', 'shell', { x: 85, y: 160 }, { x: 85, y: 42 }, preferences.stitchPitchMm),
      { id: 'flap_crown_stitches', type: 'stitch_path', layer_id: 'shell', path_type: 'bezier', start: { x: 10, y: 42 }, control: { x: 46, y: 11 }, end: { x: 82, y: 42 }, pitch_mm: preferences.stitchPitchMm, hole_type: 'slit', render_shape: 'diamond', width_mm: 1.2, height_mm: 0.55, tilt_deg: 35 },
      stitchPath('cash_sleeve_left_stitches', 'pockets', { x: 118, y: 62 }, { x: 118, y: 142 }, preferences.stitchPitchMm),
      stitchPath('cash_sleeve_bottom_stitches', 'pockets', { x: 118, y: 142 }, { x: 188, y: 142 }, preferences.stitchPitchMm),
      stitchPath('cash_sleeve_right_stitches', 'pockets', { x: 188, y: 62 }, { x: 188, y: 142 }, preferences.stitchPitchMm),
      stitchPath('middle_card_bottom_stitches', 'pockets', { x: 222, y: 119 }, { x: 282, y: 119 }, preferences.stitchPitchMm),
      stitchPath('front_card_bottom_stitches', 'pockets', { x: 318, y: 145 }, { x: 382, y: 145 }, preferences.stitchPitchMm),
    )
  }

  if (stage >= 3) {
    entities.push(
      seam('cash_sleeve_bottom_to_shell', 'back_cash_sleeve_piece', 2, 'shell_piece', 2, { stitch_spacing_mm: preferences.stitchPitchMm, tolerance_mm: 12 }),
      seam('middle_card_bottom_to_shell', 'middle_card_pocket_piece', 2, 'shell_piece', 2, { stitch_spacing_mm: preferences.stitchPitchMm, tolerance_mm: 16 }),
      seam('front_card_bottom_to_shell', 'front_card_pocket_piece', 2, 'shell_piece', 2, { stitch_spacing_mm: preferences.stitchPitchMm, tolerance_mm: 16 }),
      hardware('flap_snap_cap', 'hardware', { x: 46, y: 24 }, 'snap', 'Flap snap cap', preferences.hardwareDiameterMm),
      hardware('body_snap_socket', 'hardware', { x: 46, y: 112 }, 'snap', 'Body snap socket', preferences.hardwareDiameterMm),
      line('snap_centerline', 'hardware', { x: 46, y: 24 }, { x: 46, y: 112 }, 'guide'),
      label('shell_label', 'shell', { x: 10, y: 178 }, 'rounded flap shell'),
      label('cash_sleeve_label', 'pockets', { x: 124, y: 158 }, 'cash sleeve'),
      label('middle_card_label', 'pockets', { x: 224, y: 136 }, 'middle card'),
      label('front_card_label', 'pockets', { x: 322, y: 162 }, 'front card'),
    )
  }
  return makeDoc('live_compact_clasp_wallet', layers, entities)
}

function buildSnapCoinPouch(stage, preferences = inferPreferences('')) {
  const layers = [{ id: 'pouch', name: 'Pouch' }]
  const entities = [
    rectangle('body_outline', 'pouch', 0, 0, 160, 135),
    piece('body_piece', 'pouch', 'body_outline', 'Snap Coin Pouch Body', { code: 'A' }),
  ]
  if (stage >= 2) {
    entities.push(
      { id: 'flap_fold', type: 'fold', start: { x: 10, y: 70 }, end: { x: 150, y: 70 }, name: 'Fold flap to body', direction: 'valley', angle_deg: 165, radius_mm: 2.2, thickness_mm: 1.6 },
      allowance('body_allowance', 'body_piece', preferences.seamAllowanceMm),
      stitchPath('left_side_stitches', 'pouch', { x: 10, y: 20 }, { x: 10, y: 125 }, preferences.stitchPitchMm),
      stitchPath('right_side_stitches', 'pouch', { x: 150, y: 20 }, { x: 150, y: 125 }, preferences.stitchPitchMm),
    )
  }
  if (stage >= 3) {
    entities.push(
      seam('left_side_self_seam', 'body_piece', 3, 'body_piece', 1, { kind: 'aligned' }),
      seam('top_bottom_alignment', 'body_piece', 0, 'body_piece', 2, { kind: 'hinge' }),
      hardware('snap_cap_marker', 'pouch', { x: 80, y: 38 }, 'snap', 'Snap Cap', preferences.hardwareDiameterMm),
      hardware('snap_socket_marker', 'pouch', { x: 80, y: 98 }, 'snap', 'Snap Socket', preferences.hardwareDiameterMm),
      label('fold_label', 'pouch', { x: 16, y: 66 }, 'fold flap to body'),
      label('stitch_label', 'pouch', { x: 2, y: 128 }, 'side seam stitch lines'),
    )
  }
  return makeDoc('live_snap_coin_pouch', layers, entities)
}

function buildBeltTemplate(stage, preferences = inferPreferences('')) {
  const layers = [{ id: 'belt', name: 'Belt' }]
  const entities = [
    rectangle('belt_strap_outline', 'belt', 0, 0, 980, 38),
    piece('belt_strap_piece', 'belt', 'belt_strap_outline', 'Belt Strap', { code: 'A', orientation: 'horizontal' }),
  ]
  if (stage >= 2) {
    entities.push(
      allowance('belt_edge_allowance', 'belt_strap_piece', 2),
      stitchPath('top_edge_stitches', 'belt', { x: 20, y: 6 }, { x: 960, y: 6 }, preferences.stitchPitchMm),
      stitchPath('bottom_edge_stitches', 'belt', { x: 20, y: 32 }, { x: 960, y: 32 }, preferences.stitchPitchMm),
      line('buckle_fold_guide', 'belt', { x: 95, y: 0 }, { x: 95, y: 38 }, 'guide'),
      line('keeper_slot_guide', 'belt', { x: 145, y: 0 }, { x: 145, y: 38 }, 'guide'),
    )
  }
  if (stage >= 3) {
    entities.push(
      seam('belt_long_edge_alignment', 'belt_strap_piece', 0, 'belt_strap_piece', 2, { kind: 'aligned', stitch_spacing_mm: preferences.stitchPitchMm }),
      hardware('buckle_rivet_left', 'belt', { x: 55, y: 19 }, 'rivet', 'Buckle Rivet L', 4),
      hardware('buckle_rivet_right', 'belt', { x: 78, y: 19 }, 'rivet', 'Buckle Rivet R', 4),
      hardware('adjustment_hole_01', 'belt', { x: 780, y: 19 }, 'custom', 'Hole 1', 4),
      hardware('adjustment_hole_02', 'belt', { x: 805, y: 19 }, 'custom', 'Hole 2', 4),
      hardware('adjustment_hole_03', 'belt', { x: 830, y: 19 }, 'custom', 'Hole 3', 4),
      hardware('adjustment_hole_04', 'belt', { x: 855, y: 19 }, 'custom', 'Hole 4', 4),
      hardware('adjustment_hole_05', 'belt', { x: 880, y: 19 }, 'custom', 'Hole 5', 4),
      label('buckle_fold_label', 'belt', { x: 72, y: -4 }, 'Buckle fold-back'),
      label('keeper_label', 'belt', { x: 128, y: -4 }, 'Keeper'),
    )
  }
  return makeDoc('live_belt_template', layers, entities)
}

function buildGussetedPouch(stage, preferences = inferPreferences('')) {
  const layers = [{ id: 'gusseted_pouch', name: 'Gusseted Pouch' }]
  const entities = [
    rectangle('front_panel_outline', 'gusseted_pouch', 0, 0, 120, 95),
    rectangle('back_panel_outline', 'gusseted_pouch', 150, 0, 120, 95),
    rectangle('gusset_strip_outline', 'gusseted_pouch', 292, 0, 35, 270),
    piece('front_panel_piece', 'gusseted_pouch', 'front_panel_outline', 'Front Panel', { code: 'A' }),
    piece('back_panel_piece', 'gusseted_pouch', 'back_panel_outline', 'Back Panel', { code: 'B' }),
    piece('gusset_strip_piece', 'gusseted_pouch', 'gusset_strip_outline', 'Gusset Strip', { code: 'C', orientation: 'vertical' }),
  ]
  if (stage >= 2) {
    entities.push(
      allowance('front_panel_allowance', 'front_panel_piece', preferences.seamAllowanceMm),
      allowance('back_panel_allowance', 'back_panel_piece', preferences.seamAllowanceMm),
      allowance('gusset_strip_allowance', 'gusset_strip_piece', preferences.seamAllowanceMm),
      stitchPath('front_left_stitches', 'gusseted_pouch', { x: 5, y: 5 }, { x: 5, y: 90 }, preferences.stitchPitchMm),
      stitchPath('front_bottom_stitches', 'gusseted_pouch', { x: 5, y: 90 }, { x: 115, y: 90 }, preferences.stitchPitchMm),
      stitchPath('front_right_stitches', 'gusseted_pouch', { x: 115, y: 5 }, { x: 115, y: 90 }, preferences.stitchPitchMm),
      stitchPath('back_left_stitches', 'gusseted_pouch', { x: 155, y: 5 }, { x: 155, y: 90 }, preferences.stitchPitchMm),
      stitchPath('back_bottom_stitches', 'gusseted_pouch', { x: 155, y: 90 }, { x: 265, y: 90 }, preferences.stitchPitchMm),
      stitchPath('back_right_stitches', 'gusseted_pouch', { x: 265, y: 5 }, { x: 265, y: 90 }, preferences.stitchPitchMm),
      stitchPath('gusset_left_stitches', 'gusseted_pouch', { x: 297, y: 5 }, { x: 297, y: 265 }, preferences.stitchPitchMm),
      stitchPath('gusset_right_stitches', 'gusseted_pouch', { x: 322, y: 5 }, { x: 322, y: 265 }, preferences.stitchPitchMm),
    )
  }
  if (stage >= 3) {
    entities.push(
      seam('front_left_to_gusset', 'front_panel_piece', 3, 'gusset_strip_piece', 3, { to: { piece_id: 'gusset_strip_piece', edge_index: 3, t0: 0, t1: 0.31, reversed: true } }),
      seam('front_bottom_to_gusset', 'front_panel_piece', 2, 'gusset_strip_piece', 3, { to: { piece_id: 'gusset_strip_piece', edge_index: 3, t0: 0.31, t1: 0.72, reversed: true } }),
      seam('front_right_to_gusset', 'front_panel_piece', 1, 'gusset_strip_piece', 3, { to: { piece_id: 'gusset_strip_piece', edge_index: 3, t0: 0.72, t1: 1, reversed: true } }),
      seam('back_left_to_gusset', 'back_panel_piece', 3, 'gusset_strip_piece', 1, { to: { piece_id: 'gusset_strip_piece', edge_index: 1, t0: 0, t1: 0.31, reversed: true } }),
      seam('back_bottom_to_gusset', 'back_panel_piece', 2, 'gusset_strip_piece', 1, { to: { piece_id: 'gusset_strip_piece', edge_index: 1, t0: 0.31, t1: 0.72, reversed: true } }),
      seam('back_right_to_gusset', 'back_panel_piece', 1, 'gusset_strip_piece', 1, { to: { piece_id: 'gusset_strip_piece', edge_index: 1, t0: 0.72, t1: 1, reversed: true } }),
      label('front_panel_label', 'gusseted_pouch', { x: 24, y: 50 }, 'Front Panel'),
      label('back_panel_label', 'gusseted_pouch', { x: 178, y: 50 }, 'Back Panel'),
      label('gusset_label', 'gusseted_pouch', { x: 296, y: 138 }, 'Gusset Strip'),
    )
  }
  return makeDoc('live_gusseted_pouch', layers, entities)
}

function buildLocalDraftSnapshots(request, currentJson) {
  const kind = inferKind(request, currentJson)
  const preferences = inferPreferences(request)
  const builders = {
    belt: buildBeltTemplate,
    bifold_wallet: buildBifoldWallet,
    card_sleeve: buildCardSleeve,
    compact_clasp_wallet: buildCompactClaspWallet,
    gusseted_pouch: buildGussetedPouch,
    snap_coin_pouch: buildSnapCoinPouch,
  }
  const builder = builders[kind] ?? buildCardSleeve
  const label = snake(kind)
  return [1, 2, 3].map((stage) => ({
    label: `${label}_stage_${stage}`,
    stage,
    document: builder(stage, preferences),
  }))
}

function extractJsonText(value) {
  if (!value) return ''
  if (typeof value.output_text === 'string') return value.output_text
  if (Array.isArray(value.output)) {
    return value.output
      .flatMap((item) => Array.isArray(item.content) ? item.content : [])
      .map((content) => content?.text ?? '')
      .join('')
  }
  return ''
}

function openAiInstructions() {
  return [
    'You generate LeatherCad AI Builder JSON for leather templates.',
    'Return only a single JSON object. Do not use markdown.',
    'Use schema_version 1, units "mm", non-empty layers, and supported entities only.',
    'Supported entity types: rectangle, line, arc, bezier, text, fold, stitch_path, pattern_piece, seam_allowance, seam_connection, hardware_marker.',
    'Prefer leather-native entities for intent: pattern_piece, seam_allowance, seam_connection, stitch_path, hardware_marker.',
    'Use stable snake_case IDs. Keep closed cut boundaries simple and inspectable.',
    'Use practical leather dimensions in millimeters. Positive x moves right; positive y moves down.',
    'A pattern_piece boundary_entity_id should usually reference a rectangle entity.',
    'For stitch_path, use path_type line/arc/bezier, pitch_mm, and slanted diamond slit holes when relevant.',
    'For refinements, output the full updated JSON document.',
  ].join('\n')
}

async function generateOpenAiJson({ request, currentJson, draftJson }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.LEATHERCAD_OPENAI_MODEL || DEFAULT_MODEL
  const input = [
    `User request:\n${request}`,
    currentJson ? `Current LeatherCad AI Builder JSON to refine:\n${currentJson}` : '',
    `Current live draft JSON from deterministic generator:\n${draftJson}`,
    'Improve or replace the draft while preserving the LeatherCad AI Builder schema.',
  ].filter(Boolean).join('\n\n')

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: openAiInstructions(),
      input,
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 500)}`)
  }

  const payload = await response.json()
  return extractJsonText(payload).trim()
}

function sendFrame(socket, payload) {
  if (socket.destroyed) return
  const body = Buffer.from(payload)
  let header
  if (body.length < 126) {
    header = Buffer.from([0x81, body.length])
  } else if (body.length <= 0xffff) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(body.length, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(body.length), 2)
  }
  socket.write(Buffer.concat([header, body]))
}

function sendEvent(socket, event) {
  sendFrame(socket, JSON.stringify({ ...event, createdAt: new Date().toISOString() }))
}

function decodeFrames(state, chunk) {
  state.buffer = Buffer.concat([state.buffer, chunk])
  const messages = []

  while (state.buffer.length >= 2) {
    const first = state.buffer[0]
    const second = state.buffer[1]
    const opcode = first & 0x0f
    const masked = (second & 0x80) === 0x80
    let length = second & 0x7f
    let offset = 2

    if (length === 126) {
      if (state.buffer.length < offset + 2) break
      length = state.buffer.readUInt16BE(offset)
      offset += 2
    } else if (length === 127) {
      if (state.buffer.length < offset + 8) break
      const longLength = state.buffer.readBigUInt64BE(offset)
      if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('WebSocket frame is too large')
      }
      length = Number(longLength)
      offset += 8
    }

    const maskOffset = offset
    if (masked) offset += 4
    if (state.buffer.length < offset + length) break

    const payload = Buffer.from(state.buffer.subarray(offset, offset + length))
    if (masked) {
      const mask = state.buffer.subarray(maskOffset, maskOffset + 4)
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4]
      }
    }
    state.buffer = state.buffer.subarray(offset + length)

    if (opcode === 0x8) {
      state.closed = true
      break
    }
    if (opcode === 0x1) {
      messages.push(payload.toString('utf8'))
    }
  }

  return messages
}

async function runAgentTurn(socket, input) {
  const turnId = crypto.randomUUID()
  const status = agentStatus()
  sendEvent(socket, { type: 'turn.started', turnId, mode: status.mode, model: status.model })
  sendEvent(socket, { type: 'agent.progress', turnId, message: 'Creating leather-native draft outline.' })

  const snapshots = buildLocalDraftSnapshots(input.request ?? '', input.currentJson)
  for (const snapshot of snapshots) {
    await wait(260)
    sendEvent(socket, {
      type: 'template.snapshot',
      turnId,
      label: snapshot.label,
      stage: snapshot.stage,
      final: status.mode !== 'openai' && snapshot.stage === snapshots.length,
      rawJson: JSON.stringify(snapshot.document, null, 2),
    })
    if (snapshot.stage === 1) {
      sendEvent(socket, { type: 'agent.progress', turnId, message: 'Bound closed outlines to pattern_piece entities.' })
    } else if (snapshot.stage === 2) {
      sendEvent(socket, { type: 'agent.progress', turnId, message: 'Added seam allowances and stitch paths for live preview.' })
    }
  }

  const finalDraftJson = JSON.stringify(snapshots[snapshots.length - 1].document, null, 2)
  if (status.mode === 'openai') {
    try {
      sendEvent(socket, { type: 'agent.progress', turnId, message: `Refining with OpenAI model ${status.model}.` })
      const refinedJson = await generateOpenAiJson({
        request: input.request ?? '',
        currentJson: input.currentJson,
        draftJson: finalDraftJson,
      })
      if (refinedJson) {
        sendEvent(socket, {
          type: 'template.snapshot',
          turnId,
          label: 'openai_refined_template',
          stage: snapshots.length + 1,
          final: true,
          rawJson: refinedJson,
        })
      }
    } catch (error) {
      sendEvent(socket, {
        type: 'agent.progress',
        turnId,
        message: `OpenAI refinement failed; keeping local draft. ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  sendEvent(socket, { type: 'turn.completed', turnId })
}

function handleWebSocket(request, socket) {
  const key = request.headers['sec-websocket-key']
  if (typeof key !== 'string') {
    socket.destroy()
    return
  }
  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64')
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    '',
  ].join('\r\n'))

  const frameState = { buffer: Buffer.alloc(0), closed: false }
  sendEvent(socket, { type: 'agent.status', ...agentStatus() })

  socket.on('data', (chunk) => {
    try {
      for (const message of decodeFrames(frameState, chunk)) {
        const payload = JSON.parse(message)
        if (payload.type === 'generate') {
          runAgentTurn(socket, payload).catch((error) => {
            sendEvent(socket, {
              type: 'turn.failed',
              message: error instanceof Error ? error.message : 'Unknown agent failure',
            })
          })
        }
      }
      if (frameState.closed) {
        socket.end()
      }
    } catch (error) {
      sendEvent(socket, {
        type: 'turn.failed',
        message: error instanceof Error ? error.message : 'Invalid WebSocket message',
      })
    }
  })
}

function openBrowser(url) {
  const platform = process.platform
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(command, args, { stdio: 'ignore', detached: true })
  child.unref()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${args.host}:${args.port}`)
    if (requestUrl.pathname === '/api/ai-agent/status') {
      jsonResponse(response, 200, agentStatus())
      return
    }
    serveStatic(request, response, args.distDir)
  })

  server.on('upgrade', (request, socket) => {
    const requestUrl = new URL(request.url ?? '/', `http://${args.host}:${args.port}`)
    if (requestUrl.pathname !== '/ws/ai-agent') {
      socket.destroy()
      return
    }
    handleWebSocket(request, socket)
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(args.port, args.host, () => resolve())
  })

  const url = `http://${args.host}:${args.port}/`
  const status = agentStatus()
  console.log(`LeatherCad native agent server running at ${url}`)
  console.log(`AI mode: ${status.mode}${status.model ? ` (${status.model})` : ''}`)
  if (!args.noOpen) {
    openBrowser(url)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
