// Composable prompt sections for the AI Builder.
//
// The prompt sent to an external LLM is built from independent section
// builders so that single-shot generation and multi-turn refinement can share
// the same vocabulary (intro, constraints, entity schemas, examples) without
// duplicating strings. Each section is a pure function returning a string;
// callers join them with newlines.

import { AI_BUILDER_EXAMPLES } from './ai-builder-examples'
import {
  AI_BUILDER_ENTITY_SCHEMAS,
  AI_BUILDER_ENTITY_TYPE_ORDER,
  AI_BUILDER_TOP_LEVEL_FIELDS,
  AI_BUILDER_UNSUPPORTED_FEATURES,
} from './ai-builder-schema'

export type AiBuilderSchemaField = {
  key: string
  required: boolean
  type: string
  description: string
}

export function renderFieldList(fields: ReadonlyArray<AiBuilderSchemaField>): string {
  return fields
    .map(
      (field) =>
        `- "${field.key}" (${field.required ? 'required' : 'optional'} ${field.type}): ${field.description}`,
    )
    .join('\n')
}

export function renderEntitySchema(entityType: (typeof AI_BUILDER_ENTITY_TYPE_ORDER)[number]): string {
  const schema = AI_BUILDER_ENTITY_SCHEMAS[entityType]
  return [
    `Entity type "${schema.type}"`,
    `Description: ${schema.description}`,
    `Allowed keys: ${[...schema.requiredKeys, ...schema.optionalKeys].join(', ')}`,
    renderFieldList(schema.fields),
  ].join('\n')
}

export function renderIntroSection(): string {
  return 'You are generating JSON for LeatherCad AI Builder v1.'
}

export function renderRefinementIntroSection(): string {
  return [
    'You are revising an existing LeatherCad AI Builder v1 document based on a new user request.',
    'Output the FULL updated JSON document, not a partial diff or patch.',
  ].join('\n')
}

export function renderOutputContractSection(): string {
  return 'Return ONLY valid JSON (no markdown, no commentary, no trailing text).'
}

const BASE_CONSTRAINTS = [
  'Output must be a single JSON object.',
  'Use only the supported v1 entity types described below.',
  'Every layer and entity must have a unique snake_case "id".',
  'Keep values JSON-safe. Do not emit comments, markdown, or unsupported keys.',
  'Units must be "mm".',
  'Positive x moves right. Positive y moves down.',
  'If a requested feature is unsupported in v1, omit it instead of inventing extra keys or entity types.',
]

const REFINEMENT_CONSTRAINTS = [
  'Preserve entity ids that are unchanged from the previous document.',
  'Preserve "document_name" and existing layer ids unless the user explicitly asks to change them.',
  'Only add, remove, or modify entities the user actually requested. Leave the rest untouched.',
]

function renderConstraints(items: ReadonlyArray<string>): string {
  return [
    'Important constraints:',
    ...items.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n')
}

export function renderBaseConstraintsSection(): string {
  return renderConstraints(BASE_CONSTRAINTS)
}

export function renderRefinementConstraintsSection(): string {
  return renderConstraints([...BASE_CONSTRAINTS, ...REFINEMENT_CONSTRAINTS])
}

export function renderUnsupportedFeaturesSection(): string {
  return `Unsupported v1 concepts to omit entirely: ${AI_BUILDER_UNSUPPORTED_FEATURES.join(', ')}.`
}

const TOP_LEVEL_SHAPE_SAMPLE = [
  '{',
  '  "schema_version": 1,',
  '  "document_name": "string",',
  '  "units": "mm",',
  '  "layers": [',
  '    { "id": "layer_id", "name": "Layer Name" }',
  '  ],',
  '  "entities": [',
  '    { "id": "entity_id", "type": "rectangle", "layer_id": "layer_id", "x": 0, "y": 0, "width": 10, "height": 10 }',
  '  ]',
  '}',
].join('\n')

export function renderTopLevelSchemaSection(): string {
  return [
    'Top-level fields:',
    renderFieldList(AI_BUILDER_TOP_LEVEL_FIELDS),
    '',
    'Top-level output shape:',
    TOP_LEVEL_SHAPE_SAMPLE,
  ].join('\n')
}

export function renderPointSchemaSection(): string {
  return [
    'Point schema:',
    '- A Point must be a JSON object with only two keys: "x" and "y".',
    '- Both "x" and "y" must be finite numbers in millimeters.',
  ].join('\n')
}

export function renderEntitySchemasSection(): string {
  return [
    'Supported entities:',
    ...AI_BUILDER_ENTITY_TYPE_ORDER.flatMap((entityType) => ['', renderEntitySchema(entityType)]),
  ].join('\n')
}

export function renderExamplesSection(): string {
  return [
    'Worked examples:',
    ...AI_BUILDER_EXAMPLES.flatMap((example, index) => [
      '',
      `Example ${index + 1}`,
      JSON.stringify(example, null, 2),
    ]),
  ].join('\n')
}

export function renderRequestSection(request: string): string {
  return ['Now generate the JSON for this LeatherCad request:', request].join('\n')
}

export function renderRefinementRequestSection(request: string): string {
  return ['Now generate the updated JSON for this LeatherCad refinement request:', request].join('\n')
}

// Joins prompt sections with the standard blank-line separator used in v1.
export function joinSections(sections: ReadonlyArray<string>): string {
  return sections.join('\n\n')
}
