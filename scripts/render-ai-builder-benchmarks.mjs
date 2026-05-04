import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const OUTPUTS_DIR = path.join(ROOT, 'ai-builder-benchmarks', 'outputs')
const RENDERED_DIR = path.join(ROOT, 'ai-builder-benchmarks', 'rendered')
const REPORT_PATH = path.join(RENDERED_DIR, 'swarm-visual-report.html')

const ROLE_STYLES = {
  cut: { color: '#111827', width: 1.4, dash: '' },
  stitch: { color: '#2563eb', width: 1, dash: '4 3' },
  fold: { color: '#16a34a', width: 1.1, dash: '7 4' },
  guide: { color: '#b45309', width: 0.8, dash: '3 3' },
  mark: { color: '#7c3aed', width: 0.8, dash: '2 2' },
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function readJsonFiles() {
  if (!fs.existsSync(OUTPUTS_DIR)) return []
  return fs
    .readdirSync(OUTPUTS_DIR)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => {
      const fullPath = path.join(OUTPUTS_DIR, fileName)
      return {
        fileName,
        fullPath,
        document: JSON.parse(fs.readFileSync(fullPath, 'utf8')),
      }
    })
}

function addPoint(bounds, point) {
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return
  bounds.minX = Math.min(bounds.minX, point.x)
  bounds.minY = Math.min(bounds.minY, point.y)
  bounds.maxX = Math.max(bounds.maxX, point.x)
  bounds.maxY = Math.max(bounds.maxY, point.y)
}

function addRectangle(bounds, entity) {
  addPoint(bounds, { x: entity.x, y: entity.y })
  addPoint(bounds, { x: entity.x + entity.width, y: entity.y + entity.height })
}

function collectBounds(entities) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const entity of entities) {
    if (entity.type === 'rectangle') {
      addRectangle(bounds, entity)
    } else if (entity.type === 'line' || entity.type === 'fold' || entity.type === 'stitch_path') {
      addPoint(bounds, entity.start)
      addPoint(bounds, entity.end)
      addPoint(bounds, entity.mid)
      addPoint(bounds, entity.control)
    } else if (entity.type === 'text') {
      addPoint(bounds, entity.position)
    } else if (entity.type === 'hardware_marker') {
      addPoint(bounds, entity.point)
    }
  }

  if (!Number.isFinite(bounds.minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  }

  return bounds
}

function entityCounts(entities) {
  const counts = new Map()
  for (const entity of entities) {
    counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1)
  }
  return counts
}

function roleStyle(role) {
  return ROLE_STYLES[role ?? 'cut'] ?? ROLE_STYLES.cut
}

function renderLine(start, end, role = 'cut', attrs = '') {
  const style = roleStyle(role)
  return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-dasharray="${style.dash}" stroke-linecap="round" ${attrs}/>`
}

function renderRect(entity, role = 'cut', attrs = '') {
  const style = roleStyle(role)
  return `<rect x="${entity.x}" y="${entity.y}" width="${entity.width}" height="${entity.height}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-dasharray="${style.dash}" ${attrs}/>`
}

function renderStitchPath(entity) {
  const path =
    entity.path_type === 'arc' && entity.mid
      ? `M ${entity.start.x} ${entity.start.y} Q ${entity.mid.x} ${entity.mid.y} ${entity.end.x} ${entity.end.y}`
      : entity.path_type === 'bezier' && entity.control
        ? `M ${entity.start.x} ${entity.start.y} Q ${entity.control.x} ${entity.control.y} ${entity.end.x} ${entity.end.y}`
        : `M ${entity.start.x} ${entity.start.y} L ${entity.end.x} ${entity.end.y}`
  const pathSvg = `<path d="${path}" fill="none" stroke="${ROLE_STYLES.stitch.color}" stroke-width="1" stroke-dasharray="4 3" stroke-linecap="round"/>`

  if (entity.path_type !== 'line') return pathSvg

  const length = Math.hypot(entity.end.x - entity.start.x, entity.end.y - entity.start.y)
  const pitch = Math.max(0.1, entity.pitch_mm ?? 4)
  const includeStart = entity.include_start_hole !== false
  const holeCount = Math.max(2, Math.floor(length / pitch) + (includeStart ? 1 : 0))
  const startIndex = includeStart ? 0 : 1
  const steps = Math.max(1, holeCount - 1 + (includeStart ? 0 : 1))
  const angle = Math.atan2(entity.end.y - entity.start.y, entity.end.x - entity.start.x) * 180 / Math.PI
  const width = entity.width_mm ?? entity.diameter_mm ?? 1.1
  const height = entity.height_mm ?? entity.diameter_mm ?? 0.7
  const holes = []

  for (let index = startIndex; index <= steps; index += 1) {
    const t = index / steps
    const x = entity.start.x + (entity.end.x - entity.start.x) * t
    const y = entity.start.y + (entity.end.y - entity.start.y) * t
    holes.push(`<rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" rx="${height / 3}" fill="#1d4ed8" transform="rotate(${angle + (entity.tilt_deg ?? 0)} ${x} ${y})"/>`)
  }

  return `${pathSvg}${holes.join('')}`
}

function renderHardware(entity) {
  const diameter = entity.hole_diameter_mm ?? 4
  const radius = Math.max(2, diameter / 2)
  const label = escapeHtml(entity.label ?? entity.kind ?? entity.id)
  return [
    `<circle cx="${entity.point.x}" cy="${entity.point.y}" r="${radius}" fill="#f97316" fill-opacity="0.18" stroke="#ea580c" stroke-width="1.2"/>`,
    renderLine({ x: entity.point.x - radius * 1.6, y: entity.point.y }, { x: entity.point.x + radius * 1.6, y: entity.point.y }, 'mark'),
    renderLine({ x: entity.point.x, y: entity.point.y - radius * 1.6 }, { x: entity.point.x, y: entity.point.y + radius * 1.6 }, 'mark'),
    `<text x="${entity.point.x + radius + 2}" y="${entity.point.y - radius - 1}" font-size="6" fill="#9a3412">${label}</text>`,
  ].join('')
}

function renderPatternPieceFills(entities) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]))
  return entities
    .filter((entity) => entity.type === 'pattern_piece')
    .map((piece, index) => {
      const boundary = byId.get(piece.boundary_entity_id)
      if (!boundary || boundary.type !== 'rectangle') return ''
      const fill = index % 2 === 0 ? '#dbeafe' : '#dcfce7'
      return `<rect x="${boundary.x}" y="${boundary.y}" width="${boundary.width}" height="${boundary.height}" fill="${fill}" fill-opacity="0.34" stroke="none"/>`
    })
    .join('')
}

function renderEntity(entity) {
  if (entity.type === 'rectangle') return renderRect(entity, entity.line_role ?? 'cut')
  if (entity.type === 'line') return renderLine(entity.start, entity.end, entity.line_role ?? 'cut')
  if (entity.type === 'fold') return renderLine(entity.start, entity.end, 'fold')
  if (entity.type === 'stitch_path') return renderStitchPath(entity)
  if (entity.type === 'hardware_marker') return renderHardware(entity)
  if (entity.type === 'text') {
    return `<text x="${entity.position.x}" y="${entity.position.y}" font-size="${entity.font_size_mm ?? 8}" fill="${ROLE_STYLES.mark.color}">${escapeHtml(entity.value)}</text>`
  }
  return ''
}

function renderSummary(document, fileName) {
  const counts = entityCounts(document.entities)
  const interesting = [
    ['pieces', counts.get('pattern_piece') ?? 0],
    ['allowances', counts.get('seam_allowance') ?? 0],
    ['seams', counts.get('seam_connection') ?? 0],
    ['stitches', counts.get('stitch_path') ?? 0],
    ['hardware', counts.get('hardware_marker') ?? 0],
  ]
  return `
    <div class="summary">
      <h2>${escapeHtml(document.document_name ?? fileName)}</h2>
      <p>${escapeHtml(fileName)}</p>
      <div class="chips">
        ${interesting.map(([label, value]) => `<span>${label}: <strong>${value}</strong></span>`).join('')}
      </div>
    </div>
  `
}

function renderCard(entry) {
  const bounds = collectBounds(entry.document.entities)
  const padding = 18
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const viewBox = [
    bounds.minX - padding,
    bounds.minY - padding,
    width + padding * 2,
    height + padding * 2,
  ].join(' ')
  const renderedEntities = [
    renderPatternPieceFills(entry.document.entities),
    ...entry.document.entities.map(renderEntity),
  ].join('')

  return `
    <section class="card">
      ${renderSummary(entry.document, entry.fileName)}
      <svg viewBox="${viewBox}" role="img" aria-label="${escapeHtml(entry.document.document_name ?? entry.fileName)}">
        <rect x="${bounds.minX - padding}" y="${bounds.minY - padding}" width="${width + padding * 2}" height="${height + padding * 2}" fill="#ffffff"/>
        ${renderedEntities}
      </svg>
    </section>
  `
}

function renderReport(entries) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LeatherCad AI Builder Swarm Visual Report</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f4f6f8; color: #111827; }
    header { padding: 24px 28px 12px; }
    h1 { margin: 0 0 6px; font-size: 24px; font-weight: 700; }
    header p { margin: 0; color: #4b5563; }
    main { display: grid; gap: 16px; padding: 16px 28px 32px; }
    .card { display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: 16px; align-items: stretch; padding: 16px; background: #fff; border: 1px solid #d7dde5; border-radius: 8px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }
    .summary h2 { margin: 0 0 6px; font-size: 17px; }
    .summary p { margin: 0 0 14px; color: #667085; font-size: 13px; overflow-wrap: anywhere; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips span { border: 1px solid #d7dde5; border-radius: 999px; padding: 4px 8px; font-size: 12px; color: #344054; background: #f8fafc; }
    svg { width: 100%; height: 280px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; }
    @media (max-width: 800px) { .card { grid-template-columns: 1fr; } svg { height: 240px; } }
  </style>
</head>
<body>
  <header>
    <h1>LeatherCad AI Builder Swarm Visual Report</h1>
    <p>Rendered from generated JSON outputs. Black=cut, blue=stitch paths/holes, green=folds, orange=hardware, purple=mark text.</p>
  </header>
  <main>
    ${entries.map(renderCard).join('')}
  </main>
</body>
</html>`
}

const entries = readJsonFiles()
fs.mkdirSync(RENDERED_DIR, { recursive: true })
fs.writeFileSync(REPORT_PATH, renderReport(entries))
console.log(`Rendered ${entries.length} AI Builder benchmark previews to ${path.relative(ROOT, REPORT_PATH)}`)
