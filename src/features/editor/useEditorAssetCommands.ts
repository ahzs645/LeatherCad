import type { ChangeEventHandler, Dispatch, RefObject, SetStateAction } from 'react'
import type { Shape } from './cad/cad-types'

type UseEditorAssetCommandsParams = {
  loadedFontUrl: string | null
  shapes: Shape[]
  selectedShapeIds: string[]
  selectedShapeIdSet: Set<string>
  activeLayerId: string
  activeLineTypeId: string
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setLoadedFontUrl: Dispatch<SetStateAction<string | null>>
  setStatus: (status: string) => void
  fontInputRef: RefObject<HTMLInputElement | null>
}

export function useEditorAssetCommands({
  loadedFontUrl,
  shapes,
  selectedShapeIds,
  selectedShapeIdSet,
  activeLayerId,
  activeLineTypeId,
  setShapes,
  setSelectedShapeIds,
  setLoadedFontUrl,
  setStatus,
  fontInputRef,
}: UseEditorAssetCommandsParams) {
  const handleBooleanOp = (op: import('./ops/clipper-ops').BooleanOp) => {
    void import('./ops/clipper-ops')
      .then(({ booleanOpOnShapes }) => {
        const result = booleanOpOnShapes(
          shapes,
          new Set(selectedShapeIds),
          op,
          activeLayerId,
          activeLineTypeId,
        )
        if (result.ok) {
          setShapes(result.nextShapes)
        }
        setStatus(result.message)
      })
      .catch(() => {
        setStatus('Boolean operation tools failed to load')
      })
  }

  const handleClipperOffset = (
    offsetMm: number,
    joinType: import('./ops/clipper-ops').OffsetJoinType,
  ) => {
    void import('./ops/clipper-ops')
      .then(({ clipperOffsetForSelection }) => {
        const result = clipperOffsetForSelection(
          shapes,
          new Set(selectedShapeIds),
          offsetMm,
          joinType,
          activeLineTypeId,
        )
        if (result.ok) {
          setShapes((prev) => [...prev, ...result.created])
        }
        setStatus(result.message)
      })
      .catch(() => {
        setStatus('Offset tools failed to load')
      })
  }

  const handleTextToPath = () => {
    if (!loadedFontUrl) {
      fontInputRef.current?.click()
      setStatus('Select a .ttf/.otf font file to enable text-to-path conversion')
      return
    }
    const textShapes = shapes.filter((shape) => shape.type === 'text' && selectedShapeIdSet.has(shape.id))
    if (textShapes.length === 0) {
      setStatus('Select at least one text shape to convert')
      return
    }
    void import('./ops/opentype-ops')
      .then(({ textToPathShapes }) => {
        const created: Shape[] = []
        const convertedIds = new Set<string>()
        for (const textShape of textShapes) {
          if (textShape.type !== 'text') {
            continue
          }
          const result = textToPathShapes(textShape, loadedFontUrl)
          if (result.ok) {
            created.push(...result.shapes)
            convertedIds.add(textShape.id)
          }
        }
        if (created.length > 0) {
          setShapes((prev) => [...prev.filter((shape) => !convertedIds.has(shape.id)), ...created])
          setSelectedShapeIds([])
          setStatus(`Converted ${convertedIds.size} text shape(s) to ${created.length} path shapes`)
          return
        }
        setStatus('No paths generated. Ensure font is loaded and text shapes are selected.')
      })
      .catch(() => {
        setStatus('Text-to-path tools failed to load')
      })
  }

  const handleFontInputChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      void import('./ops/opentype-ops')
        .then(({ loadFontFromBuffer }) => {
          try {
            const key = `font:${file.name}`
            loadFontFromBuffer(reader.result as ArrayBuffer, key)
            setLoadedFontUrl(key)
            setStatus(`Font loaded: ${file.name}`)
          } catch (error) {
            setStatus(`Failed to load font: ${error instanceof Error ? error.message : 'unknown error'}`)
          }
        })
        .catch(() => {
          setStatus('Failed to load font: could not initialize font tools')
        })
    }
    reader.readAsArrayBuffer(file)
    event.target.value = ''
  }

  return {
    handleBooleanOp,
    handleClipperOffset,
    handleTextToPath,
    handleFontInputChange,
  }
}
