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
const AiBuilderModal = lazy(() =>
  import('./AiBuilderModal').then((mod) => ({ default: mod.AiBuilderModal })),
)
const TracingModal = lazy(() =>
  import('./TracingModal').then((mod) => ({ default: mod.TracingModal })),
)
const LayerColorModal = lazy(() =>
  import('./LayerColorModal').then((mod) => ({ default: mod.LayerColorModal })),
)
const StitchSimulatorModal = lazy(() =>
  import('./StitchSimulatorModal').then((mod) => ({ default: mod.StitchSimulatorModal })),
)
const BoxStitchModal = lazy(() =>
  import('./BoxStitchModal').then((mod) => ({ default: mod.BoxStitchModal })),
)
const MandalaModal = lazy(() =>
  import('./MandalaModal').then((mod) => ({ default: mod.MandalaModal })),
)
const WizardModal = lazy(() =>
  import('./WizardModal').then((mod) => ({ default: mod.WizardModal })),
)
const LetterStampModal = lazy(() =>
  import('./LetterStampModal').then((mod) => ({ default: mod.LetterStampModal })),
)
const ChangeShapeSizeModal = lazy(() =>
  import('./ChangeShapeSizeModal').then((mod) => ({ default: mod.ChangeShapeSizeModal })),
)

type EditorModalStackProps = {
  lineTypePaletteProps: ComponentProps<typeof LineTypePalette>
  helpModalProps: ComponentProps<typeof HelpModal>
  layerColorModalProps: ComponentProps<typeof LayerColorModal>
  exportModalProps: ComponentProps<typeof ExportModal>
  exportOptionsModalProps: ComponentProps<typeof ExportOptionsModal>
  templateRepositoryModalProps: ComponentProps<typeof TemplateRepositoryModal>
  patternToolsModalProps: ComponentProps<typeof PatternToolsModal>
  aiBuilderModalProps: ComponentProps<typeof AiBuilderModal>
  tracingModalProps: ComponentProps<typeof TracingModal>
  printPreviewModalProps: ComponentProps<typeof PrintPreviewModal>
  stitchSimulatorModalProps?: ComponentProps<typeof StitchSimulatorModal>
  boxStitchModalProps?: ComponentProps<typeof BoxStitchModal>
  mandalaModalProps?: ComponentProps<typeof MandalaModal>
  wizardModalProps?: ComponentProps<typeof WizardModal>
  letterStampModalProps?: ComponentProps<typeof LetterStampModal>
  changeShapeSizeModalProps?: ComponentProps<typeof ChangeShapeSizeModal>
}

export function EditorModalStack({
  lineTypePaletteProps,
  helpModalProps,
  layerColorModalProps,
  exportModalProps,
  exportOptionsModalProps,
  templateRepositoryModalProps,
  patternToolsModalProps,
  aiBuilderModalProps,
  tracingModalProps,
  printPreviewModalProps,
  stitchSimulatorModalProps,
  boxStitchModalProps,
  mandalaModalProps,
  wizardModalProps,
  letterStampModalProps,
  changeShapeSizeModalProps,
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
        <AiBuilderModal {...aiBuilderModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <TracingModal {...tracingModalProps} />
      </Suspense>
      <Suspense fallback={null}>
        <PrintPreviewModal {...printPreviewModalProps} />
      </Suspense>
      {stitchSimulatorModalProps && (
        <Suspense fallback={null}>
          <StitchSimulatorModal {...stitchSimulatorModalProps} />
        </Suspense>
      )}
      {boxStitchModalProps && (
        <Suspense fallback={null}>
          <BoxStitchModal {...boxStitchModalProps} />
        </Suspense>
      )}
      {mandalaModalProps && (
        <Suspense fallback={null}>
          <MandalaModal {...mandalaModalProps} />
        </Suspense>
      )}
      {wizardModalProps && (
        <Suspense fallback={null}>
          <WizardModal {...wizardModalProps} />
        </Suspense>
      )}
      {letterStampModalProps && (
        <Suspense fallback={null}>
          <LetterStampModal {...letterStampModalProps} />
        </Suspense>
      )}
      {changeShapeSizeModalProps?.open && (
        <Suspense fallback={null}>
          <ChangeShapeSizeModal
            key={`${changeShapeSizeModalProps.currentWidth}-${changeShapeSizeModalProps.currentHeight}`}
            {...changeShapeSizeModalProps}
          />
        </Suspense>
      )}
    </>
  )
}
