/**
 * Reading Progress — localStorage (client-side only)
 * Tracks: reading history (last chapter per book) + read counts
 */

export interface ReadingEntry {
  bookId: string; bookTitle: string
  chapterId: string; chapterTitle: string
  chapterIndex: number; totalChapters: number
  progress: number; updatedAt: number
}
export interface ReadCountEntry { bookId: string; count: number }

const KEY_HISTORY  = 'truyen-reading-history'
const KEY_COUNTS   = 'truyen-read-counts'
const MAX_HISTORY  = 50

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback } catch { return fallback }
}
function saveJson(key: string, val: unknown) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

export function saveReadingEntry(entry: Omit<ReadingEntry, 'updatedAt'>) {
  const list: ReadingEntry[] = loadJson(KEY_HISTORY, [])
  const filtered = list.filter(e => e.bookId !== entry.bookId)
  saveJson(KEY_HISTORY, [{ ...entry, updatedAt: Date.now() }, ...filtered].slice(0, MAX_HISTORY))
}

export function updateScrollProgress(bookId: string, progress: number) {
  const list: ReadingEntry[] = loadJson(KEY_HISTORY, [])
  const idx = list.findIndex(e => e.bookId === bookId)
  if (idx >= 0) { list[idx] = { ...list[idx], progress: Math.round(progress), updatedAt: Date.now() }; saveJson(KEY_HISTORY, list) }
}

export function getReadingHistory(limit = 10): ReadingEntry[] {
  return loadJson<ReadingEntry[]>(KEY_HISTORY, []).slice(0, limit)
}

export function removeFromHistory(bookId: string) {
  saveJson(KEY_HISTORY, loadJson<ReadingEntry[]>(KEY_HISTORY, []).filter(e => e.bookId !== bookId))
}

export function incrementReadCount(bookId: string) {
  const counts: Record<string, number> = loadJson(KEY_COUNTS, {})
  counts[bookId] = (counts[bookId] ?? 0) + 1
  saveJson(KEY_COUNTS, counts)
}

export function getTopReadBooks(limit = 10): ReadCountEntry[] {
  const counts: Record<string, number> = loadJson(KEY_COUNTS, {})
  return Object.entries(counts)
    .map(([bookId, count]) => ({ bookId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function removeReadCount(bookId: string) {
  const counts: Record<string, number> = loadJson(KEY_COUNTS, {})
  delete counts[bookId]
  saveJson(KEY_COUNTS, counts)
}
