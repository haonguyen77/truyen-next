/**
 * Client-side parser (runs in the browser).
 * Parses DOCX (mammoth) and EPUB (jszip) into plain chapter data,
 * so the server only needs to write to the DB — no heavy parsing on Vercel.
 *
 * Mirrors the previous server-side logic in /api/import/route.ts.
 */
import { fileNameToTitle } from './generateId'

export interface ParsedChapter {
  index: number
  title: string
  content: string
  wordCount: number
}
export interface ParsedResult {
  title: string
  author: string
  description: string
  coverBase64: string
  chapters: ParsedChapter[]
  warnings: string[]
  errors: string[]
}

// ── Pure JS HTML helpers ──────────────────────────────────────
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

function getTagText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  return m ? htmlToText(m[1]).trim() : ''
}

function getAttr(tag: string, attr: string): string {
  const re = new RegExp(`${attr}="([^"]*)"`, 'i')
  const m = tag.match(re)
  return m ? m[1] : ''
}

function splitByH1(html: string): { heading: string; content: string }[] {
  const sections: { heading: string; content: string }[] = []
  const h1Re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi
  const firstH1 = h1Re.exec(html)
  if (!firstH1) return []
  h1Re.lastIndex = 0

  const parts: Array<{ heading: string; start: number; end: number }> = []
  let match: RegExpExecArray | null
  while ((match = h1Re.exec(html)) !== null) {
    parts.push({ heading: match[1] ?? '', start: match.index, end: h1Re.lastIndex })
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
export async function parseDocxClient(file: File): Promise<ParsedResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth = (await import('mammoth/mammoth.browser')) as any
  const warnings: string[] = []
  const errors: string[] = []
  let html = ''

  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer }, {
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
    return { title: fileNameToTitle(file.name), author: '', description: '', coverBase64: '', chapters: [], warnings, errors }
  }

  const sections = splitByH1(html)
  if (sections.length === 0) {
    errors.push('Không tìm thấy Heading 1 trong file. Vui lòng định dạng tiêu đề chương bằng "Heading 1" trong Word.')
    return { title: fileNameToTitle(file.name), author: '', description: '', coverBase64: '', chapters: [], warnings, errors }
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

  return { title: fileNameToTitle(file.name), author: '', description: '', coverBase64: '', chapters, warnings, errors }
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

function extractBody(xhtml: string): string {
  const bodyMatch = xhtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let body = bodyMatch ? bodyMatch[1] : xhtml
  body = body.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  return body.trim()
}

export async function parseEpubClient(file: File): Promise<ParsedResult> {
  const JSZip = (await import('jszip')).default
  const warnings: string[] = []
  const errors: string[] = []
  const fileName = file.name

  let zip: InstanceType<typeof JSZip>
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()) }
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

  const bookTitle = (
    getTagText(opfXml, 'dc:title') || getTagText(opfXml, 'title') || fileNameToTitle(fileName)
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

// ── Dispatcher ────────────────────────────────────────────────
export async function parseFileClient(file: File): Promise<ParsedResult> {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'docx') return parseDocxClient(file)
  if (ext === 'epub') return parseEpubClient(file)
  return {
    title: fileNameToTitle(file.name), author: '', description: '', coverBase64: '',
    chapters: [], warnings: [], errors: ['Định dạng không hỗ trợ (.docx hoặc .epub)'],
  }
}
