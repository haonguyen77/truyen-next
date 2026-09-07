import { getAllBooks } from '@/lib/bookService'
import HomePage from '@/components/pages/HomePage'

export const revalidate = 0
// Force redeploy: bump timestamp

export default async function Page({ searchParams }: { searchParams: Promise<{ genre?: string }> }) {
  const { genre } = await searchParams
  const allBooks = await getAllBooks()
  const filtered = genre
    ? allBooks.filter(b => b.genres.includes(genre))
    : allBooks
  return <HomePage books={filtered} allBooks={allBooks} genre={genre} />
}
