import type { HeadacheEntry } from './types'

const STORAGE_KEY = 'health-diary-headache-entries'

export const loadEntries = (): HeadacheEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export const saveEntries = (entries: HeadacheEntry[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}
