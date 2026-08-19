import { createElement, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { changeValue, cleanupRender, click, renderForTest } from '../../../test/render'
import {
  WorkbenchThreePreviewInspector,
  WorkbenchThreePreviewViewport,
} from './WorkbenchThreePreview'

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

function createPreviewHarness({
  interactive = false,
  initialMode = 'fold',
}: {
  interactive?: boolean
  initialMode?: 'fold' | 'final' | 'assembled' | 'avatar'
} = {}) {
  function Harness() {
    const containerRef = { current: null as HTMLDivElement | null }
    const canvasRef = { current: null as HTMLCanvasElement | null }
    const bridgeRef = { current: null }
    const [threePreviewSettings, onSetThreePreviewSettings] = useState({
      mode: initialMode,
      explodedFactor: 0,
      finalFoldProgress: 1,
      finalFoldCamera: 'orbit',
      thicknessMm: 2,
      showSeams: false,
      showStressOverlay: false,
      showEdgeLabels: false,
      usePhysicsRelaxation: true,
    })
    const [stitchThreadColor, onSetStitchThreadColor] = useState('#663300')
    const [hidden3dLayerIds, setHidden3dLayerIds] = useState<string[]>([])
    const [textureForm, setTextureForm] = useState({
      sourceUrl: '',
      license: '',
      albedoUrl: '',
      normalUrl: '',
      roughnessUrl: '',
    })

    const controller = {
      containerRef,
      canvasRef,
      bridgeRef,
      shapesIn3dView: [{ id: 'shape-1', layerId: 'layer-1' }],
      visiblePatternPieces: [],
      invalidPatternPieces: [],
      showPatternPieceEmptyState:
        threePreviewSettings.mode === 'assembled' || threePreviewSettings.mode === 'avatar',
      finalProductSolveResult: null,
      seamConnections: [],
      foldLines: [
        {
          id: 'fold-1',
          name: 'Crease 1',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 10 },
          angleDeg: 90,
          maxAngleDeg: 180,
          direction: 'mountain',
        },
      ],
      threePreviewSettings,
      onSetThreePreviewSettings,
      avatars: [],
      activeAvatarId: '',
      avatarFormResetKey: 'avatar-default',
      onSetAvatars: () => undefined,
      visibleLayerCountIn3d: 1,
      layers: [{ id: 'layer-1', name: 'Front', visible: true }],
      effectiveHidden3dLayerIds: hidden3dLayerIds,
      setHidden3dLayerIds,
      onUpdateFoldLine: () => undefined,
      piecePlacementById: {},
      updatePlacement: () => undefined,
      handleSpreadPieces: () => undefined,
      handleStackByLayer: () => undefined,
      handleMirrorPairLayout: () => undefined,
      handleResetAssembly: () => undefined,
      stitchThreadColor,
      onSetStitchThreadColor,
      textureForm,
      setTextureForm,
      textureStatus: 'Default leather material active',
      applyPreset: () => undefined,
      setLeatherColor: () => undefined,
      enableShadows: () => undefined,
      rotateLeatherTexture: () => undefined,
      selectedClosedShapeIds: [],
      shapes: [{ id: 'shape-1', layerId: 'layer-1' }],
      applyTextureToSelection: async () => undefined,
      applyTextureGlobally: async () => undefined,
      clearSelectionTexture: () => undefined,
      resetMaterial: () => undefined,
      threeTextureShapeIds: [],
    } as unknown as Parameters<typeof WorkbenchThreePreviewInspector>[0]['controller']

    return createElement(
      'div',
      null,
      createElement(WorkbenchThreePreviewViewport, { controller, interactive }),
      createElement(WorkbenchThreePreviewInspector, { controller }),
    )
  }

  return createElement(Harness)
}

describe('WorkbenchThreePreview', () => {
  it('updates the viewport summary when 3D settings change in the inspector', () => {
    lastRender = renderForTest(createPreviewHarness())

    expect(lastRender.container.textContent).toContain('Mode fold')
    changeValue(lastRender.container.querySelector('select'), 'assembled')
    expect(lastRender.container.textContent).toContain('Mode assembled')
    changeValue(lastRender.container.querySelector('select'), 'final')
    expect(lastRender.container.textContent).toContain('Mode final')
    expect(lastRender.container.textContent).toContain('Fold Progress 100%')
    expect(lastRender.container.textContent).toContain('Pattern View')
    expect(lastRender.container.textContent).toContain('Half-Folded')
    expect(lastRender.container.textContent).toContain('Top')
    expect(lastRender.container.textContent).toContain('Front')
    expect(lastRender.container.textContent).toContain('Side')
    expect(lastRender.container.textContent).toContain('Fold Timeline')
    expect(lastRender.container.textContent).toContain('Create From Folds')

    const colorInputs = lastRender.container.querySelectorAll('input[type="color"]')
    changeValue(colorInputs[colorInputs.length - 1] as HTMLInputElement, '#112233')
    expect((colorInputs[colorInputs.length - 1] as HTMLInputElement).value.toLowerCase()).toBe('#112233')
  })

  it('creates and edits an authored fold timeline in Final Product mode', () => {
    lastRender = renderForTest(createPreviewHarness({ initialMode: 'final' }))

    expect(lastRender.container.textContent).toContain('Default sequence follows')
    click(Array.from(lastRender.container.querySelectorAll('button')).find((button) => button.textContent === 'Create From Folds') ?? null)

    expect(lastRender.container.textContent).toContain('Authored sequence: 1 step.')
    expect(lastRender.container.textContent).toContain('Step 1')

    const targetInput = Array.from(lastRender.container.querySelectorAll('input[type="number"]')).find((input) =>
      input.closest('.fold-control-card')?.textContent?.includes('Target Angle'),
    ) as HTMLInputElement | undefined
    expect(targetInput?.value).toBe('90')
    changeValue(targetInput ?? null, '45')
    expect(targetInput?.value).toBe('45')
  })

  it('shows final fold controls as a bottom drawer in full 3D mode', () => {
    lastRender = renderForTest(createPreviewHarness({ interactive: true, initialMode: 'final' }))

    expect(lastRender.container.textContent).toContain('Final Folds')
    expect(lastRender.container.textContent).toContain('Active step: Crease 1')
    expect(lastRender.container.textContent).not.toContain('Fold All 90')
    expect(lastRender.container.textContent).toContain('Use the Final Folds drawer')

    click(lastRender.container.querySelector('.workbench-final-fold-tab'))

    expect(lastRender.container.textContent).toContain('Final Folds')
    expect(lastRender.container.textContent).toContain('Fold All 90')
  })

  it('explains the empty viewport when Assembled or Avatar has no pattern pieces', () => {
    lastRender = renderForTest(createPreviewHarness({ interactive: true }))

    expect(lastRender.container.textContent).not.toContain('needs pattern pieces')

    changeValue(lastRender.container.querySelector('select'), 'assembled')
    expect(lastRender.container.textContent).toContain('Assembled mode needs pattern pieces')
    expect(lastRender.container.textContent).toContain('Create Piece')

    changeValue(lastRender.container.querySelector('select'), 'avatar')
    expect(lastRender.container.textContent).toContain('Avatar mode is showing the mannequin only')

    changeValue(lastRender.container.querySelector('select'), 'fold')
    expect(lastRender.container.textContent).not.toContain('needs pattern pieces')
    expect(lastRender.container.textContent).not.toContain('Avatar mode is showing the mannequin only')
  })

  it('shows a bottom tab in Fold mode that switches to Final Product', () => {
    lastRender = renderForTest(createPreviewHarness({ interactive: true, initialMode: 'fold' }))

    const tab = lastRender.container.querySelector('.workbench-final-fold-tab')
    expect(tab?.textContent).toBe('Final Folds')
    expect(lastRender.container.textContent).toContain('Fold Radius')
    expect(lastRender.container.textContent).not.toContain('Fold All 180')

    click(tab)

    expect(lastRender.container.textContent).toContain('Mode final')
    expect(lastRender.container.textContent).not.toContain('Fold All 180')
    expect(lastRender.container.textContent).toContain('Use the Final Folds drawer')
  })
})
