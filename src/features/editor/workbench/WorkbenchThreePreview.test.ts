import { createElement, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { changeValue, cleanupRender, renderForTest } from '../../../test/render'
import {
  WorkbenchThreePreviewInspector,
  WorkbenchThreePreviewViewport,
} from './WorkbenchThreePreview'

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

function createPreviewHarness() {
  function Harness() {
    const containerRef = { current: null as HTMLDivElement | null }
    const canvasRef = { current: null as HTMLCanvasElement | null }
    const bridgeRef = { current: null }
    const [threePreviewSettings, onSetThreePreviewSettings] = useState({
      mode: 'fold',
      explodedFactor: 0,
      thicknessMm: 2,
      showSeams: false,
      showStressOverlay: false,
      showEdgeLabels: false,
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
      seamConnections: [],
      foldLines: [],
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
      selectedClosedShapeIds: [],
      shapes: [{ id: 'shape-1', layerId: 'layer-1' }],
      applyTextureToSelection: async () => undefined,
      applyTextureGlobally: async () => undefined,
      clearSelectionTexture: () => undefined,
      resetMaterial: () => undefined,
      threeTextureShapeIds: [],
    } as Parameters<typeof WorkbenchThreePreviewInspector>[0]['controller']

    return createElement(
      'div',
      null,
      createElement(WorkbenchThreePreviewViewport, { controller, interactive: false }),
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

    const colorInputs = lastRender.container.querySelectorAll('input[type="color"]')
    changeValue(colorInputs[colorInputs.length - 1] as HTMLInputElement, '#112233')
    expect((colorInputs[colorInputs.length - 1] as HTMLInputElement).value.toLowerCase()).toBe('#112233')
  })
})
