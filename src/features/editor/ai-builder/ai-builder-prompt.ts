import { AI_BUILDER_EXAMPLES } from './ai-builder-examples'
import {
  AI_BUILDER_DEFAULT_REQUEST,
  AI_BUILDER_ENTITY_SCHEMAS,
  AI_BUILDER_ENTITY_TYPE_ORDER,
  AI_BUILDER_TOP_LEVEL_FIELDS,
  AI_BUILDER_UNSUPPORTED_FEATURES,
} from './ai-builder-schema'

function renderFieldList(
  fields: ReadonlyArray<{
    key: string
    required: boolean
    type: string
    description: string
  }>,
) {
  return fields
    .map(
      (field) =>
        `- "${field.key}" (${field.required ? 'required' : 'optional'} ${field.type}): ${field.description}`,
    )
    .join('\n')
}

function renderEntitySchema(entityType: (typeof AI_BUILDER_ENTITY_TYPE_ORDER)[number]) {
  const schema = AI_BUILDER_ENTITY_SCHEMAS[entityType]
  return [
    `Entity type "${schema.type}"`,
    `Description: ${schema.description}`,
    `Allowed keys: ${[...schema.requiredKeys, ...schema.optionalKeys].join(', ')}`,
    renderFieldList(schema.fields),
  ].join('\n')
}

export function renderAiBuilderPrompt(request: string) {
  const normalizedRequest = request.trim() || AI_BUILDER_DEFAULT_REQUEST

  return [
    'You are generating JSON for LeatherCad AI Builder v1.',
    '',
    'Return ONLY valid JSON (no markdown, no commentary, no trailing text).',
    '',
    'Important constraints:',
    '1. Output must be a single JSON object.',
    '2. Use only the supported v1 entity types described below.',
    '3. Every layer and entity must have a unique snake_case "id".',
    '4. Keep values JSON-safe. Do not emit comments, markdown, or unsupported keys.',
    '5. Units must be "mm".',
    '6. Positive x moves right. Positive y moves down.',
    '7. If a requested feature is unsupported in v1, omit it instead of inventing extra keys or entity types.',
    '',
    `Unsupported v1 concepts to omit entirely: ${AI_BUILDER_UNSUPPORTED_FEATURES.join(', ')}.`,
    '',
    'Top-level fields:',
    renderFieldList(AI_BUILDER_TOP_LEVEL_FIELDS),
    '',
    'Top-level output shape:',
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
    '',
    'Point schema:',
    '- A Point must be a JSON object with only two keys: "x" and "y".',
    '- Both "x" and "y" must be finite numbers in millimeters.',
    '',
    'Supported entities:',
    ...AI_BUILDER_ENTITY_TYPE_ORDER.flatMap((entityType) => ['', renderEntitySchema(entityType)]),
    '',
    'Worked examples:',
    ...AI_BUILDER_EXAMPLES.flatMap((example, index) => [
      '',
      `Example ${index + 1}`,
      JSON.stringify(example, null, 2),
    ]),
    '',
    'Now generate the JSON for this LeatherCad request:',
    normalizedRequest,
  ].join('\n')
}
