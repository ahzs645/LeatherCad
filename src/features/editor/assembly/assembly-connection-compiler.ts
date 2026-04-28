import type { AssemblyConnection, PieceInterface, SeamConnection } from '../cad/cad-types'

function seamKind(kind: AssemblyConnection['kind']): SeamConnection['kind'] {
  if (kind === 'aligned') return 'aligned'
  if (kind === 'fold-hinge') return 'hinge'
  return 'sewn'
}

export function compileAssemblyConnections(params: {
  pieceInterfaces: PieceInterface[]
  assemblyConnections: AssemblyConnection[]
}) {
  const interfaceById = new Map(params.pieceInterfaces.map((entry) => [entry.id, entry]))
  const seamConnections: SeamConnection[] = []

  for (const connection of params.assemblyConnections) {
    const fromInterface = interfaceById.get(connection.fromInterfaceId)
    const toInterface = interfaceById.get(connection.toInterfaceId)
    if (!fromInterface || !toInterface) {
      continue
    }

    const spanCount = Math.min(fromInterface.spans.length, toInterface.spans.length)
    for (let index = 0; index < spanCount; index += 1) {
      const fromSpan = fromInterface.spans[index]
      const toSpan = toInterface.spans[index]
      seamConnections.push({
        id: `${connection.id}-seam-${index + 1}`,
        sourceConnectionId: connection.id,
        from: {
          pieceId: fromSpan.pieceId,
          edgeIndex: fromSpan.edgeIndex,
        },
        to: {
          pieceId: toSpan.pieceId,
          edgeIndex: toSpan.edgeIndex,
        },
        fromSpan,
        toSpan,
        stitchSpacingMm: connection.stitchSpacingMm,
        reversed: toSpan.reversed === true || fromSpan.reversed !== toSpan.reversed,
        kind: seamKind(connection.kind),
      })
    }
  }

  return { seamConnections }
}

export function mergeCompiledSeams(params: {
  existingSeams: SeamConnection[]
  compiledSeams: SeamConnection[]
}) {
  const existingKeys = new Set(
    params.existingSeams.map((connection) =>
      [
        connection.from.pieceId,
        connection.from.edgeIndex,
        connection.to.pieceId,
        connection.to.edgeIndex,
        connection.kind,
      ].join(':'),
    ),
  )
  const additions = params.compiledSeams.filter((connection) => {
    const key = [
      connection.from.pieceId,
      connection.from.edgeIndex,
      connection.to.pieceId,
      connection.to.edgeIndex,
      connection.kind,
    ].join(':')
    return !existingKeys.has(key)
  })
  return [...params.existingSeams, ...additions]
}
