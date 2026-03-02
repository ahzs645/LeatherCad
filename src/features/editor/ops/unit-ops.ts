export type DisplayUnit = 'mm' | 'in'

export const MM_PER_INCH = 25.4

export function toDisplayValue(mm: number, unit: DisplayUnit) {
  if (unit === 'in') {
    return mm / MM_PER_INCH
  }
  return mm
}

export function fromDisplayValue(value: number, unit: DisplayUnit) {
  if (unit === 'in') {
    return value * MM_PER_INCH
  }
  return value
}

export function formatDisplayDistance(mm: number, unit: DisplayUnit, precision = 2) {
  const value = toDisplayValue(mm, unit)
  return `${value.toFixed(precision)}${unit}`
}

export function unitInputStep(unit: DisplayUnit) {
  return unit === 'in' ? 0.01 : 0.2
}

export function unitInputMin(unit: DisplayUnit) {
  return unit === 'in' ? 0.01 : 0.2
}
