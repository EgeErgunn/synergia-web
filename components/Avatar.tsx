const PALETTES = [
  { bg: 'rgba(200,240,96,0.15)',  color: '#c8f060' },
  { bg: 'rgba(138,110,255,0.15)', color: '#9b7dff' },
  { bg: 'rgba(255,140,80,0.15)',  color: '#ff8c50' },
  { bg: 'rgba(80,200,255,0.15)',  color: '#50c8ff' },
  { bg: 'rgba(255,80,160,0.15)',  color: '#ff50a0' },
  { bg: 'rgba(80,255,180,0.15)',  color: '#50ffb4' },
]

interface AvatarProps {
  name: string
  index?: number
  size?: number
}

export default function Avatar({ name, index = 0, size = 38 }: AvatarProps) {
  const { bg, color } = PALETTES[index % PALETTES.length]
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()

  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: bg,
      border: `1px solid ${color}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 600, color,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}
