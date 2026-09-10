/**
 * Import API Route
 * Server-side parsing: DOCX (mammoth) + EPUB (jszip)
 * NO JSDOM — pure regex/string HTML parsing to work on Vercel serverless
 */
import { NextResponse } from 'next/server'
import { generateId, fileNameToTitle } from '@/lib/generateId'
import { createBook, saveChapters, deleteChaptersByBook, getBookTitles, updateBook } from '@/lib/bookService'
import { normalizeVietnamese } from '@/lib/normalizeVietnamese'

interface ParsedChapter { index: number; title: string; content: string; wordCount: number }
interface ParsedResult {
  title: string; author: string; description: string
  coverBase64: string; chapters: ParsedChapter[]
  warnings: string[]; errors: string[]
}

// ── Pure JS HTML helpers (no JSDOM) ──────────────────────────

/** Extract text content from HTML string */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/** Get text content of first matching tag */
function getTagText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  return m ? htmlToText(m[1]).trim() : ''
}

/** Get attribute value from HTML tag */
function getAttr(tag: string, attr: string): string {
  const re = new RegExp(`${attr}="([^"]*)"`, 'i')
  const m = tag.match(re)
  return m ? m[1] : ''
}

/**
 * Split HTML by <h1> tags — pure string manipulation
 * Returns array of { heading, content } sections
 */
function splitByH1(html: string): { heading: string; content: string }[] {
  // Normalize: ensure h1 tags are on their own
  const sections: { heading: string; content: string }[] = []

  // Split on <h1...>...</h1> boundaries
  const h1Re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null
  let prevHeading = ''
  let isFirst = true

  // Collect prologue (before first h1)
  const firstH1 = h1Re.exec(html)
  if (!firstH1) return []

  // Reset
  h1Re.lastIndex = 0

  const parts: Array<{ heading: string; start: number; end: number }> = []
  while ((match = h1Re.exec(html)) !== null) {
    parts.push({
      heading: match[1] ?? '',
      start: match.index,
      end: h1Re.lastIndex,
    })
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const contentStart = part.end
    const contentEnd = i + 1 < parts.length ? parts[i + 1].start : html.length
    const content = html.slice(contentStart, contentEnd).trim()
    sections.push({ heading: htmlToText(part.heading).trim(), content })
  }

  return sections
}

// ── DOCX Parser ───────────────────────────────────────────────
async function parseDocx(buffer: ArrayBuffer, fileName: string): Promise<ParsedResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth = await import('mammoth') as any
  const warnings: string[] = []
  const errors: string[] = []
  let html = ''

  try {
    const nodeBuffer = Buffer.from(buffer)
    const result = await mammoth.convertToHtml({ buffer: nodeBuffer }, {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Tiêu đề 1'] => h1:fresh",
        "p[style-name='Tiêu đề 2'] => h2:fresh",
        "p[style-name='heading 1'] => h1:fresh",
        "p[style-name='heading 2'] => h2:fresh",
        "p[style-name='Title'] => h1:fresh",
      ].join('\n'),
    })
    html = (result.value as string).normalize('NFC')
    for (const m of result.messages as Array<{ type: string; message: string }>) {
      if (m.type === 'warning') {
        const t = m.message.toLowerCase()
        const isNoise = t.includes('unrecognised') || t.includes('drawing') ||
          t.includes('wps:') || t.includes('wpg:') || t.includes('mc:') || t.includes('w14:')
        if (!isNoise) warnings.push(m.message)
      }
    }
  } catch (err) {
    errors.push(`Không thể đọc DOCX: ${err instanceof Error ? err.message : String(err)}`)
    return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors }
  }

  // Split by H1 using pure string parsing (no JSDOM)
  const sections = splitByH1(html)
  if (sections.length === 0) {
    errors.push('Không tìm thấy Heading 1 trong file. Vui lòng định dạng tiêu đề chương bằng "Heading 1" trong Word.')
    return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors }
  }

  const chapters: ParsedChapter[] = sections.map((s, i) => {
    const text = htmlToText(s.content)
    return {
      index: i,
      title: s.heading.normalize('NFC') || `Chương ${i + 1}`,
      content: s.content.normalize('NFC'),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    }
  })

  return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters, warnings, errors }
}

// ── EPUB Parser ───────────────────────────────────────────────
function resolveEpubPath(base: string, rel: string): string {
  if (rel.startsWith('/')) return rel.slice(1)
  const parts = base.split('/'); parts.pop()
  for (const s of rel.split('/')) {
    if (s === '..') parts.pop()
    else if (s !== '.') parts.push(s)
  }
  return parts.join('/')
}

/** Extract all items from OPF manifest using regex */
function parseOPFManifest(opfXml: string): Record<string, { href: string; mediaType: string }> {
  const manifest: Record<string, { href: string; mediaType: string }> = {}
  const itemRe = /<item\s[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(opfXml)) !== null) {
    const tag = m[0]
    const id = getAttr(tag, 'id')
    const href = getAttr(tag, 'href')
    const mt = getAttr(tag, 'media-type')
    if (id && href) manifest[id] = { href, mediaType: mt }
  }
  return manifest
}

/** Extract spine itemrefs from OPF using regex */
function parseOPFSpine(opfXml: string): string[] {
  const spine: string[] = []
  const itemrefRe = /<itemref\s[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = itemrefRe.exec(opfXml)) !== null) {
    const idref = getAttr(m[0], 'idref')
    if (idref) spine.push(idref)
  }
  return spine
}

/** Extract body content from XHTML/HTML string */
function extractBody(xhtml: string): string {
  const bodyMatch = xhtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let body = bodyMatch ? bodyMatch[1] : xhtml
  // Remove nav elements
  body = body.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  return body.trim()
}

async function parseEpub(buffer: ArrayBuffer, fileName: string): Promise<ParsedResult> {
  const JSZip = (await import('jszip')).default
  const warnings: string[] = []
  const errors: string[] = []

  let zip: InstanceType<typeof JSZip>
  try { zip = await JSZip.loadAsync(buffer) }
  catch (err) {
    return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors: [`Không mở được EPUB: ${err}`] }
  }

  const containerXml = await zip.file('META-INF/container.xml')?.async('string') ?? ''
  const opfMatch = containerXml.match(/full-path="([^"]+)"/)
  if (!opfMatch) {
    return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors: ['Không tìm thấy OPF'] }
  }

  const opfPath = opfMatch[1]
  const opfXml = await zip.file(opfPath)?.async('string') ?? ''
  if (!opfXml) {
    return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors: ['Không đọc được OPF'] }
  }

  // Parse metadata with regex (no JSDOM)
  const bookTitle = (
    getTagText(opfXml, 'dc:title') ||
    getTagText(opfXml, 'title') ||
    fileNameToTitle(fileName)
  ).normalize('NFC')
  const author = (getTagText(opfXml, 'dc:creator') || getTagText(opfXml, 'creator')).normalize('NFC')
  const description = (getTagText(opfXml, 'dc:description') || getTagText(opfXml, 'description')).normalize('NFC')

  const manifest = parseOPFManifest(opfXml)
  const spine = parseOPFSpine(opfXml)

  if (spine.length === 0) {
    return { title: bookTitle, author, description, coverBase64: '', chapters: [], warnings, errors: ['EPUB không có spine'] }
  }

  const chapters: ParsedChapter[] = []
  let chIdx = 0

  for (const idref of spine) {
    const item = manifest[idref]
    if (!item) continue
    const mt = item.mediaType
    if (!mt.includes('html') && !mt.includes('xml')) continue

    const href = resolveEpubPath(opfPath, item.href)
    const xhtml = await zip.file(href)?.async('string') ?? ''
    if (!xhtml.trim()) continue

    const body = extractBody(xhtml)
    if (!body) continue

    const text = htmlToText(body)
    if (!text.trim()) continue

    // Get chapter title: first h1/h2 in body, or from NCX/NAV later
    const titleMatch = body.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)
    const chTitle = titleMatch
      ? htmlToText(titleMatch[1]).trim().normalize('NFC')
      : `Phần ${chIdx + 1}`

    chapters.push({
      index: chIdx,
      title: chTitle,
      content: body.normalize('NFC'),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    })
    chIdx++
  }

  if (chapters.length === 0) {
    return { title: bookTitle, author, description, coverBase64: '', chapters: [], warnings, errors: ['Không có nội dung trong EPUB'] }
  }

  return { title: bookTitle, author, description, coverBase64: '', chapters, warnings, errors }
}

// ── Main handler ──────────────────────────────────────────────
export async function POST(req: Request) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const files = formData.getAll('files') as File[]
  const genresRaw = formData.get('genres') as string | null
  let importGenres: string[] = []
  if (genresRaw) {
    try { importGenres = JSON.parse(genresRaw) } catch { importGenres = [] }
  }

  // dupAction: 'skip' | 'update' | 'create' | undefined
  // When undefined and a duplicate is found → return status 'duplicate' for user to decide
  const dupAction = (formData.get('dupAction') as string | null) ?? undefined

  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 })

  // Client already checks duplicates against /api/books/titles before uploading.
  // skipDupCheck=true → server trusts client and skips the per-request title query (fast path).
  // existingBookId → provided by client when dupAction is 'update' (avoids re-lookup).
  const skipDupCheck = formData.get('skipDupCheck') === 'true'
  const clientExistingId = (formData.get('existingBookId') as string | null) ?? undefined

  // Only query existing titles when we actually need to detect a duplicate.
  // (i.e. client did NOT pre-filter and no decision was passed)
  const needsLookup = !skipDupCheck && !clientExistingId
  const allBooks = needsLookup ? await getBookTitles() : []
  const results = []

  for (const file of files) {
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    let buffer: ArrayBuffer
    try {
      buffer = await file.arrayBuffer()
    } catch (err) {
      results.push({ fileName: file.name, status: 'error', error: `Không đọc được file: ${err}` })
      continue
    }

    let parsed: ParsedResult
    try {
      if (ext === 'docx') parsed = await parseDocx(buffer, file.name)
      else if (ext === 'epub') parsed = await parseEpub(buffer, file.name)
      else {
        results.push({ fileName: file.name, status: 'error', error: 'Định dạng không hỗ trợ (.docx hoặc .epub)' })
        continue
      }
    } catch (err) {
      results.push({ fileName: file.name, status: 'error', error: `Parse error: ${err instanceof Error ? err.message : String(err)}` })
      continue
    }

    if (parsed.errors.length > 0) {
      results.push({ fileName: file.name, status: 'error', error: parsed.errors[0], warnings: parsed.warnings })
      continue
    }

    // Determine the existing book:
    // - if client passed existingBookId (from its own dup check) → use it directly (no query)
    // - else look it up in the fetched titles (only when needsLookup)
    const existing = clientExistingId
      ? { id: clientExistingId }
      : allBooks.find(b => normalizeVietnamese(b.title) === normalizeVietnamese(parsed.title))

    // ── Duplicate handling ──
    // If book exists in library AND no action decided → ask user
    if (existing && !dupAction) {
      results.push({
        fileName: file.name,
        status: 'duplicate',
        title: parsed.title,
        chapters: parsed.chapters.length,
        existingBookId: existing.id,
        duplicateType: 'library',   // trùng với truyện đang có
      })
      continue
    }

    // If user chose skip → skip
    if (existing && dupAction === 'skip') {
      results.push({ fileName: file.name, status: 'skipped', title: parsed.title })
      continue
    }

    try {
      const now = new Date()
      // create action forces a new book even if title matches
      const shouldUpdate = existing && dupAction === 'update'
      const bookId = shouldUpdate ? existing.id : generateId()

      if (shouldUpdate) {
        await deleteChaptersByBook(bookId)
        await updateBook(bookId, {
          title: parsed.title,
          author: parsed.author || undefined,
          description: parsed.description || undefined,
          cover: parsed.coverBase64 || undefined,
          genres: importGenres.length > 0 ? importGenres : undefined,
          sourceFileName: file.name,
          sourceFileType: ext,
          chapterCount: parsed.chapters.length,
        })
      } else {
        await createBook({
          id: bookId,
          title: parsed.title,
          author: parsed.author,
          description: parsed.description,
          cover: parsed.coverBase64,
          genres: importGenres,
          sourceFileName: file.name,
          sourceFileType: ext,
          chapterCount: parsed.chapters.length,
        })
      }

      await saveChapters(parsed.chapters.map(ch => ({
        id: generateId(), bookId, index: ch.index,
        title: ch.title, content: ch.content,
        wordCount: ch.wordCount, createdAt: now, updatedAt: now,
      })))

      const wasUpdate = existing && dupAction === 'update'
      results.push({
        fileName: file.name,
        status: wasUpdate ? 'updated' : 'imported',
        bookId,
        title: parsed.title,
        chapters: parsed.chapters.length,
        warnings: parsed.warnings,
      })
    } catch (err) {
      results.push({ fileName: file.name, status: 'error', error: `DB error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return NextResponse.json({ results })
}
