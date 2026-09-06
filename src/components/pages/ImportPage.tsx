'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import s from './ImportPage.module.css'

type ImportResult = { fileName: string; status: string; title?: string; chapters?: number; error?: string; warnings?: string[] }

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [isDrag, setIsDrag] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ImportResult[] | null>(null)

  const accept = (fl: FileList | File[]) => {
    const arr = Array.from(fl).filter(f => /\.(docx|epub|pdf)$/i.test(f.name))
    if (arr.length) setFiles(arr)
  }

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDrag(false); accept(e.dataTransfer.files) }

  const handleImport = useCallback(async () => {
    if (!files.length) return
    setImporting(true)
    setProgress(0)
    setResults(null)

    // Send all files in one request (server parses)
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))

    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      setResults(data.results ?? [])
    } catch (err) {
      setResults([{ fileName: 'batch', status: 'error', error: String(err) }])
    } finally {
      setImporting(false)
      setProgress(100)
    }
  }, [files])

  const ext = (n: string) => n.toLowerCase().split('.').pop() ?? ''
  const badgeClass = (n: string) => ext(n) === 'epub' ? s.epubBadge : ext(n) === 'pdf' ? s.pdfBadge : s.docxBadge
  const badgeLabel = (n: string) => ext(n).toUpperCase()

  const importedCount = results?.filter(r => r.status === 'imported' || r.status === 'updated').length ?? 0

  return (
    <div className={s.page}>
      <div className="container">
        <div className={s.header}>
          <h1 className={s.title}>IMPORT TRUYỆN</h1>
          <p className={s.sub}>Chọn file <strong>.docx</strong>, <strong>.epub</strong> hoặc <strong>.pdf</strong> để import</p>
        </div>

        {!results && (
          <>
            <div ref={dropRef} className={`${s.drop} ${isDrag ? s.dragging : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDrag(true) }}
              onDragLeave={e => { if (!dropRef.current?.contains(e.relatedTarget as Node)) setIsDrag(false) }}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              tabIndex={0} role="button">
              <div className={s.dropIcon}>📂</div>
              <p className={s.dropMain}>Kéo thả file vào đây</p>
              <p className={s.dropOr}>hoặc</p>
              <span className={s.dropBtn}>Chọn file</span>
              <p className={s.dropHint}>Hỗ trợ .docx · .epub · .pdf · nhiều file cùng lúc</p>
              <input ref={fileRef} type="file" accept=".docx,.epub,.pdf" multiple style={{ display: 'none' }}
                onChange={e => e.target.files && accept(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div className={s.fileList}>
                <div className={s.fileListHeader}>
                  <strong>ĐÃ CHỌN {files.length} FILE</strong>
                  <button onClick={() => setFiles([])} className={s.clearBtn}>Xóa tất cả</button>
                </div>
                {files.map((f, i) => (
                  <div key={i} className={s.fileItem}>
                    <span>{ext(f.name) === 'epub' ? '📗' : ext(f.name) === 'pdf' ? '📕' : '📄'}</span>
                    <span className={s.fileName}>{f.name}</span>
                    <span className={`${s.badge} ${badgeClass(f.name)}`}>{badgeLabel(f.name)}</span>
                    <span className={s.fileSize}>{(f.size/1024).toFixed(0)} KB</span>
                  </div>
                ))}
                <button className={s.importBtn} onClick={handleImport} disabled={importing}>
                  {importing ? `Đang xử lý...` : `Phân tích và import ${files.length} file`}
                </button>
              </div>
            )}
          </>
        )}

        {importing && (
          <div className={s.importing}>
            <div className={s.spinner}>⚙️</div>
            <p>Đang phân tích và lưu vào database...</p>
            <p className={s.note}>File lớn hoặc nhiều file có thể mất vài phút.</p>
          </div>
        )}

        {results && (
          <div className={s.results}>
            <div className={s.resultHeader}>
              <h2>✅ Đã xử lý {files.length} file — Import thành công: {importedCount}</h2>
            </div>
            {results.map((r, i) => (
              <div key={i} className={`${s.resultItem} ${r.status === 'error' ? s.resultError : r.status === 'updated' ? s.resultUpdated : s.resultOk}`}>
                <span className={s.resultIcon}>{r.status === 'error' ? '✗' : r.status === 'updated' ? '↺' : '✓'}</span>
                <div className={s.resultInfo}>
                  <span className={s.resultFile}>{r.fileName}</span>
                  {r.title && <span className={s.resultTitle}>{r.title} — {r.chapters} chương</span>}
                  {r.error && <span className={s.resultErrMsg}>{r.error}</span>}
                  {r.warnings?.map((w, wi) => <span key={wi} className={s.resultWarn}>⚠ {w}</span>)}
                </div>
                <span className={s.resultStatus}>
                  {r.status === 'imported' && 'Đã import'}
                  {r.status === 'updated' && 'Đã cập nhật'}
                  {r.status === 'error' && 'Lỗi'}
                </span>
              </div>
            ))}
            <div className={s.resultActions}>
              <button className={s.importMoreBtn} onClick={() => { setFiles([]); setResults(null) }}>Import thêm</button>
              <button className={s.libraryBtn} onClick={() => router.push('/')}>Về thư viện</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
