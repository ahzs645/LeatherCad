import type { ToolSchemaDef, ToolFieldDef } from './tool-schema'

type SchemaToolDialogProps = {
  schema: ToolSchemaDef
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  onApply: () => void
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '8px',
  fontSize: '12px',
  minWidth: '200px',
}

const headerStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '13px',
  marginBottom: '2px',
}

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const labelStyle: React.CSSProperties = {
  flex: '0 0 80px',
  textAlign: 'right',
  fontSize: '11px',
  color: '#aaa',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '2px 4px',
  fontSize: '12px',
  background: '#2a2a2a',
  color: '#eee',
  border: '1px solid #444',
  borderRadius: '3px',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'auto' as const,
}

const unitStyle: React.CSSProperties = {
  flex: '0 0 24px',
  fontSize: '10px',
  color: '#777',
}

const applyBtnStyle: React.CSSProperties = {
  marginTop: '4px',
  padding: '4px 8px',
  fontSize: '12px',
  background: '#3a6ea5',
  color: '#fff',
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
}

function stringifyInputValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function stringifyPointValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return `${value[0]},${value[1]}`
  }
  if (typeof value === 'object' && value !== null) {
    const point = value as { x?: unknown; y?: unknown }
    if (typeof point.x === 'number' && typeof point.y === 'number') {
      return `${point.x},${point.y}`
    }
  }
  return '0,0'
}

function renderField(
  field: ToolFieldDef,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
) {
  switch (field.type) {
    case 'number':
      return (
        <input
          style={inputStyle}
          type="number"
          value={value != null ? Number(value) : ''}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(e) => onChange(field.key, e.target.value === '' ? '' : Number(e.target.value))}
          aria-label={field.label}
        />
      )

    case 'text':
      return (
        <input
          style={inputStyle}
          type="text"
          value={stringifyInputValue(value)}
          onChange={(e) => onChange(field.key, e.target.value)}
          aria-label={field.label}
        />
      )

    case 'select':
      return (
        <select
          style={selectStyle}
          value={stringifyInputValue(value)}
          onChange={(e) => onChange(field.key, e.target.value)}
          aria-label={field.label}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )

    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.key, e.target.checked)}
          aria-label={field.label}
        />
      )

    case 'point':
      return (
        <input
          style={inputStyle}
          type="text"
          value={stringifyPointValue(value)}
          placeholder="x,y"
          onChange={(e) => onChange(field.key, e.target.value)}
          aria-label={field.label}
        />
      )

    default:
      return null
  }
}

export function SchemaToolDialog({ schema, values, onChange, onApply }: SchemaToolDialogProps) {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>{schema.label}</div>
      {schema.fields.map((field) => (
        <div key={field.key} style={fieldRowStyle}>
          <label style={labelStyle} title={field.label}>
            {field.label}
          </label>
          {renderField(field, values[field.key], onChange)}
          <span style={unitStyle}>{field.unit ?? ''}</span>
        </div>
      ))}
      <button type="button" style={applyBtnStyle} onClick={onApply}>
        Apply
      </button>
    </div>
  )
}
