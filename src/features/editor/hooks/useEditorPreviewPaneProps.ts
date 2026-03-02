import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import type { FoldLine } from '../cad/cad-types'
import { EditorPreviewPane } from '../components/EditorPreviewPane'
import { sanitizeFoldLine } from '../editor-parsers'

type UseEditorPreviewPanePropsParams = Omit<ComponentProps<typeof EditorPreviewPane>, 'onUpdateFoldLine'> & {
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
}

export function useEditorPreviewPaneProps(params: UseEditorPreviewPanePropsParams): ComponentProps<typeof EditorPreviewPane> {
  const {
    setFoldLines,
    showThreePreview,
    hidePreviewPane,
    isMobileLayout,
    mobileViewMode,
    shapes,
    stitchHoles,
    foldLines,
    layers,
    lineTypes,
    themeMode,
  } = params

  return {
    showThreePreview,
    hidePreviewPane,
    isMobileLayout,
    mobileViewMode,
    shapes,
    stitchHoles,
    foldLines,
    layers,
    lineTypes,
    themeMode,
    onUpdateFoldLine: (foldLineId, updates) =>
      setFoldLines((previous) =>
        previous.map((foldLine) =>
          foldLine.id === foldLineId
            ? sanitizeFoldLine({
                ...foldLine,
                ...updates,
              })
            : foldLine,
        ),
      ),
  }
}
