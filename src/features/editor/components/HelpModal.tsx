type HelpLink = {
  label: string
  url: string
}

const EXTERNAL_LINKS: HelpLink[] = [
  { label: 'Website', url: 'https://www.leathercraftcad.com' },
  { label: 'FAQ', url: 'https://www.leathercraftcad.com/faq' },
  { label: 'Release notes', url: 'https://www.leathercraftcad.com/release-notes' },
  { label: 'YouTube', url: 'https://www.youtube.com/@leathercraftcad' },
  { label: 'Twitter / X', url: 'https://twitter.com/leathercraftcad' },
  { label: 'Donation', url: 'https://www.leathercraftcad.com/donation' },
  { label: 'License agreement', url: 'https://www.leathercraftcad.com/license' },
]

type HelpModalProps = {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }}
      role="presentation"
    >
      <div
        className="help-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        <div className="line-type-modal-header">
          <h2 id="help-modal-title">Help & About</h2>
          <button onClick={onClose}>Close</button>
        </div>

        <section className="help-section">
          <h3>About LeatherCad</h3>
          <p>
            LeatherCad is an open web reimplementation of Leathercraft CAD (Taiwan Studio, 2024).
            Built with React, TypeScript, and Three.js.
          </p>
        </section>

        <section className="help-section">
          <h3>Keyboard shortcuts</h3>
          <ul className="help-list">
            <li>Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo</li>
            <li>Cmd/Ctrl+C / X / V clipboard, Cmd/Ctrl+D duplicate</li>
            <li>Cmd/Ctrl+A select all</li>
            <li>Escape clears draft and selection</li>
            <li>Delete / Backspace removes selected shapes</li>
            <li>Mobile: 2D / 3D / Split buttons switch workspace focus</li>
          </ul>
        </section>

        <section className="help-section">
          <h3>Resources</h3>
          <ul className="help-list help-link-list">
            {EXTERNAL_LINKS.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer noopener">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
