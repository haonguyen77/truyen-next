import { notFound } from 'next/navigation'
import { getBook, getChapter, getChaptersByBook } from '@/lib/bookService'
import ReaderClient from '@/components/pages/ReaderPage'

export const revalidate = 0

export default async function Page({ params }: { params: Promise<{ bookId: string; chapterId: string }> }) {
  const { bookId, chapterId } = await params
  const [book, chapter, allChs] = await Promise.all([
    getBook(bookId), getChapter(chapterId), getChaptersByBook(bookId)
  ])
  if (!book || !chapter) notFound()
  const mainChs = allChs.filter(c => c.index >= 0).sort((a, b) => a.index - b.index)
  return <ReaderClient book={book} chapter={chapter} allChapters={mainChs} />
}
