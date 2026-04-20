import type { ThemeMode } from '../../editor-types'

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'dark', label: 'Dark mode' },
  { mode: 'light', label: 'Light mode' },
  { mode: 'system', label: 'System mode' },
]

type ThemeModeToggleProps = {
  themeMode: ThemeMode
  onSetThemeMode: (mode: ThemeMode) => void
  className?: string
}

function ThemeModeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-mode-icon">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2.5" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="21.5" />
        <line x1="2.5" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="21.5" y2="12" />
        <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
        <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
        <line x1="5.2" y1="18.8" x2="6.9" y2="17.1" />
        <line x1="17.1" y1="6.9" x2="18.8" y2="5.2" />
      </svg>
    )
  }

  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-mode-icon">
        <path d="M21 13.4A8.4 8.4 0 1 1 10.6 3a7.1 7.1 0 1 0 10.4 10.4z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-mode-icon">
      <rect x="3.5" y="4.5" width="17" height="12" rx="1.8" />
      <line x1="12" y1="16.5" x2="12" y2="20" />
      <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" />
    </svg>
  )
}

export function ThemeModeToggle({ themeMode, onSetThemeMode, className }: ThemeModeToggleProps) {
  return (
    <div className={`theme-mode-toggle${className ? ` ${className}` : ''}`} role="group" aria-label="Theme mode">
      {THEME_OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={`theme-mode-button${themeMode === mode ? ' active' : ''}`}
          onClick={() => onSetThemeMode(mode)}
          aria-label={label}
          title={label}
        >
          <ThemeModeIcon mode={mode} />
        </button>
      ))}
    </div>
  )
}
