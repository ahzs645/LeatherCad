import type { PiecePlacement3D } from '../cad/cad-types'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from '../ops/fold-line-ops'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { LEATHER_COLORS, LEATHER_PRESETS, PRESET_IDS } from '../three/material-presets'
import type { WorkbenchThreePreviewController } from './useWorkbenchThreePreviewController'
import { AvatarFormFields } from './WorkbenchThreeAvatarForm'
import { WorkbenchFinalFoldDrawer, WorkbenchFinalFoldModeTab } from './WorkbenchFinalFoldDrawer'
import { WorkbenchFoldTimelinePanel } from './WorkbenchFoldTimelinePanel'
import { downloadFinalReviewCollage } from './final-review-collage'

function defaultPiecePlacement(pieceId: string): PiecePlacement3D {
  return { pieceId, translationMm: { x: 0, y: 0, z: 0 }, rotationDeg: { x: 0, y: 0, z: 0 }, flipped: false }
}

/**
 * Explains why Assembled/Avatar look bare when the document has no pattern pieces.
 * Self-gating on `controller.showPatternPieceEmptyState` so every 3D surface (desktop
 * viewport and mobile panel) can render it with a single line and no duplicated logic.
 */
export function ThreePreviewEmptyState({ controller }: { controller: WorkbenchThreePreviewController }) {
  const { showPatternPieceEmptyState, threePreviewSettings } = controller
  if (!showPatternPieceEmptyState) {
    return null
  }
  return (
    <p className="hint workbench-three-warning">
      {threePreviewSettings.mode === 'avatar'
        ? 'Avatar mode is showing the mannequin only: this document has no pattern pieces yet. Select a closed outline in the 2D canvas and use Create Piece to drape geometry on the avatar.'
        : 'Assembled mode needs pattern pieces. Select a closed outline in the 2D canvas and use Create Piece, then return here to place it in 3D.'}
    </p>
  )
}

type WorkbenchThreePreviewViewportProps = { controller: WorkbenchThreePreviewController; compact?: boolean; interactive?: boolean }

export function WorkbenchThreePreviewViewport({ controller, compact = false, interactive = true }: WorkbenchThreePreviewViewportProps) {
  const {
    canvasRef,
    containerRef,
    foldLines,
    invalidPatternPieces,
    seamConnections,
    shapesIn3dView,
    threePreviewSettings,
    visiblePatternPieces,
  } = controller
  const showFinalFoldDrawer = !compact && interactive && threePreviewSettings.mode === 'final'
  const showFinalFoldModeTab = !compact && interactive && threePreviewSettings.mode === 'fold' && foldLines.length > 0
  return (
    <div className={`workbench-three-viewport ${compact ? 'compact' : ''} ${interactive ? '' : 'read-only'} ${showFinalFoldDrawer ? 'with-final-fold-drawer' : ''}`}>
      <div className="workbench-three-viewport-header">
        <div>
          <strong>3D Preview</strong>
          <span>{` ${shapesIn3dView.length} shapes | ${visiblePatternPieces.length} pieces`}</span>
        </div>
        {!compact && (
          <span className="hint">
            {`Mode ${threePreviewSettings.mode} | ${foldLines.length} folds | ${seamConnections.length} seams`}
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        className="three-preview-canvas-wrap workbench-three-canvas-wrap"
        style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      >
        <canvas ref={canvasRef} className="three-preview-canvas" />
      </div>
      {invalidPatternPieces.length > 0 && !compact && (
        <p className="hint workbench-three-warning">
          {invalidPatternPieces.length} piece(s) are missing valid closed boundaries for 3D.
        </p>
      )}
      {!compact && <ThreePreviewEmptyState controller={controller} />}
      {showFinalFoldDrawer && <WorkbenchFinalFoldDrawer controller={controller} />}
      {showFinalFoldModeTab && <WorkbenchFinalFoldModeTab controller={controller} />}
    </div>
  )
}

type WorkbenchThreePreviewInspectorProps = {
  controller: WorkbenchThreePreviewController
}

export function WorkbenchThreePreviewInspector({
  controller,
}: WorkbenchThreePreviewInspectorProps) {
  const {
    threePreviewSettings,
    bridgeRef,
    captureStudioStill,
    isStudioRendering,
    studioRenderStatus,
    finalProductSolveResult,
    assemblyDiagnostics = [],
    onSetThreePreviewSettings,
    avatars,
    activeAvatarId,
    avatarFormResetKey,
    onSetAvatars,
    visibleLayerCountIn3d,
    layers,
    effectiveHidden3dLayerIds,
    setHidden3dLayerIds,
    foldLines,
    onUpdateFoldLine,
    visiblePatternPieces,
    piecePlacementById,
    updatePlacement,
    assemblyAngleDeg,
    seamPlacementStatus,
    handleSolvePlacementFromSeams: onSolvePlacementFromSeams,
    handleSetAssemblyAngle: onSetAssemblyAngle,
    handleSpreadPieces,
    handleStackByLayer,
    handleMirrorPairLayout,
    handleResetAssembly,
    stitchThreadColor,
    onSetStitchThreadColor,
    textureForm,
    setTextureForm,
    textureStatus,
    applyPreset,
    setLeatherColor,
    enableShadows,
    rotateLeatherTexture,
    selectedClosedShapeIds,
    applyTextureToSelection,
    applyTextureGlobally,
    clearSelectionTexture,
    resetMaterial,
    threeTextureShapeIds,
  } = controller
  return (
    <>
      <div className="control-block">
        <h3>Preview Mode</h3>
        <label className="field-row">
          <span>Mode</span>
          <select
            value={threePreviewSettings.mode}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                mode:
                  event.target.value === 'assembled' ||
                  event.target.value === 'avatar' ||
                  event.target.value === 'final'
                    ? event.target.value
                    : 'fold',
              }))
            }
          >
            <option value="fold">Fold</option>
            <option value="final">Final Product</option>
            <option value="assembled">Assembled</option>
            <option value="avatar">Avatar</option>
          </select>
        </label>
        <label className="field-row">
          <span>Exploded View</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={threePreviewSettings.explodedFactor}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                explodedFactor: Number(event.target.value),
              }))
            }
          />
        </label>
        {threePreviewSettings.mode === 'final' && (
          <div className="field-row">
            <span>{`Fold Progress ${Math.round((threePreviewSettings.finalFoldProgress ?? 1) * 100)}%`}</span>
            <div className="stacked-actions">
              <input
                aria-label="Final fold progress"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={threePreviewSettings.finalFoldProgress ?? 1}
                onChange={(event) =>
                  onSetThreePreviewSettings((previous) => ({
                    ...previous,
                    finalFoldProgress: Number(event.target.value),
                  }))
                }
              />
              <div className="button-row">
                <button
                  type="button"
                  onClick={() =>
                    onSetThreePreviewSettings((previous) => ({
                      ...previous,
                      finalFoldProgress: 0,
                      finalFoldCamera: 'pattern',
                    }))
                  }
                >
                  Pattern View
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSetThreePreviewSettings((previous) => ({
                      ...previous,
                      finalFoldProgress: 0.5,
                      finalFoldCamera: 'orbit',
                    }))
                  }
                >
                  Half-Folded
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSetThreePreviewSettings((previous) => ({
                      ...previous,
                      finalFoldProgress: 1,
                      finalFoldCamera: 'orbit',
                    }))
                  }
                >
                  Folded
                </button>
              </div>
              <div className="button-row">
                {(['top', 'front', 'side'] as const).map((cameraPreset) => (
                  <button
                    key={cameraPreset}
                    type="button"
                    onClick={() =>
                      onSetThreePreviewSettings((previous) => ({
                        ...previous,
                        finalFoldCamera: cameraPreset,
                      }))
                    }
                  >
                    {cameraPreset[0].toUpperCase() + cameraPreset.slice(1)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => downloadFinalReviewCollage(bridgeRef.current)}>
                Capture Review Collage
              </button>
              <button
                type="button"
                onClick={() => void captureStudioStill()}
                disabled={isStudioRendering}
                title="Path-traced beauty shot of the current model on a studio backdrop"
              >
                {isStudioRendering ? 'Rendering Studio Still…' : 'Studio Render'}
              </button>
              {studioRenderStatus ? <p className="hint">{studioRenderStatus}</p> : null}
            </div>
          </div>
        )}
        <label className="field-row">
          <span>Thickness (mm)</span>
          <input
            type="number"
            min={0.2}
            max={20}
            step={0.1}
            value={threePreviewSettings.thicknessMm}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                thicknessMm: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={threePreviewSettings.showSeams}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                showSeams: event.target.checked,
              }))
            }
          />
          <span>Show seam guides</span>
        </label>
        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={threePreviewSettings.showStressOverlay}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                showStressOverlay: event.target.checked,
              }))
            }
          />
          <span>Show seam stress tint</span>
        </label>
        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={threePreviewSettings.usePhysicsRelaxation}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                usePhysicsRelaxation: event.target.checked,
              }))
            }
          />
          <span>Relax seam welds</span>
        </label>
        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={threePreviewSettings.showEdgeLabels}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                showEdgeLabels: event.target.checked,
              }))
            }
          />
          <span>Show edge labels</span>
        </label>
        <div className="button-row">
          <button onClick={() => onSetThreePreviewSettings(DEFAULT_THREE_PREVIEW_SETTINGS)}>Reset 3D Settings</button>
        </div>
      </div>

      {threePreviewSettings.mode === 'final' && (
        <WorkbenchFoldTimelinePanel
          foldLines={foldLines}
          threePreviewSettings={threePreviewSettings}
          onSetThreePreviewSettings={onSetThreePreviewSettings}
        />
      )}

      {threePreviewSettings.mode === 'final' && (
        <div className="control-block">
          <h3>Final Solve</h3>
          {finalProductSolveResult ? (
            <>
              <p className="hint">
                {`${finalProductSolveResult.converged ? 'Converged' : 'Partial'} | pairs ${finalProductSolveResult.stitchPairs.length} | unpaired ${finalProductSolveResult.unpairedChainCount}`}
              </p>
              <p className="hint">
                {`RMS stitch ${finalProductSolveResult.rmsStitchErrorMm.toFixed(2)}mm | max hinge ${finalProductSolveResult.maxHingeErrorDeg.toFixed(1)}deg | current collisions ${finalProductSolveResult.collisionWarningCount}`}
              </p>
              <p className="hint">
                {`Fold sweep ${finalProductSolveResult.foldSweepCollisionCount} warnings across ${finalProductSolveResult.foldSweepSampleCount} samples${finalProductSolveResult.foldSweepWorstProgress === undefined ? '' : ` | worst ${Math.round(finalProductSolveResult.foldSweepWorstProgress * 100)}%`}`}
              </p>
              <p className="hint">{`Iterations ${finalProductSolveResult.iterations}`}</p>
              {finalProductSolveResult.diagnostics.slice(0, 5).map((diagnostic) => (
                <p key={diagnostic.id} className="hint">
                  {`${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`}
                </p>
              ))}
            </>
          ) : (
            <p className="hint">Final Product mode will solve after geometry loads.</p>
          )}
        </div>
      )}

      <details className="control-block inspector-disclosure">
        <summary>
          <h3>Assembly Diagnostics</h3>
          <span>{assemblyDiagnostics.length === 0 ? 'OK' : `${assemblyDiagnostics.length}`}</span>
        </summary>
        {assemblyDiagnostics.length === 0 ? (
          <p className="hint">No assembly issues detected.</p>
        ) : (
          <>
            <p className="hint">
              {`${assemblyDiagnostics.filter((entry) => entry.blocking).length} blocking | ${assemblyDiagnostics.length} total`}
            </p>
            {assemblyDiagnostics.slice(0, 8).map((diagnostic) => (
              <div key={diagnostic.id} className="layer-toggle-item">
                <span>{`${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`}</span>
              </div>
            ))}
          </>
        )}
      </details>

      <details className="control-block inspector-disclosure">
        <summary>
          <h3>3D Layer Visibility</h3>
          <span>{`${visibleLayerCountIn3d}/${layers.length}`}</span>
        </summary>
        <p className="hint">{`Showing ${visibleLayerCountIn3d} of ${layers.length} layers in 3D.`}</p>
        {layers.length === 0 ? (
          <p className="hint">No layers available.</p>
        ) : (
          <>
            <div className="layer-toggle-list">
              {layers.map((layer) => {
                const checked = layer.visible && !effectiveHidden3dLayerIds.includes(layer.id)
                const disabled = !layer.visible
                return (
                  <label key={layer.id} className="layer-toggle-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() =>
                        setHidden3dLayerIds((previous) =>
                          previous.includes(layer.id) ? previous.filter((entry) => entry !== layer.id) : [...previous, layer.id],
                        )
                      }
                    />
                    <span>
                      {layer.name}
                      {layer.visible ? '' : ' (hidden in 2D)'}
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="button-row">
              <button onClick={() => setHidden3dLayerIds(layers.filter((layer) => layer.visible).map((layer) => layer.id))}>
                Hide All
              </button>
              <button onClick={() => setHidden3dLayerIds([])}>Show All</button>
            </div>
          </>
        )}
      </details>

      <details className="control-block inspector-disclosure" open={threePreviewSettings.mode === 'fold' && foldLines.length > 0}>
        <summary>
          <h3>Bend Controls</h3>
          <span>{foldLines.length === 0 ? 'None' : `${foldLines.length}`}</span>
        </summary>
        {threePreviewSettings.mode === 'final' ? (
          <>
            <p className="hint">Use the Final Folds drawer at the bottom of the full 3D viewport for crease angles and directions.</p>
            <p className="hint">{`${foldLines.length} crease${foldLines.length === 1 ? '' : 's'} available.`}</p>
          </>
        ) : threePreviewSettings.mode !== 'fold' ? (
          <p className="hint">Fold controls are active in Fold and Final Product modes.</p>
        ) : foldLines.length === 0 ? (
          <p className="hint">Use the Fold tool in 2D canvas to assign bend lines.</p>
        ) : (
          foldLines.map((foldLine) => (
            <div key={foldLine.id} className="fold-control-card">
              <label className="field-row">
                <span>
                  {foldLine.name}: {Math.round(foldLine.angleDeg)} deg
                </span>
                <input
                  type="range"
                  min={-foldLine.maxAngleDeg}
                  max={foldLine.maxAngleDeg}
                  step={1}
                  value={foldLine.angleDeg}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { angleDeg: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Direction</span>
                <select
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
              </label>
              <label className="field-row">
                <span>Fold Radius (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  value={foldLine.radiusMm ?? DEFAULT_FOLD_RADIUS_MM}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { radiusMm: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Material Thickness (mm)</span>
                <input
                  type="number"
                  min={0.2}
                  max={20}
                  step={0.1}
                  value={foldLine.thicknessMm ?? DEFAULT_FOLD_THICKNESS_MM}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { thicknessMm: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Clearance (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.05}
                  value={foldLine.clearanceMm ?? DEFAULT_FOLD_CLEARANCE_MM}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { clearanceMm: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Neutral Axis Ratio</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={foldLine.neutralAxisRatio ?? DEFAULT_FOLD_NEUTRAL_AXIS_RATIO}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { neutralAxisRatio: Number(event.target.value) })}
                />
              </label>
              <label className="field-row">
                <span>Stiffness</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={foldLine.stiffness ?? DEFAULT_FOLD_STIFFNESS}
                  onChange={(event) => onUpdateFoldLine(foldLine.id, { stiffness: Number(event.target.value) })}
                />
              </label>
            </div>
          ))
        )}
      </details>

      <details className="control-block inspector-disclosure" open={visiblePatternPieces.length > 0 && threePreviewSettings.mode === 'assembled'}>
        <summary>
          <h3>Piece Placement</h3>
          <span>{visiblePatternPieces.length === 0 ? 'Locked' : `${visiblePatternPieces.length}`}</span>
        </summary>
        {visiblePatternPieces.length === 0 ? (
          <p className="hint">Create pattern pieces in 2D to unlock assembled 3D placement.</p>
        ) : (
          <>
            <p className="hint">{`${visiblePatternPieces.length} piece${visiblePatternPieces.length === 1 ? '' : 's'} in the current 3D view.`}</p>

            <div className="fold-control-card">
              <strong>Assemble from seams</strong>
              <p className="hint">
                Places every piece so its seam edges meet the edges they are sewn to. The angle
                opens each seam: 0 lays the pieces out flat and connected, 90 stands them up,
                180 folds them closed.
              </p>
              <label className="field-row">
                <span>Assembly angle</span>
                <input
                  type="range"
                  min={0}
                  max={180}
                  step={5}
                  value={assemblyAngleDeg}
                  onChange={(event) => onSetAssemblyAngle(Number(event.target.value))}
                />
              </label>
              <p className="hint">{`${assemblyAngleDeg}°`}</p>
              <div className="button-row">
                <button onClick={() => onSolvePlacementFromSeams()}>Solve From Seams</button>
              </div>
              {seamPlacementStatus ? <p className="hint">{seamPlacementStatus}</p> : null}
            </div>

            <details className="control-block inspector-disclosure">
              <summary>
                <h3>Place pieces by hand</h3>
                <span>{visiblePatternPieces.length}</span>
              </summary>
            {visiblePatternPieces.map((piece) => {
              const placement = piecePlacementById[piece.id] ?? defaultPiecePlacement(piece.id)
              return (
                <div key={piece.id} className="fold-control-card">
                  <strong>{piece.name}</strong>
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <label key={`${piece.id}-translate-${axis}`} className="field-row">
                      <span>{`Translate ${axis.toUpperCase()}`}</span>
                      <input
                        type="number"
                        step={1}
                        value={placement.translationMm[axis]}
                        onChange={(event) =>
                          updatePlacement(piece.id, (current) => ({
                            ...current,
                            translationMm: {
                              ...current.translationMm,
                              [axis]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <label key={`${piece.id}-rotate-${axis}`} className="field-row">
                      <span>{`Rotate ${axis.toUpperCase()}`}</span>
                      <input
                        type="number"
                        step={1}
                        value={placement.rotationDeg[axis]}
                        onChange={(event) =>
                          updatePlacement(piece.id, (current) => ({
                            ...current,
                            rotationDeg: {
                              ...current.rotationDeg,
                              [axis]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                  <label className="layer-toggle-item">
                    <input
                      type="checkbox"
                      checked={placement.flipped}
                      onChange={(event) =>
                        updatePlacement(piece.id, (current) => ({
                          ...current,
                          flipped: event.target.checked,
                        }))
                      }
                    />
                    <span>Flip piece</span>
                  </label>
                  <div className="button-row">
                    <button
                      onClick={() =>
                        updatePlacement(piece.id, () => ({
                          pieceId: piece.id,
                          translationMm: { x: 0, y: 0, z: 0 },
                          rotationDeg: { x: 0, y: 0, z: 0 },
                          flipped: false,
                        }))
                      }
                    >
                      Reset Piece
                    </button>
                  </div>
                </div>
              )
            })}
            <div className="button-row">
                <button onClick={handleSpreadPieces}>Spread Pieces</button>
                <button onClick={handleStackByLayer}>Stack by Layer</button>
                <button onClick={handleMirrorPairLayout}>Mirror Pair Layout</button>
                <button onClick={handleResetAssembly}>Reset Assembly</button>
              </div>
            </details>
          </>
        )}
      </details>

      <details className="control-block inspector-disclosure" open={threePreviewSettings.mode === 'avatar'}>
        <summary>
          <h3>Avatar Assets</h3>
          <span>{activeAvatarId ? 'Custom' : 'Built-in'}</span>
        </summary>
        <label className="field-row">
          <span>Active avatar</span>
          <select
            value={activeAvatarId}
            onChange={(event) =>
              onSetThreePreviewSettings((previous) => ({
                ...previous,
                avatarId: event.target.value || undefined,
              }))
            }
          >
            <option value="">Built-in mannequin</option>
            {avatars.map((avatar) => (
              <option key={avatar.id} value={avatar.id}>
                {avatar.name}
              </option>
            ))}
          </select>
        </label>
        <AvatarFormFields
          key={avatarFormResetKey}
          activeAvatarId={activeAvatarId}
          avatars={avatars}
          onSetAvatars={onSetAvatars}
          onSetThreePreviewSettings={onSetThreePreviewSettings}
        />
      </details>

      <details className="control-block inspector-disclosure">
        <summary>
          <h3>Stitch Simulator</h3>
          <span>{stitchThreadColor}</span>
        </summary>
        <label className="field-row">
          <span>Thread Color</span>
          <input type="color" value={stitchThreadColor} onChange={(event) => onSetStitchThreadColor(event.target.value)} />
        </label>
      </details>

      <details className="control-block inspector-disclosure" open>
        <summary>
          <h3>Leather Material</h3>
          <span>Preset</span>
        </summary>
        <div className="line-type-edit-grid">
          <label className="field-row">
            <span>Preset</span>
            <select onChange={(event) => applyPreset(event.target.value)} defaultValue="">
              <option value="" disabled>Select preset...</option>
              {PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {LEATHER_PRESETS[id].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Color</span>
            <select onChange={(event) => setLeatherColor(event.target.value)} defaultValue="">
              <option value="" disabled>Select color...</option>
              {LEATHER_COLORS.map((color) => (
                <option key={color.id} value={color.color}>
                  {color.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Shadows</span>
            <input type="checkbox" onChange={(event) => enableShadows(event.target.checked)} />
          </label>
          <label className="field-row">
            <span>Texture rotation</span>
            <span className="control-row">
              <button type="button" onClick={() => rotateLeatherTexture(-90)}>-90°</button>
              <button type="button" onClick={() => rotateLeatherTexture(-15)}>-15°</button>
              <button type="button" onClick={() => rotateLeatherTexture(15)}>+15°</button>
              <button type="button" onClick={() => rotateLeatherTexture(90)}>+90°</button>
              <button type="button" onClick={() => rotateLeatherTexture(0)}>Reset</button>
            </span>
          </label>
        </div>
      </details>

      <details className="control-block inspector-disclosure">
        <summary>
          <h3>Texture Source</h3>
          <span>{`${threeTextureShapeIds.length} assigned`}</span>
        </summary>
        <label className="field-row">
          <span>Texture source URL</span>
          <input
            value={textureForm.sourceUrl}
            placeholder="https://..."
            onChange={(event) => setTextureForm((previous) => ({ ...previous, sourceUrl: event.target.value }))}
          />
        </label>
        <label className="field-row">
          <span>License note</span>
          <input
            value={textureForm.license}
            placeholder="CC0 / paid / attribution required"
            onChange={(event) => setTextureForm((previous) => ({ ...previous, license: event.target.value }))}
          />
        </label>
        <label className="field-row">
          <span>Albedo/base color URL</span>
          <input
            value={textureForm.albedoUrl}
            placeholder="https://..."
            onChange={(event) => setTextureForm((previous) => ({ ...previous, albedoUrl: event.target.value }))}
          />
        </label>
        <label className="field-row">
          <span>Normal map URL</span>
          <input
            value={textureForm.normalUrl ?? ''}
            placeholder="https://..."
            onChange={(event) => setTextureForm((previous) => ({ ...previous, normalUrl: event.target.value }))}
          />
        </label>
        <label className="field-row">
          <span>Roughness map URL</span>
          <input
            value={textureForm.roughnessUrl ?? ''}
            placeholder="https://..."
            onChange={(event) => setTextureForm((previous) => ({ ...previous, roughnessUrl: event.target.value }))}
          />
        </label>
        <div className="button-row">
          <button onClick={() => void applyTextureToSelection()}>Apply to Selection</button>
          <button onClick={() => void applyTextureGlobally()}>Apply Globally</button>
          <button onClick={clearSelectionTexture}>Clear Selection Texture</button>
          <button onClick={resetMaterial}>Reset Material</button>
        </div>
        <p className="hint">{`Texture assignments: ${threeTextureShapeIds.length} shapes`}</p>
        <p className="hint">{`Closed selected shapes: ${selectedClosedShapeIds.length}`}</p>
        <p className="hint">{textureStatus}</p>
      </details>
    </>
  )
}
