'use client'
import Link from 'next/link'
import s from './ReaderPage.module.css'

type Book = { id: string; title: string }
type Chapter = { id: string; index: number; title: string; content?: string; wordCount: number }

export default function ReaderClient({ book, chapter, allChapters }: {
  book: Book; chapter: Chapter; allChapters: Chapter[]
}) {
  const prev = allChapters.find(c => c.index === chapter.index - 1) ?? null
  const next = allChapters.find(c => c.index === chapter.index + 1) ?? null

  const NavBtns = () => (
    <div className={s.navBtns}>
      {prev
        ? <Link href={`/books/${book.id}/chapter/${prev.id}`} className={s.navBtn}>← Chương trước</Link>
        : <span className={`${s.navBtn} ${s.disabled}`}>← Chương trước</span>
      }
      <Link href={`/books/${book.id}`} className={`${s.navBtn} ${s.toc}`}>☰ Mục lục</Link>
      {next
        ? <Link href={`/books/${book.id}/chapter/${next.id}`} className={s.navBtn}>Chương sau →</Link>
        : <span className={`${s.navBtn} ${s.disabled}`}>Chương sau →</span>
      }
    </div>
  )

  return (
    <div className={s.page}>
      <div className={s.bcBar}>
        <div className="container">
          <nav className={s.bc}>
            <Link href="/" className={s.bcLink}>⌂ Truyện</Link>
            <span className={s.bcSep}>/</span>
            <Link href={`/books/${book.id}`} className={s.bcLink}>{book.title}</Link>
            <span className={s.bcSep}>/</span>
            <span className={s.bcCur}>{chapter.title.normalize('NFC')}</span>
          </nav>
        </div>
      </div>

      <div className={s.readerWrap}>
        <div className={s.readerCard}>
          <div className={s.chHeader}>
            <h1 className={s.bookName}>{book.title.normalize('NFC').toUpperCase()}</h1>
            <p className={s.chTitle} style={{ fontFamily: "'Times New Roman', serif" }}>
              {chapter.title.normalize('NFC')}
            </p>
            <div className={s.ornament}>— ✦ —</div>
          </div>

          <NavBtns />
          <hr className={s.hr} />

          <div
            className={`reader-content ${s.content}`}
            dangerouslySetInnerHTML={{ __html: (chapter.content ?? '').normalize('NFC') }}
          />

          <hr className={s.hr} />
          <NavBtns />
          <p className={s.pos}>Chương {chapter.index + 1} / {allChapters.length}</p>
        </div>
      </div>
    </div>
  )
}
