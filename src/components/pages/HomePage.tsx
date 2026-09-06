'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import BookCover from '@/components/BookCover'
import s from './HomePage.module.css'

type Book = {
  id: string; title: string; author: string; genres: string[]
  cover: string; chapterCount: number; createdAt: number; updatedAt: number
}

function fmtTime(ts: number) {
  const d = Date.now() - ts
  if (d < 60000) return 'Vừa xong'
  if (d < 3600000) return `${Math.floor(d/60000)} phút trước`
  if (d < 86400000) return `${Math.floor(d/3600000)} giờ trước`
  return `${Math.floor(d/86400000)} ngày trước`
}

const PER_PAGE = 20

export default function HomePage({ books, allBooks, genre }: { books: Book[]; allBooks: Book[]; genre?: string }) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(books.length / PER_PAGE))
  const paged = books.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className={s.page}>
      <div className="container">

        {/* Mới nhất */}
        <section className={s.sectionNew}>
          <div className={s.newHeader}>
            <div className={s.newHeaderLeft}>
              <span className={s.newIcon}>📚</span>
              <div>
                <h2 className={s.newTitle}>
                  {genre ? `THỂ LOẠI: ${genre.toUpperCase()}` : 'TRUYỆN MỚI NHẤT'}
                </h2>
                <p className={s.newSub}>
                  {genre ? (
                    <>{books.length} truyện · <button onClick={() => router.push('/')} className={s.clearFilter}>✕ Xóa lọc</button></>
                  ) : 'Những truyện vừa được import gần đây'}
                </p>
              </div>
            </div>
            <div className={s.newHeaderRight}>
              <Link href="/admin/import" className={s.importBtn}>+ Import truyện</Link>
            </div>
          </div>

          {books.length === 0 ? (
            <div className={s.empty}>
              <p className={s.emptyTitle}>Thư viện trống</p>
              <p className={s.emptySub}>Import file Word, EPUB hoặc PDF để bắt đầu.</p>
              <Link href="/admin/import" className={s.importBtnLg}>Import truyện ngay</Link>
            </div>
          ) : (
            <>
              <div className={s.tableHead}>
                <span>#</span><span />
                <span>TÊN TRUYỆN</span>
                <span>THỂ LOẠI</span>
                <span>SỐ CHƯƠNG</span>
                <span>CẬP NHẬT</span>
              </div>
              {paged.map((book, i) => (
                <div key={book.id} className={s.row} onClick={() => router.push(`/books/${book.id}`)}>
                  <span className={s.rowNum}>{(page-1)*PER_PAGE + i + 1}</span>
                  <span className={s.rowCover}><BookCover title={book.title} cover={book.cover} size={34} radius={4} /></span>
                  <div className={s.rowName}>
                    <span className={s.rowTitle}>{book.title}</span>
                    <span className={s.fullBadge}>Full</span>
                    {book.author && <span className={s.rowAuthor}>{book.author}</span>}
                  </div>
                  <span className={s.rowGenre}>{book.genres.slice(0,2).join(', ') || '—'}</span>
                  <span className={s.rowChap}>Chương {book.chapterCount}</span>
                  <span className={s.rowDate}>{fmtTime(book.updatedAt)}</span>
                </div>
              ))}

              {totalPages > 1 && (
                <div className={s.pagination}>
                  <button className={s.pageBtn} disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
                  {Array.from({length: totalPages}, (_,i) => i+1).map(p => (
                    <button key={p} className={`${s.pageBtn} ${p===page ? s.pageBtnActive : ''}`}
                      onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button className={s.pageBtn} disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>›</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
