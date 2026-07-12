import { useState } from 'react'
import { Search, FileText, Download } from 'lucide-react'
import { LetterRequestRow, enrichRequest } from '../lib/letterRequests'
import { kopColor } from '../components/KopBadge'
import { StatusPill } from '../components/StatusPill'
import { WhatsAppBadge } from '../components/WhatsAppBadge'

interface TabelSuratProps {
  requests: LetterRequestRow[]
  onApprove: (row: LetterRequestRow) => void
  onRevisi: (id: string) => void
  onOpenDetail: (id: string) => void
  busyId: string | null
}

const GRID = '0.95fr 1.05fr 0.35fr 0.9fr 0.65fr 0.85fr 0.85fr 0.75fr 0.85fr 0.75fr'

export function TabelSurat({ requests, onApprove, onRevisi, onOpenDetail, busyId }: TabelSuratProps) {
  const [search, setSearch] = useState('')

  let rows = requests
  if (search.trim()) {
    const q = search.toLowerCase()
    rows = rows.filter((r) => r.letter_templates?.name.toLowerCase().includes(q) || r.users?.name.toLowerCase().includes(q))
  }
  const enriched = rows.map((r) => enrichRequest(r, true))

  const handleStatusChange = (row: LetterRequestRow, value: string) => {
    if (value === 'approved') onApprove(row)
    else if (value === 'revisi') onRevisi(row.id)
  }

  return (
    <div className="page-container">
      <div className="relative w-72 mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari jenis surat / requester..."
          className="input-field pl-9"
        />
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {enriched.map((r) => (
          <div
            key={r.id}
            onClick={() => onOpenDetail(r.id)}
            className="rounded-2xl border p-4 cursor-pointer transition-transform active:scale-[0.985]"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{r.requesterName}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.typeName}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold text-white" style={{ background: kopColor(r.kop) }}>{r.kop}</span>
                <StatusPill status={r.status} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-t border-b" style={{ borderColor: 'var(--card-border)' }}>
              <div>
                <p className="text-[9.5px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Diajukan</p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{r.submittedLabel}</p>
              </div>
              <div>
                <p className="text-[9.5px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Deadline</p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: r.deadlineUrgent ? '#fb7185' : 'var(--text-primary)' }}>{r.deadlineLabel}</p>
              </div>
              <div>
                <p className="text-[9.5px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Nomor Surat</p>
                <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>{r.nomorSurat || '-'}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3" onClick={(e) => e.stopPropagation()}>
              <WhatsAppBadge waLink={r.picWaLink} phone={r.picPhone} />
              <div className="flex items-center gap-2">
                {r.googleDocUrl && (
                  <a href={r.googleDocUrl} target="_blank" rel="noreferrer" title="Buka Google Docs"
                     className="w-9 h-9 rounded-xl border flex items-center justify-center" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                    <FileText size={15} />
                  </a>
                )}
                {r.hasFile && r.downloadUrl && (
                  <a href={r.downloadUrl} target="_blank" rel="noreferrer" title="Download File PDF"
                     className="w-9 h-9 rounded-xl border flex items-center justify-center" style={{ borderColor: 'var(--accent-maroon-text)', background: 'var(--accent-maroon-soft)', color: 'var(--accent-maroon-text)' }}>
                    <Download size={15} />
                  </a>
                )}
                <select
                  value={r.status}
                  disabled={busyId === r.id}
                  onChange={(e) => handleStatusChange(r.raw, e.target.value)}
                  className="input-field text-xs py-2"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="revisi">Revisi</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        {enriched.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            Tidak ada request yang cocok dengan pencarian ini.
          </p>
        )}
      </div>

      {/* Desktop: full table */}
      <div className="card overflow-x-auto p-0 hidden md:block">
        <div className="min-w-[1100px]">
          <div
            className="grid px-5 py-3 border-b"
            style={{ gridTemplateColumns: GRID, borderColor: 'var(--card-border)' }}
          >
            {['Requester', 'Jenis Surat', 'KOP', 'Diajukan', 'Deadline', 'No. HP PIC', 'Nomor Surat', 'RAW Files', 'Download Files', 'Status'].map((h) => (
              <span key={h} className="text-[10.5px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</span>
            ))}
          </div>

          {enriched.map((r) => (
            <div
              key={r.id}
              className="table-row-hover grid px-5 py-3.5 items-center border-b last:border-0 cursor-pointer transition-colors"
              style={{ gridTemplateColumns: GRID, borderColor: 'var(--card-border)' }}
              onClick={() => onOpenDetail(r.id)}
            >
              <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.requesterName}</span>
              <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.typeName}</span>
              <span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold text-white" style={{ background: kopColor(r.kop) }}>{r.kop}</span>
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.submittedLabel}</span>
              <span className="text-xs font-semibold" style={{ color: r.deadlineUrgent ? '#fb7185' : 'var(--text-primary)' }}>{r.deadlineLabel}</span>
              <span onClick={(e) => e.stopPropagation()}>
                <WhatsAppBadge waLink={r.picWaLink} phone={r.picPhone} />
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.nomorSurat}</span>
              <span onClick={(e) => e.stopPropagation()}>
                {r.googleDocUrl ? (
                  <a href={r.googleDocUrl} target="_blank" rel="noreferrer" title="Buka Google Docs"
                     className="w-8 h-8 rounded-lg border flex items-center justify-center" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                    <FileText size={14} />
                  </a>
                ) : '-'}
              </span>
              <span onClick={(e) => e.stopPropagation()}>
                {r.hasFile && r.downloadUrl ? (
                  <a href={r.downloadUrl} target="_blank" rel="noreferrer" title="Download File PDF"
                     className="w-8 h-8 rounded-lg border flex items-center justify-center" style={{ borderColor: 'var(--accent-maroon-text)', background: 'var(--accent-maroon-soft)', color: 'var(--accent-maroon-text)' }}>
                    <Download size={14} />
                  </a>
                ) : '-'}
              </span>
              <span onClick={(e) => e.stopPropagation()}>
                <select
                  value={r.status}
                  disabled={busyId === r.id}
                  onChange={(e) => handleStatusChange(r.raw, e.target.value)}
                  className="input-field text-xs py-1.5"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="revisi">Revisi</option>
                </select>
              </span>
            </div>
          ))}
        </div>

        {enriched.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            Tidak ada request yang cocok dengan pencarian ini.
          </p>
        )}
      </div>
    </div>
  )
}
