'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { saveReadingEntry, incrementReadCount, updateScrollProgress } from '@/lib/readingProgress'
import { loadReaderSettings, BG_COLORS, type ReaderSettings } from '@/lib/readerSettings'
import dynamic from 'next/dynamic'
import s from './ReaderPage.module.css'

const ReaderSettingsPanel = dynamic(() => import('@/components/ReaderSettingsPanel'), { ssr: false })

type Book = { id: string; title: string }
type Chapter = { id: string; index: number; title: string; content?: string; wordCount: number }

export default function ReaderClient({ book, chapter, allChapters }: {
  book: Book; chapter: Chapter; allChapters: Chapter[]
}) {
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>(loadReaderSettings)

  const prev = allChapters.find(c => c.index === chapter.index - 1) ?? null
  const next = allChapters.find(c => c.index === chapter.index + 1) ?? null

  // Scroll to top on chapter change
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [chapter.id])

  // Track reading progress
  useEffect(() => {
    incrementReadCount(book.id)
    saveReadingEntry({
      bookId: book.id, bookTitle: book.title,
      chapterId: chapter.id, chapterTitle: chapter.title,
      chapterIndex: chapter.index, totalChapters: allChapters.length,
      progress: 0,
    })
  }, [book.id, book.title, chapter.id, chapter.title, chapter.index, allChapters.length])

  // Scroll progress
  useEffect(() => {
    const handler = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      if (total > 0) updateScrollProgress(book.id, (window.scrollY / total) * 100)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [book.id])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showSettings) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft' && prev) window.location.href = `/books/${book.id}/chapter/${prev.id}`
      if (e.key === 'ArrowRight' && next) window.location.href = `/books/${book.id}/chapter/${next.id}`
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, book.id, showSettings])

  const handleSettingsChange = useCallback((s: ReaderSettings) => setSettings(s), [])

  const bgCfg = BG_COLORS[settings.bgColor]
  const isDark = settings.bgColor === 'black'
  const fontStack = ['Roboto','Verdana','Tahoma','Patrick Hand','Dancing Script','Literata'].includes(settings.fontFamily)
    ? `'${settings.fontFamily}', sans-serif`
    : `'${settings.fontFamily}', 'Times New Roman', serif`

  const contentStyle: React.CSSProperties = {
    fontFamily: fontStack,
    fontSize: `${settings.fontSize}px`,
    lineHeight: `${settings.lineHeight}%`,
    color: bgCfg.text,
  }

  const NavBtns = ({ top }: { top: boolean }) => (
    <div className={s.navBtns}>
      {prev
        ? <Link href={`/books/${book.id}/chapter/${prev.id}`} className={s.navBtn} title="Chương trước">
            <span className={s.btnIcon}>◀</span>
            <span className={s.btnText}> Chương trước</span>
          </Link>
        : <span className={`${s.navBtn} ${s.disabled}`} title="Chương trước">
            <span className={s.btnIcon}>◀</span>
            <span className={s.btnText}> Chương trước</span>
          </span>
      }
      <Link href={`/books/${book.id}`} className={`${s.navBtn} ${s.toc}`} title="Mục lục">
        <span className={s.btnIcon}>☰</span>
        <span className={s.btnText}> Mục lục</span>
      </Link>
      {top && (
        <button className={`${s.navBtn} ${s.settingsBtn}`}
          onClick={() => setShowSettings(true)} title="Cài đặt">
          <span className={s.btnIcon}>⚙</span>
          <span className={s.btnText}> Cài đặt</span>
        </button>
      )}
      {next
        ? <Link href={`/books/${book.id}/chapter/${next.id}`} className={s.navBtn} title="Chương sau">
            <span className={s.btnText}>Chương sau </span>
            <span className={s.btnIcon}>▶</span>
          </Link>
        : <span className={`${s.navBtn} ${s.disabled}`} title="Chương sau">
            <span className={s.btnText}>Chương sau </span>
            <span className={s.btnIcon}>▶</span>
          </span>
      }
    </div>
  )

  return (
    <>
      {showSettings && (
        <ReaderSettingsPanel
          onClose={() => setShowSettings(false)}
          onChange={handleSettingsChange}
        />
      )}

      <div className={s.page} style={{ background: bgCfg.bg }}>
        <div className={s.bcBar} style={isDark ? { background: '#111827' } : {}}>
          <div className="container">
            <nav className={s.bc}>
              <Link href="/" className={s.bcLink}>⌂ Truyện</Link>
              <span className={s.bcSep}>/</span>
              <Link href={`/books/${book.id}`} className={s.bcLink}>{book.title.normalize('NFC')}</Link>
              <span className={s.bcSep}>/</span>
              <span className={s.bcCur}>{chapter.title.normalize('NFC')}</span>
            </nav>
          </div>
        </div>

        <div className={s.readerWrap}>
          <div className={s.readerCard}>
            <div className={s.chHeader}>
              <h1 className={s.bookName} style={{ color: isDark ? '#7ecfa0' : undefined }}>
                {book.title.normalize('NFC').toUpperCase()}
              </h1>
              <p className={s.chTitle} style={{
                color: isDark ? '#a0b8c0' : undefined,
                fontFamily: "'Times New Roman', serif",
                textRendering: 'optimizeLegibility',
                WebkitFontSmoothing: 'antialiased',
              }}>
                {chapter.title.normalize('NFC')}
              </p>
              <div className={s.ornament} style={{ color: isDark ? '#5a9d72' : undefined }}>— ✦ —</div>
            </div>

            <NavBtns top={true} />
            <hr className={s.hr} style={isDark ? { borderColor: 'rgba(255,255,255,0.12)' } : {}} />

            <div className={s.content} style={contentStyle}
              dangerouslySetInnerHTML={{ __html: (chapter.content ?? '').normalize('NFC') }} />

            <hr className={s.hr} style={isDark ? { borderColor: 'rgba(255,255,255,0.12)' } : {}} />
            <NavBtns top={false} />
            <p className={s.pos} style={{ color: isDark ? 'rgba(255,255,255,0.35)' : undefined }}>
              Chương {chapter.index + 1} / {allChapters.length}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
