import type { DocFile } from '../cad/cad-types'

export type PatternLicense = 'CC0-1.0' | 'CC-BY-4.0' | 'CC-BY-NC-4.0'
export type PatternVisibility = 'public' | 'private'
export type PublishedPatternSummary = {
  id: string
  title: string
  description: string
  author: string
  license: PatternLicense
  attribution: string
  version: number
  publishedAt: number
  visibility: PatternVisibility
  retired?: boolean
  visibilityRevision?: number
}
export type PublishedPattern = PublishedPatternSummary & { doc: DocFile }
export type PublishPatternInput = {
  id?: string
  expectedVersion?: number
  expectedVisibilityRevision?: number
  title: string
  description: string
  license: PatternLicense
  attribution: string
  visibility: PatternVisibility
  doc: DocFile
}
export interface CommunityDataClient {
  listPublic(): Promise<PublishedPatternSummary[]>
  listPublicPage(cursor?: string | null, search?: string): Promise<CloudPage<PublishedPatternSummary>>
  listMinePage(cursor?: string | null): Promise<CloudPage<PublishedPatternSummary>>
  listMine(): Promise<PublishedPatternSummary[]>
  get(id: string, version?: number): Promise<PublishedPattern | null>
  publish(input: PublishPatternInput): Promise<PublishedPatternSummary>
  retire?(snapshot: PublishedPatternSummary): Promise<void>
  setVisibility(id: string, visibility: PatternVisibility, snapshot?: Pick<PublishedPatternSummary, 'version' | 'visibilityRevision'>): Promise<void>
}

export type CloudPage<T> = { page: T[]; continueCursor: string; isDone: boolean }
export const emptyCloudPage = <T,>(): CloudPage<T> => ({ page: [], continueCursor: '', isDone: true })
export function mergeCloudPage<T extends { id: string }>(current: CloudPage<T>, next: CloudPage<T>): CloudPage<T> {
  return { ...next, page: [...new Map([...current.page, ...next.page].map(row => [row.id, row])).values()] }
}
export function checkedCloudPage<T>(value: CloudPage<T>, maximum = 25): CloudPage<T> {
  if (!value || !Array.isArray(value.page) || value.page.length > maximum || typeof value.continueCursor !== 'string' || typeof value.isDone !== 'boolean' || (!value.isDone && !value.continueCursor)) throw new Error('Cloud returned an invalid page')
  return value
}
