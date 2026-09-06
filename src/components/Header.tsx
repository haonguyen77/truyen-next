'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { BookOpen, Library, Upload, Settings, Tag, ChevronDown, PenLine } from 'lucide-react'
import s from './Header.module.css'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ id: string; title: string; chapterCount: number }[]>([])
  const [genreOpen, setGenreOpen] = useState(false)
  const [genres, setGenres] = useState<string[]>([])
  const genreRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/genres').then(r => r.json()).then(setGenres).catch(() => {})
  }, [pathname])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (genreRef.current && !genreRef.current.contains(e.target as Node)) setGenreOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setSuggestions([]); return }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/books?q=${encodeURIComponent(query)}`).then(r => r.json()).then(setSuggestions).catch(() => {})
    }, 200)
  }, [query])

  const navItems = [
    { href: '/', label: 'Thư viện', icon: <Library size={15} /> },
    { href: '/admin/import', label: 'Import', icon: <Upload size={15} /> },
    { href: '/admin/write', label: 'Viết', icon: <PenLine size={15} /> },
    { href: '/admin/books', label: 'Quản lý', icon: <Settings size={15} /> },
  ]

  return (
    <header className={s.header}>
      <div className={`container ${s.inner}`}>
        <Link href="/" className={s.logo}>
          <span className={s.logoIcon}><BookOpen size={22} strokeWidth={2.2} /></span>
          <span className={s.logoText}>TRUYỆN MỚI</span>
        </Link>

        <nav className={s.nav}>
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className={`${s.navLink} ${pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? s.active : ''}`}>
              {item.icon}<span>{item.label}</span>
            </Link>
          ))}

          <div className={s.genreWrap} ref={genreRef}>
            <button className={`${s.navLink} ${genreOpen ? s.active : ''}`}
              onClick={() => setGenreOpen(v => !v)}>
              <Tag size={15} /><span>Thể loại</span>
              <ChevronDown size={12} style={{ transform: genreOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </button>
            {genreOpen && (
              <div className={s.genreMenu}>
                <div className={s.genreMenuTitle}>Chọn thể loại</div>
                {genres.length === 0
                  ? <div className={s.genreEmpty}>Chưa có thể loại</div>
                  : genres.map(g => (
                      <button key={g} className={s.genreItem}
                        onClick={() => { router.push(`/?genre=${encodeURIComponent(g)}`); setGenreOpen(false) }}>
                        {g}
                      </button>
                    ))
                }
              </div>
            )}
          </div>
        </nav>

        {/* Search */}
        <div className={s.searchWrap}>
          <div className={s.searchBox}>
            <input className={s.searchInput} placeholder="Tìm tên truyện..."
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setSuggestions([]) } }} />
            <span className={s.searchIcon}>🔍</span>
          </div>
          {suggestions.length > 0 && (
            <div className={s.suggest}>
              {suggestions.map(b => (
                <button key={b.id} className={s.suggestItem}
                  onClick={() => { router.push(`/books/${b.id}`); setQuery(''); setSuggestions([]) }}>
                  <span className={s.suggestTitle}>{b.title}</span>
                  <span className={s.suggestMeta}>{b.chapterCount} chương</span>
                </button>
              ))}
            </div>
          )}
          {query && suggestions.length === 0 && (
            <div className={s.suggest}><div className={s.suggestEmpty}>Không tìm thấy</div></div>
          )}
        </div>
      </div>
    </header>
  )
}
