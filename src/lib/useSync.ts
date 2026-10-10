'use client'
/**
 * useSync — đồng bộ localStorage ↔ server
 * Khi đăng nhập: tải dữ liệu server xuống localStorage (merge, ưu tiên dữ liệu mới hơn)
 * Khi có thay đổi: push lên server sau 3 giây debounce
 */

import { useEffect, useRef, useCallback } from 'react'
import { loadJson, saveJson } from './localStorageUtils'

const KEY_HISTORY  = 'truyen-reading-history'
const KEY_COUNTS   = 'truyen-read-counts'
const KEY_FAV      = 'truyen-favorites'
const KEY_SETTINGS = 'truyen-reader-settings-v2'
const KEY_SYNCED   = 'truyen-synced-user'

interface HistoryEntry { bookId: string; updatedAt: number; [k: string]: unknown }
interface FavEntry     { bookId: string; addedAt: number;   [k: string]: unknown }

async function fetchSession(): Promise<{ userId: string; username: string } | null> {
  try {
    const r = await fetch('/api/auth/me')
    const d = await r.json()
    return d?.userId ? d : null
  } catch { return null }
}

/** Merge reading history: gộp 2 mảng, ưu tiên entry có updatedAt mới hơn, max 50 */
function mergeHistory(local: HistoryEntry[], server: HistoryEntry[]): HistoryEntry[] {
  const map = new Map<string, HistoryEntry>()
  for (const e of [...server, ...local]) {
    const existing = map.get(e.bookId)
    if (!existing || e.updatedAt > existing.updatedAt) map.set(e.bookId, e)
  }
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50)
}

/** Merge read counts: lấy giá trị lớn nhất từ cả hai nguồn */
function mergeCounts(local: Record<string, number>, server: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = { ...server }
  for (const [k, v] of Object.entries(local)) {
    result[k] = Math.max(result[k] ?? 0, v)
  }
  return result
}

/** Merge favorites: gộp, không trùng, ưu tiên addedAt mới hơn */
function mergeFavorites(local: FavEntry[], server: FavEntry[]): FavEntry[] {
  const map = new Map<string, FavEntry>()
  for (const e of [...server, ...local]) {
    const existing = map.get(e.bookId)
    if (!existing || e.addedAt > existing.addedAt) map.set(e.bookId, e)
  }
  return Array.from(map.values()).sort((a, b) => b.addedAt - a.addedAt)
}

export function useSync() {
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncedRef = useRef(false)

  const pushToServer = useCallback(async () => {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readingHistory: loadJson<HistoryEntry[]>(KEY_HISTORY, []),
          readCounts:     loadJson<Record<string, number>>(KEY_COUNTS, {}),
          favorites:      loadJson<FavEntry[]>(KEY_FAV, []),
          readerSettings: loadJson<Record<string, unknown>>(KEY_SETTINGS, {}),
        }),
      })
    } catch { /* silent */ }
  }, [])

  const schedulePush = useCallback(() => {
    if (!syncedRef.current) return
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(pushToServer, 3000)
  }, [pushToServer])

  useEffect(() => {
    ;(async () => {
      const session = await fetchSession()
      if (!session) return

      const lastSynced = localStorage.getItem(KEY_SYNCED)

      const r = await fetch('/api/sync')
      if (!r.ok) return
      const serverData = await r.json() as {
        readingHistory?: HistoryEntry[]
        readCounts?: Record<string, number>
        favorites?: FavEntry[]
        readerSettings?: Record<string, unknown>
      } | null
      if (!serverData) return

      if (lastSynced !== session.userId) {
        const localHistory = loadJson<HistoryEntry[]>(KEY_HISTORY, [])
        const localCounts  = loadJson<Record<string, number>>(KEY_COUNTS, {})
        const localFav     = loadJson<FavEntry[]>(KEY_FAV, [])

        saveJson(KEY_HISTORY, mergeHistory(localHistory, serverData.readingHistory ?? []))
        saveJson(KEY_COUNTS,  mergeCounts(localCounts, serverData.readCounts ?? {}))
        saveJson(KEY_FAV,     mergeFavorites(localFav, serverData.favorites ?? []))
        if (serverData.readerSettings && Object.keys(serverData.readerSettings).length > 0) {
          saveJson(KEY_SETTINGS, serverData.readerSettings)
        }
        localStorage.setItem(KEY_SYNCED, session.userId)
      }

      syncedRef.current = true
      await pushToServer()
    })()
  }, [pushToServer])

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if ([KEY_HISTORY, KEY_COUNTS, KEY_FAV, KEY_SETTINGS].includes(e.key ?? '')) {
        schedulePush()
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [schedulePush])

  return { schedulePush }
}
