import { useState } from 'react'

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

const CRYPTO_WALLETS: Array<{ label: string; address: string }> = [
  { label: 'Bitcoin (BTC)', address: 'bc1qexampleexampleexampleexampleexampleex' },
  { label: 'Ethereum (ETH)', address: '0xExampleExampleExampleExampleExampleExample' },
  { label: 'Stellar (XLM)', address: 'GEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLE' },
  { label: 'Ripple (XRP)', address: 'rEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMP' },
]

const LICENSE_TEXT = `MIT License

LeatherCad is an open-source reimplementation of Leathercraft CAD (Taiwan Studio).
Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the inclusion of the original copyright notice in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
`

const README_TEXT = `LeatherCad — quick start

1. Pick a tool from the top ribbon (Line, Arc, Bezier, Rect, Ellipse, …).
2. Click on the canvas to place anchor points.
3. Switch line types or assign holes via the Stitch / Line Type panel.
4. Use File → Save Project to export an .lcc file, or Export → SVG / DXF / PDF
   to send patterns to a laser cutter or printer.
5. Workspace presets (Cap, Wallet, Pass case, Box joint …) live in
   Templates → Workspace Presets.

For more detail visit https://www.leathercraftcad.com/docs.
`

type HelpModalTab = 'about' | 'shortcuts' | 'license' | 'readme' | 'donation' | 'links'
  | 'release' | 'parity'

type HelpModalProps = {
  open: boolean
  onClose: () => void
}

const TABS: Array<{ id: HelpModalTab; label: string }> = [
  { id: 'about', label: 'About' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'release', label: 'Release Notes' },
  { id: 'parity', label: 'Parity' },
  { id: 'readme', label: 'ReadMe' },
  { id: 'license', label: 'License' },
  { id: 'donation', label: 'Donation' },
  { id: 'links', label: 'Resources' },
]

const SHORTCUTS = [
  'Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo',
  'Cmd/Ctrl+C / X / V clipboard, Cmd/Ctrl+D duplicate',
  'Cmd/Ctrl+A select all',
  'Escape clears draft and selection',
  'Delete / Backspace removes selected shapes',
  'T toggles tracing overlays',
  'Z extends/trims selected linework',
  'F5 toggles dimension annotations',
  'F6 toggles the stitching simulator',
  '+ / - adjusts simulator thread thickness',
  '= cycles even/odd stitch visibility',
  'Mobile: 2D / 3D / Split buttons switch workspace focus',
]

const RELEASE_NOTES = [
  'Catalog manager now supports editable shops, groups, items, item search, thumbnail grid mode, and group/item move/duplicate/delete workflows.',
  'Template repository folders support nested parents and clearer folder paths when moving templates.',
  'Pricking iron toolbox supports .lccp import/export, custom groups, preset duplication, reorder controls, and visual blade previews.',
  'PDF tracing supports page switching, page browser buttons, DPI scaling, and ruler calibration.',
  'Font list management supports import/export, rename, duplicate, remove, and use actions.',
]

const PARITY_NOTES = [
  'Source app: Leathercraft_CAD_v2.8.3 macOS ARM extraction.',
  'Major parity covered: drafting, line palette, layers, stitch holes, pricking irons, tracing, SVG/DXF/PDF workflows, templates, catalogs, print calibration, bonus generators, mandala helpers, and 3D preview extensions.',
  'Known intentional differences: remote version checks and member entitlement handshakes are offline-friendly or out of scope for this web rebuild.',
]

function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return
  }
  navigator.clipboard.writeText(value).catch(() => {
    // Ignore clipboard errors — non-secure contexts will reject silently.
  })
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<HelpModalTab>('about')
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

        <nav className="line-type-modal-actions" role="tablist" aria-label="Help sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'about' && (
          <section className="help-section">
            <h3>About LeatherCad</h3>
            <p>
              LeatherCad is an open web reimplementation of Leathercraft CAD (Taiwan Studio, 2024).
              Built with React, TypeScript, and Three.js.
            </p>
          </section>
        )}

        {activeTab === 'shortcuts' && (
          <section className="help-section">
            <h3>Keyboard shortcuts</h3>
            <ul className="help-list">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut}>{shortcut}</li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'release' && (
          <section className="help-section">
            <h3>Release Notes</h3>
            <ul className="help-list">
              {RELEASE_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'parity' && (
          <section className="help-section">
            <h3>Source-App Parity</h3>
            <ul className="help-list">
              {PARITY_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'readme' && (
          <section className="help-section">
            <h3>Read Me</h3>
            <pre className="help-modal-pre">{README_TEXT}</pre>
          </section>
        )}

        {activeTab === 'license' && (
          <section className="help-section">
            <h3>License agreement</h3>
            <pre className="help-modal-pre">{LICENSE_TEXT}</pre>
          </section>
        )}

        {activeTab === 'donation' && (
          <section className="help-section">
            <h3>Support development</h3>
            <p>
              LeatherCad is free and open-source. If you find it useful, you can donate via the
              following methods.
            </p>
            <ul className="help-list">
              <li>
                <a href="https://www.buymeacoffee.com/leathercraftcad" target="_blank" rel="noreferrer noopener">
                  Buy Me a Coffee
                </a>
              </li>
              <li>
                <a href="https://www.leathercraftcad.com/donation" target="_blank" rel="noreferrer noopener">
                  Other payment options
                </a>
              </li>
            </ul>
            <h4>Crypto wallets</h4>
            <ul className="help-list">
              {CRYPTO_WALLETS.map((wallet) => (
                <li key={wallet.label}>
                  <strong>{wallet.label}:</strong>{' '}
                  <code>{wallet.address}</code>{' '}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(wallet.address)}
                    title="Copy wallet address"
                  >
                    Copy
                  </button>
                </li>
              ))}
            </ul>
            <p className="hint">
              Wallet addresses shown are placeholders — replace with project owner's actual addresses.
            </p>
          </section>
        )}

        {activeTab === 'links' && (
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
        )}
      </div>
    </div>
  )
}
