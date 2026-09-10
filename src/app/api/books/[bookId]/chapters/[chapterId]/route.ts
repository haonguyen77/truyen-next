import { NextResponse } from 'next/server'
import { getChapter, deleteChapter, updateChapter } from '@/lib/bookService'

export async function GET(_: Request, { params }: { params: Promise<{ bookId: string; chapterId: string }> }) {
  const { chapterId } = await params
  const ch = await getChapter(chapterId)
  if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(ch)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ bookId: string; chapterId: string }> }) {
  const { chapterId } = await params
  let body: { title?: string; content?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const updated = await updateChapter(chapterId, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ bookId: string; chapterId: string }> }) {
  const { chapterId } = await params
  await deleteChapter(chapterId)
  return NextResponse.json({ ok: true })
}
