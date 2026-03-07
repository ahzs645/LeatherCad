import { lazy, Suspense, type ComponentProps } from 'react'
import { LineTypePalette } from './LineTypePalette'

const ExportModal = lazy(() =>
  import('./ExportModal').then((mod) => ({ default: mod.ExportModal })),
)
const ExportOptionsModal = lazy(() =>
  import('./ExportOptionsModal').then((mod) => ({ default: mod.ExportOptionsModal })),
)
const HelpModal = lazy(() =>
  import('./HelpModal').then((mod) => ({ default: mod.HelpModal })),
)
const PrintPreviewModal = lazy(() =>
  import('./PrintPreviewModal').then((mod) => ({ default: mod.PrintPreviewModal })),
)
const TemplateRepositoryModal = lazy(() =>
  import('./TemplateRepositoryModal').then((mod) => ({ default: mod.TemplateRepositoryModal })),
)
const PatternToolsModal = lazy(() =>
  import('./PatternToolsModal').then((mod) => ({ default: mod.PatternToolsModal })),
)
const TracingModal = lazy(() =>
  import('./TracingModal').then((mod) => ({ default: mod.TracingModal })),
)
const LayerColorModal = lazy(() =>
  import('./LayerColorModal').then((mod) => ({ default: mod.LayerColorModal })),
)

type EditorModalStackProps = {
  lineTypePaletteProps: ComponentProps<typeof LineTypePalette>
  helpModalProps: ComponentProps<typeof HelpModal>
  layerColorModalProps: ComponentProps<typeof LayerColorModal>
  exportModalProps: ComponentProps<typeof ExportModal>
  exportOptionsModalProps: ComponentProps<typeof ExportOptionsModal>
  templateRepositoryModalProps: ComponentProps<typeof TemplateRepositoryModal>
  patternToolsModalProps: ComponentProps<typeof PatternToolsModal>
  tracingModalProps: ComponentProps<typeof TracingModal>
  printPreviewModalProps: ComponentProps<typeof PrintPreviewModal>
}

export function EditorModalStack({
  lineTypePaletteProps,
  helpModalProps,
  layerColorModalProps,
  exportModalProps,
  exportOptionsModalProps,
  templateRepositoryModalProps,
  patternToolsModalProps,
  tracingModalProps,
  printPreviewModalProps,
}: EditorModalStackProps) {
  return (
    <>
      <LineTypePalette {...lineTypePaletteProps} />
      <Suspense fallback={null}>
        <HelpModal {...helpModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <LayerColorModal {...layerColorModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <ExportModal {...exportModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <ExportOptionsModal {...exportOptionsModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <TemplateRepositoryModal {...templateRepositoryModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <PatternToolsModal {...patternToolsModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <TracingModal {...tracingModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <PrintPreviewModal {...printPreviewModalProps} />
      </Suspense>
    </>
  )
}
