import type { ComponentProps } from 'react'
import { ExportOptionsModal } from './ExportOptionsModal'
import { ExportModal } from './ExportModal'
import { HelpModal } from './HelpModal'
import { LayerColorModal } from './LayerColorModal'
import { LineTypePalette } from './LineTypePalette'
import { PatternToolsModal } from './PatternToolsModal'
import { PrintPreviewModal } from './PrintPreviewModal'
import { TemplateRepositoryModal } from './TemplateRepositoryModal'
import { TracingModal } from './TracingModal'

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
      <HelpModal {...helpModalProps} />
      <LayerColorModal {...layerColorModalProps} />
      <ExportModal {...exportModalProps} />
      <ExportOptionsModal {...exportOptionsModalProps} />
      <TemplateRepositoryModal {...templateRepositoryModalProps} />
      <PatternToolsModal {...patternToolsModalProps} />
      <TracingModal {...tracingModalProps} />
      <PrintPreviewModal {...printPreviewModalProps} />
    </>
  )
}
