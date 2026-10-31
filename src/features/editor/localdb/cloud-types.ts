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
}
export type PublishedPattern = PublishedPatternSummary & { doc: DocFile }
export type PublishPatternInput = {
  id?: string
  expectedVersion?: number
  title: string
  description: string
  license: PatternLicense
  attribution: string
  visibility: PatternVisibility
  doc: DocFile
}
export interface CommunityDataClient {
  listPublic(): Promise<PublishedPatternSummary[]>
  listMine(): Promise<PublishedPatternSummary[]>
  get(id: string, version?: number): Promise<PublishedPattern | null>
  publish(input: PublishPatternInput): Promise<PublishedPatternSummary>
  setVisibility(id: string, visibility: PatternVisibility): Promise<void>
}
