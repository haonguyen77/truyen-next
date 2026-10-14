import WritePageClient from '@/components/pages/WritePage'

export default async function Page({ searchParams }: { searchParams: Promise<{ bookId?: string }> }) {
  const { bookId } = await searchParams
  return <WritePageClient bookId={bookId} />
}
