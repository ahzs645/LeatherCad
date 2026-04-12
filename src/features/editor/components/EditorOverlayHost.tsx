import { lazy, Suspense, type ChangeEventHandler, type ComponentProps, type RefObject } from 'react'
import { EditorHiddenInputs, type EditorHiddenInputsProps } from './EditorHiddenInputs'
import { EditorModalStack } from './EditorModalStack'
import { ErrorBoundary } from './ErrorBoundary'
import { PieceInspectorModal, type PieceInspectorModalProps } from './PieceInspectorModal'
import type { NestingModalProps } from './NestingModal'
import type { ProjectMemoModalProps } from './ProjectMemoModal'

const ProjectMemoModal = lazy(() =>
  import('./ProjectMemoModal').then((mod) => ({ default: mod.ProjectMemoModal })),
)
const NestingModal = lazy(() =>
  import('./NestingModal').then((mod) => ({ default: mod.NestingModal })),
)

export type EditorOverlayHostProps = {
  modalStackProps: ComponentProps<typeof EditorModalStack>
  projectMemoModalProps: ProjectMemoModalProps
  pieceInspectorModalProps: PieceInspectorModalProps | null
  nestingModalProps: NestingModalProps
  hiddenInputsProps: EditorHiddenInputsProps
  fontInputProps: {
    ref: RefObject<HTMLInputElement | null>
    onChange: ChangeEventHandler<HTMLInputElement>
  }
}

export function EditorOverlayHost({
  modalStackProps,
  projectMemoModalProps,
  pieceInspectorModalProps,
  nestingModalProps,
  hiddenInputsProps,
  fontInputProps,
}: EditorOverlayHostProps) {
  return (
    <>
      <ErrorBoundary>
        <EditorModalStack {...modalStackProps} />
      </ErrorBoundary>
      <Suspense fallback={null}>
        <ProjectMemoModal {...projectMemoModalProps} />
      </Suspense>
      {pieceInspectorModalProps ? <PieceInspectorModal {...pieceInspectorModalProps} /> : null}
      <Suspense fallback={null}>
        <NestingModal {...nestingModalProps} />
      </Suspense>
      <EditorHiddenInputs {...hiddenInputsProps} />
      <input
        ref={fontInputProps.ref}
        type="file"
        accept=".ttf,.otf,.woff"
        style={{ display: 'none' }}
        onChange={fontInputProps.onChange}
      />
    </>
  )
}
