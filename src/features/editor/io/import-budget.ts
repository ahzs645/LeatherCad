export const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024
export const MAX_IMPORT_GEOMETRY = 200_000
export const MAX_IMPORT_LAYERS = 2_000
export const MAX_IMPORT_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_IMPORT_TREE_NODES = 2_000_000

export function assertImportTextBudget(raw: string): void {
  if (raw.length > MAX_IMPORT_FILE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_IMPORT_FILE_BYTES) throw new Error('Import exceeds the 50 MB file limit')
}

/** Bounds parsed nesting, total work and embedded assets before conversion. */
export function assertImportTreeBudget(value: unknown): void {
  const stack = [{ value, depth: 0 }]
  let nodes = 0, imageBytes = 0
  while (stack.length) {
    const entry = stack.pop()!
    if (++nodes > MAX_IMPORT_TREE_NODES || entry.depth > 64) throw new Error('Import exceeds the document nesting/complexity limit')
    if (typeof entry.value === 'string') {
      if (/^data:image\//i.test(entry.value)) {
        const comma = entry.value.indexOf(',')
        imageBytes += entry.value.includes(';base64,') ? Math.ceil((entry.value.length - comma - 1) * 3 / 4) : entry.value.length - comma - 1
        if (imageBytes > MAX_IMPORT_IMAGE_BYTES) throw new Error('Import exceeds the 20 MB embedded-image limit')
      }
    } else if (entry.value && typeof entry.value === 'object') {
      const values = Array.isArray(entry.value) ? entry.value : Object.values(entry.value)
      if (nodes + stack.length + values.length > MAX_IMPORT_TREE_NODES) throw new Error('Import exceeds the document complexity limit')
      for (const child of values) stack.push({ value: child, depth: entry.depth + 1 })
    }
  }
}

export function assertImportGeometryBudget(count: number): void {
  if (count > MAX_IMPORT_GEOMETRY) throw new Error('Import exceeds the 200,000 expanded geometry limit')
}

export function assertImportLayerBudget(count: number): void {
  if (count > MAX_IMPORT_LAYERS) throw new Error('Import exceeds the 2,000 layer limit')
}
