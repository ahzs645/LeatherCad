import { createElement } from 'react'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { recordWebMcpActivity, resetWebMcpActivityForTests } from './webmcp-activity'
import { WebMcpPanel } from './WebMcpPanel'

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
  resetWebMcpActivityForTests()
})

function render(state: Parameters<typeof WebMcpPanel>[0]['state']) {
  lastRender = renderForTest(createElement(WebMcpPanel, { state }))
  return lastRender
}

describe('WebMcpPanel', () => {
  it('tells the user how to get WebMCP when the browser has none', () => {
    const view = render({ supported: false, registered: false, toolNames: ['get_pattern_overview'], error: null })

    expect(view.container.textContent).toContain('No WebMCP in this browser')
    click(view.container.querySelector('.webmcp-panel-head'))
    expect(view.container.textContent).toContain('enable-webmcp-testing')
  })

  it('says the tools are live once they are registered, and lists them', () => {
    const view = render({
      supported: true,
      registered: true,
      toolNames: ['get_pattern_overview', 'create_pattern_piece'],
      error: null,
    })

    expect(view.container.textContent).toContain('Agent tools live')
    click(view.container.querySelector('.webmcp-panel-head'))
    const chips = Array.from(view.container.querySelectorAll('.webmcp-tool-chip')).map(
      (node) => node.textContent,
    )
    expect(chips).toEqual(['get_pattern_overview', 'create_pattern_piece'])
  })

  it('surfaces a registration failure rather than looking idle', () => {
    const view = render({ supported: true, registered: false, toolNames: [], error: 'blocked by policy' })
    expect(view.container.textContent).toContain('Registration failed')
    click(view.container.querySelector('.webmcp-panel-head'))
    expect(view.container.textContent).toContain('blocked by policy')
  })

  it('shows the agent\'s calls as they happen, newest first', () => {
    const view = render({ supported: true, registered: true, toolNames: [], error: null })
    click(view.container.querySelector('.webmcp-panel-head'))

    act(() => {
      recordWebMcpActivity({ toolName: 'get_pattern_overview', status: 'ok', summary: 'read the document', detail: '{}', durationMs: 2 })
      recordWebMcpActivity({ toolName: 'create_pattern_piece', status: 'error', summary: 'width_mm is required', detail: 'width_mm is required', durationMs: 1 })
    })

    const names = Array.from(view.container.querySelectorAll('.webmcp-activity-name')).map(
      (node) => node.textContent,
    )
    expect(names).toEqual(['create_pattern_piece', 'get_pattern_overview'])
    expect(view.container.querySelector('.webmcp-activity-error')).not.toBeNull()
  })

  it('opens a call to show what came back', () => {
    const view = render({ supported: true, registered: true, toolNames: [], error: null })
    click(view.container.querySelector('.webmcp-panel-head'))
    act(() => {
      recordWebMcpActivity({ toolName: 'check_pattern', status: 'ok', summary: 'passed', detail: '{"score":{"passing":true}}', durationMs: 5 })
    })

    expect(view.container.querySelector('.webmcp-activity-detail')).toBeNull()
    click(view.container.querySelector('.webmcp-activity-head'))
    expect(view.container.querySelector('.webmcp-activity-detail')?.textContent).toContain('passing')
  })

  it('clears the log on request', () => {
    const view = render({ supported: true, registered: true, toolNames: [], error: null })
    click(view.container.querySelector('.webmcp-panel-head'))
    act(() => {
      recordWebMcpActivity({ toolName: 'rename_document', status: 'ok', summary: 'renamed', detail: '', durationMs: 1 })
    })
    expect(view.container.querySelectorAll('.webmcp-activity')).toHaveLength(1)

    click(view.container.querySelector('.webmcp-clear'))
    expect(view.container.querySelectorAll('.webmcp-activity')).toHaveLength(0)
  })
})
