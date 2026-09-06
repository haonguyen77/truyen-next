import Link from 'next/link'
export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <h1 style={{ fontSize: 48, color: '#1e2d4d', marginBottom: 16 }}>404</h1>
      <p style={{ fontSize: 18, color: '#888', marginBottom: 24 }}>Không tìm thấy trang này.</p>
      <Link href="/" style={{ color: '#2e7d52', fontWeight: 600 }}>← Về thư viện</Link>
    </div>
  )
}
