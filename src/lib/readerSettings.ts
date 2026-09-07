/**
 * Reader Settings — localStorage persistence
 * Default: Times New Roman, 24px, 180%, sepia background
 */
export type BgKey = 'pink'|'yellow'|'green'|'teal'|'sepia'|'gray'|'black'|'white'
export type FontFamily = 'Times New Roman'|'Palatino Linotype'|'Literata'|'Patrick Hand'|'Roboto'|'Verdana'|'Tahoma'|'Dancing Script'

export interface ReaderSettings {
  bgColor: BgKey
  fontFamily: FontFamily
  fontSize: number
  lineHeight: number
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  bgColor: 'sepia', fontFamily: 'Times New Roman', fontSize: 24, lineHeight: 180,
}

export const BG_COLORS: Record<BgKey, { bg: string; text: string; label: string }> = {
  pink:   { bg: '#f9e4e4', text: '#2c1a1a', label: 'Hồng nhạt' },
  yellow: { bg: '#fdf6d3', text: '#2c2600', label: 'Vàng nhạt' },
  green:  { bg: '#dff0e0', text: '#1a2c1a', label: 'Xanh lá' },
  teal:   { bg: '#daeaf0', text: '#1a2a30', label: 'Xanh lam' },
  sepia:  { bg: '#e8d8b4', text: '#2c2010', label: 'Sepia' },
  gray:   { bg: '#e0e0e0', text: '#1a1a1a', label: 'Xám nhạt' },
  black:  { bg: '#1a1a1a', text: '#e8e8e8', label: 'Đen' },
  white:  { bg: '#ffffff', text: '#1a1a1a', label: 'Trắng' },
}

export const BG_ROWS: BgKey[][] = [
  ['pink', 'yellow', 'green', 'teal'],
  ['sepia', 'gray', 'black', 'white'],
]

export const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'Times New Roman',   label: 'Times New Roman' },
  { value: 'Palatino Linotype', label: 'Palatino Linotype' },
  { value: 'Literata',          label: 'Literata' },
  { value: 'Patrick Hand',      label: 'Patrick Hand' },
  { value: 'Roboto',            label: 'Roboto' },
  { value: 'Verdana',           label: 'Verdana' },
  { value: 'Tahoma',            label: 'Tahoma' },
  { value: 'Dancing Script',    label: 'Dancing Script' },
]

export const FONT_SIZE_MIN = 14; export const FONT_SIZE_MAX = 40; export const FONT_SIZE_STEP = 2
export const LINE_HEIGHT_MIN = 120; export const LINE_HEIGHT_MAX = 240; export const LINE_HEIGHT_STEP = 10

const STORAGE_KEY = 'truyen-reader-settings-v2'

export function loadReaderSettings(): ReaderSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? { ...DEFAULT_SETTINGS, ...JSON.parse(r) } : DEFAULT_SETTINGS } catch { return DEFAULT_SETTINGS }
}
export function saveReaderSettings(s: ReaderSettings) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}
export function clearReaderSettings() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
