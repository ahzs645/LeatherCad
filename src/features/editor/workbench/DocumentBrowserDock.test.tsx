import { act, createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { click, cleanupRender, renderForTest } from '../../../test/render'
import { buildDocumentBrowserModel } from './workbench-models'
import { DocumentBrowserDock } from './DocumentBrowserDock'
import type { SketchGroup } from '../cad/cad-types'

const groups: SketchGroup[] = [
  { id: 'child', parentId: 'parent', name: 'Lining', layerId: 'L', visible: true, locked: false },
  { id: 'parent', name: 'Wallet', layerId: 'L', visible: false, locked: true },
  { id: 'sibling', name: 'Strap', layerId: 'L', visible: true, locked: false },
]
function nodes(sketchGroups = groups) {
  return buildDocumentBrowserModel({ patternPieces: [], pieceLabels: [], seamAllowances: [], pieceNotches: [], piecePlacementLabels: [], seamConnections: [], selectedPieceIds: [], selectedSeamId: null, layers: [], activeLayerId: 'L', sketchGroups, activeSketchGroupId: 'child', tracingOverlays: [], activeTracingOverlayId: null, avatars: [], threeTextureSource: null })
}
it('builds real group hierarchy in source order and dims/protects descendants of hidden locked parents', () => {
  const sketches = nodes().find(node => node.id === 'section-sketches')!
  expect(sketches.children?.map(node => node.id)).toEqual(['sketch:parent', 'sketch:sibling'])
  const child = sketches.children?.[0].children?.[0]
  expect(child).toMatchObject({ id: 'sketch:child', selected: true, dimmed: true, locked: true })
})
it('renders invalid cycles safely without losing nodes or recursing indefinitely', () => {
  const cyclic = [{ ...groups[0], parentId: 'parent' }, { ...groups[1], parentId: 'child' }]
  const sketches = nodes(cyclic).find(node => node.id === 'section-sketches')!
  expect(sketches.children).toHaveLength(2)
  expect(sketches.children?.every(node => node.dimmed && node.locked)).toBe(true)
})
it('separates sketch activation from collapse and supports keyboard navigation', async () => {
  const activate = vi.fn()
  const rendered = renderForTest(createElement(DocumentBrowserDock, { nodes: nodes(), onActivateNode: activate, onToggleLayerVisibility() {}, onToggleLayerGroupVisibility() {}, onToggleLayerLock() {}, onToggleTracingVisibility() {}, onToggleTracingLock() {} }))
  const parent = rendered.container.querySelector<HTMLButtonElement>('[data-testid="browser-node-sketch:parent"]')!
  const child = rendered.container.querySelector<HTMLButtonElement>('[data-testid="browser-node-sketch:child"]')!
  const disclosure = rendered.container.querySelector<HTMLButtonElement>('[aria-controls="browser-children-sketch%3Aparent"]')!
  click(parent)
  expect(activate).toHaveBeenCalledWith(expect.objectContaining({ id: 'sketch:parent' }), false)
  click(disclosure)
  expect(disclosure.getAttribute('aria-expanded')).toBe('false')
  expect(child.closest('[hidden]')).not.toBeNull()
  expect(activate).toHaveBeenCalledOnce()
  parent.focus()
  await act(() => parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(disclosure.getAttribute('aria-expanded')).toBe('true')
  await act(() => parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(document.activeElement).toBe(child)
  await act(() => child.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
  expect(document.activeElement).toBe(parent)
  cleanupRender(rendered)
})
