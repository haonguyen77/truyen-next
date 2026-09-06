'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import s from './ImportPage.module.css'

type ImportResult = {
  fileName: string; status: string; title?: string
  chapters?: number; error?: string; warnings?: string[]
}

// Predefined genres for quick selection
const GENRE_PRESETS = [
  'Ngôn tình', 'Xuyên không', 'Huyền huyễn', 'Tu tiên', 'Tiên hiệp',
  'Đô thị', 'Hệ thống', 'Dị giới', 'Phiêu lưu', 'Cổ đại',
  'Trọng sinh', 'Học đường', 'Cung đấu', 'Thể thao', 'Lịch sử',
  'Kinh dị', 'Huyền bí', 'Hài hước', 'Ngắn', 'Hoàn',
]

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [isDrag, setIsDrag] = useState(false)
  const [genres, setGenres] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState('')

  const [importing, setImporting] = useState(false)
  const [currentFile, setCurrentFile] = useState('')
  const [processed, setProcessed] = useState(0)
  const [results, setResults] = useState<ImportResult[] | null>(null)

  const accept = (fl: FileList | File[]) => {
    const arr = Array.from(fl).filter(f => /\.(docx|epub|pdf)$/i.test(f.name))
    if (arr.length) setFiles(arr)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDrag(false); accept(e.dataTransfer.files)
  }

  // Add genre from input
  const addGenre = (g: string) => {
    const trimmed = g.trim()
    if (trimmed && !genres.includes(trimmed)) {
      setGenres(prev => [...prev, trimmed])
    }
    setGenreInput('')
  }

  const removeGenre = (g: string) => setGenres(prev => prev.filter(x => x !== g))

  const togglePreset = (g: string) => {
    if (genres.includes(g)) removeGenre(g)
    else setGenres(prev => [...prev, g])
  }

  // Send ONE file at a time to avoid Vercel 4.5MB limit
  const handleImport = useCallback(async () => {
    if (!files.length) return
    setImporting(true)
    setProcessed(0)
    setResults(null)

    const allResults: ImportResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setCurrentFile(file.name)
      setProcessed(i + 1)

      const fd = new FormData()
      fd.append('files', file)
      // Pass genres as JSON string
      fd.append('genres', JSON.stringify(genres))

      try {
        const res = await fetch('/api/import', { method: 'POST', body: fd })

        // Check content-type before parsing JSON
        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          const text = await res.text()
          allResults.push({
            fileName: file.name, status: 'error',
            error: `Server error: ${text.slice(0, 200)}`,
          })
          continue
        }

        const data = await res.json()
        if (data.results) {
          allResults.push(...data.results)
        } else {
          allResults.push({ fileName: file.name, status: 'error', error: data.error ?? 'Unknown error' })
        }
      } catch (err) {
        allResults.push({ fileName: file.name, status: 'error', error: String(err) })
      }

      // Small delay between files to avoid rate limiting
      await new Promise(r => setTimeout(r, 100))
    }

    setResults(allResults)
    setImporting(false)
    setCurrentFile('')
  }, [files, genres])

  const ext = (n: string) => n.toLowerCase().split('.').pop() ?? ''
  const badgeClass = (n: string) => ext(n) === 'epub' ? s.epubBadge : ext(n) === 'pdf' ? s.pdfBadge : s.docxBadge
  const badgeLabel = (n: string) => ext(n).toUpperCase()

  const importedCount = results?.filter(r => r.status === 'imported' || r.status === 'updated').length ?? 0
  const progressPct = files.length > 0 ? Math.round((processed / files.length) * 100) : 0

  return (
    <div className={s.page}>
      <div className="container">
        <div className={s.header}>
          <h1 className={s.title}>IMPORT TRUYỆN</h1>
          <p className={s.sub}>Chọn file <strong>.docx</strong>, <strong>.epub</strong> hoặc <strong>.pdf</strong> để import</p>
        </div>

        {!results && (
          <>
            {/* Drop zone */}
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
              <input ref={fileRef} type="file" accept=".docx,.epub,.pdf" multiple
                style={{ display: 'none' }}
                onChange={e => e.target.files && accept(e.target.files)} />
            </div>

            {/* Genre selector */}
            <div className={s.genreSection}>
              <div className={s.genreHeader}>
                <span className={s.genreTitle}>🏷 Thể loại</span>
                <span className={s.genreDesc}>Chọn thể loại để gán cho tất cả truyện vừa import</span>
              </div>

              {/* Preset chips */}
              <div className={s.presetWrap}>
                {GENRE_PRESETS.map(g => (
                  <button key={g}
                    className={`${s.presetChip} ${genres.includes(g) ? s.presetActive : ''}`}
                    onClick={() => togglePreset(g)}
                    type="button">
                    {genres.includes(g) ? '✓ ' : '+ '}{g}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className={s.genreInputRow}>
                <input
                  className={s.genreInput}
                  placeholder="Nhập thể loại tùy chỉnh..."
                  value={genreInput}
                  onChange={e => setGenreInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addGenre(genreInput)
                    }
                  }}
                />
                <button className={s.genreAddBtn} onClick={() => addGenre(genreInput)} type="button">
                  Thêm
                </button>
              </div>

              {/* Selected genres */}
              {genres.length > 0 && (
                <div className={s.selectedGenres}>
                  <span className={s.selectedLabel}>Đã chọn:</span>
                  {genres.map(g => (
                    <span key={g} className={s.genreTag}>
                      {g}
                      <button onClick={() => removeGenre(g)} className={s.genreRemove}>✕</button>
                    </span>
                  ))}
                  <button onClick={() => setGenres([])} className={s.clearGenresBtn}>
                    Xóa tất cả
                  </button>
                </div>
              )}
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className={s.fileList}>
                <div className={s.fileListHeader}>
                  <strong>ĐÃ CHỌN {files.length} FILE</strong>
                  <button onClick={() => setFiles([])} className={s.clearBtn}>Xóa tất cả</button>
                </div>
                <div className={s.fileScroll}>
                  {files.map((f, i) => (
                    <div key={i} className={s.fileItem}>
                      <span>{ext(f.name) === 'epub' ? '📗' : ext(f.name) === 'pdf' ? '📕' : '📄'}</span>
                      <span className={s.fileName}>{f.name}</span>
                      <span className={`${s.badge} ${badgeClass(f.name)}`}>{badgeLabel(f.name)}</span>
                      <span className={s.fileSize}>{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
                <button className={s.importBtn} onClick={handleImport} disabled={importing}>
                  {importing
                    ? `Đang xử lý ${processed}/${files.length}...`
                    : `Import ${files.length} file${genres.length > 0 ? ` · ${genres.length} thể loại` : ''}`
                  }
                </button>
              </div>
            )}
          </>
        )}

        {/* Progress */}
        {importing && (
          <div className={s.importing}>
            <div className={s.progressBar}>
              <div className={s.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <p className={s.progressText}>
              <span className={s.spinner}>⚙️</span>
              Đang xử lý: <strong>{currentFile}</strong>
            </p>
            <p className={s.progressCount}>{processed} / {files.length} file ({progressPct}%)</p>
            <p className={s.note}>Mỗi file được xử lý riêng lẻ để tránh timeout.</p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className={s.results}>
            <div className={s.resultHeader}>
              <h2>
                {importedCount === results.length
                  ? `✅ Import thành công ${importedCount}/${files.length} truyện`
                  : `⚠ Đã xử lý ${results.length} file — Thành công: ${importedCount}`}
              </h2>
            </div>

            {results.map((r, i) => (
              <div key={i} className={`${s.resultItem} ${r.status === 'error' ? s.resultError : r.status === 'updated' ? s.resultUpdated : s.resultOk}`}>
                <span className={s.resultIcon}>
                  {r.status === 'error' ? '✗' : r.status === 'updated' ? '↺' : '✓'}
                </span>
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
              <button className={s.importMoreBtn} onClick={() => { setFiles([]); setResults(null) }}>
                Import thêm
              </button>
              <button className={s.libraryBtn} onClick={() => router.push('/')}>
                Về thư viện
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
