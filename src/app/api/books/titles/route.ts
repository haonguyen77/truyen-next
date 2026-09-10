import { NextResponse } from 'next/server'
import { getBookTitles } from '@/lib/bookService'

// Lightweight endpoint: returns [{ id, title }] only.
// Used by the import page to detect duplicates client-side before uploading.
export async function GET() {
  try {
    const data = await getBookTitles()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
