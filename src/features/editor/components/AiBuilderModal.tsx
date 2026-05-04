import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocFile } from '../cad/cad-types'
import {
  appendAssistantTurn,
  appendUserTurn,
  EMPTY_AI_BUILDER_HISTORY,
} from '../ai-builder/ai-builder-history'
import { compileAiBuilderDocument } from '../ai-builder/ai-builder-compile'
import { parseAiBuilderDocument } from '../ai-builder/ai-builder-parse'
import { renderAiBuilderTurnPrompt } from '../ai-builder/ai-builder-prompt-turn'
import { AI_BUILDER_DEFAULT_REQUEST } from '../ai-builder/ai-builder-schema'
import type {
  AiBuilderCompileResult,
  AiBuilderValidationError,
} from '../ai-builder/ai-builder-types'

type AiBuilderModalProps = {
  open: boolean
  onClose: () => void
  onLoadDocument: (doc: DocFile, documentName: string) => void
  onInsertDocument: (doc: DocFile, documentName: string) => void
  onSetStatus: (message: string) => void
}

type ValidationState =
  | {
      kind: 'invalid'
      errors: AiBuilderValidationError[]
    }
  | {
      kind: 'valid'
      documentName: string
      compileResult: AiBuilderCompileResult
    }

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) {
    throw new Error('Copy command failed')
  }
}

export function AiBuilderModal({
  open,
  onClose,
  onLoadDocument,
  onInsertDocument,
  onSetStatus,
}: AiBuilderModalProps) {
  const requestRef = useRef<HTMLTextAreaElement | null>(null)
  const [request, setRequest] = useState('')
  const [rawJson, setRawJson] = useState('')
  const [history, setHistory] = useState(EMPTY_AI_BUILDER_HISTORY)
  const [lastHistoryRawJson, setLastHistoryRawJson] = useState('')
  const [validationState, setValidationState] = useState<ValidationState | null>(null)
  const promptPreview = useMemo(() => renderAiBuilderTurnPrompt({ history, request }), [history, request])
  const savedDocumentCount = history.turns.filter((turn) => turn.role === 'assistant').length

  useEffect(() => {
    if (!open) {
      return
    }
    requestRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const handleCopyPrompt = async () => {
    try {
      await copyTextToClipboard(promptPreview)
      onSetStatus('AI Builder prompt copied')
    } catch (error) {
      onSetStatus(`Could not copy AI Builder prompt: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  const handleValidate = () => {
    if (rawJson.trim().length === 0) {
      setValidationState({
        kind: 'invalid',
        errors: [{ path: '$', message: 'paste AI Builder JSON before validating' }],
      })
      onSetStatus('Paste AI Builder JSON before validating')
      return
    }

    const parseResult = parseAiBuilderDocument(rawJson)
    if (!parseResult.ok) {
      setValidationState({
        kind: 'invalid',
        errors: parseResult.errors,
      })
      onSetStatus(`AI Builder validation failed with ${parseResult.errors.length} error${parseResult.errors.length === 1 ? '' : 's'}`)
      return
    }

    const compileResult = compileAiBuilderDocument(parseResult.document)
    const normalizedRawJson = rawJson.trim()
    if (normalizedRawJson !== lastHistoryRawJson) {
      const historyRequest = request.trim() || AI_BUILDER_DEFAULT_REQUEST
      setHistory((currentHistory) => appendAssistantTurn(appendUserTurn(currentHistory, historyRequest), normalizedRawJson))
      setLastHistoryRawJson(normalizedRawJson)
    }
    setValidationState({
      kind: 'valid',
      documentName: parseResult.document.document_name,
      compileResult,
    })
    onSetStatus(
      `AI Builder JSON is valid (${compileResult.summary.shapeCount} shapes, ${compileResult.summary.patternPieceCount} pieces, ${compileResult.summary.stitchHoleCount} stitch holes, ${compileResult.summary.preflightErrorCount} preflight errors)`,
    )
  }

  const handleResetHistory = () => {
    setHistory(EMPTY_AI_BUILDER_HISTORY)
    setLastHistoryRawJson('')
    onSetStatus('AI Builder refinement context reset')
  }

  const handleLoadDocument = () => {
    if (!validationState || validationState.kind !== 'valid') {
      return
    }
    onLoadDocument(validationState.compileResult.doc, validationState.documentName)
    onClose()
  }

  const handleInsertDocument = () => {
    if (!validationState || validationState.kind !== 'valid') {
      return
    }
    onInsertDocument(validationState.compileResult.doc, validationState.documentName)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="line-type-modal ai-builder-modal"
        role="dialog"
        aria-modal="true"
        aria-label="AI Builder"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="line-type-modal-header">
          <div>
            <h2>AI Builder</h2>
            <p className="line-type-modal-subtitle">
              {savedDocumentCount > 0 ? `${savedDocumentCount} saved refinement turn${savedDocumentCount === 1 ? '' : 's'}` : 'Prompt Out, JSON In'}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="hint">
          Describe the pattern, copy the generated prompt into any AI service, then paste the returned JSON here for strict validation and import.
        </p>

        <div className="control-block">
          <h3>Request</h3>
          <label className="field-row" htmlFor="ai-builder-request">
            <span>Pattern description</span>
            <textarea
              ref={requestRef}
              id="ai-builder-request"
              className="ai-builder-textarea"
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              placeholder="Example: Create a bifold wallet shell with an outer rectangle, a center fold, one curved card slot, and a small brand mark."
            />
          </label>
        </div>

        <div className="control-block">
          <h3>Prompt Preview</h3>
          <label className="field-row" htmlFor="ai-builder-prompt-preview">
            <span>Generated prompt</span>
            <textarea
              id="ai-builder-prompt-preview"
              className="ai-builder-textarea ai-builder-textarea-code"
              value={promptPreview}
              readOnly
            />
          </label>
          <div className="line-type-modal-actions">
            <button type="button" onClick={handleCopyPrompt}>
              Copy Prompt
            </button>
            <button type="button" onClick={handleResetHistory} disabled={savedDocumentCount === 0}>
              Reset Context
            </button>
          </div>
        </div>

        <div className="control-block">
          <h3>Paste JSON</h3>
          <label className="field-row" htmlFor="ai-builder-json-input">
            <span>AI output JSON</span>
            <textarea
              id="ai-builder-json-input"
              className="ai-builder-textarea ai-builder-textarea-code"
              value={rawJson}
              onChange={(event) => {
                setRawJson(event.target.value)
                setValidationState(null)
              }}
              placeholder='{"schema_version":1,"document_name":"example_pattern","units":"mm","layers":[],"entities":[]}'
            />
          </label>
          <div className="line-type-modal-actions">
            <button type="button" onClick={handleValidate} disabled={rawJson.trim().length === 0}>
              Validate
            </button>
            <button
              type="button"
              onClick={handleLoadDocument}
              disabled={!validationState || validationState.kind !== 'valid'}
            >
              Load as Document
            </button>
            <button
              type="button"
              onClick={handleInsertDocument}
              disabled={!validationState || validationState.kind !== 'valid'}
            >
              Insert into Current
            </button>
          </div>
        </div>

        <div className="control-block">
          <h3>Validation Summary</h3>
          {!validationState && (
            <p className="hint">
              No validation run yet. Validate pasted JSON to see strict schema errors or compile counts.
            </p>
          )}

          {validationState?.kind === 'invalid' && (
            <ul className="ai-builder-error-list">
              {validationState.errors.map((error, index) => (
                <li key={`${error.path}-${index}`}>
                  <strong>{error.path}</strong>: {error.message}
                </li>
              ))}
            </ul>
          )}

          {validationState?.kind === 'valid' && (
            <div className="ai-builder-summary-grid">
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Document</span>
                <strong>{validationState.documentName}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Layers</span>
                <strong>{validationState.compileResult.summary.layerCount}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Entities</span>
                <strong>{validationState.compileResult.summary.entityCount}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Shapes</span>
                <strong>{validationState.compileResult.summary.shapeCount}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Fold Lines</span>
                <strong>{validationState.compileResult.summary.foldCount}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Stitch Holes</span>
                <strong>{validationState.compileResult.summary.stitchHoleCount}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Pieces</span>
                <strong>{validationState.compileResult.summary.patternPieceCount}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Seams</span>
                <strong>{validationState.compileResult.summary.seamConnectionCount}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Hardware</span>
                <strong>{validationState.compileResult.summary.hardwareMarkerCount}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Refs</span>
                <strong>{validationState.compileResult.refs.length}</strong>
              </div>
              <div className="ai-builder-summary-card">
                <span className="ai-builder-summary-label">Preflight</span>
                <strong>
                  {validationState.compileResult.summary.preflightErrorCount} / {validationState.compileResult.summary.preflightWarningCount}
                </strong>
              </div>
            </div>
          )}

          {validationState?.kind === 'valid' && validationState.compileResult.preflight.length > 0 && (
            <ul className="ai-builder-error-list">
              {validationState.compileResult.preflight.slice(0, 8).map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <strong>{issue.severity.toUpperCase()} {issue.code}</strong>: {issue.message}
                  {issue.ref ? ` ${issue.ref}` : ''}
                </li>
              ))}
            </ul>
          )}

          {validationState?.kind === 'valid' && validationState.compileResult.refs.length > 0 && (
            <p className="hint">
              Refs: {validationState.compileResult.refs.slice(0, 6).map((entry) => entry.ref).join(', ')}
              {validationState.compileResult.refs.length > 6 ? ' ...' : ''}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
