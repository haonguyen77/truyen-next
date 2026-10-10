import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getUserById, updatePassword } from '@/lib/userService'
import { verifyPassword } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { currentPassword, newPassword } = await req.json() as { currentPassword: string; newPassword: string }
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Mật khẩu mới tối thiểu 4 ký tự' }, { status: 400 })
    }

    const user = await getUserById(session.userId)
    if (!user) return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 })

    const ok = await verifyPassword(currentPassword, user.passwordHash)
    if (!ok) return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 401 })

    await updatePassword(session.userId, newPassword)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
