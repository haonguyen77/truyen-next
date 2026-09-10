'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { wasDeleted, removeFromDeletedLog } from '@/lib/deletedBooks'
import { fileNameToTitle } from '@/lib/generateId'
import { parseFileClient } from '@/lib/clientParser'
import s from './ImportPage.module.css'

type ImportResult = {
  fileName: string; status: string; title?: string
  chapters?: number; error?: string; warnings?: string[]
  existingBookId?: string; duplicateType?: string
}

type DupAction = 'skip' | 'update' | 'create'

const ALL_GENRES = [
  'Ngôn tình', 'Xuyên không', 'Huyền huyễn', 'Tu tiên', 'Tiên hiệp',
  'Đô thị', 'Hệ thống', 'Dị giới', 'Phiêu lưu', 'Cổ đại',
  'Trọng sinh', 'Học đường', 'Cung đấu', 'Thể thao', 'Lịch sử',
  'Kinh dị', 'Huyền bí', 'Hài hước', 'Ngắn', 'Hoàn', 'Sắc',
]

const USAGE_KEY = 'genre-usage-counts'
function loadUsage(): Record<string, number> { try { return JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}') } catch { return {} } }
function saveUsage(c: Record<string, number>) { try { localStorage.setItem(USAGE_KEY, JSON.stringify(c)) } catch {} }

// Must mirror server-side normalizeVietnamese for consistent duplicate detection
function normTitle(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim()
}

// Max files uploaded in parallel. 6 balances speed vs Vercel concurrent-function limits.
const CONCURRENCY = 6

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [isDrag, setIsDrag] = useState(false)

  // Genre
  const [selected, setSelected] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})

  // Deleted-log warnings (before upload)
  const [deletedDupes, setDeletedDupes] = useState<{ file: File; title: string }[]>([])

  // Library titles (fetched once) — Map<normalizedTitle, bookId> for instant client-side dup check
  const [libraryTitles, setLibraryTitles] = useState<Map<string, string>>(new Map())
  const [libDupes, setLibDupes] = useState<{ file: File; title: string; bookId: string }[]>([])
  const [checkingLib, setCheckingLib] = useState(false)

  // Import flow
  const [importing, setImporting] = useState(false)
  const [currentFile, setCurrentFile] = useState('')
  const [processed, setProcessed] = useState(0)
  const [results, setResults] = useState<ImportResult[] | null>(null)

  // Duplicate resolution (library duplicates found during import)
  const [duplicates, setDuplicates] = useState<ImportResult[]>([])
  const [dupActions, setDupActions] = useState<Record<string, DupAction>>({})

  const sortedGenres = [...ALL_GENRES].sort((a, b) => {
    const aS = selected.includes(a) ? 1 : 0, bS = selected.includes(b) ? 1 : 0
    if (aS !== bS) return bS - aS
    return (usageCounts[b] ?? 0) - (usageCounts[a] ?? 0)
  })
  const visibleGenres = expanded ? sortedGenres : sortedGenres.slice(0, 10)

  useEffect(() => {
    setUsageCounts(loadUsage())
    // Fetch existing titles once (lightweight) for instant duplicate detection (A)
    setCheckingLib(true)
    fetch('/api/books/titles')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { id: string; title: string }[]) => {
        const map = new Map<string, string>()
        for (const r of rows) map.set(normTitle(r.title), r.id)
        setLibraryTitles(map)
      })
      .catch(() => {})
      .finally(() => setCheckingLib(false))
  }, [])

  // Re-check library duplicates whenever files or the fetched titles change
  const recomputeLibDupes = useCallback((arr: File[], titles: Map<string, string>) => {
    const dupes: { file: File; title: string; bookId: string }[] = []
    for (const f of arr) {
      const t = fileNameToTitle(f.name)
      const id = titles.get(normTitle(t))
      if (id) dupes.push({ file: f, title: t, bookId: id })
    }
    setLibDupes(dupes)
  }, [])

  useEffect(() => {
    recomputeLibDupes(files, libraryTitles)
  }, [files, libraryTitles, recomputeLibDupes])

  const toggleGenre = (g: string) => setSelected(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])
  const addCustom = (v: string) => { const t = v.trim(); if (t && !selected.includes(t)) setSelected(p => [...p, t]); setCustomInput('') }
  const removeGenre = (g: string) => setSelected(p => p.filter(x => x !== g))

  // ── File selection + deleted-log check ──
  const accept = (fl: FileList | File[]) => {
    const arr = Array.from(fl).filter(f => /\.(docx|epub|pdf)$/i.test(f.name))
    if (!arr.length) return
    setFiles(arr)
    // Check against deleted log
    const dupes: { file: File; title: string }[] = []
    for (const f of arr) {
      const title = fileNameToTitle(f.name)
      if (wasDeleted(title)) dupes.push({ file: f, title })
    }
    setDeletedDupes(dupes)
  }

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDrag(false); accept(e.dataTransfer.files) }

  // Remove a file from selection
  const removeFile = (file: File) => {
    setFiles(prev => prev.filter(f => f !== file))
    setDeletedDupes(prev => prev.filter(d => d.file !== file))
    setLibDupes(prev => prev.filter(d => d.file !== file))
  }

  // Skip ALL library-duplicate files at once (remove them before uploading)
  const skipAllLibDupes = () => {
    const dupFiles = new Set(libDupes.map(d => d.file))
    setFiles(prev => prev.filter(f => !dupFiles.has(f)))
    setDeletedDupes(prev => prev.filter(d => !dupFiles.has(d.file)))
    setLibDupes([])
  }

  // ── Parse a file in the browser, then send parsed JSON to the API ──
  // Heavy parsing (mammoth/jszip) runs on the user's machine; server only writes to DB.
  const importFile = async (
    file: File,
    dupAction?: DupAction,
    opts?: { existingBookId?: string }
  ): Promise<ImportResult[]> => {
    const ext = file.name.toLowerCase().split('.').pop() ?? ''

    // 1) Parse locally
    let parsed
    try {
      parsed = await parseFileClient(file)
    } catch (err) {
      return [{ fileName: file.name, status: 'error', error: `Lỗi phân tích: ${err instanceof Error ? err.message : String(err)}` }]
    }
    if (parsed.errors.length > 0) {
      return [{ fileName: file.name, status: 'error', error: parsed.errors[0], warnings: parsed.warnings }]
    }

    // 2) Send lightweight JSON (no raw file upload)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          sourceFileType: ext,
          genres: selected,
          dupAction,
          existingBookId: opts?.existingBookId,
          parsed: {
            title: parsed.title,
            author: parsed.author,
            description: parsed.description,
            coverBase64: parsed.coverBase64,
            chapters: parsed.chapters,
            warnings: parsed.warnings,
          },
        }),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        const text = await res.text()
        return [{ fileName: file.name, status: 'error', error: `Server error (${res.status}): ${text.slice(0, 200)}` }]
      }
      const data = await res.json()
      return data.results ?? [{ fileName: file.name, status: 'error', error: data.error ?? 'Unknown' }]
    } catch (err) {
      return [{ fileName: file.name, status: 'error', error: String(err) }]
    }
  }

  // ── Main import ──
  const handleImport = useCallback(async () => {
    if (!files.length) return
    setImporting(true)
    setProcessed(0)
    setResults(null)
    setDuplicates([])
    setDupActions({})

    if (selected.length > 0) {
      const counts = loadUsage()
      selected.forEach(g => { counts[g] = (counts[g] ?? 0) + 1 })
      saveUsage(counts); setUsageCounts(counts)
    }

    const allResults: ImportResult[] = []
    const foundDupes: ImportResult[] = []
    let done = 0

    // Split client-side: duplicates go straight to the resolve screen (no server round-trip);
    // new files get skipDupCheck=true so the server skips the per-request title query (cách 2).
    const dupFileSet = new Map<File, { title: string; bookId: string }>()
    libDupes.forEach(d => dupFileSet.set(d.file, { title: d.title, bookId: d.bookId }))

    for (const d of libDupes) {
      foundDupes.push({
        fileName: d.file.name,
        status: 'duplicate',
        title: d.title,
        existingBookId: d.bookId,
        duplicateType: 'library',
      })
    }

    const newFiles = files.filter(f => !dupFileSet.has(f))
    setProcessed(0)

    // Upload new (non-duplicate) files in parallel, telling server to skip dup check (cách 1 + 2)
    const queue = [...newFiles]
    const worker = async () => {
      while (queue.length) {
        const file = queue.shift()
        if (!file) break
        setCurrentFile(file.name)
        const res = await importFile(file)
        for (const r of res) {
          if (r.status === 'duplicate') foundDupes.push(r)
          else allResults.push(r)
        }
        done++
        setProcessed(done)
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, newFiles.length || 1) }, worker))

    setResults(allResults)
    setDuplicates(foundDupes)
    setImporting(false)
    setCurrentFile('')
  }, [files, selected, libDupes])

  // ── Resolve duplicates (after user chooses actions) ──
  const handleResolveDuplicates = async () => {
    const unresolved = duplicates.filter(d => !dupActions[d.fileName])
    if (unresolved.length > 0) {
      alert(`Vui lòng chọn hành động cho ${unresolved.length} truyện trùng.`)
      return
    }
    setImporting(true)
    setProcessed(0)
    const newResults = [...(results ?? [])]

    // Resolve duplicates in parallel batches too (B, C)
    const queue = duplicates.filter(d => files.some(f => f.name === d.fileName))
    let done = 0
    const worker = async () => {
      while (queue.length) {
        const dup = queue.shift()
        if (!dup) break
        const action = dupActions[dup.fileName]
        const file = files.find(f => f.name === dup.fileName)
        if (!file) continue
        setCurrentFile(dup.fileName)
        // Pass existingBookId so server updates the right book without re-querying
        const res = await importFile(file, action, {
          existingBookId: dup.existingBookId,
        })
        newResults.push(...res)
        done++
        setProcessed(done)
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

    setResults(newResults)
    setDuplicates([])
    setImporting(false)
    setCurrentFile('')
  }

  const bulkSetDupAction = (action: DupAction) => {
    const all: Record<string, DupAction> = {}
    duplicates.forEach(d => { all[d.fileName] = action })
    setDupActions(all)
  }

  const ext = (n: string) => n.toLowerCase().split('.').pop() ?? ''
  const badgeClass = (n: string) => ext(n) === 'epub' ? s.epubBadge : ext(n) === 'pdf' ? s.pdfBadge : s.docxBadge
  const importedCount = results?.filter(r => r.status === 'imported' || r.status === 'updated').length ?? 0
  const progressTotal = duplicates.length > 0
    ? duplicates.length
    : Math.max(1, files.length - libDupes.length)
  const progressPct = progressTotal > 0 ? Math.round((processed / progressTotal) * 100) : 0

  return (
    <div className={s.page}>
      <div className="container">
        <div className={s.header}>
          <h1 className={s.title}>IMPORT TRUYỆN</h1>
          <p className={s.sub}>Chọn file <strong>.docx</strong>, <strong>.epub</strong> hoặc <strong>.pdf</strong></p>
        </div>

        {/* ── SELECT + GENRE + FILE LIST ── */}
        {!results && duplicates.length === 0 && (
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
              <input ref={fileRef} type="file" accept=".docx,.epub,.pdf" multiple
                style={{ display: 'none' }} onChange={e => e.target.files && accept(e.target.files)} />
            </div>

            {/* Deleted-log warning */}
            {deletedDupes.length > 0 && (
              <div className={s.deletedWarn}>
                <div className={s.deletedWarnHeader}>
                  ⚠ {deletedDupes.length} file trùng với truyện ĐÃ XÓA trước đây
                </div>
                <p className={s.deletedWarnDesc}>Các truyện này từng được xóa. Bạn có chắc muốn import lại?</p>
                {deletedDupes.map((d, i) => (
                  <div key={i} className={s.deletedItem}>
                    <span className={s.deletedTitle}>📕 {d.title}</span>
                    <div className={s.deletedActions}>
                      <button className={s.deletedKeep} onClick={() => { removeFromDeletedLog(d.title); setDeletedDupes(p => p.filter(x => x !== d)) }}>
                        Vẫn import
                      </button>
                      <button className={s.deletedRemove} onClick={() => removeFile(d.file)}>
                        Bỏ file này
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Library-duplicate warning (instant, client-side check) */}
            {libDupes.length > 0 && (
              <div className={s.libWarn}>
                <div className={s.libWarnHeader}>
                  🔁 {libDupes.length} file trùng tên với truyện ĐANG CÓ trong thư viện
                </div>
                <p className={s.libWarnDesc}>
                  Chọn cách xử lý ngay bên dưới, hoặc bỏ qua hết để không import lại các truyện này.
                </p>
                <div className={s.libWarnBulk}>
                  <button className={s.libSkipAll} onClick={skipAllLibDupes}>
                    ↩ Bỏ qua tất cả ({libDupes.length})
                  </button>
                </div>
                <div className={s.libWarnItems}>
                  {libDupes.map((d, i) => (
                    <div key={i} className={s.libWarnItem}>
                      <span className={s.libWarnItemTitle}>📘 {d.title}</span>
                      <button className={s.libSkipOne} onClick={() => removeFile(d.file)}>
                        Bỏ file này
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {checkingLib && files.length > 0 && (
              <p className={s.libChecking}>Đang kiểm tra trùng với thư viện...</p>
            )}

            {/* Genre selector */}
            <div className={s.genreSection}>
              <div className={s.genreHeader}>
                <span className={s.genreTitle}>🏷 Thể loại</span>
                <span className={s.genreDesc}>Gán thể loại cho tất cả truyện import lần này</span>
              </div>
              <div className={s.chipsRow}>
                {visibleGenres.map(g => (
                  <button key={g} type="button" className={`${s.chip} ${selected.includes(g) ? s.chipActive : ''}`} onClick={() => toggleGenre(g)}>
                    {selected.includes(g) && <span className={s.chipCheck}>✓</span>}{g}
                    {(usageCounts[g] ?? 0) > 0 && !selected.includes(g) && <span className={s.chipCount}>{usageCounts[g]}</span>}
                  </button>
                ))}
                <button type="button" className={s.expandBtn} onClick={() => setExpanded(v => !v)}>
                  {expanded ? '▲ Thu gọn' : `▼ Thêm (${sortedGenres.length - 10})`}
                </button>
              </div>
              <div className={s.customRow}>
                <input className={s.customInput} placeholder="Nhập thể loại khác... (Enter)"
                  value={customInput} onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(customInput) } }} />
                <button type="button" className={s.customAddBtn} onClick={() => addCustom(customInput)}>Thêm</button>
                {selected.length > 0 && <button type="button" className={s.clearAllBtn} onClick={() => setSelected([])}>Xóa hết</button>}
              </div>
              {selected.length > 0 && (
                <div className={s.selectedRow}>
                  <span className={s.selectedLabel}>Đã chọn:</span>
                  {selected.map(g => (
                    <span key={g} className={s.tag}>{g}<button type="button" className={s.tagRemove} onClick={() => removeGenre(g)}>✕</button></span>
                  ))}
                </div>
              )}
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className={s.fileList}>
                <div className={s.fileListHeader}>
                  <strong>ĐÃ CHỌN {files.length} FILE</strong>
                  <button onClick={() => { setFiles([]); setDeletedDupes([]) }} className={s.clearBtn}>Xóa tất cả</button>
                </div>
                <div className={s.fileScroll}>
                  {files.map((f, i) => (
                    <div key={i} className={s.fileItem}>
                      <span>{ext(f.name) === 'epub' ? '📗' : ext(f.name) === 'pdf' ? '📕' : '📄'}</span>
                      <span className={s.fileName}>{f.name}</span>
                      <span className={`${s.badge} ${badgeClass(f.name)}`}>{ext(f.name).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
                <button className={s.importBtn} onClick={handleImport} disabled={importing}>
                  {importing ? `Đang xử lý ${processed}/${files.length}...` : `Import ${files.length} file${selected.length > 0 ? ` · ${selected.join(', ')}` : ''}`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── DUPLICATE RESOLUTION ── */}
        {duplicates.length > 0 && !importing && (
          <div className={s.dupSection}>
            <div className={s.dupHeader}>
              <h2>⚠ Phát hiện {duplicates.length} truyện trùng tên</h2>
              <p className={s.dupDesc}>Các truyện này đã có trong thư viện. Chọn hành động:</p>
            </div>

            {/* Bulk actions */}
            <div className={s.bulkBar}>
              <span className={s.bulkLabel}>Áp dụng tất cả:</span>
              <button className={s.bulkBtn} onClick={() => bulkSetDupAction('skip')}>↩ Bỏ qua hết</button>
              <button className={s.bulkBtn} onClick={() => bulkSetDupAction('update')}>↺ Cập nhật hết</button>
              <button className={s.bulkBtn} onClick={() => bulkSetDupAction('create')}>＋ Tạo mới hết</button>
            </div>

            {duplicates.map(dup => (
              <div key={dup.fileName} className={s.dupItem}>
                <div className={s.dupInfo}>
                  <strong>{dup.title}</strong>
                  <span className={s.dupFile}>{dup.fileName} · {dup.chapters} chương</span>
                </div>
                <div className={s.dupBtns}>
                  {(['skip', 'update', 'create'] as DupAction[]).map(a => (
                    <button key={a}
                      className={`${s.dupActionBtn} ${dupActions[dup.fileName] === a ? s.dupActionActive : ''}`}
                      onClick={() => setDupActions(p => ({ ...p, [dup.fileName]: a }))}>
                      {a === 'skip' ? 'Bỏ qua' : a === 'update' ? 'Cập nhật' : 'Tạo mới'}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className={s.dupFooter}>
              <span className={s.dupCount}>{Object.keys(dupActions).length}/{duplicates.length} đã chọn</span>
              <button className={s.dupApplyBtn} onClick={handleResolveDuplicates}>
                Áp dụng
              </button>
            </div>
          </div>
        )}

        {/* ── PROGRESS ── */}
        {importing && (
          <div className={s.importing}>
            <div className={s.progressBar}><div className={s.progressFill} style={{ width: `${progressPct}%` }} /></div>
            <p className={s.progressText}><span className={s.spinner}>⚙️</span> Đang xử lý: <strong>{currentFile}</strong></p>
            <p className={s.progressCount}>{processed} / {progressTotal} file — {progressPct}%</p>
          </div>
        )}

        {/* ── RESULTS ── */}
        {results && duplicates.length === 0 && !importing && (
          <div className={s.results}>
            <div className={s.resultHeader}>
              <h2>{importedCount > 0 ? `✅ Thành công ${importedCount}/${results.length} truyện` : `⚠ Đã xử lý ${results.length} file — Thành công: ${importedCount}`}</h2>
            </div>
            {results.map((r, i) => (
              <div key={i} className={`${s.resultItem} ${r.status === 'error' ? s.resultError : r.status === 'updated' ? s.resultUpdated : r.status === 'skipped' ? s.resultSkip : s.resultOk}`}>
                <span className={s.resultIcon}>{r.status === 'error' ? '✗' : r.status === 'updated' ? '↺' : r.status === 'skipped' ? '⊘' : '✓'}</span>
                <div className={s.resultInfo}>
                  <span className={s.resultFile}>{r.fileName}</span>
                  {r.title && r.chapters !== undefined && <span className={s.resultTitle}>{r.title} — {r.chapters} chương</span>}
                  {r.error && <span className={s.resultErrMsg}>{r.error}</span>}
                  {r.warnings?.map((w, wi) => <span key={wi} className={s.resultWarn}>⚠ {w}</span>)}
                </div>
                <span className={s.resultStatus}>
                  {r.status === 'imported' && 'Đã import'}
                  {r.status === 'updated' && 'Đã cập nhật'}
                  {r.status === 'skipped' && 'Bỏ qua'}
                  {r.status === 'error' && 'Lỗi'}
                </span>
              </div>
            ))}
            <div className={s.resultActions}>
              <button className={s.importMoreBtn} onClick={() => { setFiles([]); setResults(null); setDeletedDupes([]) }}>Import thêm</button>
              <button className={s.libraryBtn} onClick={() => router.push('/')}>Về thư viện</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
