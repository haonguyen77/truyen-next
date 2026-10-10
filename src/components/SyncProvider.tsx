'use client'
import { useSync } from '@/lib/useSync'

/**
 * SyncProvider — gắn vào layout để tự động sync khi có tài khoản
 * Không render gì ra UI
 */
export default function SyncProvider() {
  useSync()
  return null
}
