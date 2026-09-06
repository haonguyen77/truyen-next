const PALETTE = ['#1e3a5f','#2d5016','#5a1a1a','#3a1a5c','#1a4a3a','#4a3a00','#1a3a4a','#4a1a3a']
function getColor(title: string) {
  let h = 0
  for (let i = 0; i < title.length; i++) h = title.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}
export default function BookCover({ title, cover, size = 48, radius = 5 }: { title: string; cover?: string; size?: number; radius?: number }) {
  if (cover) return <img src={cover} alt={title} style={{ width: size, height: size * 1.4, objectFit: 'cover', borderRadius: radius, display: 'block', flexShrink: 0 }} />
  const initials = title.replace(/[^\p{L}\p{N}]/gu, ' ').trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return (
    <div style={{ width: size, height: size * 1.4, borderRadius: radius, background: getColor(title), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.9)', fontSize: size * 0.3, fontWeight: 800, flexShrink: 0, userSelect: 'none' }}>
      {initials || '?'}
    </div>
  )
}
