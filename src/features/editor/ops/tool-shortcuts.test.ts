import { describe, expect, it } from 'vitest'
import { DESKTOP_TOOL_ICON_ITEMS, TOOL_OPTIONS } from '../editor-constants'
import { TOOL_IDLE_HINTS, TOOL_SHORTCUTS, toolForKey, toolShortcutLabel } from './tool-shortcuts'

describe('tool shortcuts', () => {
  it('matches the reference editor for shared tools', () => {
    expect(toolForKey('a', false)).toBe('pan')
    expect(toolForKey('l', false)).toBe('line')
    expect(toolForKey('r', false)).toBe('rectangle')
    expect(toolForKey('e', false)).toBe('circle')
    expect(toolForKey('E', true)).toBe('ellipse')
    expect(toolForKey('v', false)).toBe('arc')
    expect(toolForKey('b', false)).toBe('bezier')
    expect(toolForKey('t', false)).toBe('text')
    expect(toolForKey('p', false)).toBe('stitch-hole')
    expect(toolForKey('#', true)).toBe('dimension')
  })

  it('ignores unmapped keys and does not collide with existing single-key commands', () => {
    for (const reserved of ['s', 'g', 'z', 'n', 'j', 'i', '[', ']']) {
      expect(toolForKey(reserved, false)).toBeNull()
    }
    expect(toolForKey('Enter', false)).toBeNull()
  })

  it('assigns every tool at most one unique binding', () => {
    const bindings = TOOL_SHORTCUTS.map(entry => `${entry.shift ? 'S+' : ''}${entry.key}`)
    expect(new Set(bindings).size).toBe(bindings.length)
    const tools = TOOL_SHORTCUTS.map(entry => entry.tool)
    expect(new Set(tools).size).toBe(tools.length)
  })

  it('labels shortcuts for tooltips and has an idle hint for every tool', () => {
    expect(toolShortcutLabel('line')).toBe('L')
    expect(toolShortcutLabel('ellipse')).toBe('Shift+E')
    expect(toolShortcutLabel('dimension')).toBe('#')
    for (const option of TOOL_OPTIONS) expect(TOOL_IDLE_HINTS[option.value]).toBeTruthy()
  })
})

describe('tool rail icons', () => {
  it('gives every tool its own icon', () => {
    const icons = DESKTOP_TOOL_ICON_ITEMS.map((item) => item.iconSrc)
    expect(new Set(icons).size).toBe(icons.length)
  })
})
