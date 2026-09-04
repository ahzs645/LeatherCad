/**
 * Building the AI Builder document an agent's request compiles down to.
 *
 * The app already has a declarative document format with a compiler and a
 * preflight pass behind it, so the WebMCP tools do not invent a second path
 * into the canvas: a tool call becomes an `AiBuilderDocumentV1`, and the
 * existing compiler turns that into shapes, stitch holes and pattern pieces.
 * Whatever the compiler rejects, the tool reports back — the agent never gets
 * to write geometry the rest of the app cannot read.
 */

import type { Point } from '../cad/cad-types'
import type {
  AiBuilderDocumentV1,
  AiBuilderEntity,
  AiBuilderStitchPathEntity,
} from '../ai-builder/ai-builder-types'
import { buildOutline, buildStitchOutline, type OutlineParams, type OutlineSegment } from './webmcp-shapes'

export type CreatePieceRequest = {
  name: string
  layerName: string
  outline: OutlineParams
  center: Point
  quantity: number
  material: string | null
  onFold: boolean
  stitchInsetMm: number | null
  stitchPitchMm: number
  seamAllowanceMm: number | null
}

export type BuiltPieceDocument = {
  document: AiBuilderDocumentV1
  warnings: string[]
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug.length > 0 ? slug : fallback
}

function outlineEntity(
  segment: OutlineSegment,
  id: string,
  layerId: string,
  role: 'cut' | 'guide',
): AiBuilderEntity {
  if (segment.kind === 'line') {
    return { id, type: 'line', layer_id: layerId, start: segment.start, end: segment.end, line_role: role }
  }
  if (segment.kind === 'arc') {
    return {
      id,
      type: 'arc',
      layer_id: layerId,
      start: segment.start,
      mid: segment.mid,
      end: segment.end,
      line_role: role,
    }
  }
  return {
    id,
    type: 'bezier',
    layer_id: layerId,
    start: segment.start,
    control: segment.control,
    end: segment.end,
    line_role: role,
  }
}

function stitchPathEntity(
  segment: OutlineSegment,
  id: string,
  layerId: string,
  pitchMm: number,
  includeStartHole: boolean,
): AiBuilderStitchPathEntity {
  const base = {
    id,
    type: 'stitch_path' as const,
    layer_id: layerId,
    pitch_mm: pitchMm,
    hole_type: 'slit' as const,
    render_shape: 'diamond' as const,
    width_mm: 1.2,
    height_mm: 0.5,
    tilt_deg: 35,
    include_start_hole: includeStartHole,
    force_fit_last_hole: true,
  }
  if (segment.kind === 'line') {
    return { ...base, path_type: 'line', start: segment.start, end: segment.end }
  }
  if (segment.kind === 'arc') {
    return { ...base, path_type: 'arc', start: segment.start, mid: segment.mid, end: segment.end }
  }
  return { ...base, path_type: 'bezier', start: segment.start, control: segment.control, end: segment.end }
}

export function buildPieceDocument(request: CreatePieceRequest): BuiltPieceDocument {
  const warnings: string[] = []
  const layerId = slugify(request.layerName, 'agent')
  const pieceSlug = slugify(request.name, 'piece')
  const outline = buildOutline(request.outline, request.center)

  const entities: AiBuilderEntity[] = outline.map((segment, index) =>
    outlineEntity(segment, `${pieceSlug}_edge_${index + 1}`, layerId, 'cut'),
  )

  if (request.stitchInsetMm !== null) {
    const stitchOutline = buildStitchOutline(request.outline, request.stitchInsetMm, request.center)
    if (!stitchOutline) {
      warnings.push(
        `A stitch line ${request.stitchInsetMm}mm inside the cut edge would not fit inside a ${request.outline.widthMm} x ${request.outline.heightMm}mm piece, so the piece was created without one.`,
      )
    } else {
      stitchOutline.forEach((segment, index) => {
        // Only the first run opens with a hole on its start point: the
        // following runs begin where the previous one ended, so repeating it
        // would punch the corner twice.
        entities.push(
          stitchPathEntity(
            segment,
            `${pieceSlug}_stitch_${index + 1}`,
            layerId,
            request.stitchPitchMm,
            index === 0,
          ),
        )
      })
    }
  }

  entities.push({
    id: `${pieceSlug}_piece`,
    type: 'pattern_piece',
    layer_id: layerId,
    boundary_entity_id: `${pieceSlug}_edge_1`,
    name: request.name,
    quantity: request.quantity,
    on_fold: request.onFold,
    ...(request.material ? { material: request.material } : {}),
  })

  if (request.seamAllowanceMm !== null && request.seamAllowanceMm > 0) {
    entities.push({
      id: `${pieceSlug}_seam_allowance`,
      type: 'seam_allowance',
      piece_id: `${pieceSlug}_piece`,
      default_offset_mm: request.seamAllowanceMm,
      enabled: true,
    })
  }

  return {
    document: {
      schema_version: 1,
      document_name: request.name,
      units: 'mm',
      layers: [{ id: layerId, name: request.layerName }],
      entities,
    },
    warnings,
  }
}

export type StitchRunRequest = {
  layerName: string
  name: string
  path:
    | { kind: 'line'; start: Point; end: Point }
    | { kind: 'arc'; start: Point; mid: Point; end: Point }
  pitchMm: number
  holeType: 'round' | 'slit'
  tiltDeg: number
}

export function buildStitchRunDocument(request: StitchRunRequest): AiBuilderDocumentV1 {
  const layerId = slugify(request.layerName, 'agent')
  const id = slugify(request.name, 'stitch_run')
  const segment: OutlineSegment =
    request.path.kind === 'line'
      ? { kind: 'line', start: request.path.start, end: request.path.end }
      : { kind: 'arc', start: request.path.start, mid: request.path.mid, end: request.path.end }

  const entity = stitchPathEntity(segment, id, layerId, request.pitchMm, true)

  return {
    schema_version: 1,
    document_name: request.name,
    units: 'mm',
    layers: [{ id: layerId, name: request.layerName }],
    entities: [
      {
        ...entity,
        hole_type: request.holeType,
        render_shape: request.holeType === 'round' ? 'round' : 'diamond',
        ...(request.holeType === 'round' ? { diameter_mm: 1 } : { tilt_deg: request.tiltDeg }),
      },
    ],
  }
}
