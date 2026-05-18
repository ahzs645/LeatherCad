import { useEffect } from 'react'
import { useEditorToolActions } from '../state/providers/EditorToolStateProvider'
import { useEditorUIActions } from '../state/providers/EditorUIStateProvider'

type UseKeyboardShortcutsParams = {
  handleDeleteSelection: () => void
  handleUndo: () => void
  handleRedo: () => void
  handleCopySelection: () => void
  handleCutSelection: () => void
  handlePasteClipboard: () => void
  handleDuplicateSelection: () => void
  handleSelectAllShapes: () => void
  handleDeselectAll: () => void
  handleNudgeSelection: (dxMm: number, dyMm: number) => void
  handleToggleCanvasRuler: () => void
  handleHideBezierOffsetGuides: () => void
  handleToggleGrid: () => void
  handleToggleTracingsVisibility: () => void
  handleBackToSelectMode: () => void
  handleRotateSelectionBy: (angleDeg: number) => void
  handleExtendOrTrimLines: () => void
  handlePanViewport: (dxScreenPx: number, dyScreenPx: number) => void
  reverseGridScrollDirection: boolean
}

export function useKeyboardShortcuts(params: UseKeyboardShortcutsParams) {
  const {
    handleDeleteSelection,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleSelectAllShapes,
    handleDeselectAll,
    handleNudgeSelection,
    handleToggleCanvasRuler,
    handleHideBezierOffsetGuides,
    handleToggleGrid,
    handleToggleTracingsVisibility,
    handleBackToSelectMode,
    handleRotateSelectionBy,
    handleExtendOrTrimLines,
    handlePanViewport,
    reverseGridScrollDirection,
  } = params
  const { clearDraft } = useEditorToolActions()
  const { setStatus } = useEditorUIActions()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearDraft()
        handleDeselectAll()
        setStatus('Draft and selection cleared')
        return
      }

      const isMeta = event.ctrlKey || event.metaKey
      const targetEl = event.target as HTMLElement | null
      const isTypingContext = targetEl?.tagName === 'INPUT' || targetEl?.tagName === 'TEXTAREA'

      if (!isMeta) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (!isTypingContext) {
            event.preventDefault()
            handleDeleteSelection()
          }
          return
        }
        // Plain-key single-letter hotkeys.
        if (!isTypingContext && !event.altKey) {
          if (event.key === 's' || event.key === 'S') {
            event.preventDefault()
            handleToggleCanvasRuler()
            return
          }
          if ((event.key === 'J' || event.key === 'j') && event.shiftKey) {
            event.preventDefault()
            handleHideBezierOffsetGuides()
            return
          }
          if ((event.key === 'g' || event.key === 'G') && !event.shiftKey) {
            event.preventDefault()
            handleToggleGrid()
            return
          }
          if ((event.key === 't' || event.key === 'T') && !event.shiftKey) {
            event.preventDefault()
            handleToggleTracingsVisibility()
            return
          }
          if ((event.key === 'v' || event.key === 'V') && !event.shiftKey) {
            event.preventDefault()
            handleBackToSelectMode()
            return
          }
          if ((event.key === 'z' || event.key === 'Z') && !event.shiftKey) {
            event.preventDefault()
            handleExtendOrTrimLines()
            return
          }
          // Plain arrow keys pan the canvas viewport (source-app v1.4.0).
          // Reversal sign matches the `reverseGridScrollDirection` option.
          const panSign = reverseGridScrollDirection ? -1 : 1
          const panStepPx = 40 * panSign
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            handlePanViewport(panStepPx, 0)
            return
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            handlePanViewport(-panStepPx, 0)
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            handlePanViewport(0, panStepPx)
            return
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            handlePanViewport(0, -panStepPx)
            return
          }
          // Rotation hotkeys: [ = CCW 1, ] = CW 1, { = CCW 5, } = CW 5
          if (event.key === '[') {
            event.preventDefault()
            handleRotateSelectionBy(-1)
            return
          }
          if (event.key === ']') {
            event.preventDefault()
            handleRotateSelectionBy(1)
            return
          }
          if (event.key === '{') {
            event.preventDefault()
            handleRotateSelectionBy(-5)
            return
          }
          if (event.key === '}') {
            event.preventDefault()
            handleRotateSelectionBy(5)
            return
          }
        }
        return
      }

      // Arrow-key nudge (Ctrl = 1mm, Ctrl+Shift = 0.1mm, Ctrl+Alt = 0.01mm).
      const nudgeStepMm = event.altKey ? 0.01 : event.shiftKey ? 0.1 : 1
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          handleNudgeSelection(-nudgeStepMm, 0)
          return
        case 'ArrowRight':
          event.preventDefault()
          handleNudgeSelection(nudgeStepMm, 0)
          return
        case 'ArrowUp':
          event.preventDefault()
          handleNudgeSelection(0, -nudgeStepMm)
          return
        case 'ArrowDown':
          event.preventDefault()
          handleNudgeSelection(0, nudgeStepMm)
          return
        default:
          break
      }

      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        handleRedo()
        return
      }
      if (key === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        handleRedo()
        return
      }
      if (key === 'c') {
        event.preventDefault()
        handleCopySelection()
        return
      }
      if (key === 'x') {
        event.preventDefault()
        handleCutSelection()
        return
      }
      if (key === 'v') {
        event.preventDefault()
        handlePasteClipboard()
        return
      }
      if (key === 'd') {
        event.preventDefault()
        handleDuplicateSelection()
        return
      }
      if (key === 'a') {
        event.preventDefault()
        handleSelectAllShapes()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    clearDraft,
    setStatus,
    handleDeleteSelection,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleSelectAllShapes,
    handleDeselectAll,
    handleNudgeSelection,
    handleToggleCanvasRuler,
    handleHideBezierOffsetGuides,
    handleToggleGrid,
    handleToggleTracingsVisibility,
    handleBackToSelectMode,
    handleRotateSelectionBy,
    handleExtendOrTrimLines,
    handlePanViewport,
    reverseGridScrollDirection,
  ])
}
