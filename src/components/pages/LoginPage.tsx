'use client'
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import s from './LoginPage.module.css'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) { setError('Vui lòng nhập đầy đủ thông tin'); return }
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Lỗi không xác định'); return }
      router.push('/')
      router.refresh()
    } catch {
      setError('Lỗi kết nối, thử lại sau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.logo}>📚</div>
        <h1 className={s.title}>TRUYỆN MỚI</h1>
        <p className={s.sub}>{mode === 'login' ? 'Đăng nhập để đồng bộ dữ liệu' : 'Tạo tài khoản mới'}</p>

        <div className={s.tabs}>
          <button className={`${s.tab} ${mode === 'login' ? s.tabActive : ''}`} onClick={() => { setMode('login'); setError('') }}>
            Đăng nhập
          </button>
          <button className={`${s.tab} ${mode === 'register' ? s.tabActive : ''}`} onClick={() => { setMode('register'); setError('') }}>
            Đăng ký
          </button>
        </div>

        <form className={s.form} onSubmit={handleSubmit}>
          <div className={s.field}>
            <label className={s.label}>Tên đăng nhập</label>
            <input
              className={s.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập..."
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className={s.field}>
            <label className={s.label}>Mật khẩu</label>
            <input
              className={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className={s.error}>{error}</div>}

          <button className={s.submit} type="submit" disabled={loading}>
            {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>

        <button className={s.skip} onClick={() => router.push('/')}>
          Dùng không cần tài khoản →
        </button>
      </div>
    </div>
  )
}
