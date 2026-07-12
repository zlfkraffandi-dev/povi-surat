import { X, FileText, Download } from 'lucide-react'
import { EnrichedRequest, buildDetailFields } from '../lib/letterRequests'
import { KopBadge } from './KopBadge'
import { StatusPill } from './StatusPill'
import { WhatsAppBadge } from './WhatsAppBadge'

interface DetailDrawerProps {
  request: EnrichedRequest
  onClose: () => void
  onAjukanUlang?: () => void
}

export function DetailDrawer({ request, onClose, onAjukanUlang }: DetailDrawerProps) {
  const fields = buildDetailFields(request.raw)

  const rows: [string, string][] = [
    ...(request.requesterName ? [['Diajukan Oleh', request.requesterName] as [string, string]] : []),
    ['Diajukan', request.submittedLabel],
    ['Deadline Dibutuhkan', request.deadlineLabel],
    ['Nomor Surat', request.nomorSurat],
  ]

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" style={{ background: 'rgba(10,12,20,0.5)' }} onClick={onClose}>
      <div
        className="modal-in rounded-[26px] w-full max-w-[480px] max-h-[88vh] overflow-y-auto"
        style={{ background: 'var(--modal-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--card-border)' }}>
          <p className="text-[10px] font-extrabold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
            Detail Request
          </p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <KopBadge kop={request.kop} size={46} />
            <div className="flex-1">
              <h3 className="text-[16.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{request.typeName}</h3>
            </div>
            <StatusPill status={request.status} />
          </div>

          <div className="space-y-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[13px]" style={{ background: 'var(--row-bg)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[13px]" style={{ background: 'var(--row-bg)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nomor Telepon PIC</span>
              <WhatsAppBadge waLink={request.picWaLink} phone={request.picPhone} />
            </div>
          </div>

          <div className="flex gap-3">
            {request.googleDocUrl && (
              <a
                href={request.googleDocUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-outline flex-1 flex items-center justify-center gap-2"
              >
                <FileText size={16} /> Buka Google Docs
              </a>
            )}
            {request.hasFile && request.downloadUrl && (
              <a
                href={request.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-xl py-2.5 font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: 'var(--accent-maroon-soft)', color: 'var(--accent-maroon-text)' }}
              >
                <Download size={16} /> Download File
              </a>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Isi yang Diajukan</h4>
            {fields.map((f) => (
              <div key={f.label} className="p-3 rounded-xl text-sm" style={{ background: 'var(--row-bg)' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</p>
                {f.isTable ? (
                  <div className="space-y-1">
                    {(f.rows || []).map((r, i) => (
                      <p key={i} style={{ color: 'var(--text-primary)' }}>{r}</p>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-primary)' }}>{f.value}</p>
                )}
              </div>
            ))}
          </div>

          {request.status === 'revisi' && (
            <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
              <p className="text-sm" style={{ color: '#fb7185' }}>{request.revisionNote}</p>
              {onAjukanUlang && (
                <button onClick={onAjukanUlang} className="btn-primary w-full">Ajukan Ulang</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
