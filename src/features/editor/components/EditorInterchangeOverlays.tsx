import { lazy, Suspense, useMemo, useRef, type ReactNode } from 'react'
import type { DocFile } from '../cad/cad-types'
import type { DxfImportActionsParams } from '../hooks/useDxfImportActions'
import type { useInterchangePanels } from '../hooks/useInterchangePanels'
import { useTranslate } from '../hooks/useTranslate'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { ErrorBoundary } from './ErrorBoundary'
import './EditorInterchangeOverlays.css'

const DxfImportButton = lazy(() => import('./DxfImportButton').then((mod) => ({ default: mod.DxfImportButton })))
const StlExportModal = lazy(() => import('./StlExportModal').then((mod) => ({ default: mod.StlExportModal })))
const CloudCommunityDialog = lazy(() => import('./CloudCommunityDialog').then((mod) => ({ default: mod.CloudCommunityDialog })))

export type EditorInterchangeOverlaysProps = {
  panels: ReturnType<typeof useInterchangePanels>
  buildCurrentDocFile: () => DocFile
  onSaveLcad: () => void
  onLoadDocument: (doc: DocFile) => void
  onStatus: (message: string) => void
  selectedShapeIds: string[]
  dxfImportProps: DxfImportActionsParams
}

function ToolLoadingDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslate()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open: true, onClose })
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="export-options-modal" role="dialog" aria-modal="true" aria-label={t('interchange.opening', 'Opening tool')} ref={dialogRef} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <p role="status">{t('common.loading', 'Loading…')}</p>
        <button type="button" onClick={onClose}>{t('common.close', 'Close')}</button>
      </div>
    </div>
  )
}

function ToolFailureDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslate()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open: true, onClose })
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="export-options-modal" role="alertdialog" aria-modal="true" aria-label={t('interchange.unavailable', 'Tool unavailable')} ref={dialogRef} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <p>{t('interchange.loadFailed', 'Could not open this tool. Close it to continue editing; save your drawing before reloading to try again.')}</p>
        <div className="line-type-modal-actions">
          <button type="button" onClick={onClose}>{t('common.close', 'Close')}</button>
        </div>
      </div>
    </div>
  )
}

function FileToolsDialog({ panels, onSaveLcad, children }: Pick<EditorInterchangeOverlaysProps, 'panels' | 'onSaveLcad'> & { children: ReactNode }) {
  const t = useTranslate()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open: true, onClose: panels.close })
  return (
    <div className="modal-backdrop" role="presentation" onClick={panels.close}>
      <div className="export-options-modal" role="dialog" aria-modal="true" aria-labelledby="interchange-tools-title" tabIndex={-1} ref={dialogRef} onClick={(event) => event.stopPropagation()}>
        <div className="layer-color-modal-header">
          <h2 id="interchange-tools-title">{t('interchange.title', 'File tools')}</h2>
          <button type="button" onClick={panels.close}>{t('common.done', 'Done')}</button>
        </div>
        <section className="control-block">
          <h3>{t('interchange.dxfTitle', 'Import DXF')}</h3>
          <p>{t('interchange.dxfHint', 'Add CAD geometry to the current drawing. Choose file units or override them before importing.')}</p>
          <Suspense fallback={<span role="status">{t('common.loading', 'Loading…')}</span>}>{children}</Suspense>
        </section>
        <section className="control-block">
          <h3>{t('interchange.exportsTitle', 'Export and share')}</h3>
          <div className="line-type-modal-actions">
            <button type="button" onClick={onSaveLcad}>{t('interchange.saveLcad', 'Save LCAD')}</button>
            <button type="button" onClick={panels.openStl}>{t('interchange.exportStl', 'Export STL / Jig')}</button>
            <button type="button" onClick={panels.openCloud}>{t('interchange.cloud', 'Cloud / Community')}</button>
          </div>
        </section>
      </div>
    </div>
  )
}

export function EditorInterchangeOverlays(props: EditorInterchangeOverlaysProps) {
  const { panels } = props
  const t = useTranslate()
  const selectedShapeIds = useMemo(() => new Set(props.selectedShapeIds), [props.selectedShapeIds])

  if (!panels.panel) return null
  const doc = props.buildCurrentDocFile()
  return (
    <ErrorBoundary key={panels.panel} fallback={
      <ToolFailureDialog onClose={panels.close} />
    }>
      <Suspense fallback={<ToolLoadingDialog onClose={panels.close} />}>
        {panels.panel === 'files' ? (
          <FileToolsDialog panels={panels} onSaveLcad={props.onSaveLcad}>
            <DxfImportButton {...props.dxfImportProps} />
          </FileToolsDialog>
        ) : null}
        {panels.panel === 'stl' ? (
          <StlExportModal open onClose={panels.close} doc={doc} selectedShapeIds={selectedShapeIds} onExported={() => props.onStatus(t('interchange.stlExported', 'Exported STL'))} />
        ) : null}
        {panels.panel === 'cloud' ? (
          <CloudCommunityDialog open onClose={panels.close} currentDoc={doc} onLoadDocument={props.onLoadDocument} onStatus={props.onStatus} />
        ) : null}
      </Suspense>
    </ErrorBoundary>
  )
}
