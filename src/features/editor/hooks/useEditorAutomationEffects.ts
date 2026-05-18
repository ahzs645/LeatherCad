import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { LineType, Shape } from '../cad/cad-types'
import type { AutoConstraintSettings, ConstraintSuggestion } from '../ops/auto-constraint-ops'

type UseEditorAutomationEffectsParams = {
  shapes: Shape[]
  autoConstraintSettings: AutoConstraintSettings
  constraintSuggestions: ConstraintSuggestion[]
  setConstraintSuggestions: Dispatch<SetStateAction<ConstraintSuggestion[]>>
  fillOnChange?: boolean
  lineTypesById?: Record<string, LineType | undefined>
  setShapes?: Dispatch<SetStateAction<Shape[]>>
}

export function useEditorAutomationEffects({
  shapes,
  autoConstraintSettings,
  constraintSuggestions,
  setConstraintSuggestions,
  fillOnChange = false,
  lineTypesById,
  setShapes,
}: UseEditorAutomationEffectsParams) {
  // Source `chkFillOnChange` — when on, auto-paint newly-closed shapes with
  // their line-type color. Tolerance: start ≈ end within 1 µm.
  useEffect(() => {
    if (!fillOnChange || !setShapes || !lineTypesById) return
    const tolerance = 1e-3
    const isClosed = (shape: Shape) =>
      Math.hypot(shape.start.x - shape.end.x, shape.start.y - shape.end.y) < tolerance
    const candidates = shapes.filter(
      (shape) =>
        shape.type !== 'text' &&
        shape.type !== 'line' &&
        isClosed(shape) &&
        !('fillColor' in shape && shape.fillColor),
    )
    if (candidates.length === 0) return
    const updates = new Map<string, string>()
    for (const candidate of candidates) {
      const color = lineTypesById[candidate.lineTypeId]?.color
      if (color) updates.set(candidate.id, color)
    }
    if (updates.size === 0) return
    setShapes((previous) =>
      previous.map((shape) => {
        const color = updates.get(shape.id)
        return color ? { ...shape, fillColor: color } : shape
      }),
    )
  }, [fillOnChange, lineTypesById, setShapes, shapes])
  const prevShapeCountRef = useRef(0)

  useEffect(() => {
    if (!autoConstraintSettings.enabled || shapes.length === 0) {
      if (constraintSuggestions.length > 0) setConstraintSuggestions([])
      prevShapeCountRef.current = shapes.length
      return
    }

    if (shapes.length > prevShapeCountRef.current && shapes.length > 1) {
      const newest = shapes[shapes.length - 1]
      const rest = shapes.slice(0, -1)
      void import('../ops/auto-constraint-ops')
        .then(({ detectAutoConstraints }) => {
          const suggestions = detectAutoConstraints(newest, rest, autoConstraintSettings)
          setConstraintSuggestions(suggestions)
        })
        .catch(() => {
          setConstraintSuggestions([])
        })
    } else if (shapes.length < prevShapeCountRef.current) {
      setConstraintSuggestions([])
    }

    prevShapeCountRef.current = shapes.length
  }, [autoConstraintSettings, constraintSuggestions.length, setConstraintSuggestions, shapes])
}
