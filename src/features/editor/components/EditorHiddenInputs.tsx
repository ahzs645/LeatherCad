import type { ChangeEventHandler, RefObject } from 'react'

export type EditorHiddenInputsProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  svgInputRef: RefObject<HTMLInputElement | null>
  tracingInputRef: RefObject<HTMLInputElement | null>
  patternPdfInputRef: RefObject<HTMLInputElement | null>
  templateImportInputRef: RefObject<HTMLInputElement | null>
  catalogImportInputRef: RefObject<HTMLInputElement | null>
  translationInputRef: RefObject<HTMLInputElement | null>
  onLoadJson: ChangeEventHandler<HTMLInputElement>
  onImportSvg: ChangeEventHandler<HTMLInputElement>
  onImportTracing: ChangeEventHandler<HTMLInputElement>
  onImportPatternPdf: ChangeEventHandler<HTMLInputElement>
  onImportTemplateRepositoryFile: ChangeEventHandler<HTMLInputElement>
  onImportCatalogFile: ChangeEventHandler<HTMLInputElement>
  onImportTranslation: ChangeEventHandler<HTMLInputElement>
}

export function EditorHiddenInputs({
  fileInputRef,
  svgInputRef,
  tracingInputRef,
  patternPdfInputRef,
  templateImportInputRef,
  catalogImportInputRef,
  translationInputRef,
  onLoadJson,
  onImportSvg,
  onImportTracing,
  onImportPatternPdf,
  onImportTemplateRepositoryFile,
  onImportCatalogFile,
  onImportTranslation,
}: EditorHiddenInputsProps) {
  return (
    <>
      <input ref={fileInputRef} type="file" accept="application/json,.lcc" className="hidden-input" onChange={onLoadJson} />
      <input ref={svgInputRef} type="file" accept=".svg,image/svg+xml" className="hidden-input" onChange={onImportSvg} />
      <input
        ref={tracingInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden-input"
        onChange={onImportTracing}
      />
      <input
        ref={patternPdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden-input"
        onChange={onImportPatternPdf}
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
      <input
        ref={translationInputRef}
        type="file"
        accept=".tsv,.txt,.json,text/plain"
        className="hidden-input"
        onChange={onImportTranslation}
      />
    </>
  )
}
