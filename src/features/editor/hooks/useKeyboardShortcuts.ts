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
      if (!isMeta) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const target = event.target as HTMLElement | null
          if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) {
            event.preventDefault()
            handleDeleteSelection()
          }
        }
        return
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
  ])
}
