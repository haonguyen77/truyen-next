/**
 * Deleted Books Log — localStorage
 * Keeps track of book titles that were deleted,
 * so re-importing them triggers a duplicate warning.
 */

const KEY = 'truyen-deleted-books'

export interface DeletedEntry {
  title: string
  normalizedTitle: string
  deletedAt: number
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim()
}

function load(): DeletedEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function save(list: DeletedEntry[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
}

export function logDeletedBook(title: string) {
  const list = load().filter(e => e.normalizedTitle !== norm(title))
  save([{ title, normalizedTitle: norm(title), deletedAt: Date.now() }, ...list].slice(0, 500))
}

export function wasDeleted(title: string): DeletedEntry | null {
  return load().find(e => e.normalizedTitle === norm(title)) ?? null
}

export function removeFromDeletedLog(title: string) {
  save(load().filter(e => e.normalizedTitle !== norm(title)))
}

export function getDeletedLog(): DeletedEntry[] {
  return load()
}
