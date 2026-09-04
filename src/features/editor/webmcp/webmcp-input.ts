/**
 * Reading tool arguments defensively.
 *
 * A tool's `inputSchema` is a contract with the agent, not a guard: the model
 * fills it in and the browser passes it through, so a number can arrive as a
 * string and a required field can be missing entirely. Every accessor here
 * returns a fallback rather than throwing, and `requireString`/`requireNumber`
 * throw a `WebMcpInputError` the tool runner turns into an `isError` result —
 * so a bad call answers the agent instead of breaking the page.
 */

export class WebMcpInputError extends Error {}

export function readString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key]
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  return null
}

export function requireString(input: Record<string, unknown>, key: string): string {
  const value = readString(input, key)
  if (value === null) {
    throw new WebMcpInputError(`"${key}" is required and must be a non-empty string.`)
  }
  return value
}

export function readNumber(input: Record<string, unknown>, key: string): number | null {
  const value = input[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  // Models frequently send dimensions as strings ("42", "42mm"); accept the
  // plain numeric form rather than failing a call that is otherwise correct.
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.trim())
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

export function requireNumber(input: Record<string, unknown>, key: string): number {
  const value = readNumber(input, key)
  if (value === null) {
    throw new WebMcpInputError(`"${key}" is required and must be a number.`)
  }
  return value
}

export function requirePositiveNumber(input: Record<string, unknown>, key: string): number {
  const value = requireNumber(input, key)
  if (value <= 0) {
    throw new WebMcpInputError(`"${key}" must be greater than 0 (got ${value}).`)
  }
  return value
}

export function readBoolean(input: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = input[key]
  if (typeof value === 'boolean') {
    return value
  }
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function readEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = readString(input, key)
  if (value !== null && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  return fallback
}

export function requireEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = readString(input, key)
  if (value === null || !(allowed as readonly string[]).includes(value)) {
    throw new WebMcpInputError(`"${key}" must be one of: ${allowed.join(', ')}.`)
  }
  return value as T
}

export function readPoint(
  input: Record<string, unknown>,
  key: string,
): { x: number; y: number } | null {
  const value = input[key]
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const x = readNumber(record, 'x')
  const y = readNumber(record, 'y')
  if (x === null || y === null) {
    return null
  }
  return { x, y }
}

export function requirePoint(
  input: Record<string, unknown>,
  key: string,
): { x: number; y: number } {
  const point = readPoint(input, key)
  if (!point) {
    throw new WebMcpInputError(`"${key}" must be an object with numeric "x" and "y" in millimetres.`)
  }
  return point
}

/** Millimetres rounded for display; agents do not need micron noise. */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
