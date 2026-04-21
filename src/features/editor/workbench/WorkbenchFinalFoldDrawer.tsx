import { useState } from 'react'
import { DEFAULT_FOLD_DIRECTION } from '../ops/fold-line-ops'
import type { WorkbenchThreePreviewController } from './useWorkbenchThreePreviewController'

type WorkbenchFinalFoldDrawerProps = {
  controller: WorkbenchThreePreviewController
}

export function WorkbenchFinalFoldModeTab({ controller }: WorkbenchFinalFoldDrawerProps) {
  const { onSetThreePreviewSettings } = controller

  return (
    <div className="workbench-final-fold-drawer collapsed">
      <button
        type="button"
        className="workbench-final-fold-tab"
        aria-label="Switch to Final Product fold controls"
        onClick={() =>
          onSetThreePreviewSettings((previous) => ({
            ...previous,
            mode: 'final',
          }))
        }
      >
        Final Folds
      </button>
    </div>
  )
}

export function WorkbenchFinalFoldDrawer({ controller }: WorkbenchFinalFoldDrawerProps) {
  const { foldLines, finalProductSolveResult, onUpdateFoldLine } = controller
  const [open, setOpen] = useState(true)

  const setAllAngles = (angleDeg: number) => {
    foldLines.forEach((foldLine) => {
      const maxAngle = foldLine.maxAngleDeg || 180
      onUpdateFoldLine(foldLine.id, {
        angleDeg: Math.max(-maxAngle, Math.min(maxAngle, angleDeg)),
      })
    })
  }

  const flipDirections = () => {
    foldLines.forEach((foldLine) => {
      onUpdateFoldLine(foldLine.id, {
        direction: (foldLine.direction ?? DEFAULT_FOLD_DIRECTION) === 'mountain' ? 'valley' : 'mountain',
      })
    })
  }

  return (
    <div className={`workbench-final-fold-drawer ${open ? 'open' : 'collapsed'}`}>
      <button
        type="button"
        className="workbench-final-fold-tab"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        {open ? 'Hide Final Folds' : 'Final Folds'}
      </button>
      {open && (
        <div className="workbench-final-fold-panel" aria-label="Final Product fold controls">
          <div className="workbench-final-fold-summary">
            <strong>Final Folds</strong>
            <span>
              {finalProductSolveResult
                ? `${finalProductSolveResult.converged ? 'Converged' : 'Partial'} | pairs ${finalProductSolveResult.stitchPairs.length} | RMS ${finalProductSolveResult.rmsStitchErrorMm.toFixed(2)}mm`
                : `${foldLines.length} crease${foldLines.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="button-row workbench-final-fold-actions">
            <button type="button" onClick={() => setAllAngles(90)}>
              Fold All 90
            </button>
            <button type="button" onClick={() => setAllAngles(180)}>
              Fold All 180
            </button>
            <button type="button" onClick={flipDirections}>
              Flip Directions
            </button>
          </div>
          {foldLines.length === 0 ? (
            <p className="hint">Use the Fold tool in 2D canvas to assign bend lines.</p>
          ) : (
            <div className="workbench-final-fold-table">
              {foldLines.map((foldLine) => (
                <div key={foldLine.id} className="workbench-final-fold-row">
                  <span className="workbench-final-fold-name">{foldLine.name}</span>
                  <input
                    aria-label={`${foldLine.name} angle`}
                    type="range"
                    min={-foldLine.maxAngleDeg}
                    max={foldLine.maxAngleDeg}
                    step={1}
                    value={foldLine.angleDeg}
                    onChange={(event) => onUpdateFoldLine(foldLine.id, { angleDeg: Number(event.target.value) })}
                  />
                  <output>{`${Math.round(foldLine.angleDeg)} deg`}</output>
                  <select
                    aria-label={`${foldLine.name} direction`}
                    value={foldLine.direction ?? DEFAULT_FOLD_DIRECTION}
                    onChange={(event) =>
                      onUpdateFoldLine(foldLine.id, {
                        direction: event.target.value === 'valley' ? 'valley' : 'mountain',
                      })
                    }
                  >
                    <option value="mountain">Mountain</option>
                    <option value="valley">Valley</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
