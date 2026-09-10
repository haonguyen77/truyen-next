'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import s from './ChapterEditor.module.css'

interface Props {
  bookId: string
  chapterId: string
  initialTitle: string
  onClose: () => void
  onSaved?: (data: { id: string; title: string; wordCount: number }) => void
}

export default function ChapterEditor({ bookId, chapterId, initialTitle, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // Load current chapter content
  useEffect(() => {
    let alive = true
    fetch(`/api/books/${bookId}/chapters/${chapterId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!alive) return
        if (data) {
          setTitle(data.title ?? initialTitle)
          if (editorRef.current) editorRef.current.innerHTML = (data.content ?? '').normalize('NFC')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapterId])

  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); editorRef.current?.focus() }

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html')
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
  }, [])

  const insertImage = () => {
    const i = document.createElement('input')
    i.type = 'file'; i.accept = 'image/*'
    i.onchange = () => {
      const f = i.files?.[0]; if (!f) return
      const r = new FileReader()
      r.onload = ev => exec('insertHTML', `<img src="${ev.target?.result}" style="max-width:100%" />`)
      r.readAsDataURL(f)
    }
    i.click()
  }

  const handleSave = async () => {
    if (!editorRef.current) return
    setSaving(true)
    try {
      const content = editorRef.current.innerHTML
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || initialTitle, content }),
      })
      const data = await res.json()
      onSaved?.({ id: chapterId, title: data.title, wordCount: data.wordCount })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className={s.overlay}>
      <div className={s.panel}>
        <div className={s.topbar}>
          <span className={s.topTitle}>✏ Sửa chương</span>
          <div className={s.topActions}>
            <button className={s.cancelBtn} onClick={onClose} disabled={saving}>Hủy</button>
            <button className={s.saveBtn} onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>

        <input className={s.titleInput} value={title} placeholder="Tên chương..."
          onChange={e => setTitle(e.target.value)} />

        <div className={s.toolbar}>
          {[['B', 'bold'], ['I', 'italic'], ['U', 'underline'], ['S', 'strikeThrough']].map(([l, c]) => (
            <button key={c} className={s.toolBtn} onClick={() => exec(c)} title={c}>
              <span style={c === 'bold' ? { fontWeight: 700 } : c === 'italic' ? { fontStyle: 'italic' } : c === 'underline' ? { textDecoration: 'underline' } : { textDecoration: 'line-through' }}>{l}</span>
            </button>
          ))}
          <span className={s.sep} />
          {[['H1', 'h1'], ['H2', 'h2'], ['¶', 'p']].map(([l, tag]) => (
            <button key={tag} className={s.toolBtn} onClick={() => exec('formatBlock', tag)}>{l}</button>
          ))}
          <span className={s.sep} />
          <button className={s.toolBtnIcon} onClick={insertImage}>🖼 Hình</button>
          <span className={s.sep} />
          <button className={s.toolBtn} onClick={() => exec('undo')}>↩</button>
          <button className={s.toolBtn} onClick={() => exec('redo')}>↪</button>
        </div>

        {loading && <div className={s.loading}>Đang tải nội dung...</div>}
        <div ref={editorRef} className={s.editor} contentEditable={!loading} suppressContentEditableWarning
          onPaste={handlePaste} data-placeholder="Nội dung chương..." spellCheck={false}
          style={loading ? { visibility: 'hidden' } : undefined} />
      </div>
    </div>
  )
}
