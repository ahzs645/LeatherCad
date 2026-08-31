import { act, createElement, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { EditorStateProviders } from '../state/providers/EditorStateProviders'
import type {
  AvatarSpec,
  FoldLine,
  PiecePlacement3D,
  Shape,
  TextureSource,
  ThreePreviewSettings,
} from '../cad/cad-types'
import { useThreePreviewController } from './useThreePreviewController'

let lastRender: ReturnType<typeof renderForTest> | null = null

const bridgeSpies = {
  updateDocument: vi.fn(),
  updatePresentation: vi.fn(async () => undefined),
  resize: vi.fn(),
  dispose: vi.fn(),
}

vi.mock('../three/three-bridge', () => ({
  ThreeBridge: class {
    updateDocument = bridgeSpies.updateDocument
    updatePresentation = bridgeSpies.updatePresentation
    resize = bridgeSpies.resize
    dispose = bridgeSpies.dispose
  },
}))

beforeEach(() => {
  bridgeSpies.updateDocument.mockClear()
  bridgeSpies.updatePresentation.mockClear()
  bridgeSpies.resize.mockClear()
  bridgeSpies.dispose.mockClear()
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
})

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

const previewSettings: ThreePreviewSettings = {
  mode: 'fold',
  explodedFactor: 0.35,
  finalFoldProgress: 1,
  finalFoldCamera: 'orbit',
  thicknessMm: 1.8,
  showSeams: true,
  showEdgeLabels: false,
  showPieceOutlines: false,
  showStressOverlay: true,
  showFoldStressOverlay: false,
  showFoldClashOverlay: false,
  usePhysicsRelaxation: true,
}

const closedShape: Shape = {
  id: 'shape-1',
  type: 'bezier',
  layerId: 'layer-1',
  lineTypeId: 'line-type-1',
  start: { x: 0, y: 0 },
  control: { x: 20, y: 10 },
  end: { x: 0, y: 0 },
}

function createHarness() {
  function Harness() {
    const [piecePlacements3d, setPiecePlacements3d] = useState<PiecePlacement3D[]>([])
    const [threeTextureSource, setThreeTextureSource] = useState<TextureSource | null>(null)
    const [threeTextureShapeIds, setThreeTextureShapeIds] = useState<string[]>([])
    const [threePreviewSettings, setThreePreviewSettings] = useState(previewSettings)
    const [stitchThreadColor, setStitchThreadColor] = useState('#663300')
    const [avatars, setAvatars] = useState<AvatarSpec[]>([])
    const [foldLines, setFoldLines] = useState<FoldLine[]>([])

    const controller = useThreePreviewController({
      shapes: [closedShape],
      selectedShapeIds: ['shape-1'],
      stitchHoles: [],
      stitchThreadColor,
      onSetStitchThreadColor: setStitchThreadColor,
      patternPieces: [],
      pieceInterfaces: [],
      assemblyConnections: [],
      piecePlacements3d,
      seamConnections: [],
      hardwareMarkers: [],
      threePreviewSettings,
      avatars,
      onSetPiecePlacements3d: setPiecePlacements3d,
      onSetThreePreviewSettings: setThreePreviewSettings,
      onSetAvatars: setAvatars,
      threeTextureSource,
      onSetThreeTextureSource: setThreeTextureSource,
      threeTextureShapeIds,
      onSetThreeTextureShapeIds: setThreeTextureShapeIds,
      foldLines,
      layers: [
        { id: 'layer-1', name: 'Front', visible: true, locked: false },
        { id: 'layer-2', name: 'Back', visible: true, locked: false },
      ],
      lineTypes: [
        { id: 'line-type-1', name: 'Cut', role: 'cut', style: 'solid', color: '#000', visible: true },
      ],
      themeMode: 'dark',
      onUpdateFoldLine: (foldLineId, updates) =>
        setFoldLines((previous) =>
          previous.map((foldLine) => (foldLine.id === foldLineId ? { ...foldLine, ...updates } : foldLine)),
        ),
    })

    return createElement(
      'div',
      null,
      createElement('div', { ref: controller.containerRef }, createElement('canvas', { ref: controller.canvasRef })),
      createElement('div', { 'data-visible-count': true }, String(controller.visibleLayerCountIn3d)),
      createElement('div', { 'data-shape-count': true }, controller.shapesIn3dView.map((shape) => shape.id).join(',')),
      createElement('div', { 'data-assigned-shapes': true }, controller.threeTextureShapeIds.join(',')),
      createElement('div', { 'data-texture-status': true }, controller.textureStatus),
      createElement('div', { 'data-document-theme': true }, `${controller.documentState.layers.length}:${controller.documentState.shapes.length}`),
      createElement('div', { 'data-presentation-thread': true }, controller.presentationState.threadColor),
      createElement('div', { 'data-presentation-material': true }, JSON.stringify(controller.presentationState.material)),
      createElement('button', { onClick: () => controller.setHidden3dLayerIds(['layer-1']) }, 'hide-layer-1'),
      createElement(
        'button',
        {
          onClick: () => {
            controller.setTextureForm({
              sourceUrl: 'https://textures.example/leather',
              license: 'cc0',
              albedoUrl: 'https://textures.example/albedo.jpg',
              normalUrl: '',
              roughnessUrl: '',
            })
          },
        },
        'set-texture-form',
      ),
      createElement('button', { onClick: () => void controller.applyTextureToSelection() }, 'apply-selection-texture'),
      createElement('div', { 'data-empty-state': true }, String(controller.showPatternPieceEmptyState)),
      createElement(
        'button',
        { onClick: () => setThreePreviewSettings((previous) => ({ ...previous, mode: 'avatar' })) },
        'use-avatar-mode',
      ),
    )
  }

  // The controller now reads the editor's shared tool session, so a seam started
  // on the 2D canvas can be finished on the model.
  return createElement(EditorStateProviders, null, createElement(Harness))
}

describe('useThreePreviewController', () => {
  it('filters visible 3D layers through shared controller state', async () => {
    lastRender = renderForTest(createHarness())

    expect(lastRender.container.querySelector('[data-visible-count]')?.textContent).toBe('2')

    click(lastRender.container.querySelector('button'))

    expect(lastRender.container.querySelector('[data-visible-count]')?.textContent).toBe('1')
    expect(lastRender.container.querySelector('[data-shape-count]')?.textContent).toBe('')
  })

  it('applies texture assignments through controller-owned state', async () => {
    lastRender = renderForTest(createHarness())

    const buttons = lastRender.container.querySelectorAll('button')
    click(buttons[1] ?? null)
    click(buttons[2] ?? null)

    expect(lastRender.container.querySelector('[data-assigned-shapes]')?.textContent).toBe('shape-1')
    expect(lastRender.container.querySelector('[data-texture-status]')?.textContent).toContain('Loading texture set')
  })

  it('flags the pattern-piece empty state only for Assembled and Avatar modes', async () => {
    lastRender = renderForTest(createHarness())

    expect(lastRender.container.querySelector('[data-empty-state]')?.textContent).toBe('false')

    const buttons = lastRender.container.querySelectorAll('button')
    click(buttons[buttons.length - 1] ?? null)

    expect(lastRender.container.querySelector('[data-empty-state]')?.textContent).toBe('true')
  })

  it('builds declarative document and presentation state for the bridge', async () => {
    lastRender = renderForTest(createHarness())

    await act(async () => {
      await Promise.resolve()
    })

    expect(lastRender.container.querySelector('[data-document-theme]')?.textContent).toBe('2:1')
    expect(lastRender.container.querySelector('[data-presentation-thread]')?.textContent).toBe('#663300')
    expect(lastRender.container.querySelector('[data-presentation-material]')?.textContent).toContain('"shadowsEnabled":false')
  })
})
