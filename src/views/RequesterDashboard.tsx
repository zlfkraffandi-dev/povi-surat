import { useEffect, useState } from 'react'
import { LayoutGrid, Hourglass, CheckCircle2, Pencil, Search, Folder, Download, Plus } from 'lucide-react'
import { supabase, UserProfile } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { MainLayout } from '../layouts/MainLayout'
import { StatCard } from '../components/StatCard'
import { KopBadge } from '../components/KopBadge'
import { StatusPill, statusMeta } from '../components/StatusPill'
import { NewRequestModal, ResubmitData } from '../components/NewRequestModal'
import { DetailDrawer } from '../components/DetailDrawer'
import { EnrichedRequest, LetterRequestRow, enrichRequest, fmtDateTime } from '../lib/letterRequests'

interface SuratLainDraft {
  id: string
  hal: string
  nama_kegiatan: string
  created_at: string
}

const FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'revisi', label: 'Revisi' },
]

export function RequesterDashboardContent({ profile }: { profile: UserProfile }) {
  const { pushToast } = useToast()
  const [requests, setRequests] = useState<LetterRequestRow[]>([])
  const [drafts, setDrafts] = useState<SuratLainDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [resubmit, setResubmit] = useState<ResubmitData | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      supabase
        .from('letter_requests')
        .select('*, letter_templates(*)')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setRequests((data as any) || [])),
      supabase
        .from('surat_lain_requests')
        .select('id, hal, nama_kegiatan, created_at')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setDrafts((data as any) || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(load, [profile.id])

  const counts = { pending: 0, approved: 0, revisi: 0 }
  requests.forEach((r) => { if (r.status in counts) (counts as any)[r.status]++ })

  let filtered = requests
  if (filterStatus !== 'all') filtered = filtered.filter((r) => r.status === filterStatus)
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter((r) => r.letter_templates?.name.toLowerCase().includes(q))
  }
  const enriched = filtered.map((r) => enrichRequest(r, false))

  let filteredDrafts: SuratLainDraft[] = []
  if (filterStatus === 'all') {
    filteredDrafts = drafts
    if (search.trim()) {
      const q = search.toLowerCase()
      filteredDrafts = filteredDrafts.filter((d) => d.hal.toLowerCase().includes(q) || d.nama_kegiatan.toLowerCase().includes(q))
    }
  }

  const isEmpty = enriched.length === 0 && filteredDrafts.length === 0
  const detailReq = detailId ? enriched.find((r) => r.id === detailId) : null

  const openAjukanUlang = (r: EnrichedRequest) => {
    setDetailId(null)
    setResubmit({
      id: r.raw.id,
      templateId: r.raw.template_id || '',
      formData: r.raw.form_data,
      tableData: r.raw.table_data,
      neededByDate: r.raw.needed_by_date,
      picPhone: r.raw.pic_phone || '',
    })
    setShowModal(true)
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-end mb-5">
        <button onClick={() => { setResubmit(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Ajukan Surat Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Pending" value={counts.pending} icon={Hourglass} color="#f59e0b" bg="rgba(245,158,11,0.16)" hoverBg="rgba(245,158,11,0.1)" />
        <StatCard label="Approved" value={counts.approved} icon={CheckCircle2} color="#1d3557" bg="rgba(29,53,87,0.16)" hoverBg="rgba(29,53,87,0.1)" />
        <StatCard label="Revisi" value={counts.revisi} icon={Pencil} color="#fb7185" bg="rgba(244,63,94,0.16)" hoverBg="rgba(244,63,94,0.1)" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`pill ${filterStatus === f.value ? 'pill-active' : ''}`}
          >
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto w-60">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari jenis surat..."
            className="input-field pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 92, borderRadius: 20 }} />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-3xl border-2 border-dashed p-16 text-center" style={{ borderColor: 'var(--card-border)' }}>
          <Folder size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-[15.5px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Belum ada request</h3>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Ajukan surat pertamamu dan pantau statusnya di sini.</p>
          <button onClick={() => { setResubmit(null); setShowModal(true) }} className="btn-primary">Ajukan Surat Baru</button>
        </div>
      ) : (
        <div className="space-y-3">
          {enriched.map((r) => (
            <div key={r.id} className="request-card overflow-hidden" onClick={() => setDetailId(r.id)}>
              <div className="p-4 flex items-center gap-3">
                <KopBadge kop={r.kop} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.typeName}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Diajukan {r.submittedLabel}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="px-4 py-3 flex items-center justify-between border-t" style={{ background: 'var(--row-bg)', borderColor: 'var(--card-border)' }}>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Deadline</p>
                  <p className="text-[12.5px] font-bold" style={{ color: r.deadlineUrgent ? '#fb7185' : 'var(--text-primary)' }}>{r.deadlineLabel}</p>
                </div>
                {r.hasFile && r.downloadUrl && (
                  <a
                    href={r.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-[11px] border text-xs font-bold"
                    style={{ borderColor: 'var(--card-border)', color: 'var(--accent-maroon-text)' }}
                  >
                    <Download size={14} /> Download File
                  </a>
                )}
              </div>
            </div>
          ))}

          {filteredDrafts.map((d) => {
            const meta = statusMeta('draft')
            return (
              <div
                key={d.id}
                className="request-card overflow-hidden"
                onClick={() => pushToast('Surat Lain diproses manual oleh sekretaris — tidak ada tracking status.', 'info')}
              >
                <div className="p-4 flex items-center gap-3">
                  <KopBadge kop="LAIN" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>Surat Lain — {d.hal}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Diajukan {fmtDateTime(d.created_at)}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ color: meta.color, background: meta.bg }}>Draft</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <NewRequestModal
          onClose={() => setShowModal(false)}
          onSuccess={load}
          resubmit={resubmit}
        />
      )}

      {detailReq && (
        <DetailDrawer
          request={detailReq}
          onClose={() => setDetailId(null)}
          onAjukanUlang={detailReq.status === 'revisi' ? () => openAjukanUlang(detailReq) : undefined}
        />
      )}
    </div>
  )
}

export function RequesterDashboard({ profile }: { profile: UserProfile }) {
  return (
    <MainLayout
      profile={profile}
      title="Dashboard Saya"
      subtitle={`Halo, ${profile.name}`}
      navItems={[{ label: 'Dashboard', icon: LayoutGrid, active: true, onClick: () => {} }]}
    >
      <RequesterDashboardContent profile={profile} />
    </MainLayout>
  )
}
