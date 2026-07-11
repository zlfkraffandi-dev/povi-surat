const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.16)', label: 'Pending' },
  approved: { color: '#1d3557', bg: 'rgba(29,53,87,0.16)', label: 'Approved' },
  revisi: { color: '#fb7185', bg: 'rgba(244,63,94,0.16)', label: 'Revisi' },
  selesai: { color: '#14532d', bg: 'rgba(20,83,45,0.16)', label: 'Selesai' },
  draft: { color: '#92400e', bg: 'rgba(139,92,246,0.14)', label: 'Draft' },
}

export function statusMeta(status: string) {
  return STATUS_STYLE[status] || STATUS_STYLE.pending
}

interface StatusPillProps {
  status: string
}

export function StatusPill({ status }: StatusPillProps) {
  const meta = statusMeta(status)
  return (
    <span
      className="px-2.5 py-1 rounded-lg text-xs font-bold shrink-0"
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  )
}
