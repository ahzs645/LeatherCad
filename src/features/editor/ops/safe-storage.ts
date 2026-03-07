export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn(`localStorage quota exceeded when writing key "${key}". Data was not saved.`)
    } else {
      console.warn(`Failed to write to localStorage key "${key}":`, error)
    }
    return false
  }
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    console.warn(`Failed to read localStorage key "${key}"`)
    return null
  }
}

export function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    console.warn(`Failed to remove localStorage key "${key}"`)
  }
}
