import type {
  BezierShape,
  DocFile,
  FoldLine,
  Layer,
  LineType,
  Shape,
  StitchHole,
} from '../cad/cad-types'
import { uid } from '../cad/cad-geometry'
import { normalizeLineTypes, resolveActiveLineTypeId, resolveShapeLineTypeId } from '../cad/line-types'

const TEMPLATE_REPOSITORY_STORAGE_KEY = 'leathercraft-template-repository-v1'

export type TemplateRepositoryEntry = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  doc: DocFile
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
    doc: cloneDoc(maybe.doc as DocFile),
  }
}

export function loadTemplateRepository(): TemplateRepositoryEntry[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(TEMPLATE_REPOSITORY_STORAGE_KEY)
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

export function saveTemplateRepository(entries: TemplateRepositoryEntry[]) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(TEMPLATE_REPOSITORY_STORAGE_KEY, JSON.stringify(entries))
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

  const bezier = shape as BezierShape
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

  const lineTypes = normalizeLineTypes([...currentLineTypes, ...insertedLineTypes])
  const activeLineTypeId = resolveActiveLineTypeId(lineTypes, templateDoc.activeLineTypeId)

  return {
    layers: [...currentLayers, ...insertedLayers],
    lineTypes,
    activeLineTypeId,
    shapes: [...currentShapes, ...insertedShapes],
    foldLines: [...currentFoldLines, ...insertedFoldLines],
    stitchHoles: [...currentStitchHoles, ...insertedStitchHoles],
    insertedShapeIds: insertedShapes.map((shape) => shape.id),
    insertedLayerIds: insertedLayers.map((layer) => layer.id),
  }
}
