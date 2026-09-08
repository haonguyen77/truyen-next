'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import BookCover from '@/components/BookCover'
import { removeFromHistory, removeReadCount } from '@/lib/readingProgress'
import { isFavorite, toggleFavorite } from '@/lib/favorites'
import s from './BookDetailPage.module.css'

type Book = { id: string; title: string; author: string; description: string; cover: string; genres: string[]; chapterCount: number }
type Chapter = { id: string; index: number; title: string; wordCount: number }

export default function BookDetailClient({ book: initBook, chapters: initChapters }: { book: Book; chapters: Chapter[] }) {
  const router = useRouter()
  const [book, setBook] = useState(initBook)
  const [chapters, setChapters] = useState(initChapters)
  const [chapterEditMode, setChapterEditMode] = useState(false)
  const [editing, setEditing] = useState<{ title: string; author: string; description: string; genres: string; cover: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)

  // Load favorite state on client
  useEffect(() => {
    setFavorited(isFavorite(book.id))
  }, [book.id])

  const handleToggleFavorite = () => {
    const isNowFav = toggleFavorite({
      bookId: book.id,
      bookTitle: book.title,
      cover: book.cover,
      chapterCount: book.chapterCount,
    })
    setFavorited(isNowFav)
  }

  const emptyCount = chapters.filter(c => c.wordCount === 0).length

  // ── Edit ──
  function openEdit() {
    setEditing({ title: book.title, author: book.author, description: book.description, genres: book.genres.join(', '), cover: book.cover })
  }
  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editing.title.trim() || book.title,
          author: editing.author.trim(),
          description: editing.description.trim(),
          genres: editing.genres.split(',').map(g => g.trim()).filter(Boolean),
          cover: editing.cover,
        }),
      })
      const updated = await res.json()
      setBook(updated)
      setEditing(null)
    } finally { setSaving(false) }
  }
  function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editing) return
    const reader = new FileReader()
    reader.onload = ev => setEditing(prev => prev ? { ...prev, cover: ev.target?.result as string } : prev)
    reader.readAsDataURL(file)
  }

  // ── Delete empty chapters ──
  async function handleDeleteEmpty() {
    const empty = chapters.filter(c => c.wordCount === 0)
    if (empty.length === 0) { alert('Không có chương rỗng.'); return }
    if (!confirm(`Xóa ${empty.length} chương rỗng?`)) return
    await Promise.all(empty.map(c => fetch(`/api/books/${book.id}/chapters/${c.id}`, { method: 'DELETE' })))
    const newChs = chapters.filter(c => c.wordCount > 0)
    setChapters(newChs)
    await fetch(`/api/books/${book.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chapterCount: newChs.length }) })
    setBook(prev => ({ ...prev, chapterCount: newChs.length }))
  }

  // ── Delete single chapter ──
  async function handleDeleteChapter(ch: Chapter) {
    if (!confirm(`Xóa chương "${ch.title}"?`)) return
    await fetch(`/api/books/${book.id}/chapters/${ch.id}`, { method: 'DELETE' })
    const newChs = chapters.filter(c => c.id !== ch.id)
    setChapters(newChs)
    await fetch(`/api/books/${book.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chapterCount: newChs.length }) })
    setBook(prev => ({ ...prev, chapterCount: newChs.length }))
  }

  // ── Delete book ──
  async function handleDeleteBook() {
    if (!confirm(`Xóa truyện "${book.title}"?\n\nToàn bộ chương sẽ bị xóa.`)) return
    setDeleting(true)
    await fetch(`/api/books/${book.id}`, { method: 'DELETE' })
    removeFromHistory(book.id)
    removeReadCount(book.id)
    router.push('/')
  }

  return (
    <div className={s.page}>
      <div className="container">
        {/* Breadcrumb */}
        <nav className={s.bc}>
          <Link href="/" className={s.bcLink}>⌂ Thư viện</Link>
          <span className={s.bcSep}>/</span>
          <span className={s.bcCur}>{book.title}</span>
        </nav>

        {/* Book info */}
        <div className={s.bookInfo}>
          <BookCover title={book.title} cover={book.cover} size={80} radius={8} />
          <div className={s.meta}>
            <div className={s.titleRow}>
              <h1 className={s.title}>{book.title}</h1>
              <div className={s.actionBtns}>
                <button
                  className={`${s.favBtn} ${favorited ? s.favActive : ''}`}
                  onClick={handleToggleFavorite}
                  title={favorited ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
                >
                  {favorited ? '❤' : '♡'} {favorited ? 'Yêu thích' : 'Yêu thích'}
                </button>
                <button className={s.editBtn} onClick={openEdit}>✏ Sửa</button>
                {emptyCount > 0 && (
                  <button className={s.warnBtn} onClick={handleDeleteEmpty}>
                    🗑 Xóa {emptyCount} chương rỗng
                  </button>
                )}
                <button className={s.delBtn} onClick={handleDeleteBook} disabled={deleting}>
                  🗑 Xóa truyện
                </button>
              </div>
            </div>
            {book.author && <p className={s.author}><span className={s.lbl}>Tác giả:</span> {book.author}</p>}
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

        {/* Chapter list */}
        <div className={s.chSection}>
          <div className={s.chHeader}>
            <h2 className={s.chTitle}>DANH SÁCH CHƯƠNG</h2>
            <button
              className={`${s.editModeBtn} ${chapterEditMode ? s.editModeActive : ''}`}
              onClick={() => setChapterEditMode(v => !v)}>
              {chapterEditMode ? '✓ Xong' : '✏ Chỉnh sửa chương'}
            </button>
          </div>
          {chapters.length === 0
            ? <p className={s.noChap}>Không có chương nào.</p>
            : chapters.map(ch => (
              <div key={ch.id} className={`${s.chRow} ${ch.wordCount === 0 ? s.chEmpty : ''}`}>
                <Link href={`/books/${book.id}/chapter/${ch.id}`} className={s.chLink}>
                  <span className={s.chIcon}>✹</span>
                  <span className={s.chName}>{ch.title}</span>
                  {ch.wordCount === 0
                    ? <span className={s.emptyBadge}>Rỗng</span>
                    : ch.wordCount > 0 && <span className={s.chWords}>{ch.wordCount.toLocaleString()} từ</span>
                  }
                </Link>
                {chapterEditMode && (
                  <button className={s.chDelBtn} onClick={() => handleDeleteChapter(ch)} title="Xóa chương">🗑</button>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className={s.overlay} onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className={s.modal}>
            <h2 className={s.modalTitle}>Sửa thông tin truyện</h2>

            {/* Cover */}
            <div className={s.coverSection}>
              <div className={s.coverPreview} onClick={() => coverRef.current?.click()} style={{ cursor: 'pointer' }}>
                <BookCover title={editing.title} cover={editing.cover || undefined} size={72} radius={6} />
                <span className={s.coverHint}>📎 Đổi ảnh</span>
              </div>
              <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverFile} />
              {editing.cover && (
                <button className={s.coverRemove} onClick={() => setEditing(p => p ? { ...p, cover: '' } : p)}>Xóa ảnh</button>
              )}
            </div>

            {[
              ['Tên truyện *', 'title', false],
              ['Tác giả', 'author', false],
              ['Thể loại', 'genres', false],
              ['Mô tả', 'description', true],
            ].map(([label, field, isArea]) => (
              <div key={field as string} className={s.formGroup}>
                <label className={s.label}>{label as string}</label>
                {isArea
                  ? <textarea className={s.textarea} rows={3}
                      value={(editing as Record<string, string>)[field as string]}
                      onChange={e => setEditing(p => p ? { ...p, [field as string]: e.target.value } : p)} />
                  : <input className={s.input}
                      value={(editing as Record<string, string>)[field as string]}
                      onChange={e => setEditing(p => p ? { ...p, [field as string]: e.target.value } : p)}
                      placeholder={field === 'genres' ? 'Ngôn tình, Xuyên không, ... (cách bằng dấu phẩy)' : ''} />
                }
              </div>
            ))}

            <div className={s.modalActions}>
              <button className={s.cancelBtn} onClick={() => setEditing(null)}>Hủy</button>
              <button className={s.saveBtn} onClick={handleSave} disabled={saving || !editing.title.trim()}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
