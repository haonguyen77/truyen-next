'use client'
import { useState, useEffect, useRef } from 'react'
import {
  BG_COLORS, BG_ROWS, FONT_OPTIONS,
  FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP,
  LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, LINE_HEIGHT_STEP,
  loadReaderSettings, saveReaderSettings, clearReaderSettings,
  DEFAULT_SETTINGS,
  type ReaderSettings, type BgKey, type FontFamily,
} from '@/lib/readerSettings'
import s from './ReaderSettingsPanel.module.css'

interface Props { onClose: () => void; onChange: (settings: ReaderSettings) => void }

export default function ReaderSettingsPanel({ onClose, onChange }: Props) {
  const [settings, setSettings] = useState<ReaderSettings>(loadReaderSettings)
  const [saved, setSaved] = useState<ReaderSettings>(loadReaderSettings)
  const panelRef = useRef<HTMLDivElement>(null)

  const isDirty = JSON.stringify(settings) !== JSON.stringify(saved)

  useEffect(() => { onChange(settings) }, [settings, onChange])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) { setSettings(saved); onClose() } }
    const t = setTimeout(() => document.addEventListener('mousedown', h), 80)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h) }
  }, [onClose, saved])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSettings(saved); onClose() } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, saved])

  const update = (p: Partial<ReaderSettings>) => setSettings(prev => ({ ...prev, ...p }))

  const handleSave = () => { saveReaderSettings(settings); setSaved(settings); onClose() }
  const handleReset = () => { clearReaderSettings(); setSettings(DEFAULT_SETTINGS); setSaved(DEFAULT_SETTINGS); onClose() }

  const bgCfg = BG_COLORS[settings.bgColor]
  const isDark = ['black'].includes(settings.bgColor)

  return (
    <div className={s.overlay}>
      <div className={s.panel} ref={panelRef} role="dialog" aria-label="Cài đặt đọc truyện">
        <div className={s.header}>
          <span className={s.headerTitle}>⚙ Cài đặt</span>
          <button className={s.closeBtn} onClick={() => { setSettings(saved); onClose() }}>✕</button>
        </div>

        {/* Background color */}
        <div className={s.section}>
          <div className={s.sectionLabel}>🎨 Màu nền</div>
          <div className={s.swatchGrid}>
            {BG_ROWS.map((row, ri) => (
              <div key={ri} className={s.swatchRow}>
                {row.map(key => (
                  <button key={key}
                    className={`${s.swatch} ${settings.bgColor === key ? s.swatchSel : ''}`}
                    style={{ background: BG_COLORS[key].bg }}
                    onClick={() => update({ bgColor: key as BgKey })}
                    title={BG_COLORS[key].label}>
                    {settings.bgColor === key && (
                      <span style={{ color: BG_COLORS[key].text, fontSize: 18, fontWeight: 700 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={s.divider} />

        {/* Font */}
        <div className={s.section}>
          <div className={s.row}>
            <span className={s.rowLabel}>Aa Font chữ</span>
            <select className={s.select} value={settings.fontFamily}
              onChange={e => update({ fontFamily: e.target.value as FontFamily })}>
              {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className={s.divider} />

        {/* Font size */}
        <div className={s.section}>
          <div className={s.row}>
            <span className={s.rowLabel}>Tт Cỡ chữ</span>
            <div className={s.stepper}>
              <button className={s.stepBtn} disabled={settings.fontSize <= FONT_SIZE_MIN}
                onClick={() => update({ fontSize: Math.max(FONT_SIZE_MIN, settings.fontSize - FONT_SIZE_STEP) })}>−</button>
              <span className={s.stepVal}>{settings.fontSize}px</span>
              <button className={s.stepBtn} disabled={settings.fontSize >= FONT_SIZE_MAX}
                onClick={() => update({ fontSize: Math.min(FONT_SIZE_MAX, settings.fontSize + FONT_SIZE_STEP) })}>+</button>
            </div>
          </div>
        </div>

        <div className={s.divider} />

        {/* Line height */}
        <div className={s.section}>
          <div className={s.row}>
            <span className={s.rowLabel}>T↕ Giãn dòng</span>
            <div className={s.stepper}>
              <button className={s.stepBtn} disabled={settings.lineHeight <= LINE_HEIGHT_MIN}
                onClick={() => update({ lineHeight: Math.max(LINE_HEIGHT_MIN, settings.lineHeight - LINE_HEIGHT_STEP) })}>−</button>
              <span className={s.stepVal}>{settings.lineHeight}%</span>
              <button className={s.stepBtn} disabled={settings.lineHeight >= LINE_HEIGHT_MAX}
                onClick={() => update({ lineHeight: Math.min(LINE_HEIGHT_MAX, settings.lineHeight + LINE_HEIGHT_STEP) })}>+</button>
            </div>
          </div>
        </div>

        <div className={s.divider} />

        {/* Preview */}
        <div className={s.preview} style={{
          background: bgCfg.bg, color: bgCfg.text,
          fontFamily: `'${settings.fontFamily}', serif`,
          fontSize: `${Math.min(settings.fontSize, 18)}px`,
          lineHeight: `${settings.lineHeight}%`,
        }}>
          Ánh nắng chiếu qua khung cửa sổ, nàng đứng lặng nhìn ra xa.
        </div>

        {/* Actions */}
        <div className={s.actions}>
          <button className={s.resetBtn} onClick={handleReset}>↺ Mặc định</button>
          <button className={`${s.saveBtn} ${isDirty ? s.saveDirty : ''}`} onClick={handleSave}>
            💾 Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  )
}
