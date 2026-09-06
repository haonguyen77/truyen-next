import { notFound } from 'next/navigation'
import { getBook, getChaptersByBook } from '@/lib/bookService'
import BookDetailClient from '@/components/pages/BookDetailPage'

export const revalidate = 0

export default async function Page({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params
  const [book, chapters] = await Promise.all([getBook(bookId), getChaptersByBook(bookId)])
  if (!book) notFound()
  return <BookDetailClient book={book} chapters={chapters.filter(c => c.index >= 0)} />
}
