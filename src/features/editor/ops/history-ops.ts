export type HistoryState<T> = {
  past: T[]
  future: T[]
}

const MAX_HISTORY_BYTES = 50 * 1024 * 1024

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function estimateSize(value: unknown): number {
  try {
    return JSON.stringify(value).length * 2 // rough byte estimate (UTF-16)
  } catch {
    return 0
  }
}

export function pushHistorySnapshot<T>(
  history: HistoryState<T>,
  previousSnapshot: T,
  maxPast = 120,
): HistoryState<T> {
  const cloned = deepClone(previousSnapshot)
  const nextPast = [...history.past, cloned]

  // Count-based eviction
  if (nextPast.length > maxPast) {
    nextPast.splice(0, nextPast.length - maxPast)
  }

  // Size-based eviction
  let totalSize = 0
  for (let i = nextPast.length - 1; i >= 0; i--) {
    totalSize += estimateSize(nextPast[i])
    if (totalSize > MAX_HISTORY_BYTES && i > 0) {
      nextPast.splice(0, i)
      break
    }
  }

  return {
    past: nextPast,
    future: [],
  }
}

export function applyUndo<T>(
  history: HistoryState<T>,
  currentSnapshot: T,
): { history: HistoryState<T>; snapshot: T | null } {
  if (history.past.length === 0) {
    return { history, snapshot: null }
  }

  const nextPast = history.past.slice(0, -1)
  const snapshot = deepClone(history.past[history.past.length - 1])
  return {
    history: {
      past: nextPast,
      future: [deepClone(currentSnapshot), ...history.future],
    },
    snapshot,
  }
}

export function applyRedo<T>(
  history: HistoryState<T>,
  currentSnapshot: T,
): { history: HistoryState<T>; snapshot: T | null } {
  if (history.future.length === 0) {
    return { history, snapshot: null }
  }

  const [nextSnapshot, ...remainingFuture] = history.future
  return {
    history: {
      past: [...history.past, deepClone(currentSnapshot)],
      future: remainingFuture,
    },
    snapshot: deepClone(nextSnapshot),
  }
}
