import { useEffect, useRef, useState } from 'react'
import { GRID_SPACING_OPTIONS } from '../../editor-constants'
import type { DisplayUnit } from '../../ops/unit-ops'

type TopbarSettingsDropdownProps = {
  displayUnit: DisplayUnit
  onSetDisplayUnit: (unit: DisplayUnit) => void
  gridSpacing: number
  onSetGridSpacing: (spacing: number) => void
  showCanvasRuler: boolean
  onToggleCanvasRuler: () => void
  onOpenHelpModal: () => void
  buttonClassName?: string
  iconSize?: number
}

function SettingsGearIcon({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function TopbarSettingsDropdown({
  displayUnit,
  onSetDisplayUnit,
  gridSpacing,
  onSetGridSpacing,
  showCanvasRuler,
  onToggleCanvasRuler,
  onOpenHelpModal,
  buttonClassName,
  iconSize = 18,
}: TopbarSettingsDropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="settings-dropdown-wrapper">
      <button
        ref={buttonRef}
        type="button"
        className={`help-button settings-button${buttonClassName ? ` ${buttonClassName}` : ''}`}
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Open settings"
        title="Settings"
      >
        <SettingsGearIcon size={iconSize} />
      </button>
      {open && (
        <div ref={dropdownRef} className="settings-dropdown">
          <label className="stitch-pitch-inline">
            <span>Units</span>
            <select
              className="line-type-select"
              value={displayUnit}
              onChange={(event) => onSetDisplayUnit(event.target.value as DisplayUnit)}
            >
              <option value="mm">mm</option>
              <option value="in">in</option>
            </select>
          </label>
          <label className="stitch-pitch-inline">
            <span>Grid</span>
            <select
              className="line-type-select"
              value={gridSpacing}
              onChange={(event) => onSetGridSpacing(Number(event.target.value))}
            >
              {GRID_SPACING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}mm
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onToggleCanvasRuler}>
            {showCanvasRuler ? 'Hide XY Ruler' : 'Show XY Ruler'}
          </button>
          <button type="button" onClick={onOpenHelpModal}>
            Help
          </button>
        </div>
      )}
    </div>
  )
}
