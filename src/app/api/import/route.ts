/**
 * POST /api/import
 * Accepts multipart/form-data with files[]
 * Parses DOCX/EPUB on server, saves to Neon DB
 * Returns per-file results
 */
import { NextResponse } from 'next/server'
import { generateId, fileNameToTitle } from '@/lib/generateId'
import { createBook, saveChapters, deleteChaptersByBook, getAllBooks, updateBook } from '@/lib/bookService'
import { normalizeVietnamese } from '@/lib/normalizeVietnamese'

interface ParsedChapter { index: number; title: string; content: string; wordCount: number }
interface ParsedResult {
  title: string; author: string; description: string
  coverBase64: string; chapters: ParsedChapter[]
  warnings: string[]; errors: string[]
}

// ── DOCX parser (server-side with mammoth) ────────────────────
async function parseDocx(buffer: ArrayBuffer, fileName: string): Promise<ParsedResult> {
  const mammoth = await import('mammoth')
  const warnings: string[] = []
  const errors: string[] = []

  let html = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mammothAny = mammoth as any
    const result = await mammothAny.convertToHtml({ arrayBuffer: buffer }, {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Tiêu đề 1'] => h1:fresh",
      ].join('\n'),
    })
    html = result.value.normalize('NFC')
    for (const m of result.messages) {
      if (m.type === 'warning') {
        const t = m.message.toLowerCase()
        if (!t.includes('unrecognised') && !t.includes('drawing') && !t.includes('wps:')) {
          warnings.push(m.message)
        }
      }
    }
  } catch (err) {
    errors.push(`Không thể đọc DOCX: ${err instanceof Error ? err.message : String(err)}`)
    return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors }
  }

  // Split by H1
  const { JSDOM } = await import('jsdom').catch(() => ({ JSDOM: null }))
  if (!JSDOM) {
    errors.push('Không thể parse HTML trên server.')
    return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors }
  }

  const dom = new JSDOM(`<div id="root">${html}</div>`)
  const root = dom.window.document.getElementById('root')!
  const children = Array.from(root.childNodes)

  const sections: { heading: Element | null; nodes: ChildNode[] }[] = []
  let current: { heading: Element | null; nodes: ChildNode[] } = { heading: null, nodes: [] }

  for (const node of children) {
    if (node.nodeType === 1 && (node as Element).tagName === 'H1') {
      sections.push({ ...current })
      current = { heading: node as Element, nodes: [] }
    } else {
      current.nodes.push(node)
    }
  }
  sections.push(current)

  const chapterSections = sections.slice(1)
  if (chapterSections.length === 0) {
    errors.push('Không tìm thấy Heading 1 trong file DOCX.')
    return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors }
  }

  const parsedChapters: ParsedChapter[] = []
  for (let i = 0; i < chapterSections.length; i++) {
    const s = chapterSections[i]
    if (!s.heading) continue
    const title = (s.heading.textContent?.trim() ?? `Chương ${i + 1}`).normalize('NFC')
    const div = dom.window.document.createElement('div')
    s.nodes.forEach(n => div.appendChild(n.cloneNode(true)))
    const content = div.innerHTML.normalize('NFC')
    const text = div.textContent?.trim() ?? ''
    parsedChapters.push({ index: i, title, content, wordCount: text.split(/\s+/).filter(Boolean).length })
  }

  return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: parsedChapters, warnings, errors }
}

// ── EPUB parser (server-side with jszip) ─────────────────────
async function parseEpub(buffer: ArrayBuffer, fileName: string): Promise<ParsedResult> {
  const JSZip = (await import('jszip')).default
  const warnings: string[] = []
  const errors: string[] = []

  let zip: InstanceType<typeof JSZip>
  try { zip = await JSZip.loadAsync(buffer) }
  catch (err) { return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors: [`Không mở được EPUB: ${err}`] } }

  const containerXml = await zip.file('META-INF/container.xml')?.async('string') ?? ''
  if (!containerXml) return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors: ['Không tìm thấy container.xml'] }

  const opfMatch = containerXml.match(/full-path="([^"]+)"/)
  if (!opfMatch) return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors: ['Không tìm thấy OPF path'] }

  const opfPath = opfMatch[1]
  const opfXml = await zip.file(opfPath)?.async('string') ?? ''
  if (!opfXml) return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors: ['Không đọc được OPF'] }

  const { JSDOM } = await import('jsdom').catch(() => ({ JSDOM: null }))
  if (!JSDOM) return { title: fileNameToTitle(fileName), author: '', description: '', coverBase64: '', chapters: [], warnings, errors: ['JSDOM not available'] }

  const opfDom = new JSDOM(opfXml, { contentType: 'application/xml' })
  const doc = opfDom.window.document

  const bookTitle = doc.querySelector('title, dc\\:title')?.textContent?.trim() || fileNameToTitle(fileName)
  const author = doc.querySelector('creator, dc\\:creator')?.textContent?.trim() || ''
  const description = doc.querySelector('description, dc\\:description')?.textContent?.trim() || ''

  const manifest: Record<string, { href: string; mediaType: string }> = {}
  doc.querySelectorAll('manifest item, item').forEach(item => {
    const id = item.getAttribute('id') ?? ''
    const href = item.getAttribute('href') ?? ''
    const mt = item.getAttribute('media-type') ?? ''
    if (id && href) manifest[id] = { href, mediaType: mt }
  })

  const spine: string[] = []
  doc.querySelectorAll('spine itemref, itemref').forEach(ref => {
    const id = ref.getAttribute('idref') ?? ''
    if (id) spine.push(id)
  })

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''

  function resolve(base: string, rel: string) {
    if (rel.startsWith('/')) return rel.slice(1)
    const parts = base.split('/'); parts.pop()
    for (const s of rel.split('/')) { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s) }
    return parts.join('/')
  }

  const chapters: ParsedChapter[] = []
  let chIdx = 0

  for (const idref of spine) {
    const item = manifest[idref]
    if (!item || (!item.mediaType.includes('html') && !item.mediaType.includes('xml'))) continue
    const href = resolve(opfPath, item.href)
    const xhtml = await zip.file(href)?.async('string') ?? ''
    if (!xhtml.trim()) continue

    const pageDom = new JSDOM(xhtml, { contentType: 'text/html' })
    const body = pageDom.window.document.body
    body.querySelectorAll('nav').forEach(n => n.remove())

    const text = body.textContent?.trim() ?? ''
    if (!text) continue

    const title = (body.querySelector('h1,h2')?.textContent?.trim() || `Phần ${chIdx + 1}`).normalize('NFC')
    const content = body.innerHTML.normalize('NFC')
    chapters.push({ index: chIdx, title, content, wordCount: text.split(/\s+/).filter(Boolean).length })
    chIdx++
  }

  if (chapters.length === 0) return { title: bookTitle, author, description, coverBase64: '', chapters: [], warnings, errors: ['Không có nội dung trong EPUB'] }

  return { title: bookTitle, author, description, coverBase64: '', chapters, warnings, errors }
}

// ── Main handler ──────────────────────────────────────────────
export async function POST(req: Request) {
  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 })

  const allBooks = await getAllBooks()
  const results = []

  for (const file of files) {
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    const buffer = await file.arrayBuffer()

    let parsed: ParsedResult
    try {
      if (ext === 'docx') parsed = await parseDocx(buffer, file.name)
      else if (ext === 'epub') parsed = await parseEpub(buffer, file.name)
      else {
        results.push({ fileName: file.name, status: 'error', error: 'Định dạng không hỗ trợ' })
        continue
      }
    } catch (err) {
      results.push({ fileName: file.name, status: 'error', error: String(err) })
      continue
    }

    if (parsed.errors.length > 0) {
      results.push({ fileName: file.name, status: 'error', error: parsed.errors[0], warnings: parsed.warnings })
      continue
    }

    // Check duplicate
    const existing = allBooks.find(b => normalizeVietnamese(b.title) === normalizeVietnamese(parsed.title))

    try {
      const now = new Date()
      const bookId = existing?.id ?? generateId()

      if (existing) {
        await deleteChaptersByBook(bookId)
        await updateBook(bookId, {
          title: parsed.title,
          author: parsed.author,
          description: parsed.description,
          cover: parsed.coverBase64,
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
          genres: [],
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

      results.push({
        fileName: file.name, status: existing ? 'updated' : 'imported',
        bookId, title: parsed.title, chapters: parsed.chapters.length,
        warnings: parsed.warnings,
      })
    } catch (err) {
      results.push({ fileName: file.name, status: 'error', error: String(err) })
    }
  }

  return NextResponse.json({ results })
}
