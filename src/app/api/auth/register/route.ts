import { NextResponse } from 'next/server'
import { getUserByUsername, createUser } from '@/lib/userService'
import { createSessionToken, makeSessionCookie } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json() as { username: string; password: string }
    if (!username?.trim() || !password) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'Mật khẩu tối thiểu 4 ký tự' }, { status: 400 })
    }
    const existing = await getUserByUsername(username)
    if (existing) {
      return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 409 })
    }
    const user = await createUser(username, password)
    const token = await createSessionToken({ userId: user.id, username: user.username })
    const res = NextResponse.json({ userId: user.id, username: user.username })
    res.headers.set('Set-Cookie', makeSessionCookie(token))
    return res
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
