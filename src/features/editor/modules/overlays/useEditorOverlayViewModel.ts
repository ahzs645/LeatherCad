import {
  buildEditorOverlayProps,
  type BuildEditorOverlayPropsParams,
  type EditorOverlayProps,
} from '../../controllers/buildEditorOverlayProps'
import {
  useEditorModalStackProps,
  type UseEditorModalStackPropsParams,
} from '../../hooks/useEditorModalStackProps'

type OverlayPropsParams = Omit<BuildEditorOverlayPropsParams, 'modalStackProps'>

export type UseEditorOverlayViewModelParams = {
  modalStack: UseEditorModalStackPropsParams
  overlay: OverlayPropsParams
}

export function useEditorOverlayViewModel({
  modalStack,
  overlay,
}: UseEditorOverlayViewModelParams): EditorOverlayProps {
  const modalStackProps = useEditorModalStackProps(modalStack)

  return buildEditorOverlayProps({
    modalStackProps,
    ...overlay,
  })
}
