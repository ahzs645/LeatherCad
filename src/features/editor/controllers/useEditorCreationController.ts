import { useEffect, useMemo } from 'react'
import type {
  BoxJointParams,
  CapPatternParams,
  DiceCupParams,
  JigsawParams,
  PassCaseParams,
  WatchStrapParams,
  WizardType,
} from '../ops/wizard-ops'
import type { BoxStitchParams } from '../ops/box-stitch-ops'
import type { GoldenSpiralParams, MandalaSettings } from '../ops/mandala-ops'
import type { LetterStampParams } from '../ops/letter-stamp-ops'
import type { BoxStitchHelperSettings } from '../ops/box-stitch-settings'
import type { Shape, StitchHole, TextTransformMode } from '../cad/cad-types'
import {
  clearTerminalStitchHole,
  getTerminalStitchHoleIdForShape,
  setTerminalStitchHole,
} from '../ops/stitch-hole-ops'
import { simulateStitches, type StitchSimulatorSettings } from '../ops/stitch-simulator-ops'
import { saveBoxStitchHelperSettings } from '../ops/box-stitch-settings'

type UseEditorCreationControllerParams = {
  shapes: Shape[]
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>
  stitchHoles: StitchHole[]
  setStitchHoles: React.Dispatch<React.SetStateAction<StitchHole[]>>
  selectedShapeIdSet: Set<string>
  selectedStitchHole: StitchHole | null
  activeLayerId: string
  activeLineTypeId: string
  textDraftValue: string
  textFontFamily: string
  textFontSizeMm: number
  textTransformMode: TextTransformMode
  textRadiusMm: number
  textSweepDeg: number
  showStitchSimulatorModal: boolean
  stitchSimulatorSettings: StitchSimulatorSettings
  setStitchSimulatorSettings: React.Dispatch<React.SetStateAction<StitchSimulatorSettings>>
  setBoxStitchHelperSettings: React.Dispatch<React.SetStateAction<BoxStitchHelperSettings>>
  setShowBoxStitchModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowBoxStitchHelperModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowMandalaModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowWizardModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowLetterStampModal: React.Dispatch<React.SetStateAction<boolean>>
  setStatus: React.Dispatch<React.SetStateAction<string>>
  preloadBoxStitchGeneration: () => void
  applyBoxStitchToSelection: (settings: BoxStitchHelperSettings) => void
}

export function useEditorCreationController(params: UseEditorCreationControllerParams) {
  const {
    shapes,
    setShapes,
    stitchHoles,
    setStitchHoles,
    selectedShapeIdSet,
    selectedStitchHole,
    activeLayerId,
    activeLineTypeId,
    textDraftValue,
    textFontFamily,
    textFontSizeMm,
    textTransformMode,
    textRadiusMm,
    textSweepDeg,
    showStitchSimulatorModal,
    stitchSimulatorSettings,
    setStitchSimulatorSettings,
    setBoxStitchHelperSettings,
    setShowBoxStitchModal,
    setShowBoxStitchHelperModal,
    setShowMandalaModal,
    setShowWizardModal,
    setShowLetterStampModal,
    setStatus,
    preloadBoxStitchGeneration,
    applyBoxStitchToSelection,
  } = params

  const stitchSimulatorResult = useMemo(() => {
    if (stitchHoles.length === 0) {
      return null
    }
    if (!showStitchSimulatorModal && !stitchSimulatorSettings.showSimulatorPattern) {
      return null
    }
    return simulateStitches(stitchHoles, stitchSimulatorSettings)
  }, [showStitchSimulatorModal, stitchHoles, stitchSimulatorSettings])

  useEffect(() => {
    const nextEndHoleId = selectedStitchHole
      ? getTerminalStitchHoleIdForShape(stitchHoles, selectedStitchHole.shapeId)
      : null
    setStitchSimulatorSettings((previous) =>
      previous.endHoleId === nextEndHoleId
        ? previous
        : {
            ...previous,
            endHoleId: nextEndHoleId,
          },
    )
  }, [selectedStitchHole, stitchHoles, setStitchSimulatorSettings])

  const handleMarkSelectedStitchHoleAsEnd = () => {
    if (!selectedStitchHole) {
      return
    }

    setStitchHoles((previous) => setTerminalStitchHole(previous, selectedStitchHole.id))
    setStitchSimulatorSettings((previous) => ({
      ...previous,
      endHoleId: selectedStitchHole.id,
    }))
    setStatus(`Marked hole ${selectedStitchHole.sequence + 1} as the stitch end`)
  }

  const handleClearSelectedStitchHoleEnd = () => {
    if (!selectedStitchHole) {
      return
    }

    setStitchHoles((previous) => clearTerminalStitchHole(previous, selectedStitchHole.id))
    setStitchSimulatorSettings((previous) => ({
      ...previous,
      endHoleId: null,
    }))
    setStatus(`Cleared stitch end on hole ${selectedStitchHole.sequence + 1}`)
  }

  const handleExtractSelectedBoxStitchSources = () => {
    void import('../ops/box-stitch-ops')
      .then(({ markSelectedShapesAsBoxStitchSource }) => {
        const result = markSelectedShapesAsBoxStitchSource(shapes, selectedShapeIdSet)
        if (result.updatedCount === 0) {
          setStatus('Select one or more lines, arcs, or beziers to extract as box stitch sources')
          return
        }
        setShapes(result.nextShapes)
        setStatus(`Marked ${result.updatedCount} shape${result.updatedCount === 1 ? '' : 's'} as box stitch sources`)
      })
      .catch(() => {
        setStatus('Box stitch tools failed to load')
      })
  }

  const handleClearSelectedBoxStitchSources = () => {
    void import('../ops/box-stitch-ops')
      .then(({ clearSelectedBoxStitchSources }) => {
        const result = clearSelectedBoxStitchSources(shapes, selectedShapeIdSet)
        if (result.updatedCount === 0) {
          setStatus('Selected shapes do not contain extracted box stitch sources')
          return
        }
        setShapes(result.nextShapes)
        setStatus(`Cleared box stitch sources on ${result.updatedCount} shape${result.updatedCount === 1 ? '' : 's'}`)
      })
      .catch(() => {
        setStatus('Box stitch tools failed to load')
      })
  }

  const handleApplyTextDefaultsToSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more text shapes first')
      return
    }

    let updatedCount = 0
    setShapes((previous) =>
      previous.map((shape) => {
        if (!selectedShapeIdSet.has(shape.id) || shape.type !== 'text') {
          return shape
        }
        updatedCount += 1
        return {
          ...shape,
          text: textDraftValue.trim().length > 0 ? textDraftValue.trim() : shape.text,
          fontFamily: textFontFamily,
          fontSizeMm: Math.max(2, Math.min(120, textFontSizeMm)),
          transform: textTransformMode,
          radiusMm: Math.max(2, Math.min(2000, textRadiusMm)),
          sweepDeg: Math.max(-1080, Math.min(1080, textSweepDeg)),
        }
      }),
    )

    if (updatedCount === 0) {
      setStatus('Selected shapes do not include text')
      return
    }
    setStatus(`Updated ${updatedCount} text shape${updatedCount === 1 ? '' : 's'}`)
  }

  const handleGenerateBoxStitch = (params: BoxStitchParams) => {
    void import('../ops/box-stitch-ops')
      .then(({ generateBoxStitchPattern }) => {
        const result = generateBoxStitchPattern(params)
        setShapes((prev) => [...prev, ...result.guideLines])
        setStitchHoles((prev) => [...prev, ...result.stitchHoles])
        setShowBoxStitchModal(false)
        setStatus(`Generated box stitch: ${result.guideLines.length} guides, ${result.stitchHoles.length} holes`)
      })
      .catch(() => {
        setStatus('Box stitch generator failed to load')
      })
  }

  const handleOpenBoxStitchHelperModal = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to create a box stitch')
      return
    }
    preloadBoxStitchGeneration()
    setShowBoxStitchHelperModal(true)
  }

  const handleApplyBoxStitchHelper = (settings: BoxStitchHelperSettings) => {
    setBoxStitchHelperSettings(settings)
    saveBoxStitchHelperSettings(settings)
    applyBoxStitchToSelection(settings)
    setShowBoxStitchHelperModal(false)
  }

  const handleGenerateMandalaRadial = (settings: MandalaSettings) => {
    const selectedShapes = shapes.filter((shape) => selectedShapeIdSet.has(shape.id))
    if (selectedShapes.length === 0) {
      setStatus('Select shapes first for radial copy')
      return
    }
    void import('../ops/mandala-ops')
      .then(({ generateMandalaGuideCircle, generateRadialCopies }) => {
        const guides = generateMandalaGuideCircle(
          settings.center,
          settings.radius,
          settings.segmentCount,
          activeLayerId,
          activeLineTypeId,
        )
        const copies = generateRadialCopies(selectedShapes, settings)
        setShapes((prev) => [...prev, ...guides, ...copies])
        setShowMandalaModal(false)
        setStatus(`Generated ${copies.length} radial copies with ${guides.length} guides`)
      })
      .catch(() => {
        setStatus('Mandala tools failed to load')
      })
  }

  const handleGenerateSpiral = (params: GoldenSpiralParams) => {
    void import('../ops/mandala-ops')
      .then(({ generateGoldenSpiral }) => {
        const arcs = generateGoldenSpiral(params)
        setShapes((prev) => [...prev, ...arcs])
        setShowMandalaModal(false)
        setStatus(`Generated golden spiral with ${arcs.length} arc segments`)
      })
      .catch(() => {
        setStatus('Spiral tools failed to load')
      })
  }

  const handleGenerateGoldenGuides = (center: { x: number; y: number }, size: number) => {
    void import('../ops/mandala-ops')
      .then(({ generateGoldenRatioGuides }) => {
        const guides = generateGoldenRatioGuides(center, size, activeLayerId, activeLineTypeId)
        setShapes((prev) => [...prev, ...guides])
        setShowMandalaModal(false)
        setStatus(`Generated ${guides.length} golden ratio guide lines`)
      })
      .catch(() => {
        setStatus('Golden ratio tools failed to load')
      })
  }

  const handleGenerateWhiteSilverGuides = (center: { x: number; y: number }, size: number) => {
    void import('../ops/mandala-ops')
      .then(({ generateWhiteSilverGuides }) => {
        const guides = generateWhiteSilverGuides(center, size, activeLayerId, activeLineTypeId)
        setShapes((prev) => [...prev, ...guides])
        setShowMandalaModal(false)
        setStatus(`Generated ${guides.length} white-silver (1:√2) guide lines`)
      })
      .catch(() => {
        setStatus('White-silver ratio tools failed to load')
      })
  }

  const handleGenerateWizardPattern = (
    type: WizardType,
    params:
      | WatchStrapParams
      | PassCaseParams
      | BoxJointParams
      | JigsawParams
      | DiceCupParams
      | CapPatternParams,
  ) => {
    void import('../ops/wizard-ops')
      .then(({
        generateWatchStrap,
        generatePassCase,
        generateBoxJoint,
        generateJigsaw,
        generateDiceCup,
        generateCapPattern,
      }) => {
        let result: { shapes: Shape[]; description: string }
        switch (type) {
          case 'watch-strap':
            result = generateWatchStrap(params as WatchStrapParams)
            break
          case 'pass-case':
            result = generatePassCase(params as PassCaseParams)
            break
          case 'box-joint':
            result = generateBoxJoint(params as BoxJointParams)
            break
          case 'jigsaw':
            result = generateJigsaw(params as JigsawParams)
            break
          case 'dice-cup':
            result = generateDiceCup(params as DiceCupParams)
            break
          case 'cap-pattern':
            result = generateCapPattern(params as CapPatternParams)
            break
        }
        setShapes((prev) => [...prev, ...result.shapes])
        setShowWizardModal(false)
        setStatus(result.description)
      })
      .catch(() => {
        setStatus('Pattern wizard tools failed to load')
      })
  }

  const handleGenerateLetterStamp = (params: LetterStampParams) => {
    void import('../ops/letter-stamp-ops')
      .then(({ generateLetterStampPreview }) => {
        const result = generateLetterStampPreview({ ...params, layerId: activeLayerId, lineTypeId: activeLineTypeId })
        setShapes((prev) => [...prev, ...result.textShapes, ...result.guideLines])
        setShowLetterStampModal(false)
        setStatus(`Generated letter stamp: ${result.placements.length} characters`)
      })
      .catch(() => {
        setStatus('Letter stamp tools failed to load')
      })
  }

  return {
    stitchSimulatorResult,
    handleMarkSelectedStitchHoleAsEnd,
    handleClearSelectedStitchHoleEnd,
    handleExtractSelectedBoxStitchSources,
    handleClearSelectedBoxStitchSources,
    handleApplyTextDefaultsToSelection,
    handleGenerateBoxStitch,
    handleOpenBoxStitchHelperModal,
    handleApplyBoxStitchHelper,
    handleGenerateMandalaRadial,
    handleGenerateSpiral,
    handleGenerateGoldenGuides,
    handleGenerateWhiteSilverGuides,
    handleGenerateWizardPattern,
    handleGenerateLetterStamp,
  }
}
