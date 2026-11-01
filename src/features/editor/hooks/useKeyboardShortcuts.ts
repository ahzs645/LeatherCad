import { useEffect, useRef } from 'react'
import type { Tool } from '../cad/cad-types'
import { toolForKey } from '../ops/tool-shortcuts'
import { requestSelectionGeometryFocus } from '../ops/selection-geometry-focus'
import { CANVAS_HISTORY_EVENT } from './canvas-interactions/useCanvasTouchGestures'
import { useEditorToolActions, useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
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
  handleToggleDimensionAnnotations: () => void
  handleToggleStitchSimulator: () => void
  handleAdjustThreadThickness: (delta: number) => void
  handleToggleStitchParity: () => void
  /** Activate a drawing tool from its single-key shortcut. */
  handleSelectTool?: (tool: Tool) => void
  handleToggleDisplayUnit?: () => void
  handleOpenOptions?: () => void
  /** True while shapes are selected: arrows nudge instead of panning. */
  hasSelection?: boolean
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
    handleToggleDimensionAnnotations,
    handleToggleStitchSimulator,
    handleAdjustThreadThickness,
    handleToggleStitchParity,
    handleSelectTool,
    handleToggleDisplayUnit,
    handleOpenOptions,
    hasSelection = false,
  } = params
  const { clearDraft } = useEditorToolActions()
  const { setStatus } = useEditorUIActions()
  const { tool, draftPointCount } = useEditorToolSelector((state) => ({ tool: state.tool, draftPointCount: state.draftPoints.length }))
  const previousToolRef = useRef<Tool | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const targetEl = event.target instanceof HTMLElement ? event.target : null
      if (event.defaultPrevented || targetEl?.closest('[aria-modal="true"], dialog[open]')) return
      const isTypingContext = Boolean(targetEl?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))
      if (isTypingContext) return
      if (event.key === 'Escape') {
        // Cascade: cancel the shape in progress → back to Select → clear the
        // selection → return to the tool used before (reference behaviour).
        if (draftPointCount > 0) {
          clearDraft()
          setStatus('Shape in progress cancelled')
        } else if (tool !== 'pan' && handleSelectTool) {
          previousToolRef.current = tool
          handleSelectTool('pan')
        } else if (hasSelection) {
          handleDeselectAll()
          setStatus('Selection cleared')
        } else if (previousToolRef.current && handleSelectTool) {
          const previous = previousToolRef.current
          previousToolRef.current = null
          handleSelectTool(previous)
        } else {
          clearDraft()
          handleDeselectAll()
          setStatus('Draft and selection cleared')
        }
        return
      }

      const isMeta = event.ctrlKey || event.metaKey

      if (!isMeta) {
        if (!isTypingContext) {
          // Source-app function-key + symbol-key shortcuts.
          if (event.key === 'F5') {
            event.preventDefault()
            handleToggleDimensionAnnotations()
            return
          }
          if (event.key === 'F6') {
            event.preventDefault()
            handleToggleStitchSimulator()
            return
          }
          if (event.key === '+' || event.key === '=') {
            // '=' shares the same physical key as '+'; reserve plain '=' for
            // the parity toggle (source-app v1.2.5) when no Shift is held.
            if (event.key === '+' || event.shiftKey) {
              event.preventDefault()
              handleAdjustThreadThickness(1)
              return
            }
            event.preventDefault()
            handleToggleStitchParity()
            return
          }
          if (event.key === '-' || event.key === '_') {
            event.preventDefault()
            handleAdjustThreadThickness(-1)
            return
          }
        }
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
          // T is the Text tool (as in the reference); Shift+T toggles tracings.
          if ((event.key === 't' || event.key === 'T') && event.shiftKey) {
            event.preventDefault()
            handleToggleTracingsVisibility()
            return
          }
          if ((event.key === 'n' || event.key === 'N') && !event.shiftKey && handleToggleDisplayUnit) {
            event.preventDefault()
            handleToggleDisplayUnit()
            return
          }
          if ((event.key === 'z' || event.key === 'Z') && !event.shiftKey) {
            event.preventDefault()
            handleExtendOrTrimLines()
            return
          }
          if (event.key === 'Enter' && hasSelection && tool === 'pan' && !targetEl?.closest('button, a, [role="button"], [role="menuitem"], [role="tab"]')) {
            event.preventDefault()
            requestSelectionGeometryFocus()
            return
          }
          const shortcutTool = toolForKey(event.key, event.shiftKey)
          if (shortcutTool) {
            event.preventDefault()
            if (handleSelectTool) handleSelectTool(shortcutTool)
            else if (shortcutTool === 'pan') handleBackToSelectMode()
            return
          }
          // Arrow keys nudge a selection (Shift = 0.1 mm), otherwise pan the
          // view. Pan reversal follows the `reverseGridScrollDirection` option.
          if (hasSelection && event.key.startsWith('Arrow')) {
            event.preventDefault()
            const step = event.shiftKey ? 0.1 : 1
            const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
            const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
            if (dx !== 0 || dy !== 0) handleNudgeSelection(dx, dy)
            return
          }
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

      if ((event.key === ',' || event.code === 'Comma') && handleOpenOptions) {
        event.preventDefault()
        handleOpenOptions()
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

    // Touch gestures (two/three-finger double tap) arrive as history events.
    const onHistory = (event: Event) => {
      const action = (event as CustomEvent<'undo' | 'redo' | 'delete'>).detail
      if (action === 'delete') {
        handleDeleteSelection()
        return
      }
      if (action === 'undo') handleUndo()
      else if (action === 'redo') handleRedo()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(CANVAS_HISTORY_EVENT, onHistory)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(CANVAS_HISTORY_EVENT, onHistory)
    }
  }, [
    clearDraft,
    setStatus,
    tool,
    draftPointCount,
    hasSelection,
    handleSelectTool,
    handleToggleDisplayUnit,
    handleOpenOptions,
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
    handleToggleDimensionAnnotations,
    handleToggleStitchSimulator,
    handleAdjustThreadThickness,
    handleToggleStitchParity,
  ])
}
