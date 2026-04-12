import { useMemo, type ComponentProps } from 'react'
import { EditorCanvasPane } from '../components/EditorCanvasPane'

type UseEditorCanvasPanePropsParams = Omit<ComponentProps<typeof EditorCanvasPane>, 'hideCanvasPane'> & {
  hideCanvasPane?: boolean
}

export function useEditorCanvasPaneProps(params: UseEditorCanvasPanePropsParams): ComponentProps<typeof EditorCanvasPane> {
  return useMemo(
    () => ({
      ...params,
      hideCanvasPane: params.hideCanvasPane ?? false,
    }),
    [params],
  )
}
