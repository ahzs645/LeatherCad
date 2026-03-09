import { describe, expect, it } from 'vitest'
import { AI_BUILDER_EXAMPLES } from './ai-builder-examples'
import { renderAiBuilderPrompt } from './ai-builder-prompt'
import { AI_BUILDER_ENTITY_TYPE_ORDER } from './ai-builder-schema'

describe('renderAiBuilderPrompt', () => {
  it('includes every supported entity type, examples, and the user request', () => {
    const request = 'Create a bifold wallet shell with one fold line and a brand mark.'
    const prompt = renderAiBuilderPrompt(request)

    expect(prompt).toContain('Return ONLY valid JSON')
    expect(prompt).toContain('stitch holes')
    expect(prompt).toContain(request)

    AI_BUILDER_ENTITY_TYPE_ORDER.forEach((entityType) => {
      expect(prompt).toContain(`Entity type "${entityType}"`)
    })

    AI_BUILDER_EXAMPLES.forEach((example) => {
      expect(prompt).toContain(JSON.stringify(example, null, 2))
    })
  })
})
