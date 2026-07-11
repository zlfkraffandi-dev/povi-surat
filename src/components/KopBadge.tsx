const KOP_COLOR: Record<string, string> = {
  FS: 'var(--kop-fs)',
  POVI: 'var(--kop-povi)',
  LAIN: 'var(--surat-lain)',
}

export function kopColor(kop: string) {
  return KOP_COLOR[kop] || 'var(--kop-fs)'
}

interface KopBadgeProps {
  kop: string
  size?: number
}

export function KopBadge({ kop, size = 42 }: KopBadgeProps) {
  return (
    <div
      className="flex items-center justify-center rounded-[13px] text-white font-extrabold shrink-0"
      style={{ width: size, height: size, background: kopColor(kop), fontSize: size * 0.26 }}
    >
      {kop}
    </div>
  )
}
