import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

type EditorOverlayHostProps = {
  modalStack: ReactNode
  projectMemoModal: ReactNode
  pieceInspectorModal: ReactNode
  nestingModal: ReactNode
  hiddenInputs: ReactNode
  fontInput: ReactNode
}

export function EditorOverlayHost({
  modalStack,
  projectMemoModal,
  pieceInspectorModal,
  nestingModal,
  hiddenInputs,
  fontInput,
}: EditorOverlayHostProps) {
  return (
    <>
      <ErrorBoundary>{modalStack}</ErrorBoundary>
      {projectMemoModal}
      {pieceInspectorModal}
      {nestingModal}
      {hiddenInputs}
      {fontInput}
    </>
  )
}
