import { NextResponse } from 'next/server'
import { saveChapters, deleteChaptersByBook } from '@/lib/bookService'
import { db, books } from '@/db'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  try {
    const { bookId, chapters } = await req.json() as {
      bookId: string
      chapters: Array<{
        id: string; bookId: string; index: number
        title: string; content: string; wordCount: number
      }>
    }
    if (!bookId || !chapters) {
      return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 })
    }

    // Upsert tất cả chapters (onConflictDoUpdate đã có trong saveChapters)
    await saveChapters(chapters)

    // Cập nhật chapterCount
    await db.update(books).set({ chapterCount: chapters.length, updatedAt: new Date() }).where(eq(books.id, bookId))

    return NextResponse.json({ ok: true, count: chapters.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
