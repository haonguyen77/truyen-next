import { getAllBooks } from '@/lib/bookService'
import AdminBooksClient from '@/components/pages/AdminBooksPage'
export const revalidate = 0
export default async function Page() {
  const books = await getAllBooks()
  return <AdminBooksClient initialBooks={books} />
}
