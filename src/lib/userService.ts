import { db, users, userSyncData } from '@/db'
import { eq } from 'drizzle-orm'
import { hashPassword } from './auth'

// ── User CRUD ─────────────────────────────────────────────────

export async function getUserByUsername(username: string) {
  const [row] = await db.select().from(users).where(eq(users.username, username.toLowerCase().trim()))
  return row ?? null
}

export async function getUserById(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id))
  return row ?? null
}

export async function createUser(username: string, password: string) {
  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  const now = new Date()
  const [user] = await db.insert(users).values({
    id, username: username.toLowerCase().trim(), passwordHash, createdAt: now, updatedAt: now,
  }).returning()
  // Tạo row sync data trống
  await db.insert(userSyncData).values({
    userId: id, readingHistory: '[]', readCounts: '{}', favorites: '[]', readerSettings: '{}',
    updatedAt: now,
  })
  return user
}

export async function updatePassword(userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId))
}

export async function listUsers() {
  return db.select({ id: users.id, username: users.username, createdAt: users.createdAt }).from(users)
}

// ── Sync data ─────────────────────────────────────────────────

export type SyncPayload = {
  readingHistory?: string  // JSON string
  readCounts?: string
  favorites?: string
  readerSettings?: string
}

export async function getSyncData(userId: string) {
  const [row] = await db.select().from(userSyncData).where(eq(userSyncData.userId, userId))
  if (!row) {
    // Tạo mới nếu chưa có (trường hợp user cũ)
    const now = new Date()
    const [newRow] = await db.insert(userSyncData).values({
      userId, readingHistory: '[]', readCounts: '{}', favorites: '[]', readerSettings: '{}', updatedAt: now,
    }).returning()
    return newRow
  }
  return row
}

export async function saveSyncData(userId: string, data: SyncPayload) {
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (data.readingHistory !== undefined) patch.readingHistory = data.readingHistory
  if (data.readCounts !== undefined) patch.readCounts = data.readCounts
  if (data.favorites !== undefined) patch.favorites = data.favorites
  if (data.readerSettings !== undefined) patch.readerSettings = data.readerSettings

  const [row] = await db.update(userSyncData).set(patch)
    .where(eq(userSyncData.userId, userId)).returning()

  if (!row) {
    // Insert nếu chưa có row
    await db.insert(userSyncData).values({
      userId,
      readingHistory: data.readingHistory ?? '[]',
      readCounts: data.readCounts ?? '{}',
      favorites: data.favorites ?? '[]',
      readerSettings: data.readerSettings ?? '{}',
      updatedAt: new Date(),
    })
  }
}
