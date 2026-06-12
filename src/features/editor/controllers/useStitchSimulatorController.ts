import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { loadBoxStitchHelperSettings, type BoxStitchHelperSettings } from '../ops/box-stitch-settings'
import { type StitchSimulatorSettings } from '../ops/stitch-simulator-ops'
import { loadStitchSimulatorSettings, saveStitchSimulatorSettings } from '../ops/stitch-simulator-settings'

type UseStitchSimulatorControllerParams = {
  leatherSimEnabled: boolean
  showStitchSimulatorModal: boolean
  setShowStitchSimulatorModal: Dispatch<SetStateAction<boolean>>
  setStatus: (message: string) => void
}

export function useStitchSimulatorController({
  leatherSimEnabled,
  showStitchSimulatorModal,
  setShowStitchSimulatorModal,
  setStatus,
}: UseStitchSimulatorControllerParams) {
  const [stitchSimulatorSettings, setStitchSimulatorSettings] = useState<StitchSimulatorSettings>(() =>
    loadStitchSimulatorSettings(),
  )
  const [boxStitchHelperSettings, setBoxStitchHelperSettings] = useState<BoxStitchHelperSettings>(() =>
    loadBoxStitchHelperSettings(),
  )

  useEffect(() => {
    if (leatherSimEnabled && !showStitchSimulatorModal) {
      setShowStitchSimulatorModal(true)
    }
  }, [leatherSimEnabled, showStitchSimulatorModal, setShowStitchSimulatorModal])

  useEffect(() => {
    if (!leatherSimEnabled || stitchSimulatorSettings.showSimulatorPattern) {
      return
    }
    queueMicrotask(() => {
      setStitchSimulatorSettings((previous) => {
        if (previous.showSimulatorPattern) {
          return previous
        }
        const next = { ...previous, showSimulatorPattern: true }
        saveStitchSimulatorSettings(next)
        return next
      })
    })
  }, [leatherSimEnabled, stitchSimulatorSettings.showSimulatorPattern])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingContext = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT'
      if (isTypingContext || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      if (event.key === 'F6') {
        event.preventDefault()
        setShowStitchSimulatorModal((previous) => !previous)
        setStitchSimulatorSettings((previous) => {
          const next = { ...previous, showSimulatorPattern: !previous.showSimulatorPattern }
          saveStitchSimulatorSettings(next)
          return next
        })
        setStatus('Toggled stitching simulator')
        return
      }
      if (!showStitchSimulatorModal) {
        return
      }
      if (event.key === '+' || event.key === '-') {
        event.preventDefault()
        const delta = event.key === '+' ? 0.1 : -0.1
        setStitchSimulatorSettings((previous) => {
          const next = {
            ...previous,
            threadWidthMm: Math.max(0.3, Math.min(2, Number((previous.threadWidthMm + delta).toFixed(2)))),
          }
          saveStitchSimulatorSettings(next)
          setStatus(`Thread width ${next.threadWidthMm.toFixed(1)} mm`)
          return next
        })
        return
      }
      if (event.key === '=') {
        event.preventDefault()
        setStitchSimulatorSettings((previous) => {
          const next =
            previous.showEvenStitches && previous.showOddStitches
              ? { ...previous, showOddStitches: false }
              : previous.showEvenStitches
                ? { ...previous, showEvenStitches: false, showOddStitches: true }
                : { ...previous, showEvenStitches: true, showOddStitches: true }
          saveStitchSimulatorSettings(next)
          setStatus(
            next.showEvenStitches && next.showOddStitches
              ? 'Showing even and odd stitches'
              : next.showEvenStitches
                ? 'Showing even stitches'
                : 'Showing odd stitches',
          )
          return next
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setShowStitchSimulatorModal, setStatus, showStitchSimulatorModal])

  return {
    stitchSimulatorSettings,
    setStitchSimulatorSettings,
    boxStitchHelperSettings,
    setBoxStitchHelperSettings,
  }
}
