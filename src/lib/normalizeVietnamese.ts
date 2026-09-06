export function normalizeVietnamese(text: string): string {
  if (!text) return ''
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim()
}
export function matchesSearch(title: string, query: string): boolean {
  if (!query.trim()) return true
  return normalizeVietnamese(title).includes(normalizeVietnamese(query)) || title.toLowerCase().includes(query.toLowerCase())
}
