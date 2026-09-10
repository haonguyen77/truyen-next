'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BookCover from '@/components/BookCover'
import { logDeletedBook } from '@/lib/deletedBooks'
import s from './AdminBooksPage.module.css'

type Book = { id: string; title: string; author: string; description: string; cover: string; genres: string[]; chapterCount: number; sourceFileName: string; updatedAt: number }

function fmtTime(ts: number) {
  const d = Date.now() - ts
  if (d < 3600000) return `${Math.floor(d/60000)} phút trước`
  if (d < 86400000) return `${Math.floor(d/3600000)} giờ trước`
  return `${Math.floor(d/86400000)} ngày trước`
}

export default function AdminBooksClient({ initialBooks }: { initialBooks: Book[] }) {
  const router = useRouter()
  const [books, setBooks] = useState(initialBooks)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; title: string; author: string; description: string; genres: string; cover: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkModal, setBulkModal] = useState(false)
  const [bulkGenres, setBulkGenres] = useState('')

  async function handleDelete(book: Book) {
    if (!confirm(`Xóa truyện "${book.title}"?`)) return
    setDeleting(book.id)
    await fetch(`/api/books/${book.id}`, { method: 'DELETE' })
    logDeletedBook(book.title)   // log để cảnh báo khi import lại
    setBooks(prev => prev.filter(b => b.id !== book.id))
    setDeleting(null)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/books/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editing.title, author: editing.author,
        description: editing.description, cover: editing.cover,
        genres: editing.genres.split(',').map(g => g.trim()).filter(Boolean),
      }),
    })
    const updated = await res.json()
    setBooks(prev => prev.map(b => b.id === updated.id ? updated : b))
    setEditing(null)
    setSaving(false)
  }

  async function handleBulkGenres() {
    const genreList = bulkGenres.split(',').map(g => g.trim()).filter(Boolean)
    await Promise.all(Array.from(selected).map(id =>
      fetch(`/api/books/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ genres: genreList }) })
    ))
    const updated = await fetch('/api/books').then(r => r.json())
    setBooks(updated)
    setBulkModal(false)
    setBulkGenres('')
    setSelected(new Set())
  }

  const allSel = books.length > 0 && selected.size === books.length

  return (
    <div className={s.page}>
      <div className="container">
        <div className={s.pageHeader}>
          <h1 className={s.title}>QUẢN LÝ TRUYỆN</h1>
          <div className={s.headerActions}>
            <Link href="/admin/write" className={s.writeBtn}>✏ Viết truyện</Link>
            <Link href="/admin/import" className={s.importBtn}>+ Import truyện</Link>
          </div>
        </div>

        {selected.size > 0 && (
          <div className={s.bulkBar}>
            <span className={s.bulkCount}>Đã chọn {selected.size} truyện</span>
            <button className={s.bulkGenreBtn} onClick={() => { setBulkGenres(''); setBulkModal(true) }}>🏷 Sửa thể loại hàng loạt</button>
            <button className={s.bulkClearBtn} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
          </div>
        )}

        {books.length === 0 ? (
          <div className={s.empty}><p>Chưa có truyện nào.</p><Link href="/admin/import" className={s.importLink}>Import ngay →</Link></div>
        ) : (
          <div className={s.table}>
            <div className={s.thead}>
              <span><input type="checkbox" checked={allSel} onChange={() => setSelected(allSel ? new Set() : new Set(books.map(b => b.id)))} /></span>
              <span />
              <span>Tên truyện</span>
              <span>Thể loại</span>
              <span>Chương</span>
              <span>Cập nhật</span>
              <span>Thao tác</span>
            </div>
            {books.map(book => (
              <div key={book.id} className={`${s.trow} ${selected.has(book.id) ? s.rowSel : ''}`}>
                <span className={s.checkCell}>
                  <input type="checkbox" checked={selected.has(book.id)}
                    onChange={() => setSelected(prev => { const s = new Set(prev); s.has(book.id) ? s.delete(book.id) : s.add(book.id); return s })} />
                </span>
                <span><BookCover title={book.title} cover={book.cover} size={32} radius={4} /></span>
                <div className={s.bookInfo}>
                  <span className={s.bookTitle}>{book.title}</span>
                  {book.author && <span className={s.bookAuthor}>{book.author}</span>}
                  <span className={s.bookFile}>{book.sourceFileName}</span>
                </div>
                <span className={s.genreCell}>
                  {book.genres.length > 0 ? book.genres.slice(0,2).map(g => <span key={g} className={s.genreTag}>{g}</span>) : <span className={s.noGenre}>—</span>}
                </span>
                <span className={s.cell}>{book.chapterCount}</span>
                <span className={`${s.cell} ${s.dateCell}`}>{fmtTime(book.updatedAt)}</span>
                <div className={s.actions}>
                  <button className={s.viewBtn} onClick={() => router.push(`/books/${book.id}`)}>Xem</button>
                  <button className={s.editBtn} onClick={() => setEditing({ id: book.id, title: book.title, author: book.author, description: book.description, genres: book.genres.join(', '), cover: book.cover })}>Sửa</button>
                  <button className={s.delBtn} onClick={() => handleDelete(book)} disabled={deleting === book.id}>{deleting === book.id ? '...' : 'Xóa'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={s.stats}>Tổng: {books.length} truyện</div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className={s.overlay} onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className={s.modal}>
            <h2 className={s.modalTitle}>Sửa thông tin truyện</h2>
            {['title','author','genres','description'].map(field => (
              <div key={field} className={s.formGroup}>
                <label className={s.label}>{field === 'title' ? 'Tên truyện *' : field === 'author' ? 'Tác giả' : field === 'genres' ? 'Thể loại' : 'Mô tả'}</label>
                {field === 'description'
                  ? <textarea className={s.textarea} rows={3} value={(editing as Record<string,string>)[field]} onChange={e => setEditing(prev => prev ? { ...prev, [field]: e.target.value } : prev)} />
                  : <input className={s.input} value={(editing as Record<string,string>)[field]} onChange={e => setEditing(prev => prev ? { ...prev, [field]: e.target.value } : prev)} />
                }
              </div>
            ))}
            <div className={s.modalActions}>
              <button className={s.cancelBtn} onClick={() => setEditing(null)}>Hủy</button>
              <button className={s.saveBtn} onClick={handleSave} disabled={saving || !editing.title.trim()}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk genre modal */}
      {bulkModal && (
        <div className={s.overlay} onClick={e => e.target === e.currentTarget && setBulkModal(false)}>
          <div className={s.modal}>
            <h2 className={s.modalTitle}>Sửa thể loại — {selected.size} truyện</h2>
            <div className={s.formGroup}>
              <label className={s.label}>Thể loại mới (cách bằng dấu phẩy)</label>
              <input className={s.input} value={bulkGenres} onChange={e => setBulkGenres(e.target.value)} autoFocus placeholder="Ngôn tình, Xuyên không, ..." />
            </div>
            <div className={s.modalActions}>
              <button className={s.cancelBtn} onClick={() => setBulkModal(false)}>Hủy</button>
              <button className={s.saveBtn} onClick={handleBulkGenres}>Áp dụng cho {selected.size} truyện</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
