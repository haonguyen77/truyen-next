import { NextResponse } from 'next/server'
import { getChapter, deleteChapter } from '@/lib/bookService'

export async function GET(_: Request, { params }: { params: Promise<{ bookId: string; chapterId: string }> }) {
  const { chapterId } = await params
  const ch = await getChapter(chapterId)
  if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(ch)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ bookId: string; chapterId: string }> }) {
  const { chapterId } = await params
  await deleteChapter(chapterId)
  return NextResponse.json({ ok: true })
}
