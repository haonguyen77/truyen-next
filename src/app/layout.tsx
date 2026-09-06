import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: 'Truyện Mới — Thư viện truyện',
  description: 'Đọc truyện online, import DOCX, EPUB, PDF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Header />
        <main style={{ paddingTop: 'var(--header-h)' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
