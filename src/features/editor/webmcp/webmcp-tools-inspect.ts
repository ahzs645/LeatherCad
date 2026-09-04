/**
 * The read half of the agent surface: what is on the canvas, whether it works,
 * and what it will cost to make.
 *
 * These are the tools that make an agent loop worth having. A model that can
 * only write geometry is guessing; a model that can write geometry and then
 * ask the app what it made — measured off the resolved outline, scored by the
 * same functional checks the project benchmarks against — can correct itself
 * before a person ever picks up a knife.
 */

import { runAiBuilderPreflight } from '../ai-builder/ai-builder-preflight'
import { scoreDocumentGeometry } from '../ai-builder/ai-builder-functional-checks'
import type { WebMcpBridge } from './webmcp-bridge-types'
import type { WebMcpToolDescriptor } from './webmcp-api'
import { jsonResult } from './webmcp-api'
import { measurePatternPieces, summarizeDocument } from './webmcp-measure'
import {
  DEFAULT_NESTING_EFFICIENCY,
  DEFAULT_THREAD_MULTIPLIER,
  estimateMaterial,
  MM2_PER_SQFT,
} from './webmcp-material'
import { readNumber, readString, round } from './webmcp-input'
import { PIECE_SHAPE_KINDS } from './webmcp-shapes'

function roundMeasurement(value: number) {
  return round(value, 2)
}

export function buildInspectTools(bridge: WebMcpBridge): WebMcpToolDescriptor[] {
  return [
    {
      name: 'get_pattern_overview',
      description:
        'Read the leather pattern currently open in LeatherCad: its name, how many pieces, folds, stitch holes and seams it has, the total leather area the pieces need, and the total length of stitch run. Call this first — every other tool works in millimetres against this document.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        const summary = summarizeDocument(bridge.getDocument())
        return jsonResult({
          ...summary,
          totalCutAreaMm2: roundMeasurement(summary.totalCutAreaMm2),
          totalCutAreaSqft: round(summary.totalCutAreaMm2 / MM2_PER_SQFT, 3),
          totalStitchRunMm: roundMeasurement(summary.totalStitchRunMm),
          pieces: summary.pieces.map((piece) => ({
            pieceId: piece.pieceId,
            name: piece.name,
            quantity: piece.quantity,
            widthMm: roundMeasurement(piece.widthMm),
            heightMm: roundMeasurement(piece.heightMm),
            cutAreaMm2: roundMeasurement(piece.cutAreaMm2),
            stitchHoleCount: piece.stitchHoleCount,
          })),
        })
      },
    },
    {
      name: 'list_pattern_pieces',
      description:
        'List every pattern piece with its measured size, position, cut area, perimeter, cutouts and stitch holes. Positions are the millimetre bounds on the flat sheet, so use these numbers when placing a new piece or a stitch line next to an existing one. A piece reported with a zero perimeter has a boundary that does not close and cannot be cut.',
      inputSchema: {
        type: 'object',
        properties: {
          name_contains: {
            type: 'string',
            description: 'Optional case-insensitive filter on the piece name.',
          },
        },
        additionalProperties: false,
      },
      execute: async (input) => {
        const filter = readString(input, 'name_contains')?.toLowerCase() ?? null
        const pieces = measurePatternPieces(bridge.getDocument())
          .filter((piece) => (filter === null ? true : piece.name.toLowerCase().includes(filter)))
          .map((piece) => ({
            pieceId: piece.pieceId,
            name: piece.name,
            quantity: piece.quantity,
            material: piece.material ?? null,
            onFold: piece.onFold,
            widthMm: roundMeasurement(piece.widthMm),
            heightMm: roundMeasurement(piece.heightMm),
            boundsMm: {
              minX: roundMeasurement(piece.boundsMm.minX),
              minY: roundMeasurement(piece.boundsMm.minY),
              maxX: roundMeasurement(piece.boundsMm.maxX),
              maxY: roundMeasurement(piece.boundsMm.maxY),
            },
            centerMm: { x: roundMeasurement(piece.centerMm.x), y: roundMeasurement(piece.centerMm.y) },
            cutAreaMm2: roundMeasurement(piece.cutAreaMm2),
            perimeterMm: roundMeasurement(piece.perimeterMm),
            cutoutCount: piece.cutoutCount,
            stitchHoleCount: piece.stitchHoleCount,
            boundaryResolved: piece.perimeterMm > 0,
          }))
        return jsonResult({ pieceCount: pieces.length, pieces })
      },
    },
    {
      name: 'check_pattern',
      description:
        'Check whether the open pattern can actually be cut, sewn and folded. Runs the geometry checks the project scores its own generated patterns against — pieces overlapping on the hide, stitch holes or hardware drawn off the piece they belong to, creases that stop short of a cut edge, seams whose two sides do not mate — plus the compiler preflight. Call this after writing geometry and fix what it reports before telling the user the pattern is ready.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        const doc = bridge.getDocument()
        const checks = scoreDocumentGeometry(doc)
        const preflight = runAiBuilderPreflight(doc)
        const points = checks.reduce((sum, check) => sum + check.points, 0)
        const max = checks.reduce((sum, check) => sum + check.max, 0)
        return jsonResult({
          score: { points, max, passing: points === max },
          checks: checks.map((check) => ({
            name: check.name,
            passed: check.points === check.max,
            points: check.points,
            max: check.max,
            note: check.note,
          })),
          preflightErrors: preflight.filter((issue) => issue.severity === 'error'),
          preflightWarnings: preflight.filter((issue) => issue.severity === 'warning'),
        })
      },
    },
    {
      name: 'estimate_material',
      description:
        'Work out how much leather and thread the open pattern needs, and what it costs. Multiplies each piece by its quantity, allows for nesting waste, and converts to square feet and square decimetres. Give a hide size to get the number of hides, and a price to get a cost. Thread is estimated from the real stitch runs in the document.',
      inputSchema: {
        type: 'object',
        properties: {
          hide_area_sqft: {
            type: 'number',
            description:
              'Area of one hide or panel in square feet. A side of veg tan is roughly 22-25 sqft; a shoulder 14-16.',
          },
          hide_width_mm: {
            type: 'number',
            description: 'Alternative to hide_area_sqft: width of a rectangular panel in millimetres.',
          },
          hide_length_mm: {
            type: 'number',
            description: 'Alternative to hide_area_sqft: length of a rectangular panel in millimetres.',
          },
          nesting_efficiency: {
            type: 'number',
            description: `Fraction of the hide that ends up in pieces, 0-1. Defaults to ${DEFAULT_NESTING_EFFICIENCY} for hide work; use 0.85 or higher for rectangular panel stock.`,
          },
          price_per_sqft: {
            type: 'number',
            description: 'Price of one square foot, in any currency. Used when buying by the foot.',
          },
          price_per_hide: {
            type: 'number',
            description: 'Price of one whole hide. Takes precedence over price_per_sqft when a hide size is given.',
          },
          thread_multiplier: {
            type: 'number',
            description: `Thread length as a multiple of the seam length. Defaults to ${DEFAULT_THREAD_MULTIPLIER}, the usual saddle-stitch allowance.`,
          },
        },
        additionalProperties: false,
      },
      execute: async (input) => {
        const doc = bridge.getDocument()
        const summary = summarizeDocument(doc)
        const hideAreaSqft = readNumber(input, 'hide_area_sqft')
        const hideWidthMm = readNumber(input, 'hide_width_mm')
        const hideLengthMm = readNumber(input, 'hide_length_mm')
        const hideAreaMm2 =
          hideAreaSqft !== null && hideAreaSqft > 0
            ? hideAreaSqft * MM2_PER_SQFT
            : hideWidthMm !== null && hideLengthMm !== null && hideWidthMm > 0 && hideLengthMm > 0
              ? hideWidthMm * hideLengthMm
              : null

        const estimate = estimateMaterial(summary.pieces, {
          hideAreaMm2,
          nestingEfficiency: readNumber(input, 'nesting_efficiency') ?? DEFAULT_NESTING_EFFICIENCY,
          pricePerSqft: readNumber(input, 'price_per_sqft'),
          pricePerHide: readNumber(input, 'price_per_hide'),
          threadMultiplier: readNumber(input, 'thread_multiplier') ?? DEFAULT_THREAD_MULTIPLIER,
          stitchRunMm: summary.totalStitchRunMm,
        })

        return jsonResult({
          pieceCount: estimate.pieceCount,
          totalCutPieces: estimate.totalCutPieces,
          netArea: {
            mm2: roundMeasurement(estimate.netAreaMm2),
            sqft: round(estimate.netAreaSqft, 3),
            dm2: round(estimate.netAreaDm2, 2),
          },
          nestingEfficiency: estimate.nestingEfficiency,
          grossArea: {
            mm2: roundMeasurement(estimate.grossAreaMm2),
            sqft: round(estimate.grossAreaSqft, 3),
            dm2: round(estimate.grossAreaDm2, 2),
          },
          wasteAreaSqft: round(estimate.wasteAreaSqft, 3),
          hidesRequired: estimate.hidesRequired,
          estimatedCost: estimate.estimatedCost === null ? null : round(estimate.estimatedCost, 2),
          costNote: estimate.costCurrencyNote,
          thread: {
            seamLengthMm: roundMeasurement(summary.totalStitchRunMm),
            threadLengthM: round(estimate.threadLengthM, 2),
          },
          largestPiece: estimate.largestPiece
            ? {
                name: estimate.largestPiece.name,
                widthMm: roundMeasurement(estimate.largestPiece.widthMm),
                heightMm: roundMeasurement(estimate.largestPiece.heightMm),
              }
            : null,
          notes: estimate.notes,
        })
      },
    },
    {
      name: 'describe_pattern_format',
      description:
        'Return the JSON document format that apply_pattern_json accepts, with the entity types, their fields and a worked example. Call this before writing a whole pattern by hand; for a single ordinary piece prefer create_pattern_piece, which needs no geometry.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () =>
        jsonResult({
          schema_version: 1,
          units: 'mm — every coordinate and dimension, with x to the right and y downwards',
          shape_helpers: PIECE_SHAPE_KINDS,
          document: {
            schema_version: 1,
            document_name: 'string',
            units: 'mm',
            layers: [{ id: 'body', name: 'Body' }],
            entities: '[]',
          },
          entity_types: {
            line: 'id, layer_id, start {x,y}, end {x,y}, line_role: cut|stitch|fold|guide|mark',
            arc: 'id, layer_id, start, mid, end, line_role — mid is a point ON the arc, not the centre',
            bezier: 'id, layer_id, start, control, end, line_role — quadratic',
            rectangle: 'id, layer_id, x, y, width, height — x,y is the minimum corner',
            text: 'id, layer_id, position, value, font_size_mm',
            fold: 'id, start, end, direction: mountain|valley, angle_deg, radius_mm — must reach the cut edges at both ends',
            stitch_path:
              'id, layer_id, path_type: line|arc|bezier, start, end (+ mid for arc, control for bezier), pitch_mm, hole_type: round|slit, include_start_hole, force_fit_last_hole',
            pattern_piece:
              'id, layer_id, boundary_entity_id, internal_entity_ids[], name, quantity, on_fold — the boundary entity must be part of a ring of entities that meet end to end and close',
            seam_allowance: 'id, piece_id, default_offset_mm, enabled',
            seam_connection: 'id, from {piece_id, edge_index}, to {piece_id, edge_index}, kind: sewn|hinge',
            hardware_marker: 'id, layer_id, point, kind, label, hole_diameter_mm',
          },
          example: {
            schema_version: 1,
            document_name: 'Card sleeve',
            units: 'mm',
            layers: [{ id: 'body', name: 'Body' }],
            entities: [
              { id: 'sleeve_outline', type: 'rectangle', layer_id: 'body', x: -45, y: -32, width: 90, height: 64, line_role: 'cut' },
              {
                id: 'sleeve_stitch',
                type: 'stitch_path',
                layer_id: 'body',
                path_type: 'line',
                start: { x: -41, y: 28 },
                end: { x: 41, y: 28 },
                pitch_mm: 3.85,
                hole_type: 'slit',
              },
              {
                id: 'sleeve_piece',
                type: 'pattern_piece',
                layer_id: 'body',
                boundary_entity_id: 'sleeve_outline',
                name: 'Sleeve',
                quantity: 2,
              },
            ],
          },
          rules: [
            'Every pattern_piece needs a boundary that closes, or the app cannot cut, measure or nest it.',
            'Lay pieces apart on the sheet: two pieces overlapping on the flat is a nesting that cannot be cut, and check_pattern will fail it.',
            'A fold must run all the way to the cut edge at both ends or the piece cannot bend along it.',
            'Keep stitch holes, hardware and marks inside the piece they belong to.',
          ],
        }),
    },
  ]
}
