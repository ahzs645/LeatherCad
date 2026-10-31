import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'
import { isEditorLocale, type EditorLocale } from './locale-dictionaries'

export const EDITOR_LOCALE_STORAGE_KEY = 'leathercad-interface-language-v1'
const listeners = new Set<() => void>()
let listeningForStorage = false
let currentLocale: EditorLocale | undefined

export function getEditorLocale(): EditorLocale {
  if (currentLocale === undefined) {
    const stored = typeof window !== 'undefined' ? safeLocalStorageGet(EDITOR_LOCALE_STORAGE_KEY) : null
    currentLocale = isEditorLocale(stored) ? stored : 'en'
  }
  return currentLocale
}

function notifyLocaleChange() {
  for (const listener of listeners) listener()
}

function handleStorage(event: StorageEvent) {
  if (event.key === EDITOR_LOCALE_STORAGE_KEY || event.key === null) {
    currentLocale = undefined
    notifyLocaleChange()
  }
}

export function subscribeEditorLocale(listener: () => void) {
  listeners.add(listener)
  if (!listeningForStorage && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage)
    listeningForStorage = true
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && listeningForStorage) {
      window.removeEventListener('storage', handleStorage)
      listeningForStorage = false
    }
  }
}

export function setEditorLocale(locale: EditorLocale) {
  if (!isEditorLocale(locale)) return
  currentLocale = locale
  safeLocalStorageSet(EDITOR_LOCALE_STORAGE_KEY, locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  notifyLocaleChange()
}
