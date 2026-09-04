/**
 * The write half of the agent surface.
 *
 * Two levels on purpose. `create_pattern_piece` names the shapes a
 * leatherworker asks for and takes dimensions, so the common case costs the
 * agent no geometry at all and cannot produce an outline that fails to close.
 * `apply_pattern_json` is the escape hatch for anything the named shapes do not
 * cover, and it goes through the same parser and compiler the app's own AI
 * Builder uses, so a malformed document comes back as validation errors rather
 * than as a broken canvas.
 *
 * Everything merges into the open document. The one tool that can destroy work
 * — replacing the document outright — is a mode the agent has to ask for by
 * name, and its description says so.
 */

import { parseAiBuilderDocument } from '../ai-builder/ai-builder-parse'
import type { AiBuilderDocumentV1 } from '../ai-builder/ai-builder-types'
import type { ExportFormat, WebMcpBridge } from './webmcp-bridge-types'
import type { WebMcpToolDescriptor } from './webmcp-api'
import { jsonResult } from './webmcp-api'
import { buildPieceDocument, buildStitchRunDocument } from './webmcp-document'
import { measurePatternPieces } from './webmcp-measure'
import { PIECE_SHAPE_KINDS, type PieceShapeKind } from './webmcp-shapes'
import {
  readBoolean,
  readEnum,
  readNumber,
  readPoint,
  readString,
  requireEnum,
  requirePoint,
  requirePositiveNumber,
  requireString,
  round,
  WebMcpInputError,
} from './webmcp-input'

/** Default saddle-stitch pitch: a 7 stitches-per-inch iron, the common size. */
const DEFAULT_PITCH_MM = 3.85
const DEFAULT_LAYER_NAME = 'Agent'
/** Clear space left between an auto-placed piece and the work already there. */
const AUTO_PLACEMENT_GAP_MM = 12

/**
 * Where to drop a piece the agent did not place.
 *
 * Two pieces sharing leather on the flat sheet is a nesting that cannot be
 * cut, and `check_pattern` fails a document for it. Rather than make every
 * agent work that out, an unplaced piece lands to the right of everything
 * already on the sheet.
 */
function autoPlacement(bridge: WebMcpBridge, widthMm: number): { x: number; y: number } {
  const pieces = measurePatternPieces(bridge.getDocument()).filter((piece) => piece.perimeterMm > 0)
  if (pieces.length === 0) {
    return { x: 0, y: 0 }
  }
  const rightEdge = pieces.reduce((max, piece) => Math.max(max, piece.boundsMm.maxX), -Infinity)
  const topEdge = pieces.reduce((min, piece) => Math.min(min, piece.boundsMm.minY), Infinity)
  return {
    x: rightEdge + AUTO_PLACEMENT_GAP_MM + widthMm / 2,
    y: topEdge + widthMm / 2,
  }
}

function applyOutcomeResult(
  outcome: ReturnType<WebMcpBridge['applyDocument']>,
  extra: Record<string, unknown> = {},
) {
  return jsonResult({
    ok: outcome.ok,
    message: outcome.message,
    insertedPieceIds: outcome.insertedPieceIds,
    insertedShapeCount: outcome.insertedShapeCount,
    insertedStitchHoleCount: outcome.insertedStitchHoleCount,
    preflight: outcome.preflight,
    ...extra,
  })
}

function coerceDocument(input: Record<string, unknown>): AiBuilderDocumentV1 {
  const value = input.document
  const raw =
    typeof value === 'string' ? value : value && typeof value === 'object' ? JSON.stringify(value) : null
  if (raw === null) {
    throw new WebMcpInputError('"document" must be the pattern document object, or a JSON string of it.')
  }
  const parsed = parseAiBuilderDocument(raw)
  if (!parsed.ok) {
    throw new WebMcpInputError(
      `The document did not validate. Call describe_pattern_format and fix these: ${parsed.errors
        .map((error) => `${error.path}: ${error.message}`)
        .join('; ')}`,
    )
  }
  return parsed.document
}

export function buildEditTools(bridge: WebMcpBridge): WebMcpToolDescriptor[] {
  return [
    {
      name: 'create_pattern_piece',
      description:
        'Add a leather pattern piece to the open document from its dimensions — no coordinates needed. Choose a shape: rounded_rect for a panel or wallet body, strap for a belt or handle, card_slot for a pocket with a scooped mouth, circle for a disc. Optionally punch a saddle-stitch line a fixed distance inside the cut edge. If you do not give a position the piece is placed clear of the work already on the sheet, so pieces never overlap.',
      inputSchema: {
        type: 'object',
        properties: {
          shape: {
            type: 'string',
            enum: [...PIECE_SHAPE_KINDS],
            description:
              'rounded_rect: a panel with optional corner radius. strap: parallel sides with a round, pointed or square end. card_slot: a rectangle whose top edge dips so a card can be thumbed out. circle: a disc, sized by width_mm as the diameter.',
          },
          name: { type: 'string', description: 'Piece name, as it will read on the cutting list.' },
          width_mm: { type: 'number', description: 'Width across the piece. For a circle this is the diameter.' },
          height_mm: { type: 'number', description: 'Height of the piece down the sheet. Ignored for a circle.' },
          corner_radius_mm: {
            type: 'number',
            description: 'Corner radius for rounded_rect. 0 gives square corners. Defaults to 0.',
          },
          strap_end: {
            type: 'string',
            enum: ['round', 'point', 'square'],
            description: 'How a strap is finished at its far end. Defaults to round.',
          },
          scoop_mm: {
            type: 'number',
            description: 'How far a card_slot mouth dips below its top edge. Defaults to 12.',
          },
          quantity: { type: 'number', description: 'How many of this piece to cut. Defaults to 1.' },
          center_x_mm: { type: 'number', description: 'Centre of the piece on the sheet. Auto-placed if omitted.' },
          center_y_mm: { type: 'number', description: 'Centre of the piece on the sheet. Auto-placed if omitted.' },
          material: { type: 'string', description: 'Material note, e.g. "3.2mm veg tan".' },
          on_fold: { type: 'boolean', description: 'Whether the piece is cut on a fold. Defaults to false.' },
          stitch_inset_mm: {
            type: 'number',
            description:
              'Distance from the cut edge to a saddle-stitch line running right around the piece. Omit for no stitch line. 4 is a common wallet inset.',
          },
          stitch_pitch_mm: {
            type: 'number',
            description: `Hole spacing along the stitch line. Defaults to ${DEFAULT_PITCH_MM}, a 7 stitches-per-inch iron.`,
          },
          seam_allowance_mm: {
            type: 'number',
            description: 'Seam allowance to record on the piece. Omit for none.',
          },
          layer_name: {
            type: 'string',
            description: `Layer to draw on. Defaults to "${DEFAULT_LAYER_NAME}". Reusing a name reuses the layer.`,
          },
        },
        required: ['shape', 'name', 'width_mm'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const shape = requireEnum<PieceShapeKind>(input, 'shape', PIECE_SHAPE_KINDS)
        const name = requireString(input, 'name')
        const widthMm = requirePositiveNumber(input, 'width_mm')
        const heightMm = shape === 'circle' ? widthMm : requirePositiveNumber(input, 'height_mm')

        const centerX = readNumber(input, 'center_x_mm')
        const centerY = readNumber(input, 'center_y_mm')
        const placed = centerX !== null && centerY !== null
        const center = placed
          ? { x: centerX, y: centerY }
          : autoPlacement(bridge, Math.max(widthMm, heightMm))

        const built = buildPieceDocument({
          name,
          layerName: readString(input, 'layer_name') ?? DEFAULT_LAYER_NAME,
          outline: {
            kind: shape,
            widthMm,
            heightMm,
            cornerRadiusMm: readNumber(input, 'corner_radius_mm') ?? 0,
            strapEnd: readEnum(input, 'strap_end', ['round', 'point', 'square'] as const, 'round'),
            scoopMm: readNumber(input, 'scoop_mm') ?? 12,
          },
          center,
          quantity: Math.max(1, Math.round(readNumber(input, 'quantity') ?? 1)),
          material: readString(input, 'material'),
          onFold: readBoolean(input, 'on_fold', false),
          stitchInsetMm: readNumber(input, 'stitch_inset_mm'),
          stitchPitchMm: readNumber(input, 'stitch_pitch_mm') ?? DEFAULT_PITCH_MM,
          seamAllowanceMm: readNumber(input, 'seam_allowance_mm'),
        })

        const outcome = bridge.applyDocument(built.document, `Added "${name}"`)
        const measured = measurePatternPieces(bridge.getDocument()).find((piece) =>
          outcome.insertedPieceIds.includes(piece.pieceId),
        )

        return applyOutcomeResult(outcome, {
          warnings: built.warnings,
          placedAt: { x: round(center.x), y: round(center.y), autoPlaced: !placed },
          measured: measured
            ? {
                pieceId: measured.pieceId,
                widthMm: round(measured.widthMm),
                heightMm: round(measured.heightMm),
                cutAreaMm2: round(measured.cutAreaMm2),
                perimeterMm: round(measured.perimeterMm),
                stitchHoleCount: measured.stitchHoleCount,
              }
            : null,
        })
      },
    },
    {
      name: 'add_stitch_line',
      description:
        'Punch a run of stitch holes along a straight line or an arc, at a fixed pitch. Use the bounds from list_pattern_pieces to place it inside the piece it belongs to — holes drawn off a piece are reported as a fault by check_pattern. For a stitch line that follows the whole outline of a new piece, use create_pattern_piece with stitch_inset_mm instead.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'A name for this stitch run.' },
          start: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
            description: 'Start of the run, in millimetres.',
          },
          end: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
            description: 'End of the run, in millimetres.',
          },
          mid: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
            description: 'Optional point ON the curve between start and end. Supplying it makes the run an arc.',
          },
          pitch_mm: {
            type: 'number',
            description: `Distance between holes. Defaults to ${DEFAULT_PITCH_MM}.`,
          },
          hole_type: {
            type: 'string',
            enum: ['slit', 'round'],
            description: 'slit for a diamond chisel, round for a pricking iron or awl. Defaults to slit.',
          },
          tilt_deg: {
            type: 'number',
            description: 'Angle of a slit hole to the stitch line. Defaults to 35.',
          },
          layer_name: { type: 'string', description: `Layer to draw on. Defaults to "${DEFAULT_LAYER_NAME}".` },
        },
        required: ['name', 'start', 'end'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const name = requireString(input, 'name')
        const start = requirePoint(input, 'start')
        const end = requirePoint(input, 'end')
        const mid = readPoint(input, 'mid')
        const document = buildStitchRunDocument({
          layerName: readString(input, 'layer_name') ?? DEFAULT_LAYER_NAME,
          name,
          path: mid ? { kind: 'arc', start, mid, end } : { kind: 'line', start, end },
          pitchMm: readNumber(input, 'pitch_mm') ?? DEFAULT_PITCH_MM,
          holeType: readEnum(input, 'hole_type', ['slit', 'round'] as const, 'slit'),
          tiltDeg: readNumber(input, 'tilt_deg') ?? 35,
        })
        return applyOutcomeResult(bridge.applyDocument(document, `Stitched "${name}"`))
      },
    },
    {
      name: 'apply_pattern_json',
      description:
        'Write a whole pattern document — arbitrary outlines, folds, seams, hardware — in the app\'s own JSON format. Call describe_pattern_format first for the schema. By default the document is merged into what is already open; pass mode "replace" only when the user has asked to start over, because that discards the current pattern.',
      inputSchema: {
        type: 'object',
        properties: {
          document: {
            type: 'object',
            description: 'The pattern document, in the format describe_pattern_format returns.',
          },
          mode: {
            type: 'string',
            enum: ['merge', 'replace'],
            description: 'merge adds to the open document (default). replace discards it first.',
          },
        },
        required: ['document'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const document = coerceDocument(input)
        const mode = readEnum(input, 'mode', ['merge', 'replace'] as const, 'merge')
        const label = `${mode === 'replace' ? 'Replaced with' : 'Merged'} "${document.document_name}"`
        const outcome =
          mode === 'replace'
            ? bridge.replaceDocument(document, label)
            : bridge.applyDocument(document, label)
        return applyOutcomeResult(outcome, { mode })
      },
    },
    {
      name: 'select_pattern_pieces',
      description:
        'Highlight pieces on the canvas so the person watching can see which ones you mean. Use it when you are about to describe or change a piece — it is how the user follows what you are doing.',
      inputSchema: {
        type: 'object',
        properties: {
          piece_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Piece names to highlight. Matched case-insensitively against the names on the pieces.',
          },
        },
        required: ['piece_names'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const names = Array.isArray(input.piece_names)
          ? input.piece_names.filter((value): value is string => typeof value === 'string')
          : []
        if (names.length === 0) {
          throw new WebMcpInputError('"piece_names" must contain at least one name.')
        }
        const wanted = names.map((name) => name.toLowerCase())
        const pieces = measurePatternPieces(bridge.getDocument())
        const matched = pieces.filter((piece) =>
          wanted.some((name) => piece.name.toLowerCase().includes(name)),
        )
        const shapeCount = bridge.selectPieces(matched.map((piece) => piece.pieceId))
        return jsonResult({
          matchedPieces: matched.map((piece) => piece.name),
          unmatched: names.filter(
            (name) => !pieces.some((piece) => piece.name.toLowerCase().includes(name.toLowerCase())),
          ),
          highlightedShapeCount: shapeCount,
        })
      },
    },
    {
      name: 'clear_document',
      description:
        'Empty the document so a new pattern can be started from nothing. This discards every piece, stitch hole and fold currently open, so only call it when the person has asked to start over — to add to what is already there, use create_pattern_piece, which never removes anything.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        const before = measurePatternPieces(bridge.getDocument()).length
        bridge.clearDocument()
        return jsonResult({
          ok: true,
          message: `Cleared the document${before > 0 ? `, discarding ${before} piece(s)` : ''}.`,
        })
      },
    },
    {
      name: 'rename_document',
      description: 'Rename the open pattern. The name appears on exports and on saved projects.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'The new document name.' } },
        required: ['name'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const name = requireString(input, 'name')
        bridge.renameDocument(name)
        return jsonResult({ ok: true, documentName: name })
      },
    },
    {
      name: 'undo_last_change',
      description:
        'Undo the last change to the document — the same undo the person has on Ctrl+Z. Use it when the user rejects something you just did.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        bridge.undo()
        return jsonResult({ ok: true, message: 'Undid the last change.' })
      },
    },
    {
      name: 'export_pattern',
      description:
        'Download the open pattern as a cut-ready file: svg or dxf for a cutter, pdf to print and trace, json to save the editable project. The file downloads to the person\'s machine — say so when you use it.',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['svg', 'pdf', 'dxf', 'json'],
            description: 'The file format to download.',
          },
        },
        required: ['format'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const format = requireEnum<ExportFormat>(input, 'format', ['svg', 'pdf', 'dxf', 'json'])
        const result = bridge.exportDocument(format)
        return jsonResult({ ok: result.ok, format, message: result.message })
      },
    },
  ]
}
