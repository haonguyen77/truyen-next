import { NextResponse } from 'next/server'
import { getAllBooks, searchBooks } from '@/lib/bookService'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  try {
    const data = q ? await searchBooks(q) : await getAllBooks()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
