'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import s from './ProfilePage.module.css'

export default function ProfilePage({ username }: { username: string }) {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (newPassword !== confirmPassword) { setMsg({ type: 'err', text: 'Mật khẩu mới không khớp' }); return }
    if (newPassword.length < 4) { setMsg({ type: 'err', text: 'Mật khẩu mới tối thiểu 4 ký tự' }); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: data.error ?? 'Lỗi' }); return }
      setMsg({ type: 'ok', text: 'Đổi mật khẩu thành công!' })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch {
      setMsg({ type: 'err', text: 'Lỗi kết nối' })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className={s.page}>
      <div className="container">
        <div className={s.card}>
          <div className={s.header}>
            <div className={s.avatar}>👤</div>
            <div>
              <h1 className={s.name}>{username}</h1>
              <p className={s.sub}>Thông tin tài khoản</p>
            </div>
          </div>

          <section className={s.section}>
            <h2 className={s.sectionTitle}>Đổi mật khẩu</h2>
            <form className={s.form} onSubmit={handleChangePassword}>
              <div className={s.field}>
                <label className={s.label}>Mật khẩu hiện tại</label>
                <input className={s.input} type="password" value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <div className={s.field}>
                <label className={s.label}>Mật khẩu mới</label>
                <input className={s.input} type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className={s.field}>
                <label className={s.label}>Xác nhận mật khẩu mới</label>
                <input className={s.input} type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {msg && <div className={msg.type === 'ok' ? s.ok : s.error}>{msg.text}</div>}
              <button className={s.saveBtn} type="submit" disabled={loading}>
                {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </form>
          </section>

          <section className={s.section}>
            <h2 className={s.sectionTitle}>Đăng xuất</h2>
            <p className={s.logoutNote}>Dữ liệu của bạn đã được đồng bộ lên server.</p>
            <button className={s.logoutBtn} onClick={handleLogout}>Đăng xuất</button>
          </section>
        </div>
      </div>
    </div>
  )
}
