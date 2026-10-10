/**
 * Server-only: đọc session từ cookie (dùng next/headers)
 * Import file này chỉ trong Server Components và API Routes
 */
import { cookies } from 'next/headers'
import { verifySessionToken, cookieName, type SessionPayload } from './auth'

export type { SessionPayload }

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(cookieName())?.value
    if (!token) return null
    return verifySessionToken(token)
  } catch {
    return null
  }
}
