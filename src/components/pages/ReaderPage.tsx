'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { saveReadingEntry, incrementReadCount, updateScrollProgress } from '@/lib/readingProgress'
import { loadReaderSettings, BG_COLORS, type ReaderSettings } from '@/lib/readerSettings'
import dynamic from 'next/dynamic'
import s from './ReaderPage.module.css'

const ReaderSettingsPanel = dynamic(() => import('@/components/ReaderSettingsPanel'), { ssr: false })
const ChapterEditor = dynamic(() => import('@/components/ChapterEditor'), { ssr: false })

type Book = { id: string; title: string }
type Chapter = { id: string; index: number; title: string; content?: string; wordCount: number }

export default function ReaderClient({ book, chapter, allChapters }: {
  book: Book; chapter: Chapter; allChapters: Chapter[]
}) {
  const [showSettings, setShowSettings] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [chapterData, setChapterData] = useState(chapter)
  const [settings, setSettings] = useState<ReaderSettings>(loadReaderSettings)

  // Expanded chapters (loaded on demand via "Mở rộng")
  const [extraChapters, setExtraChapters] = useState<Chapter[]>([])
  const [expanding, setExpanding] = useState(false)
  const [autoLoaded, setAutoLoaded] = useState(false)

  // The last chapter currently shown
  const lastShownIndex = extraChapters.length > 0
    ? extraChapters[extraChapters.length - 1].index
    : chapter.index

  // Tự động load 2 chương tiếp khi mở trang
  useEffect(() => {
    if (autoLoaded) return
    setAutoLoaded(true)
    const toLoad = allChapters.filter(c => c.index > chapter.index).slice(0, 2)
    if (toLoad.length === 0) return
    Promise.all(
      toLoad.map(c =>
        fetch(`/api/books/${book.id}/chapters/${c.id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(loaded => {
      const valid = loaded.filter(Boolean) as Chapter[]
      if (valid.length > 0) setExtraChapters(valid)
    })
  }, [autoLoaded, allChapters, book.id, chapter.index])

  const handleExpand = async () => {
    if (expanding) return
    setExpanding(true)
    try {
      const toLoad = allChapters
        .filter(c => c.index > lastShownIndex)
        .slice(0, 3)
      const loaded = await Promise.all(
        toLoad.map(c =>
          fetch(`/api/books/${book.id}/chapters/${c.id}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      )
      const valid = loaded.filter(Boolean) as Chapter[]
      setExtraChapters(prev => [...prev, ...valid])
    } finally {
      setExpanding(false)
    }
  }

  const prev = allChapters.find(c => c.index === chapter.index - 1) ?? null
  const nextChapter = allChapters.find(c => c.index === chapter.index + 1) ?? null

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
      if (e.key === 'ArrowRight' && nextChapter) window.location.href = `/books/${book.id}/chapter/${nextChapter.id}`
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, nextChapter, book.id, showSettings])

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
      {top && (
        <button className={`${s.navBtn} ${s.editChBtn}`}
          onClick={() => setShowEditor(true)} title="Sửa chương">
          <span className={s.btnIcon}>✏</span>
          <span className={s.btnText}> Sửa chương</span>
        </button>
      )}
      {!top && lastShownIndex < allChapters[allChapters.length - 1]?.index && (
        <button
          className={`${s.navBtn} ${s.expandBtn} ${expanding ? s.expanding : ''}`}
          onClick={handleExpand}
          disabled={expanding}
          title="Mở rộng 5 chương tiếp theo"
        >
          <span className={s.btnIcon}>{expanding ? '⏳' : '⤵'}</span>
          <span className={s.btnText}> {expanding ? 'Đang tải...' : 'Mở rộng'}</span>
        </button>
      )}
      {nextChapter
        ? <Link href={`/books/${book.id}/chapter/${nextChapter.id}`} className={s.navBtn} title="Chương sau">
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

      {showEditor && (
        <ChapterEditor
          bookId={book.id}
          chapterId={chapterData.id}
          initialTitle={chapterData.title}
          onClose={() => setShowEditor(false)}
          onSaved={async () => {
            // reload chapter content after edit
            try {
              const res = await fetch(`/api/books/${book.id}/chapters/${chapterData.id}`)
              if (res.ok) {
                const fresh = await res.json()
                setChapterData(prev => ({ ...prev, title: fresh.title, content: fresh.content }))
              }
            } catch {}
          }}
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
                <Link href={`/books/${book.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {book.title.normalize('NFC').toUpperCase()}
                </Link>
              </h1>
              <p className={s.chTitle} style={{
                color: isDark ? '#a0b8c0' : undefined,
                fontFamily: "'Times New Roman', serif",
                textRendering: 'optimizeLegibility',
                WebkitFontSmoothing: 'antialiased',
              }}>
                {chapterData.title.normalize('NFC')}
              </p>
              <div className={s.ornament} style={{ color: isDark ? '#5a9d72' : undefined }}>— ✦ —</div>
            </div>

            <NavBtns top={true} />
            <hr className={s.hr} style={isDark ? { borderColor: 'rgba(255,255,255,0.12)' } : {}} />

            <div className={s.content} style={contentStyle}
              dangerouslySetInnerHTML={{ __html: (chapterData.content ?? '').normalize('NFC') }} />

            <hr className={s.hr} style={isDark ? { borderColor: 'rgba(255,255,255,0.12)' } : {}} />
            <NavBtns top={false} />
            <p className={s.pos} style={{ color: isDark ? 'rgba(255,255,255,0.35)' : undefined }}>
              Chương {chapter.index + 1} / {allChapters.length}
            </p>

            {/* Extra chapters loaded by "Mở rộng" */}
            {extraChapters.map((ch, i) => (
              <div key={ch.id} className={s.extraChapter}>
                <hr className={s.hr} style={isDark ? { borderColor: 'rgba(255,255,255,0.12)' } : {}} />
                <div className={s.chHeader}>
                  <p className={s.chTitle} style={{
                    color: isDark ? '#a0b8c0' : undefined,
                    fontFamily: "'Times New Roman', serif",
                  }}>
                    {ch.title.normalize('NFC')}
                  </p>
                  <div className={s.ornament} style={{ color: isDark ? '#5a9d72' : undefined }}>— ✦ —</div>
                </div>
                <div className={s.content} style={contentStyle}
                  dangerouslySetInnerHTML={{ __html: (ch.content ?? '').normalize('NFC') }} />
                <p className={s.pos} style={{ color: isDark ? 'rgba(255,255,255,0.35)' : undefined }}>
                  Chương {ch.index + 1} / {allChapters.length}
                </p>
                {/* Show nav again after the last extra chapter */}
                {i === extraChapters.length - 1 && (
                  <NavBtns top={false} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
