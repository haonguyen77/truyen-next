import { NextResponse } from 'next/server'
import { createBook, saveChapters } from '@/lib/bookService'

export async function POST(req: Request) {
  const { book, chapters: chs } = await req.json() as {
    book: {
      id: string; title: string; author: string; description: string
      cover: string; genres: string[]; sourceFileName: string
      sourceFileType: string; chapterCount: number
    }
    chapters: Array<{
      id: string; bookId: string; index: number
      title: string; content: string; wordCount: number
    }>
  }
  try {
    await createBook(book)
    if (chs.length > 0) {
      await saveChapters(chs)
    }
    return NextResponse.json({ bookId: book.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
