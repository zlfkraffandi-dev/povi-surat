import { useEffect, useState } from 'react'
import { Home, LayoutGrid, Table2, Bell, Inbox, AlarmClock, CheckCircle2, BarChart3, Search, CheckCircle, XCircle, FileText, Download } from 'lucide-react'
import { supabase, UserProfile } from '../lib/supabase'
import { MainLayout } from '../layouts/MainLayout'
import { StatCard } from '../components/StatCard'
import { KopBadge } from '../components/KopBadge'
import { StatusPill } from '../components/StatusPill'
import { RevisiModal } from '../components/RevisiModal'
import { DetailDrawer } from '../components/DetailDrawer'
import { LoadingOverlay } from '../components/LoadingOverlay'
import { ResultModal } from '../components/ResultModal'
import { TabelSurat } from './TabelSurat'
import { RequesterDashboardContent } from './RequesterDashboard'
import { LetterRequestRow, enrichRequest, daysUntil } from '../lib/letterRequests'
import { getFunctionErrorMessage } from '../lib/functionError'

const FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'revisi', label: 'Revisi' },
]

export function SekretarisDashboard({ profile }: { profile: UserProfile }) {
  const [tab, setTab] = useState<'dashboard' | 'monitoring' | 'table'>('dashboard')
  const [requests, setRequests] = useState<LetterRequestRow[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [revisiTargetId, setRevisiTargetId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null)

  const load = () => {
    supabase
      .from('letter_requests')
      .select('*, letter_templates(*), users(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRequests((data as any) || []))
  }

  useEffect(load, [])

  const perluReview = requests.filter((r) => r.status === 'pending').length
  const deadlineMendesak = requests.filter((r) => (r.status === 'pending' || r.status === 'revisi') && daysUntil(r.needed_by_date) <= 2).length
  const todayStr = new Date().toISOString().slice(0, 10)
  const approvedHariIni = requests.filter((r) => r.status === 'approved' && r.tanggal_surat === todayStr).length
  const now = new Date()
  const totalBulanIni = requests.filter((r) => {
    const d = new Date(r.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  let filtered = requests
  if (filterStatus !== 'all') filtered = filtered.filter((r) => r.status === filterStatus)
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter((r) => r.letter_templates?.name.toLowerCase().includes(q) || r.users?.name.toLowerCase().includes(q))
  }
  const enriched = filtered.map((r) => enrichRequest(r, true))

  const pendingRecent = requests.filter((r) => r.status === 'pending').slice(0, 5).map((r) => enrichRequest(r, true))
  const detailReq = detailId ? enrichRequest(requests.find((r) => r.id === detailId)!, true) : null

  const handleApprove = async (r: LetterRequestRow) => {
    setBusyId(r.id)
    setApproving(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('approve-surat', {
        body: { docId: r.google_doc_id, nomorSurat: r.nomor_surat, namaSurat: r.letter_templates?.name },
      })
      if (fnError) throw new Error(await getFunctionErrorMessage(fnError, 'Gagal menyetujui surat.'))
      if (data?.error) throw new Error(data.error)

      const { error } = await supabase
        .from('letter_requests')
        .update({ status: 'approved', current_folder: 'approved', drive_file_id: data.pdf_file_id })
        .eq('id', r.id)
      if (error) throw error

      load()
      setResult({ type: 'success', title: 'Surat Disetujui', message: `Nomor surat ${r.nomor_surat} disetujui. File PDF sudah dipindahkan ke folder Approved.` })
    } catch (err: any) {
      setResult({ type: 'error', title: 'Gagal Menyetujui Surat', message: err.message || 'Terjadi kesalahan tidak diketahui.' })
    } finally {
      setBusyId(null)
      setApproving(false)
    }
  }

  const confirmRevisi = async (note: string) => {
    if (!revisiTargetId) return
    setBusyId(revisiTargetId)
    try {
      const { error } = await supabase
        .from('letter_requests')
        .update({ status: 'revisi', revision_note: note })
        .eq('id', revisiTargetId)
      if (error) throw error
      setRevisiTargetId(null)
      load()
      setResult({ type: 'success', title: 'Revisi Terkirim', message: 'Catatan revisi terkirim ke requester.' })
    } catch (err: any) {
      setResult({ type: 'error', title: 'Gagal Mengirim Revisi', message: err.message || 'Terjadi kesalahan tidak diketahui.' })
    } finally {
      setBusyId(null)
    }
  }

  const navItems = [
    { label: 'Dashboard', icon: Home, active: tab === 'dashboard', onClick: () => setTab('dashboard') },
    { label: 'Monitoring', icon: LayoutGrid, active: tab === 'monitoring', onClick: () => setTab('monitoring') },
    { label: 'Tabel Surat', icon: Table2, active: tab === 'table', onClick: () => setTab('table') },
  ]

  const notifButton = (
    <div className="relative">
      <button
        onClick={() => setNotifOpen((v) => !v)}
        className="w-[38px] h-[38px] rounded-xl border flex items-center justify-center relative"
        style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}
      >
        <Bell size={18} />
        {perluReview > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
            style={{ background: '#f43f5e' }}
          >
            {perluReview}
          </span>
        )}
      </button>
      {notifOpen && (
        <div
          className="absolute right-0 top-11 w-80 rounded-2xl border z-20 overflow-hidden"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          {pendingRecent.length === 0 ? (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Tidak ada notifikasi</p>
          ) : (
            pendingRecent.map((r) => (
              <button
                key={r.id}
                onClick={() => { setNotifOpen(false); setDetailId(r.id) }}
                className="w-full text-left p-3.5 border-b last:border-0"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.typeName}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.requesterName} · {r.submittedLabel}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )

  return (
    <MainLayout
      profile={profile}
      title={tab === 'dashboard' ? 'Dashboard Saya' : tab === 'monitoring' ? 'Monitoring Persuratan' : 'Tabel Surat'}
      subtitle={
        tab === 'dashboard' ? `Halo, ${profile.name}` :
        tab === 'monitoring' ? 'Semua request dari seluruh requester' : 'Daftar lengkap seluruh surat'
      }
      navItems={navItems}
      rightExtra={notifButton}
    >
      {tab === 'dashboard' ? (
        <RequesterDashboardContent profile={profile} />
      ) : tab === 'monitoring' ? (
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Perlu Direview" value={perluReview} icon={Inbox} color="#f59e0b" bg="rgba(245,158,11,0.16)" hoverBg="rgba(245,158,11,0.1)" />
            <StatCard label="Deadline Mendesak" value={deadlineMendesak} icon={AlarmClock} color="#fb7185" bg="rgba(244,63,94,0.16)" hoverBg="rgba(244,63,94,0.1)" />
            <StatCard label="Approved Hari Ini" value={approvedHariIni} icon={CheckCircle2} color="#1d3557" bg="rgba(29,53,87,0.16)" hoverBg="rgba(29,53,87,0.1)" />
            <StatCard label="Total Bulan Ini" value={totalBulanIni} icon={BarChart3} color="#14532d" bg="rgba(20,83,45,0.16)" hoverBg="rgba(20,83,45,0.1)" />
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
            <div className="relative ml-auto w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari jenis surat / requester..."
                className="input-field pl-9"
              />
            </div>
          </div>

          {enriched.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed p-16 text-center" style={{ borderColor: 'var(--card-border)' }}>
              <Inbox size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-[15.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Tidak ada request</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {enriched.map((r) => (
                <div key={r.id} className="request-card overflow-hidden" onClick={() => setDetailId(r.id)}>
                  <div className="p-4 flex items-center gap-3">
                    <KopBadge kop={r.kop} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.typeName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Diajukan oleh <b style={{ color: 'var(--text-secondary)' }}>{r.requesterName}</b> · {r.submittedLabel}
                      </p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  <div
                    className="px-4 py-3 flex items-center justify-between border-t"
                    style={{ background: 'var(--row-bg)', borderColor: 'var(--card-border)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Deadline</p>
                      <p className="text-[12.5px] font-bold" style={{ color: r.deadlineUrgent ? '#fb7185' : 'var(--text-primary)' }}>{r.deadlineLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.hasFile && r.downloadUrl && (
                        <a href={r.downloadUrl} target="_blank" rel="noreferrer" title="Download File PDF"
                           className="w-8 h-8 rounded-lg border flex items-center justify-center" style={{ borderColor: 'var(--card-border)', color: 'var(--accent-maroon-text)' }}>
                          <Download size={15} />
                        </a>
                      )}
                      {r.googleDocUrl && (
                        <a href={r.googleDocUrl} target="_blank" rel="noreferrer" title="Buka Google Docs"
                           className="w-8 h-8 rounded-lg border flex items-center justify-center" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                          <FileText size={15} />
                        </a>
                      )}
                      {(r.status === 'pending' || r.status === 'revisi') && (
                        <>
                          <button
                            onClick={() => handleApprove(r.raw)}
                            disabled={busyId === r.id}
                            title="Approve"
                            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                            style={{ background: 'rgba(20,83,45,0.16)', color: '#14532d' }}
                          >
                            <CheckCircle size={15} />
                          </button>
                          <button
                            onClick={() => setRevisiTargetId(r.id)}
                            disabled={busyId === r.id}
                            title="Minta Revisi"
                            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                            style={{ background: 'rgba(244,63,94,0.16)', color: '#fb7185' }}
                          >
                            <XCircle size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <TabelSurat requests={requests} onApprove={handleApprove} onRevisi={(id) => setRevisiTargetId(id)} onOpenDetail={setDetailId} busyId={busyId} />
      )}

      {revisiTargetId && (
        <RevisiModal
          onCancel={() => setRevisiTargetId(null)}
          onConfirm={confirmRevisi}
          submitting={busyId === revisiTargetId}
        />
      )}

      {detailReq && <DetailDrawer request={detailReq} onClose={() => setDetailId(null)} />}

      {approving && <LoadingOverlay text="Menyetujui surat & memindahkan file..." fixed />}

      {result && (
        <ResultModal
          type={result.type}
          title={result.title}
          message={result.message}
          onClose={() => setResult(null)}
        />
      )}
    </MainLayout>
  )
}
