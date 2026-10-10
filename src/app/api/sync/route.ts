import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getSyncData, saveSyncData } from '@/lib/userService'

// GET — tải dữ liệu sync từ server
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json(null)
  try {
    const data = await getSyncData(session.userId)
    return NextResponse.json({
      readingHistory: JSON.parse(data.readingHistory),
      readCounts: JSON.parse(data.readCounts),
      favorites: JSON.parse(data.favorites),
      readerSettings: JSON.parse(data.readerSettings),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — lưu dữ liệu sync lên server
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  try {
    const body = await req.json() as {
      readingHistory?: unknown
      readCounts?: unknown
      favorites?: unknown
      readerSettings?: unknown
    }
    await saveSyncData(session.userId, {
      readingHistory: body.readingHistory !== undefined ? JSON.stringify(body.readingHistory) : undefined,
      readCounts:     body.readCounts !== undefined     ? JSON.stringify(body.readCounts)     : undefined,
      favorites:      body.favorites !== undefined      ? JSON.stringify(body.favorites)      : undefined,
      readerSettings: body.readerSettings !== undefined ? JSON.stringify(body.readerSettings) : undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
