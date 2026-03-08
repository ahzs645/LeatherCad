import { useState } from 'react'
import type {
  Point,
  StitchHoleType,
  TextTransformMode,
  Tool,
} from '../cad/cad-types'
import { toolLabel } from '../editor-utils'
import type { Dispatch, SetStateAction } from 'react'

type UseEditorToolsParams = {
  setStatus: Dispatch<SetStateAction<string>>
}

export function useEditorTools(params: UseEditorToolsParams) {
  const { setStatus } = params

  const [tool, setTool] = useState<Tool>('pan')
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null)

  // Text tool state
  const [textDraftValue, setTextDraftValue] = useState('Leathercraft CAD')
  const [textFontFamily, setTextFontFamily] = useState('Georgia, serif')
  const [textFontSizeMm, setTextFontSizeMm] = useState(14)
  const [textTransformMode, setTextTransformMode] = useState<TextTransformMode>('none')
  const [textRadiusMm, setTextRadiusMm] = useState(40)
  const [textSweepDeg, setTextSweepDeg] = useState(140)

  // Stitch tool state
  const [stitchHoleType, setStitchHoleType] = useState<StitchHoleType>('round')
  const [stitchPitchMm, setStitchPitchMm] = useState(4)
  const [stitchVariablePitchStartMm, setStitchVariablePitchStartMm] = useState(3)
  const [stitchVariablePitchEndMm, setStitchVariablePitchEndMm] = useState(5)
  const [showStitchSequenceLabels, setShowStitchSequenceLabels] = useState(false)

  const clearDraft = () => {
    setDraftPoints([])
    setCursorPoint(null)
  }

  const setActiveTool = (nextTool: Tool) => {
    setTool(nextTool)
    clearDraft()
    setStatus(`Tool selected: ${toolLabel(nextTool)}`)
  }

  return {
    tool,
    setTool,
    draftPoints,
    setDraftPoints,
    cursorPoint,
    setCursorPoint,
    clearDraft,
    setActiveTool,

    // Text tool state
    textDraftValue,
    setTextDraftValue,
    textFontFamily,
    setTextFontFamily,
    textFontSizeMm,
    setTextFontSizeMm,
    textTransformMode,
    setTextTransformMode,
    textRadiusMm,
    setTextRadiusMm,
    textSweepDeg,
    setTextSweepDeg,

    // Stitch tool state
    stitchHoleType,
    setStitchHoleType,
    stitchPitchMm,
    setStitchPitchMm,
    stitchVariablePitchStartMm,
    setStitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    setStitchVariablePitchEndMm,
    showStitchSequenceLabels,
    setShowStitchSequenceLabels,
  }
}
