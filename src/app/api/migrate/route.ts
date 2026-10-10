/**
 * One-time migration endpoint — tạo bảng users và user_sync_data
 * Chạy 1 lần bằng cách GET /api/migrate?secret=<AUTH_SECRET>
 * Xóa file này sau khi đã chạy thành công
 */
import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const expected = process.env.AUTH_SECRET ?? 'truyen-secret-change-me-in-production'

  if (secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id           TEXT PRIMARY KEY,
        username     TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS user_sync_data (
        user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        reading_history  TEXT NOT NULL DEFAULT '[]',
        read_counts      TEXT NOT NULL DEFAULT '{}',
        favorites        TEXT NOT NULL DEFAULT '[]',
        reader_settings  TEXT NOT NULL DEFAULT '{}',
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `

    return NextResponse.json({ ok: true, message: 'Tables created successfully' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
