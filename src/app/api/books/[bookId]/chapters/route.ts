import { NextResponse } from 'next/server'
import { getChaptersByBook } from '@/lib/bookService'

export async function GET(_: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params
  const data = await getChaptersByBook(bookId)
  return NextResponse.json(data)
}
