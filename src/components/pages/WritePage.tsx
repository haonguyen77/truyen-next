'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import BookCover from '@/components/BookCover'
import { useImageResize } from '@/lib/useImageResize'
import s from './WritePage.module.css'

function genId() { return crypto.randomUUID() }
interface ChapterDraft { id: string; title: string; content: string; isNew?: boolean }

export default function WritePage({ bookId }: { bookId?: string }) {
  const router = useRouter()
  const isEdit = !!bookId

  const [loading, setLoading] = useState(isEdit)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [genres, setGenres] = useState('')
  const [description, setDescription] = useState('')
  const [cover, setCover] = useState('')
  const [chapters, setChapters] = useState<ChapterDraft[]>([{ id: genId(), title: 'Chương 1', content: '', isNew: true }])
  const [activeIdx, setActiveIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const { selected, box, startDrag, scaleSelected } = useImageResize(editorRef)

  // Load existing book data when editing
  useEffect(() => {
    if (!bookId) return
    ;(async () => {
      try {
        const [bookRes, chsRes] = await Promise.all([
          fetch(`/api/books/${bookId}`),
          fetch(`/api/books/${bookId}/chapters`),
        ])
        const book = await bookRes.json()
        const chs = await chsRes.json()

        setTitle(book.title ?? '')
        setAuthor(book.author ?? '')
        setGenres(Array.isArray(book.genres) ? book.genres.join(', ') : '')
        setDescription(book.description ?? '')
        setCover(book.cover ?? '')

        // Load chapter content for each chapter
        const drafts: ChapterDraft[] = await Promise.all(
          (chs as { id: string; title: string }[]).map(async (c) => {
            const r = await fetch(`/api/books/${bookId}/chapters/${c.id}`)
            const full = r.ok ? await r.json() : c
            return { id: c.id, title: c.title, content: full.content ?? '', isNew: false }
          })
        )
        setChapters(drafts.length > 0 ? drafts : [{ id: genId(), title: 'Chương 1', content: '', isNew: true }])
        setActiveIdx(0)
      } finally {
        setLoading(false)
      }
    })()
  }, [bookId])

  // Set editor content when switching chapters or after loading
  useEffect(() => {
    if (loading) return
    if (editorRef.current) {
      editorRef.current.innerHTML = chapters[activeIdx]?.content ?? ''
      editorRef.current.focus()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, loading])

  const sync = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    setChapters(prev => { const n = [...prev]; n[activeIdx] = { ...n[activeIdx], content: html }; return n })
  }, [activeIdx])

  const switchChapter = (idx: number) => { sync(); setActiveIdx(idx) }

  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); editorRef.current?.focus() }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    if (html) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      doc.body.querySelectorAll('*').forEach(el => {
        el.removeAttribute('style'); el.removeAttribute('class'); el.removeAttribute('bgcolor')
        if (el.tagName === 'SPAN' && !el.querySelector('img,a,b,i,u,strong,em')) {
          const p = el.parentNode; if (p) { while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el) }
        }
      })
      exec('insertHTML', doc.body.innerHTML)
    } else {
      const paras = text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
      exec('insertHTML', paras || text)
    }
    sync()
  }

  const addChapter = () => {
    sync()
    const c: ChapterDraft = { id: genId(), title: `Chương ${chapters.length + 1}`, content: '', isNew: true }
    setChapters(prev => [...prev, c])
    setActiveIdx(chapters.length)
  }

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { alert('Vui lòng nhập tên truyện.'); return }
    setSaving(true)
    try {
      const currentContent = editorRef.current?.innerHTML ?? ''
      const finalChapters = chapters.map((c, i) =>
        i === activeIdx ? { ...c, content: currentContent } : c
      )
      const genreList = genres.split(',').map(g => g.trim()).filter(Boolean)
      const wc = (c: ChapterDraft) => c.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length

      if (isEdit && bookId) {
        // ── Edit mode: PATCH book metadata + upsert chapters ──
        await fetch(`/api/books/${bookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(), author, description, cover,
            genres: genreList, chapterCount: finalChapters.length,
          }),
        })

        // Upsert all chapters (existing ones update, new ones create)
        const res = await fetch('/api/write/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            chapters: finalChapters.map((c, i) => ({
              id: c.id, bookId, index: i, title: c.title,
              content: c.content, wordCount: wc(c),
            })),
          }),
        })
        if (!res.ok) { alert('Lỗi lưu chương'); return }
        router.push(`/books/${bookId}`)
      } else {
        // ── Create mode ──
        const newBookId = genId()
        const res = await fetch('/api/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            book: {
              id: newBookId, title: title.trim(), author, description, cover,
              genres: genreList, sourceFileName: `${title.trim()}.written`,
              sourceFileType: 'docx', chapterCount: finalChapters.length,
            },
            chapters: finalChapters.map((c, i) => ({
              id: genId(), bookId: newBookId, index: i, title: c.title,
              content: c.content, wordCount: wc(c),
            })),
          }),
        })
        const data = await res.json()
        if (!res.ok || data.error) { alert(`Lỗi lưu truyện: ${data.error ?? res.status}`); return }
        router.push(`/books/${data.bookId}`)
      }
    } catch (err) {
      alert(`Lỗi kết nối: ${String(err)}`)
    } finally { setSaving(false) }
  }

  const wc = chapters[activeIdx]?.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length ?? 0

  if (loading) {
    return (
      <div className={s.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888', fontSize: 16 }}>Đang tải truyện...</p>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <div className={s.layout}>
        <aside className={s.sidebar}>
          <div className={s.sbHeader}>
            <h2 className={s.sbTitle}>{isEdit ? 'Chỉnh sửa truyện' : 'Viết truyện mới'}</h2>
          </div>

          <div className={s.coverBlock} onClick={() => coverRef.current?.click()}>
            {cover ? <img src={cover} alt="cover" className={s.coverImg} /> : <BookCover title={title || 'Truyện'} size={90} radius={6} />}
            <span className={s.coverHover}>📎 Đổi ảnh bìa</span>
            <input ref={coverRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setCover(ev.target?.result as string); r.readAsDataURL(f) }} />
          </div>

          <div className={s.metaFields}>
            {[['Tên truyện *', title, setTitle], ['Tác giả', author, setAuthor], ['Thể loại', genres, setGenres]].map(([label, val, fn]) => (
              <div key={label as string} className={s.field}>
                <label className={s.fieldLabel}>{label as string}</label>
                <input className={s.fieldInput} value={val as string} onChange={e => (fn as (v: string) => void)(e.target.value)} placeholder={label as string} />
              </div>
            ))}
            <div className={s.field}>
              <label className={s.fieldLabel}>Mô tả</label>
              <textarea className={s.fieldTextarea} rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          <div className={s.chListSide}>
            <div className={s.chListHeader}>
              <span className={s.chListTitle}>Danh sách chương</span>
              <button className={s.addChBtn} onClick={addChapter}>+ Thêm chương</button>
            </div>
            {chapters.map((ch, i) => (
              <div key={ch.id} className={`${s.chItem} ${i === activeIdx ? s.chActive : ''}`}>
                <button className={s.chBtn} onClick={() => switchChapter(i)}>
                  <span className={s.chNum}>{i + 1}</span>
                  <span className={s.chName}>{ch.title || `Chương ${i + 1}`}</span>
                  {ch.isNew && <span className={s.newBadge}>Mới</span>}
                </button>
                {chapters.length > 1 && (
                  <button className={s.chDel} onClick={() => {
                    if (!confirm(`Xóa "${ch.title}"?`)) return
                    const n = chapters.filter((_, j) => j !== i); setChapters(n); setActiveIdx(Math.min(i, n.length - 1))
                  }}>✕</button>
                )}
              </div>
            ))}
          </div>

          <div className={s.sbFooter}>
            <button className={s.saveBtn} onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Lưu truyện'}
            </button>
            <button className={s.cancelBtn} onClick={() => router.back()}>Hủy</button>
          </div>
        </aside>

        <main className={s.editorArea}>
          <input className={s.chTitleInput} value={chapters[activeIdx]?.title ?? ''} placeholder="Tên chương..."
            onChange={e => setChapters(prev => { const n = [...prev]; n[activeIdx] = { ...n[activeIdx], title: e.target.value }; return n })} />

          <div className={s.toolbar}>
            {[['B','bold'],['I','italic'],['U','underline'],['S','strikeThrough']].map(([l,c]) => (
              <button key={c} className={s.toolBtn} onClick={() => exec(c)} title={c}><span style={c==='bold'?{fontWeight:700}:c==='italic'?{fontStyle:'italic'}:c==='underline'?{textDecoration:'underline'}:{textDecoration:'line-through'}}>{l}</span></button>
            ))}
            <span className={s.sep}/>
            {[['H1','h1'],['H2','h2'],['H3','h3'],['¶','p']].map(([l,tag]) => (
              <button key={tag} className={s.toolBtn} onClick={() => exec('formatBlock', tag)}>{l}</button>
            ))}
            <span className={s.sep}/>
            <button className={s.toolBtnIcon} onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=()=>{ const f=i.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>exec('insertHTML',`<img src="${ev.target?.result}" style="max-width:100%" />`); r.readAsDataURL(f) }; i.click() }}>🖼 Hình</button>
            <button className={s.toolBtnIcon} onClick={() => { if (!scaleSelected(0.5)) alert('Bấm vào ảnh trước để thu nhỏ.') }} title="Thu nhỏ ảnh đang chọn còn 50%">↘ 50%</button>
            <span className={s.sep}/>
            <button className={s.toolBtn} onClick={() => exec('undo')}>↩</button>
            <button className={s.toolBtn} onClick={() => exec('redo')}>↪</button>
          </div>

          <div className={s.editorWrap}>
            <div ref={editorRef} className={s.editor} contentEditable suppressContentEditableWarning
              onInput={sync} onPaste={handlePaste} data-placeholder="Bắt đầu viết nội dung..." spellCheck={false} />
            {selected && box && (
              <div className={s.resizeBox} style={{ top: box.top, left: box.left, width: box.width, height: box.height }}>
                <span className={`${s.handle} ${s.hSE}`} onMouseDown={startDrag} />
              </div>
            )}
          </div>

          <div className={s.editorFooter}>
            <span>{wc} từ</span>
            <span>Chương {activeIdx + 1} / {chapters.length}</span>
          </div>
        </main>
      </div>
    </div>
  )
}
