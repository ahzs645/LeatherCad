// Lightweight startup version check (source-app v1.7.0).
//
// The desktop source app pings the project website on launch and surfaces a
// "newer version available" prompt. Offline web builds can't reach a remote
// endpoint reliably, so we keep this as a self-contained comparison against a
// constant: bump `LATEST_KNOWN_VERSION` whenever a new release ships and the
// running build will surface a status-bar notice for older instances.

import packageJson from '../../../package.json'

const APP_VERSION = (packageJson as { version?: string }).version ?? '0.0.0'

// Update this when publishing new releases so older deployments can flag
// themselves as out-of-date. Format must match `MAJOR.MINOR.PATCH`.
export const LATEST_KNOWN_VERSION = APP_VERSION

function parseVersion(value: string): number[] | null {
  const parts = value.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length === 0 || parts.some((part) => Number.isNaN(part))) return null
  return parts
}

function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return 0
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const l = left[index] ?? 0
    const r = right[index] ?? 0
    if (l !== r) return l - r
  }
  return 0
}

export type VersionCheckResult = {
  current: string
  latest: string
  isOutdated: boolean
}

export function checkForNewerVersion(latest: string = LATEST_KNOWN_VERSION): VersionCheckResult {
  const isOutdated = compareVersions(APP_VERSION, latest) < 0
  return { current: APP_VERSION, latest, isOutdated }
}

export { APP_VERSION }
