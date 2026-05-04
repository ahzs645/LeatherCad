import type { AiBuilderLeatherRef, AiBuilderLeatherRefKind } from './ai-builder-types'

export function makeLeatherRef(kind: AiBuilderLeatherRefKind, id: string) {
  return `@leather[${kind}:${id}]`
}

export function createLeatherRef(kind: AiBuilderLeatherRefKind, id: string, label: string): AiBuilderLeatherRef {
  return {
    ref: makeLeatherRef(kind, id),
    kind,
    id,
    label,
  }
}

