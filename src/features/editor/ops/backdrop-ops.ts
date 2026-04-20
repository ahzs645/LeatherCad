import type { Backdrop, BackdropUndoEntry, Point } from '../cad/cad-types'

/**
 * Per-backdrop in-memory undo history. Mirrors Delphi TBackdrop.FUndoList.
 * Document-level undo handles structural changes (add/delete); this captures
 * move/scale/rotate tweaks so users can revert an individual image without
 * touching shape edits.
 */
const undoStacks = new Map<string, BackdropUndoEntry[]>()
const redoStacks = new Map<string, BackdropUndoEntry[]>()
const MAX_UNDO = 32

function snapshot(backdrop: Backdrop): BackdropUndoEntry {
  return {
    leftTop: { ...backdrop.leftTop },
    width: backdrop.width,
    height: backdrop.height,
    angleDeg: backdrop.angleDeg,
    rotationCenter: backdrop.rotationCenter ? { ...backdrop.rotationCenter } : undefined,
  }
}

export function pushBackdropUndo(backdrop: Backdrop): void {
  const stack = undoStacks.get(backdrop.id) ?? []
  stack.push(snapshot(backdrop))
  while (stack.length > MAX_UNDO) stack.shift()
  undoStacks.set(backdrop.id, stack)
  redoStacks.delete(backdrop.id)
}

export function getBackdropUndoDepth(backdropId: string): number {
  return undoStacks.get(backdropId)?.length ?? 0
}

export function getBackdropRedoDepth(backdropId: string): number {
  return redoStacks.get(backdropId)?.length ?? 0
}

export function popBackdropUndo(backdrop: Backdrop): Backdrop | null {
  const stack = undoStacks.get(backdrop.id)
  if (!stack || stack.length === 0) return null
  const prev = stack.pop()!
  const redo = redoStacks.get(backdrop.id) ?? []
  redo.push(snapshot(backdrop))
  redoStacks.set(backdrop.id, redo)
  return { ...backdrop, ...prev }
}

export function popBackdropRedo(backdrop: Backdrop): Backdrop | null {
  const stack = redoStacks.get(backdrop.id)
  if (!stack || stack.length === 0) return null
  const next = stack.pop()!
  const undo = undoStacks.get(backdrop.id) ?? []
  undo.push(snapshot(backdrop))
  undoStacks.set(backdrop.id, undo)
  return { ...backdrop, ...next }
}

export function clearBackdropHistory(backdropId: string): void {
  undoStacks.delete(backdropId)
  redoStacks.delete(backdropId)
}

/**
 * Convert a File/Blob to a data URL. Used when the user imports a backdrop —
 * the bytes are embedded in the document so the image survives save/reload.
 */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('FileReader produced non-string result'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

export function readImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 })
    image.onerror = () => reject(new Error('Could not decode image'))
    image.src = dataUrl
  })
}

export function computeBackdropMmSize(
  bitmapWidth: number,
  bitmapHeight: number,
  dpi: number | undefined,
): { width: number; height: number } {
  if (dpi && dpi > 0) {
    const mmPerPx = 25.4 / dpi
    return { width: bitmapWidth * mmPerPx, height: bitmapHeight * mmPerPx }
  }
  // Default: treat bitmap pixels as 1 px = 1 mm.
  return { width: bitmapWidth, height: bitmapHeight }
}

export function defaultBackdropCenter(backdrop: Backdrop): Point {
  return {
    x: backdrop.leftTop.x + backdrop.width / 2,
    y: backdrop.leftTop.y + backdrop.height / 2,
  }
}
