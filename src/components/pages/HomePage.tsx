'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import BookCover from '@/components/BookCover'
import { getReadingHistory, getTopReadBooks, type ReadingEntry } from '@/lib/readingProgress'
import s from './HomePage.module.css'

type Book = { id: string; title: string; author: string; genres: string[]; cover: string; chapterCount: number; createdAt: number; updatedAt: number }

function fmtTime(ts: number) {
  const d = Date.now() - ts
  if (d < 60000) return 'Vừa xong'
  if (d < 3600000) return `${Math.floor(d/60000)} phút trước`
  if (d < 86400000) return `${Math.floor(d/3600000)} giờ trước`
  return `${Math.floor(d/86400000)} ngày trước`
}

const PER_PAGE = 20
const SECTION_LIMIT = 5

export default function HomePage({ books, genre }: { books: Book[]; genre?: string }) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [readingList, setReadingList] = useState<ReadingEntry[]>([])
  const [topBooks, setTopBooks] = useState<{ book: Book; count: number }[]>([])
  const [showAllReading, setShowAllReading] = useState(false)
  const [showAllTop, setShowAllTop] = useState(false)

  useEffect(() => {
    // Load from localStorage on client
    const history = getReadingHistory(50).filter(e => books.some(b => b.id === e.bookId))
    setReadingList(history)
    const topRaw = getTopReadBooks(20)
    const resolved = topRaw
      .map(({ bookId, count }) => ({ book: books.find(b => b.id === bookId), count }))
      .filter((r): r is { book: Book; count: number } => !!r.book)
    setTopBooks(resolved)
  }, [books])

  const totalPages = Math.max(1, Math.ceil(books.length / PER_PAGE))
  const paged = books.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const visReading = showAllReading ? readingList : readingList.slice(0, SECTION_LIMIT)
  const visTop = showAllTop ? topBooks : topBooks.slice(0, SECTION_LIMIT)

  return (
    <div className={s.page}>
      <div className="container">

        {/* ══ TOP ROW ══ */}
        <div className={s.topRow}>

          {/* ── Đang đọc ── */}
          <section className={s.cardReading}>
            <div className={s.cardHeader}>
              <div className={s.cardLeft}>
                <span className={s.iconBoxReading}>🕐</span>
                <div>
                  <h2 className={s.cardTitle}>TRUYỆN ĐANG ĐỌC</h2>
                  <p className={s.cardSub}>Những truyện bạn vừa đọc gần đây</p>
                </div>
              </div>
              {readingList.length > SECTION_LIMIT && (
                <button className={s.seeMore} onClick={() => setShowAllReading(v => !v)}>
                  {showAllReading ? 'Thu gọn ←' : 'Xem thêm →'}
                </button>
              )}
            </div>
            <div className={s.listBody}>
              {visReading.length === 0 ? (
                <div className={s.empty}>
                  <p>Chưa có truyện đang đọc</p>
                  <button className={s.emptyBtn}
                    onClick={() => document.getElementById('sec-new')?.scrollIntoView({ behavior: 'smooth' })}>
                    Khám phá thư viện
                  </button>
                </div>
              ) : visReading.map(e => (
                <ReadingRow key={e.bookId} entry={e} navigate={router.push.bind(router)} />
              ))}
            </div>
          </section>

          {/* ── Đọc nhiều nhất ── */}
          <section className={s.cardPopular}>
            <div className={s.cardHeader}>
              <div className={s.cardLeft}>
                <span className={s.iconBoxPopular}>📊</span>
                <div>
                  <h2 className={s.cardTitle}>TRUYỆN ĐỌC NHIỀU NHẤT</h2>
                  <p className={s.cardSub}>Top những truyện được đọc nhiều nhất</p>
                </div>
              </div>
              {topBooks.length > SECTION_LIMIT && (
                <button className={s.seeMore} onClick={() => setShowAllTop(v => !v)}>
                  {showAllTop ? 'Thu gọn ←' : 'Xem thêm →'}
                </button>
              )}
            </div>
            <div className={s.listBody}>
              {visTop.length === 0 ? (
                <div className={s.empty}><p>Chưa có dữ liệu đọc</p></div>
              ) : visTop.map(({ book, count }, i) => (
                <PopularRow key={book.id} book={book} rank={i+1} count={count}
                  onClick={() => router.push(`/books/${book.id}`)} />
              ))}
            </div>
          </section>
        </div>

        {/* ══ Mới nhất ══ */}
        <section className={s.sectionNew} id="sec-new">
          <div className={s.newHeader}>
            <div className={s.newLeft}>
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
            <div className={s.newRight}>
              <Link href="/admin/import" className={s.importBtn}>+ Import truyện</Link>
            </div>
          </div>

          {books.length === 0 ? (
            <div className={s.emptyFull}>
              <p className={s.emptyTitle}>Thư viện trống</p>
              <p className={s.emptySub}>Import file Word, EPUB để bắt đầu.</p>
              <Link href="/admin/import" className={s.importBtnLg}>Import ngay</Link>
            </div>
          ) : (
            <>
              <div className={s.tableHead}>
                <span>#</span><span/><span>TÊN TRUYỆN</span>
                <span>THỂ LOẠI</span><span>SỐ CHƯƠNG</span><span>CẬP NHẬT</span>
              </div>
              {paged.map((book, i) => (
                <div key={book.id} className={s.row} onClick={() => router.push(`/books/${book.id}`)}>
                  <span className={s.rNum}>{(page-1)*PER_PAGE + i + 1}</span>
                  <span className={s.rCover}><BookCover title={book.title} cover={book.cover} size={34} radius={4} /></span>
                  <div className={s.rName}>
                    <span className={s.rTitle}>{book.title}</span>
                    <span className={s.fullBadge}>Full</span>
                    {book.author && <span className={s.rAuthor}>{book.author}</span>}
                  </div>
                  <span className={s.rGenre}>{book.genres.slice(0,2).join(', ') || '—'}</span>
                  <span className={s.rChap}>Chương {book.chapterCount}</span>
                  <span className={s.rDate}>{fmtTime(book.updatedAt)}</span>
                </div>
              ))}
              {totalPages > 1 && (
                <div className={s.pagination}>
                  <button className={s.pageBtn} disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
                  {Array.from({length: totalPages}, (_,i) => i+1).map(p => (
                    <button key={p} className={`${s.pageBtn} ${p===page ? s.pageBtnActive : ''}`} onClick={() => setPage(p)}>{p}</button>
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

// ── Reading row ──────────────────────────────────────────────
function ReadingRow({ entry, navigate }: { entry: ReadingEntry; navigate: (url: string) => void }) {
  const bookPct = entry.totalChapters > 0
    ? Math.min(100, Math.round(((entry.chapterIndex + 1) / entry.totalChapters) * 100)) : 0
  return (
    <div className={s.readingRow}>
      <BookCover title={entry.bookTitle} size={44} />
      <div className={s.readMeta}>
        <button className={s.readTitle} onClick={() => navigate(`/books/${entry.bookId}`)}>
          {entry.bookTitle}
        </button>
        <span className={s.readChap}>{entry.chapterTitle}</span>
        <div className={s.progWrap}>
          <div className={s.progBar}><div className={s.progFill} style={{ width: `${bookPct}%` }} /></div>
          <span className={s.progPct}>{bookPct}%</span>
        </div>
      </div>
      <button className={s.continueBtn} onClick={() => navigate(`/books/${entry.bookId}/chapter/${entry.chapterId}`)}>
        Đọc tiếp
      </button>
    </div>
  )
}

// ── Popular row ─────────────────────────────────────────────
function PopularRow({ book, rank, count, onClick }: { book: Book; rank: number; count: number; onClick: () => void }) {
  void count
  const rankCls = rank===1 ? s.rank1 : rank===2 ? s.rank2 : rank===3 ? s.rank3 : s.rankN
  return (
    <div className={s.popularRow} onClick={onClick}>
      <span className={`${s.rankBadge} ${rankCls}`}>{rank}</span>
      <BookCover title={book.title} cover={book.cover} size={44} />
      <div className={s.popMeta}>
        <span className={s.popTitle}>{book.title}</span>
        {book.genres.length > 0 && <span className={s.popGenres}>{book.genres.slice(0,2).join(' · ')}</span>}
      </div>
      <span className={s.popCount}>🔥 {book.chapterCount} chương</span>
    </div>
  )
}
