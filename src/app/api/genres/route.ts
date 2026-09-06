import { NextResponse } from 'next/server'
import { getAllGenres } from '@/lib/bookService'

export async function GET() {
  const genres = await getAllGenres()
  return NextResponse.json(genres)
}
