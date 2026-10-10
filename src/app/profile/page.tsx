import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ProfilePageClient from '@/components/pages/ProfilePage'

export default async function Page() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <ProfilePageClient username={session.username} />
}
