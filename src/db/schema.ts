import { pgTable, text, integer, timestamp, boolean, serial } from 'drizzle-orm/pg-core'

// ── Books ────────────────────────────────────────────────────
export const books = pgTable('books', {
  id:             text('id').primaryKey(),
  title:          text('title').notNull(),
  author:         text('author').notNull().default(''),
  description:    text('description').notNull().default(''),
  cover:          text('cover').notNull().default(''),       // base64 or URL
  genres:         text('genres').notNull().default('[]'),    // JSON array string
  sourceFileName: text('source_file_name').notNull().default(''),
  sourceFileType: text('source_file_type').notNull().default('docx'),
  chapterCount:   integer('chapter_count').notNull().default(0),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
})

// ── Chapters ─────────────────────────────────────────────────
export const chapters = pgTable('chapters', {
  id:        text('id').primaryKey(),
  bookId:    text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  index:     integer('index').notNull(),
  title:     text('title').notNull(),
  content:   text('content').notNull().default(''),
  wordCount: integer('word_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ── Types ─────────────────────────────────────────────────────
export type Book    = typeof books.$inferSelect
export type NewBook = typeof books.$inferInsert
export type Chapter    = typeof chapters.$inferSelect
export type NewChapter = typeof chapters.$inferInsert
