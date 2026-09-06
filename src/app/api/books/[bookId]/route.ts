import { NextResponse } from 'next/server'
import { getBook, updateBook, deleteBook } from '@/lib/bookService'

export async function GET(_: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params
  const book = await getBook(bookId)
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(book)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params
  const body = await req.json() as Record<string, unknown>
  const book = await updateBook(bookId, {
    title: body.title as string | undefined,
    author: body.author as string | undefined,
    description: body.description as string | undefined,
    cover: body.cover as string | undefined,
    genres: body.genres as string | string[] | undefined,
    chapterCount: body.chapterCount as number | undefined,
  })
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(book)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params
  await deleteBook(bookId)
  return NextResponse.json({ ok: true })
}
