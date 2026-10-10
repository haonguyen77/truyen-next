import { getAllBooks } from '@/lib/bookService'
import HomePage from '@/components/pages/HomePage'
import { Suspense } from 'react'

export const revalidate = 0

export default async function Page({ searchParams }: { searchParams: Promise<{ genre?: string }> }) {
  const { genre } = await searchParams
  const allBooks = await getAllBooks()
  const filtered = genre ? allBooks.filter(b => b.genres.includes(genre)) : allBooks
  return (
    <Suspense fallback={null}>
      <HomePage books={filtered} allBooks={allBooks} genre={genre} />
    </Suspense>
  )
}
