'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BookCover from '@/components/BookCover'
import s from './BookDetailPage.module.css'

type Book = { id: string; title: string; author: string; description: string; cover: string; genres: string[]; chapterCount: number }
type Chapter = { id: string; index: number; title: string; wordCount: number }

export default function BookDetailClient({ book, chapters }: { book: Book; chapters: Chapter[] }) {
  const router = useRouter()
  return (
    <div className={s.page}>
      <div className="container">
        <nav className={s.bc}>
          <Link href="/" className={s.bcLink}>⌂ Thư viện</Link>
          <span className={s.bcSep}>/</span>
          <span className={s.bcCur}>{book.title}</span>
        </nav>

        <div className={s.bookInfo}>
          <BookCover title={book.title} cover={book.cover} size={80} radius={8} />
          <div className={s.meta}>
            <h1 className={s.title}>{book.title}</h1>
            {book.author && <p className={s.author}><span className={s.label}>Tác giả:</span> {book.author}</p>}
            {book.genres.length > 0 && (
              <div className={s.genres}>{book.genres.map(g => <span key={g} className={s.genre}>{g}</span>)}</div>
            )}
            <p className={s.stats}><span className={s.badge}>{chapters.length} chương</span></p>
            {book.description && <p className={s.desc}>{book.description}</p>}
            {chapters.length > 0 && (
              <button className={s.readBtn} onClick={() => router.push(`/books/${book.id}/chapter/${chapters[0].id}`)}>
                Đọc từ đầu →
              </button>
            )}
          </div>
        </div>

        <div className={s.chSection}>
          <h2 className={s.chTitle}>DANH SÁCH CHƯƠNG</h2>
          {chapters.length === 0
            ? <p className={s.noChap}>Không có chương nào.</p>
            : chapters.map(ch => (
              <Link key={ch.id} href={`/books/${book.id}/chapter/${ch.id}`} className={s.chItem}>
                <span className={s.chIcon}>✹</span>
                <span className={s.chName}>{ch.title}</span>
                {ch.wordCount > 0 && <span className={s.chWords}>{ch.wordCount.toLocaleString()} từ</span>}
              </Link>
            ))
          }
        </div>
      </div>
    </div>
  )
}
