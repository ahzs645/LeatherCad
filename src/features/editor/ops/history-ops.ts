export type HistoryState<T> = {
  past: T[]
  future: T[]
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export function pushHistorySnapshot<T>(
  history: HistoryState<T>,
  previousSnapshot: T,
  maxPast = 120,
): HistoryState<T> {
  const nextPast = [...history.past, deepClone(previousSnapshot)]
  if (nextPast.length > maxPast) {
    nextPast.splice(0, nextPast.length - maxPast)
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
