import { db, books, chapters, type Book, type NewBook, type Chapter, type NewChapter } from '@/db'
import { eq, desc, ilike, sql } from 'drizzle-orm'

// ── Helpers ───────────────────────────────────────────────────
function parseGenres(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}
function toGenreStr(v: string | string[]): string {
  return Array.isArray(v) ? JSON.stringify(v) : v
}

export function toBookClient(b: Book) {
  return {
    ...b,
    genres: parseGenres(b.genres),
    createdAt: b.createdAt.getTime(),
    updatedAt: b.updatedAt.getTime(),
  }
}
export function toChapterClient(c: Chapter) {
  return { ...c, createdAt: c.createdAt.getTime(), updatedAt: c.updatedAt.getTime() }
}

// ── Input type for createBook ─────────────────────────────────
export type CreateBookInput = {
  id: string
  title: string
  author?: string
  description?: string
  cover?: string
  genres?: string | string[]
  sourceFileName?: string
  sourceFileType?: string
  chapterCount?: number
}

// ── Books CRUD ────────────────────────────────────────────────
export async function getAllBooks() {
  const rows = await db.select().from(books).orderBy(desc(books.createdAt))
  return rows.map(toBookClient)
}

export async function getBook(id: string) {
  const [row] = await db.select().from(books).where(eq(books.id, id))
  return row ? toBookClient(row) : null
}

export async function createBook(data: CreateBookInput) {
  const now = new Date()
  const [row] = await db.insert(books).values({
    id: data.id,
    title: data.title,
    author: data.author ?? '',
    description: data.description ?? '',
    cover: data.cover ?? '',
    genres: toGenreStr(data.genres ?? []),
    sourceFileName: data.sourceFileName ?? '',
    sourceFileType: (data.sourceFileType as NewBook['sourceFileType']) ?? 'docx',
    chapterCount: data.chapterCount ?? 0,
    createdAt: now,
    updatedAt: now,
  }).returning()
  return toBookClient(row)
}

export type UpdateBookInput = Partial<{
  title: string
  author: string
  description: string
  cover: string
  genres: string | string[]
  sourceFileName: string
  sourceFileType: string
  chapterCount: number
  updatedAt: Date
}>

export async function updateBook(id: string, data: UpdateBookInput) {
  const { genres, ...rest } = data
  const updateData: Record<string, unknown> = {
    ...rest,
    updatedAt: rest.updatedAt ?? new Date(),
  }
  if (genres !== undefined) {
    updateData.genres = toGenreStr(genres)
  }
  const [row] = await db.update(books).set(updateData).where(eq(books.id, id)).returning()
  return row ? toBookClient(row) : null
}

export async function deleteBook(id: string) {
  await db.delete(books).where(eq(books.id, id))
}

export async function searchBooks(query: string) {
  const rows = await db.select().from(books)
    .where(ilike(books.title, `%${query}%`))
    .orderBy(desc(books.updatedAt))
    .limit(8)
  return rows.map(toBookClient)
}

export async function getAllGenres(): Promise<string[]> {
  const rows = await db.select({ genres: books.genres }).from(books)
  const set = new Set<string>()
  for (const r of rows) {
    parseGenres(r.genres).forEach(g => g.trim() && set.add(g.trim()))
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
}

// ── Chapters CRUD ─────────────────────────────────────────────
export async function getChaptersByBook(bookId: string) {
  const rows = await db.select({
    id: chapters.id, bookId: chapters.bookId,
    index: chapters.index, title: chapters.title,
    wordCount: chapters.wordCount,
    createdAt: chapters.createdAt, updatedAt: chapters.updatedAt,
  }).from(chapters).where(eq(chapters.bookId, bookId)).orderBy(chapters.index)
  return rows.map(r => ({
    ...r,
    content: '',
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }))
}

export async function getChapter(id: string) {
  const [row] = await db.select().from(chapters).where(eq(chapters.id, id))
  return row ? toChapterClient(row) : null
}

export type NewChapterInput = {
  id: string
  bookId: string
  index: number
  title: string
  content: string
  wordCount: number
  createdAt?: Date
  updatedAt?: Date
}

export async function saveChapters(data: NewChapterInput[]) {
  if (data.length === 0) return
  const now = new Date()
  const rows: NewChapter[] = data.map(d => ({
    id: d.id,
    bookId: d.bookId,
    index: d.index,
    title: d.title,
    content: d.content,
    wordCount: d.wordCount,
    createdAt: d.createdAt ?? now,
    updatedAt: d.updatedAt ?? now,
  }))
  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(chapters).values(rows.slice(i, i + 50))
      .onConflictDoUpdate({
        target: chapters.id,
        set: {
          title: sql`excluded.title`,
          content: sql`excluded.content`,
          wordCount: sql`excluded.word_count`,
          updatedAt: sql`excluded.updated_at`,
        }
      })
  }
}

export async function deleteChapter(id: string) {
  await db.delete(chapters).where(eq(chapters.id, id))
}

export async function deleteChaptersByBook(bookId: string) {
  await db.delete(chapters).where(eq(chapters.bookId, bookId))
}
