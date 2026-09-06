'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import s from './ImportPage.module.css'

type ImportResult = {
  fileName: string; status: string; title?: string
  chapters?: number; error?: string; warnings?: string[]
}

const ALL_GENRES = [
  'Ngôn tình', 'Xuyên không', 'Huyền huyễn', 'Tu tiên', 'Tiên hiệp',
  'Đô thị', 'Hệ thống', 'Dị giới', 'Phiêu lưu', 'Cổ đại',
  'Trọng sinh', 'Học đường', 'Cung đấu', 'Thể thao', 'Lịch sử',
  'Kinh dị', 'Huyền bí', 'Hài hước', 'Ngắn', 'Hoàn', 'Sắc',
]

const USAGE_KEY = 'genre-usage-counts'

function loadUsage(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}') } catch { return {} }
}
function saveUsage(counts: Record<string, number>) {
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(counts)) } catch {}
}

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [isDrag, setIsDrag] = useState(false)

  // Genre state
  const [selected, setSelected] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})

  // Sort genres: selected first → then by usage → then alphabetical
  const sortedGenres = [...ALL_GENRES].sort((a, b) => {
    const aSelected = selected.includes(a) ? 1 : 0
    const bSelected = selected.includes(b) ? 1 : 0
    if (aSelected !== bSelected) return bSelected - aSelected
    return (usageCounts[b] ?? 0) - (usageCounts[a] ?? 0)
  })

  const visibleGenres = expanded ? sortedGenres : sortedGenres.slice(0, 10)

  useEffect(() => { setUsageCounts(loadUsage()) }, [])

  const toggleGenre = (g: string) => {
    setSelected(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    )
  }

  const addCustom = (val: string) => {
    const trimmed = val.trim()
    if (trimmed && !selected.includes(trimmed)) {
      setSelected(prev => [...prev, trimmed])
    }
    setCustomInput('')
  }

  const removeGenre = (g: string) => setSelected(prev => prev.filter(x => x !== g))

  // Import state
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

  const handleImport = useCallback(async () => {
    if (!files.length) return
    setImporting(true)
    setProcessed(0)
    setResults(null)

    // Update usage counts for selected genres
    if (selected.length > 0) {
      const counts = loadUsage()
      selected.forEach(g => { counts[g] = (counts[g] ?? 0) + 1 })
      saveUsage(counts)
      setUsageCounts(counts)
    }

    const allResults: ImportResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setCurrentFile(file.name)
      setProcessed(i + 1)

      const fd = new FormData()
      fd.append('files', file)
      fd.append('genres', JSON.stringify(selected))

      try {
        const res = await fetch('/api/import', { method: 'POST', body: fd })
        const contentType = res.headers.get('content-type') ?? ''

        if (!contentType.includes('application/json')) {
          const text = await res.text()
          allResults.push({
            fileName: file.name, status: 'error',
            error: `Server error (${res.status}): ${text.slice(0, 300)}`,
          })
          continue
        }

        const data = await res.json()
        if (data.results) allResults.push(...data.results)
        else allResults.push({ fileName: file.name, status: 'error', error: data.error ?? 'Unknown error' })
      } catch (err) {
        allResults.push({ fileName: file.name, status: 'error', error: String(err) })
      }

      await new Promise(r => setTimeout(r, 80))
    }

    setResults(allResults)
    setImporting(false)
    setCurrentFile('')
  }, [files, selected])

  const ext = (n: string) => n.toLowerCase().split('.').pop() ?? ''
  const badgeClass = (n: string) => ext(n) === 'epub' ? s.epubBadge : ext(n) === 'pdf' ? s.pdfBadge : s.docxBadge
  const importedCount = results?.filter(r => r.status === 'imported' || r.status === 'updated').length ?? 0
  const progressPct = files.length > 0 ? Math.round((processed / files.length) * 100) : 0

  return (
    <div className={s.page}>
      <div className="container">
        <div className={s.header}>
          <h1 className={s.title}>IMPORT TRUYỆN</h1>
          <p className={s.sub}>Chọn file <strong>.docx</strong>, <strong>.epub</strong> hoặc <strong>.pdf</strong></p>
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
                <span className={s.genreDesc}>Gán thể loại cho tất cả truyện trong lần import này</span>
              </div>

              {/* One-row chips + expand button */}
              <div className={s.chipsRow}>
                {visibleGenres.map(g => (
                  <button key={g} type="button"
                    className={`${s.chip} ${selected.includes(g) ? s.chipActive : ''}`}
                    onClick={() => toggleGenre(g)}>
                    {selected.includes(g) && <span className={s.chipCheck}>✓</span>}
                    {g}
                    {(usageCounts[g] ?? 0) > 0 && !selected.includes(g) && (
                      <span className={s.chipCount}>{usageCounts[g]}</span>
                    )}
                  </button>
                ))}
                <button type="button" className={s.expandBtn} onClick={() => setExpanded(v => !v)}>
                  {expanded ? '▲ Thu gọn' : `▼ Thêm (${sortedGenres.length - 10})`}
                </button>
              </div>

              {/* Custom input */}
              <div className={s.customRow}>
                <input className={s.customInput}
                  placeholder="Nhập thể loại khác... (Enter để thêm)"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(customInput) } }} />
                <button type="button" className={s.customAddBtn} onClick={() => addCustom(customInput)}>
                  Thêm
                </button>
                {selected.length > 0 && (
                  <button type="button" className={s.clearAllBtn} onClick={() => setSelected([])}>
                    Xóa hết
                  </button>
                )}
              </div>

              {/* Selected tags */}
              {selected.length > 0 && (
                <div className={s.selectedRow}>
                  <span className={s.selectedLabel}>Đã chọn:</span>
                  {selected.map(g => (
                    <span key={g} className={s.tag}>
                      {g}
                      <button type="button" className={s.tagRemove} onClick={() => removeGenre(g)}>✕</button>
                    </span>
                  ))}
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
                      <span className={`${s.badge} ${badgeClass(f.name)}`}>{ext(f.name).toUpperCase()}</span>
                      <span className={s.fileSize}>{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
                <button className={s.importBtn} onClick={handleImport} disabled={importing}>
                  {importing
                    ? `Đang xử lý ${processed}/${files.length}...`
                    : `Import ${files.length} file${selected.length > 0 ? ` · Thể loại: ${selected.join(', ')}` : ''}`
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
            <p className={s.progressCount}>{processed} / {files.length} file — {progressPct}%</p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className={s.results}>
            <div className={s.resultHeader}>
              <h2>
                {importedCount > 0
                  ? `✅ Import thành công ${importedCount}/${results.length} truyện`
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
              <button className={s.importMoreBtn} onClick={() => { setFiles([]); setResults(null) }}>Import thêm</button>
              <button className={s.libraryBtn} onClick={() => router.push('/')}>Về thư viện</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
