import type {
  DocFile,
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  PatternPiece,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  StitchHole,
} from '../cad/cad-types'
import { uid } from '../cad/cad-geometry'
import { normalizeLineTypes, resolveActiveLineTypeId, resolveShapeLineTypeId } from '../cad/line-types'
import { withEditorLocalDataClient } from '../localdb/editor-local-data-client'
import { safeLocalStorageGet, safeLocalStorageSet } from '../ops/safe-storage'

const TEMPLATE_REPOSITORY_STORAGE_KEY = 'leathercraft-template-repository-v1'

export type TemplateRepositoryEntry = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  /** Optional parent folder id. `null` (or undefined) means root. Source v1.6.3 tree layout. */
  parentFolderId?: string | null
  doc: DocFile
}

export type TemplateRepositoryFolder = {
  id: string
  name: string
  parentFolderId: string | null
  createdAt: string
  updatedAt: string
}

export type TemplateRepositorySortKey = 'name' | 'updated'
export type TemplateRepositoryMoveDirection = 'up' | 'down'

const TEMPLATE_REPOSITORY_FOLDERS_STORAGE_KEY = 'leathercraft-template-repository-folders-v1'

function parseTemplateFolder(candidate: unknown): TemplateRepositoryFolder | null {
  if (typeof candidate !== 'object' || candidate === null) return null
  const maybe = candidate as Partial<TemplateRepositoryFolder>
  if (typeof maybe.id !== 'string' || typeof maybe.name !== 'string') return null
  return {
    id: maybe.id,
    name: maybe.name,
    parentFolderId: typeof maybe.parentFolderId === 'string' ? maybe.parentFolderId : null,
    createdAt: typeof maybe.createdAt === 'string' ? maybe.createdAt : new Date().toISOString(),
    updatedAt: typeof maybe.updatedAt === 'string' ? maybe.updatedAt : new Date().toISOString(),
  }
}

export function loadTemplateRepositoryFolders(): TemplateRepositoryFolder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = safeLocalStorageGet(TEMPLATE_REPOSITORY_FOLDERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseTemplateFolder).filter((folder): folder is TemplateRepositoryFolder => folder !== null)
  } catch {
    return []
  }
}

export function saveTemplateRepositoryFolders(folders: TemplateRepositoryFolder[]) {
  if (typeof window === 'undefined') return
  safeLocalStorageSet(TEMPLATE_REPOSITORY_FOLDERS_STORAGE_KEY, JSON.stringify(folders))
}

export function createTemplateFolder(name: string, parentFolderId: string | null = null): TemplateRepositoryFolder {
  const now = new Date().toISOString()
  return {
    id: uid(),
    name: name.trim() || 'Folder',
    parentFolderId,
    createdAt: now,
    updatedAt: now,
  }
}

export function moveTemplateEntryToFolder(
  entries: TemplateRepositoryEntry[],
  entryId: string,
  parentFolderId: string | null,
) {
  return entries.map((entry) =>
    entry.id === entryId
      ? { ...entry, parentFolderId, updatedAt: new Date().toISOString() }
      : entry,
  )
}

export function deleteTemplateFolder(
  folders: TemplateRepositoryFolder[],
  entries: TemplateRepositoryEntry[],
  folderId: string,
): { folders: TemplateRepositoryFolder[]; entries: TemplateRepositoryEntry[] } {
  // Promote descendants to root (simpler than recursive delete; users can re-organise).
  const removedIds = new Set<string>([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders) {
      if (folder.parentFolderId && removedIds.has(folder.parentFolderId) && !removedIds.has(folder.id)) {
        removedIds.add(folder.id)
        changed = true
      }
    }
  }
  return {
    folders: folders.filter((folder) => !removedIds.has(folder.id)),
    entries: entries.map((entry) =>
      entry.parentFolderId && removedIds.has(entry.parentFolderId)
        ? { ...entry, parentFolderId: null }
        : entry,
    ),
  }
}

export function renameTemplateFolder(
  folders: TemplateRepositoryFolder[],
  folderId: string,
  nextName: string,
): TemplateRepositoryFolder[] {
  const safeName = nextName.trim() || 'Folder'
  return folders.map((folder) =>
    folder.id === folderId ? { ...folder, name: safeName, updatedAt: new Date().toISOString() } : folder,
  )
}

function flipPoint(point: { x: number; y: number }, axis: 'horizontal' | 'vertical') {
  return axis === 'horizontal' ? { x: -point.x, y: point.y } : { x: point.x, y: -point.y }
}

function flipShape(shape: Shape, axis: 'horizontal' | 'vertical'): Shape {
  if (shape.type === 'arc') {
    return {
      ...shape,
      start: flipPoint(shape.start, axis),
      mid: flipPoint(shape.mid, axis),
      end: flipPoint(shape.end, axis),
    }
  }
  if (shape.type === 'bezier') {
    return {
      ...shape,
      start: flipPoint(shape.start, axis),
      control: flipPoint(shape.control, axis),
      end: flipPoint(shape.end, axis),
    }
  }
  return {
    ...shape,
    start: flipPoint(shape.start, axis),
    end: flipPoint(shape.end, axis),
  }
}

export function flipTemplateEntryShapes(
  entry: TemplateRepositoryEntry,
  axis: 'horizontal' | 'vertical',
): TemplateRepositoryEntry {
  const flippedDoc: DocFile = {
    ...cloneDoc(entry.doc),
    objects: entry.doc.objects.map((shape) => flipShape(shape, axis)),
    foldLines: (entry.doc.foldLines ?? []).map((foldLine) => ({
      ...foldLine,
      start: flipPoint(foldLine.start, axis),
      end: flipPoint(foldLine.end, axis),
    })),
    stitchHoles: (entry.doc.stitchHoles ?? []).map((hole) => ({
      ...hole,
      point: flipPoint(hole.point, axis),
    })),
  }
  return {
    ...entry,
    updatedAt: new Date().toISOString(),
    doc: flippedDoc,
  }
}

function cloneDoc(doc: DocFile): DocFile {
  if (typeof structuredClone === 'function') {
    return structuredClone(doc)
  }
  return JSON.parse(JSON.stringify(doc)) as DocFile
}

function parseTemplateEntry(candidate: unknown): TemplateRepositoryEntry | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const maybe = candidate as Partial<TemplateRepositoryEntry>
  if (typeof maybe.id !== 'string' || typeof maybe.name !== 'string') {
    return null
  }
  if (typeof maybe.createdAt !== 'string' || typeof maybe.updatedAt !== 'string') {
    return null
  }
  if (!maybe.doc || typeof maybe.doc !== 'object') {
    return null
  }
  return {
    id: maybe.id,
    name: maybe.name,
    createdAt: maybe.createdAt,
    updatedAt: maybe.updatedAt,
    parentFolderId: typeof maybe.parentFolderId === 'string' ? maybe.parentFolderId : null,
    doc: cloneDoc(maybe.doc),
  }
}

export function loadTemplateRepository(): TemplateRepositoryEntry[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = safeLocalStorageGet(TEMPLATE_REPOSITORY_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map(parseTemplateEntry).filter((entry): entry is TemplateRepositoryEntry => entry !== null)
  } catch {
    return []
  }
}

export function hasTemplateRepositoryStorage() {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return safeLocalStorageGet(TEMPLATE_REPOSITORY_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function saveTemplateRepository(entries: TemplateRepositoryEntry[]) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(TEMPLATE_REPOSITORY_STORAGE_KEY, JSON.stringify(entries))
  void withEditorLocalDataClient((client) => client.templateRepository.replaceAll(entries))
}

export async function loadTemplateRepositoryFromLocalDb(): Promise<TemplateRepositoryEntry[]> {
  const entries = await withEditorLocalDataClient((client) => client.templateRepository.list())
  if (!entries || entries.length === 0) {
    return loadTemplateRepository()
  }
  return entries.map(parseTemplateEntry).filter((entry): entry is TemplateRepositoryEntry => entry !== null)
}

export async function hasTemplateRepositoryStorageInLocalDb(): Promise<boolean> {
  return (
    (await withEditorLocalDataClient((client) => client.templateRepository.hasSavedEntries())) ||
    hasTemplateRepositoryStorage()
  )
}

export function createTemplateFromDoc(name: string, doc: DocFile): TemplateRepositoryEntry {
  const now = new Date().toISOString()
  return {
    id: uid(),
    name: name.trim() || 'Untitled template',
    createdAt: now,
    updatedAt: now,
    doc: cloneDoc(doc),
  }
}

export function serializeTemplateRepository(entries: TemplateRepositoryEntry[]) {
  return JSON.stringify(entries, null, 2)
}

export function moveTemplateRepositoryEntry(
  entries: TemplateRepositoryEntry[],
  entryId: string,
  direction: TemplateRepositoryMoveDirection,
) {
  const index = entries.findIndex((entry) => entry.id === entryId)
  const nextIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) {
    return entries
  }
  const next = [...entries]
  const [entry] = next.splice(index, 1)
  next.splice(nextIndex, 0, entry)
  return next
}

export function sortTemplateRepository(entries: TemplateRepositoryEntry[], sortKey: TemplateRepositorySortKey) {
  return [...entries].sort((left, right) =>
    sortKey === 'name' ? left.name.localeCompare(right.name) : right.updatedAt.localeCompare(left.updatedAt),
  )
}

export function parseTemplateRepositoryImport(raw: string): TemplateRepositoryEntry[] {
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Template repository file must contain a JSON array')
  }
  const entries = parsed.map(parseTemplateEntry).filter((entry): entry is TemplateRepositoryEntry => entry !== null)
  if (entries.length === 0) {
    throw new Error('No valid template entries found in file')
  }
  return entries
}

export type InsertTemplateResult = {
  layers: Layer[]
  lineTypes: LineType[]
  activeLineTypeId: string
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  insertedPatternPieces: PatternPiece[]
  insertedSeamAllowances: PieceSeamAllowance[]
  insertedSeamConnections: SeamConnection[]
  insertedHardwareMarkers: HardwareMarker[]
  insertedShapeIds: string[]
  insertedLayerIds: string[]
}

function cloneShapeWithMap(shape: Shape, layerId: string, lineTypeId: string): Shape {
  if (shape.type === 'line') {
    return {
      ...shape,
      id: uid(),
      layerId,
      lineTypeId,
      start: { ...shape.start },
      end: { ...shape.end },
    }
  }

  if (shape.type === 'arc') {
    return {
      ...shape,
      id: uid(),
      layerId,
      lineTypeId,
      start: { ...shape.start },
      mid: { ...shape.mid },
      end: { ...shape.end },
    }
  }

  if (shape.type === 'text') {
    return {
      ...shape,
      id: uid(),
      layerId,
      lineTypeId,
      start: { ...shape.start },
      end: { ...shape.end },
    }
  }

  const bezier = shape
  return {
    ...bezier,
    id: uid(),
    layerId,
    lineTypeId,
    start: { ...bezier.start },
    control: { ...bezier.control },
    end: { ...bezier.end },
  }
}

function uniqueLayerName(name: string, existingNames: Set<string>) {
  if (!existingNames.has(name)) {
    existingNames.add(name)
    return name
  }
  let index = 2
  while (existingNames.has(`${name} (${index})`)) {
    index += 1
  }
  const resolved = `${name} (${index})`
  existingNames.add(resolved)
  return resolved
}

export function insertTemplateDocIntoCurrent(
  templateDoc: DocFile,
  currentLayers: Layer[],
  currentLineTypes: LineType[],
  currentShapes: Shape[],
  currentFoldLines: FoldLine[],
  currentStitchHoles: StitchHole[],
): InsertTemplateResult {
  const templateLineTypes = normalizeLineTypes(templateDoc.lineTypes ?? [])
  const existingLayerNames = new Set(currentLayers.map((layer) => layer.name))
  const layerMap = new Map<string, string>()
  const insertedLayers: Layer[] = templateDoc.layers.map((layer, index) => {
    const nextId = uid()
    layerMap.set(layer.id, nextId)
    return {
      ...layer,
      id: nextId,
      name: uniqueLayerName(layer.name, existingLayerNames),
      stackLevel: currentLayers.length + index,
    }
  })

  const lineTypeMap = new Map<string, string>()
  const insertedLineTypes: LineType[] = templateLineTypes.map((lineType) => {
    const nextId = uid()
    lineTypeMap.set(lineType.id, nextId)
    return {
      ...lineType,
      id: nextId,
      name: `${lineType.name} (Template)`,
    }
  })

  const shapeMap = new Map<string, string>()
  const insertedShapes = templateDoc.objects.map((shape) => {
    const mappedLayerId = layerMap.get(shape.layerId) ?? insertedLayers[0]?.id ?? currentLayers[0]?.id ?? uid()
    const mappedLineTypeId = resolveShapeLineTypeId(
      [...currentLineTypes, ...insertedLineTypes],
      lineTypeMap.get(shape.lineTypeId) ?? shape.lineTypeId,
      currentLineTypes[0]?.id ?? '',
    )
    const cloned = cloneShapeWithMap(shape, mappedLayerId, mappedLineTypeId)
    shapeMap.set(shape.id, cloned.id)
    return cloned
  })

  const insertedFoldLines = templateDoc.foldLines.map((foldLine) => ({
    ...foldLine,
    id: uid(),
    start: { ...foldLine.start },
    end: { ...foldLine.end },
  }))

  const insertedStitchHoles = (templateDoc.stitchHoles ?? [])
    .map((stitchHole) => {
      const mappedShapeId = shapeMap.get(stitchHole.shapeId)
      if (!mappedShapeId) {
        return null
      }
      return {
        ...stitchHole,
        id: uid(),
        shapeId: mappedShapeId,
        point: { ...stitchHole.point },
      }
    })
    .filter((stitchHole): stitchHole is StitchHole => stitchHole !== null)

  const pieceMap = new Map<string, string>()
  const insertedPatternPieces = (templateDoc.patternPieces ?? [])
    .map((piece) => {
      const boundaryShapeId = shapeMap.get(piece.boundaryShapeId)
      if (!boundaryShapeId) {
        return null
      }
      const nextId = uid()
      pieceMap.set(piece.id, nextId)
      return {
        ...piece,
        id: nextId,
        boundaryShapeId,
        internalShapeIds: piece.internalShapeIds
          .map((shapeId) => shapeMap.get(shapeId))
          .filter((shapeId): shapeId is string => typeof shapeId === 'string'),
        layerId: layerMap.get(piece.layerId) ?? insertedLayers[0]?.id ?? piece.layerId,
      }
    })
    .filter((piece): piece is PatternPiece => piece !== null)

  const insertedSeamAllowances = (templateDoc.seamAllowances ?? [])
    .filter((entry): entry is PieceSeamAllowance => 'pieceId' in entry && typeof entry.pieceId === 'string')
    .map((entry) => {
      const mappedPieceId = pieceMap.get(entry.pieceId)
      if (!mappedPieceId) {
        return null
      }
      return {
        ...entry,
        id: uid(),
        pieceId: mappedPieceId,
        edgeOverrides: entry.edgeOverrides.map((override) => ({ ...override })),
      }
    })
    .filter((entry): entry is PieceSeamAllowance => entry !== null)

  const insertedSeamConnections = (templateDoc.seamConnections ?? [])
    .flatMap((connection): SeamConnection[] => {
      const fromPieceId = pieceMap.get(connection.from.pieceId)
      const toPieceId = pieceMap.get(connection.to.pieceId)
      if (!fromPieceId || !toPieceId) {
        return []
      }
      return [{
        ...connection,
        id: uid(),
        from: {
          ...connection.from,
          pieceId: fromPieceId,
        },
        to: {
          ...connection.to,
          pieceId: toPieceId,
        },
        fromSpan: connection.fromSpan
          ? {
              ...connection.fromSpan,
              pieceId: fromPieceId,
            }
          : undefined,
        toSpan: connection.toSpan
          ? {
              ...connection.toSpan,
              pieceId: toPieceId,
            }
          : undefined,
      }]
    })

  const insertedHardwareMarkers = (templateDoc.hardwareMarkers ?? [])
    .flatMap((marker): HardwareMarker[] => {
      const mappedLayerId = layerMap.get(marker.layerId)
      if (!mappedLayerId) {
        return []
      }
      return [{
        ...marker,
        id: uid(),
        layerId: mappedLayerId,
        groupId: undefined,
        point: { ...marker.point },
      }]
    })

  const lineTypes = normalizeLineTypes([...currentLineTypes, ...insertedLineTypes])
  const activeLineTypeId = resolveActiveLineTypeId(lineTypes, templateDoc.activeLineTypeId)

  return {
    layers: [...currentLayers, ...insertedLayers],
    lineTypes,
    activeLineTypeId,
    shapes: [...currentShapes, ...insertedShapes],
    foldLines: [...currentFoldLines, ...insertedFoldLines],
    stitchHoles: [...currentStitchHoles, ...insertedStitchHoles],
    insertedPatternPieces,
    insertedSeamAllowances,
    insertedSeamConnections,
    insertedHardwareMarkers,
    insertedShapeIds: insertedShapes.map((shape) => shape.id),
    insertedLayerIds: insertedLayers.map((layer) => layer.id),
  }
}
