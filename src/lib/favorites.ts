/**
 * Favorites — localStorage
 * Stores bookIds the user has favorited
 */

const KEY = 'truyen-favorites'

export interface FavoriteEntry {
  bookId: string
  bookTitle: string
  cover: string
  chapterCount: number
  addedAt: number
}

function load(): FavoriteEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(list: FavoriteEntry[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
}

export function getFavorites(): FavoriteEntry[] {
  return load().sort((a, b) => b.addedAt - a.addedAt)
}

export function isFavorite(bookId: string): boolean {
  return load().some(f => f.bookId === bookId)
}

export function addFavorite(entry: Omit<FavoriteEntry, 'addedAt'>) {
  const list = load().filter(f => f.bookId !== entry.bookId)
  save([{ ...entry, addedAt: Date.now() }, ...list])
}

export function removeFavorite(bookId: string) {
  save(load().filter(f => f.bookId !== bookId))
}

export function toggleFavorite(entry: Omit<FavoriteEntry, 'addedAt'>): boolean {
  if (isFavorite(entry.bookId)) {
    removeFavorite(entry.bookId)
    return false // now unfavorited
  } else {
    addFavorite(entry)
    return true  // now favorited
  }
}
