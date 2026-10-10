import { NextResponse } from 'next/server'
import { getUserByUsername } from '@/lib/userService'
import { verifyPassword, createSessionToken, makeSessionCookie } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json() as { username: string; password: string }
    if (!username?.trim() || !password) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
    }
    const user = await getUserByUsername(username)
    if (!user) {
      return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 })
    }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 })
    }
    const token = await createSessionToken({ userId: user.id, username: user.username })
    const res = NextResponse.json({ userId: user.id, username: user.username })
    res.headers.set('Set-Cookie', makeSessionCookie(token))
    return res
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
