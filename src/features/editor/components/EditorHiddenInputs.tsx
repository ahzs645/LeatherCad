import type { ChangeEventHandler, RefObject } from 'react'

type EditorHiddenInputsProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  svgInputRef: RefObject<HTMLInputElement | null>
  tracingInputRef: RefObject<HTMLInputElement | null>
  templateImportInputRef: RefObject<HTMLInputElement | null>
  catalogImportInputRef: RefObject<HTMLInputElement | null>
  onLoadJson: ChangeEventHandler<HTMLInputElement>
  onImportSvg: ChangeEventHandler<HTMLInputElement>
  onImportTracing: ChangeEventHandler<HTMLInputElement>
  onImportTemplateRepositoryFile: ChangeEventHandler<HTMLInputElement>
  onImportCatalogFile: ChangeEventHandler<HTMLInputElement>
}

export function EditorHiddenInputs({
  fileInputRef,
  svgInputRef,
  tracingInputRef,
  templateImportInputRef,
  catalogImportInputRef,
  onLoadJson,
  onImportSvg,
  onImportTracing,
  onImportTemplateRepositoryFile,
  onImportCatalogFile,
}: EditorHiddenInputsProps) {
  return (
    <>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden-input" onChange={onLoadJson} />
      <input ref={svgInputRef} type="file" accept=".svg,image/svg+xml" className="hidden-input" onChange={onImportSvg} />
      <input
        ref={tracingInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden-input"
        onChange={onImportTracing}
      />
      <input
        ref={templateImportInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={onImportTemplateRepositoryFile}
      />
      <input
        ref={catalogImportInputRef}
        type="file"
        accept=".ctlg,application/json"
        className="hidden-input"
        onChange={onImportCatalogFile}
      />
    </>
  )
}
