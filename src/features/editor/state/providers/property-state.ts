import type { SetStateAction } from 'react'

export type PropertyAction<TState extends object> = {
  [K in keyof TState]: {
    type: K
    value: SetStateAction<TState[K]>
  }
}[keyof TState]

export function resolveSetStateAction<T>(previous: T, value: SetStateAction<T>) {
  return typeof value === 'function'
    ? (value as (current: T) => T)(previous)
    : value
}

export function propertyStateReducer<TState extends object>(
  state: TState,
  action: PropertyAction<TState>,
): TState {
  const key = action.type as keyof TState
  const nextValue = resolveSetStateAction(
    state[key],
    action.value as SetStateAction<TState[keyof TState]>,
  ) as TState[keyof TState]

  if (Object.is(state[key], nextValue)) {
    return state
  }

  return {
    ...state,
    [key]: nextValue,
  }
}

export function useRequiredContext<T>(value: T | null, name: string) {
  if (!value) {
    throw new Error(`${name} must be used within its provider`)
  }
  return value
}
