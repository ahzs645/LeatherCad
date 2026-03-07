export type ToolFieldType = 'number' | 'text' | 'select' | 'boolean' | 'point'

export type ToolFieldDef = {
  key: string
  label: string
  type: ToolFieldType
  default?: number | string | boolean
  min?: number
  max?: number
  step?: number
  unit?: string // e.g. 'mm', 'deg'
  options?: Array<{ value: string; label: string }> // for 'select' type
  required?: boolean
}

export type ToolSchemaDef = {
  toolId: string
  label: string
  icon?: string
  fields: ToolFieldDef[]
}

export const lineSchema: ToolSchemaDef = {
  toolId: 'line',
  label: 'Line',
  fields: [
    { key: 'startX', label: 'Start X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'startY', label: 'Start Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'endX', label: 'End X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'endY', label: 'End Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'length', label: 'Length', type: 'number', step: 0.1, unit: 'mm' },
    { key: 'angle', label: 'Angle', type: 'number', step: 1, min: 0, max: 360, unit: 'deg' },
  ],
}

export const rectangleSchema: ToolSchemaDef = {
  toolId: 'rectangle',
  label: 'Rectangle',
  fields: [
    { key: 'originX', label: 'Origin X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'originY', label: 'Origin Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'width', label: 'Width', type: 'number', default: 50, min: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'height', label: 'Height', type: 'number', default: 30, min: 0, step: 0.1, unit: 'mm', required: true },
  ],
}

export const circleSchema: ToolSchemaDef = {
  toolId: 'circle',
  label: 'Circle',
  fields: [
    { key: 'centerX', label: 'Center X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'centerY', label: 'Center Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'radius', label: 'Radius', type: 'number', default: 25, min: 0, step: 0.1, unit: 'mm', required: true },
  ],
}

export const arcSchema: ToolSchemaDef = {
  toolId: 'arc',
  label: 'Arc',
  fields: [
    { key: 'startX', label: 'Start X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'startY', label: 'Start Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'midX', label: 'Mid X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'midY', label: 'Mid Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'endX', label: 'End X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'endY', label: 'End Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
  ],
}

export const bezierSchema: ToolSchemaDef = {
  toolId: 'bezier',
  label: 'Bezier',
  fields: [
    { key: 'startX', label: 'Start X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'startY', label: 'Start Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'controlX', label: 'Control X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'controlY', label: 'Control Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'endX', label: 'End X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'endY', label: 'End Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
  ],
}

export const textSchema: ToolSchemaDef = {
  toolId: 'text',
  label: 'Text',
  fields: [
    { key: 'positionX', label: 'Position X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'positionY', label: 'Position Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'text', label: 'Text', type: 'text', default: '', required: true },
    { key: 'fontSize', label: 'Font Size', type: 'number', default: 5, min: 1, max: 200, step: 0.5, unit: 'mm', required: true },
    {
      key: 'fontFamily',
      label: 'Font Family',
      type: 'select',
      default: 'sans-serif',
      options: [
        { value: 'sans-serif', label: 'Sans Serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'monospace', label: 'Monospace' },
      ],
      required: true,
    },
  ],
}

export const stitchHoleSchema: ToolSchemaDef = {
  toolId: 'stitch-hole',
  label: 'Stitch Hole',
  fields: [
    { key: 'spacing', label: 'Spacing', type: 'number', default: 4, min: 0.5, step: 0.5, unit: 'mm', required: true },
    {
      key: 'holeType',
      label: 'Hole Type',
      type: 'select',
      default: 'round',
      options: [
        { value: 'round', label: 'Round' },
        { value: 'slit', label: 'Slit' },
      ],
      required: true,
    },
  ],
}

export const hardwareSchema: ToolSchemaDef = {
  toolId: 'hardware',
  label: 'Hardware',
  fields: [
    { key: 'positionX', label: 'Position X', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    { key: 'positionY', label: 'Position Y', type: 'number', default: 0, step: 0.1, unit: 'mm', required: true },
    {
      key: 'kind',
      label: 'Kind',
      type: 'select',
      default: 'snap',
      options: [
        { value: 'snap', label: 'Snap' },
        { value: 'rivet', label: 'Rivet' },
        { value: 'buckle', label: 'Buckle' },
        { value: 'custom', label: 'Custom' },
      ],
      required: true,
    },
    { key: 'holeDiameter', label: 'Hole Diameter', type: 'number', default: 4, min: 0.5, step: 0.5, unit: 'mm', required: true },
  ],
}

export const toolSchemas: Record<string, ToolSchemaDef> = {
  line: lineSchema,
  rectangle: rectangleSchema,
  circle: circleSchema,
  arc: arcSchema,
  bezier: bezierSchema,
  text: textSchema,
  'stitch-hole': stitchHoleSchema,
  hardware: hardwareSchema,
}
