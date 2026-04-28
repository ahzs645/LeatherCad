import type { PatternPiece, SeamConnection } from '../cad/cad-types'

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function SeamConnectionEditor({
  piece,
  connection,
  counterpartPieceName,
  index,
  onUpdateSeamConnection,
  onDeleteSeamConnection,
}: {
  piece: PatternPiece
  connection: SeamConnection
  counterpartPieceName: string
  index: number
  onUpdateSeamConnection: (connectionId: string, patch: Partial<SeamConnection>) => void
  onDeleteSeamConnection: (connectionId: string) => void
}) {
  const localRef = connection.from.pieceId === piece.id ? connection.from : connection.to
  const remoteRef = connection.from.pieceId === piece.id ? connection.to : connection.from
  const localSpanKey = connection.from.pieceId === piece.id ? 'fromSpan' : 'toSpan'
  const localSpan = connection[localSpanKey]

  const updateLocalSpan = (patch: { t0?: number; t1?: number }) => {
    onUpdateSeamConnection(connection.id, {
      [localSpanKey]: {
        pieceId: localRef.pieceId,
        edgeIndex: localRef.edgeIndex,
        t0: patch.t0 ?? localSpan?.t0 ?? 0,
        t1: patch.t1 ?? localSpan?.t1 ?? 1,
        reversed: localSpan?.reversed,
      },
    } as Partial<SeamConnection>)
  }

  return (
    <div className="layer-toggle-item">
      <span>{`${index + 1}. Edge ${localRef.edgeIndex + 1} to ${counterpartPieceName} edge ${remoteRef.edgeIndex + 1}`}</span>
      <label className="layer-field">
        <span>Kind</span>
        <select
          value={connection.kind}
          onChange={(event) =>
            onUpdateSeamConnection(connection.id, {
              kind: event.target.value as SeamConnection['kind'],
            })
          }
        >
          <option value="sewn">Sewn</option>
          <option value="aligned">Aligned</option>
          <option value="hinge">Hinge</option>
        </select>
      </label>
      <label className="layer-field">
        <span>Stitch spacing (mm)</span>
        <input
          type="number"
          min={0}
          step={0.1}
          value={connection.stitchSpacingMm ?? ''}
          onChange={(event) => {
            const nextValue = event.target.value.trim()
            onUpdateSeamConnection(connection.id, {
              stitchSpacingMm: nextValue.length > 0 ? Math.max(0, parseNumber(nextValue, connection.stitchSpacingMm ?? 0)) : undefined,
            })
          }}
        />
      </label>
      <label className="layer-field">
        <span>Tolerance (mm)</span>
        <input
          type="number"
          min={0}
          step={0.1}
          value={connection.toleranceMm ?? ''}
          onChange={(event) => {
            const nextValue = event.target.value.trim()
            onUpdateSeamConnection(connection.id, {
              toleranceMm: nextValue.length > 0 ? Math.max(0, parseNumber(nextValue, connection.toleranceMm ?? 0)) : undefined,
            })
          }}
        />
      </label>
      <div className="pattern-toggle-grid">
        <label className="layer-field">
          <span>Local start</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={localSpan?.t0 ?? 0}
            onChange={(event) => updateLocalSpan({ t0: clamp01(parseNumber(event.target.value, 0)) })}
          />
        </label>
        <label className="layer-field">
          <span>Local end</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={localSpan?.t1 ?? 1}
            onChange={(event) => updateLocalSpan({ t1: clamp01(parseNumber(event.target.value, 1)) })}
          />
        </label>
      </div>
      <label className="layer-toggle-item">
        <input
          type="checkbox"
          checked={connection.reversed === true}
          onChange={(event) => onUpdateSeamConnection(connection.id, { reversed: event.target.checked })}
        />
        <span>Reverse edge direction</span>
      </label>
      <button type="button" onClick={() => onDeleteSeamConnection(connection.id)}>
        Delete
      </button>
    </div>
  )
}
