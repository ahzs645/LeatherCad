import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { Shape } from '../cad/cad-types'
import type { AutoConstraintSettings, ConstraintSuggestion } from '../ops/auto-constraint-ops'

type UseEditorAutomationEffectsParams = {
  shapes: Shape[]
  autoConstraintSettings: AutoConstraintSettings
  constraintSuggestions: ConstraintSuggestion[]
  setConstraintSuggestions: Dispatch<SetStateAction<ConstraintSuggestion[]>>
}

export function useEditorAutomationEffects({
  shapes,
  autoConstraintSettings,
  constraintSuggestions,
  setConstraintSuggestions,
}: UseEditorAutomationEffectsParams) {
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
