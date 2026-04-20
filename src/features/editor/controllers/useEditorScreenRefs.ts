import { useRef } from 'react'

export function useEditorScreenRefs() {
  return {
    svgRef: useRef<SVGSVGElement | null>(null),
    fileInputRef: useRef<HTMLInputElement | null>(null),
    svgInputRef: useRef<HTMLInputElement | null>(null),
    tracingInputRef: useRef<HTMLInputElement | null>(null),
    backdropInputRef: useRef<HTMLInputElement | null>(null),
    templateImportInputRef: useRef<HTMLInputElement | null>(null),
    catalogImportInputRef: useRef<HTMLInputElement | null>(null),
    translationInputRef: useRef<HTMLInputElement | null>(null),
    fontInputRef: useRef<HTMLInputElement | null>(null),
    pasteCountRef: useRef(0),
    tracingObjectUrlsRef: useRef<Set<string>>(new Set()),
    panRef: useRef<{ startX: number; startY: number; originX: number; originY: number; pointerId: number } | null>(
      null,
    ),
  }
}
