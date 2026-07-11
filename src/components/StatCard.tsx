import { useState } from 'react'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ComponentType<{ size?: number }>
  color: string
  bg: string
  hoverBg: string
}

export function StatCard({ label, value, icon: Icon, color, bg, hoverBg }: StatCardProps) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className="stat-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        transform: hover ? 'translateY(-3px)' : undefined,
        borderColor: hover ? color : 'var(--card-border)',
        background: hover ? hoverBg : 'var(--card-bg)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12.5px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-[28px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        </div>
        <div className="flex items-center justify-center rounded-[11px] shrink-0" style={{ width: 34, height: 34, background: bg, color }}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}
