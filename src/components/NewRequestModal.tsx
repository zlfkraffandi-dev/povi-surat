import { useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { supabase, getCurrentUserProfile } from '../lib/supabase'
import { Template, RepeatableConfig, FormField } from '../lib/templates'
import { getFunctionErrorMessage } from '../lib/functionError'
import { LoadingOverlay } from './LoadingOverlay'
import { ResultModal } from './ResultModal'

const KATEGORI_BY_KODE: Record<string, string> = {
  '01': 'permohonan',
  '02': 'undangan',
  '03': 'sertifikat',
}

const DIVISI_OPTIONS = [
  'Acara',
  'Admin',
  'Art Design',
  'Badan Pengurus Harian',
  'Cinematography',
  'Content Creator',
  'Content Planning',
  'Copywriting',
  'Dana Usaha',
  'Dekor',
  'Display',
  'Keamanan',
  'Konsumsi',
  'Liaison Officer',
  'Media Partner',
  'Perlengkapan',
  'PJ Karya',
  'Publikasi Offline',
  'Sponsorship',
  'Website',
]

export interface ResubmitData {
  id: string
  templateId: string
  formData: Record<string, string>
  tableData: Record<string, string>[] | null
  neededByDate: string
  picPhone: string
}

interface NewRequestModalProps {
  onClose: () => void
  onSuccess: () => void
  resubmit?: ResubmitData | null
}

function emptyRow(template: Template): Record<string, string> {
  const row: Record<string, string> = {}
  template.repeatable_table_config?.columns.forEach((col) => { row[col.key] = '' })
  return row
}

function formatRupiah(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  return 'Rp ' + Number(digits).toLocaleString('id-ID')
}

const BULAN_INDONESIA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// ISO yyyy-mm-dd (from <input type="date">) -> "26 Oktober 2026", matching the format
// sekretaris asked for on every date placeholder in the letter templates.
function formatIndoDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${BULAN_INDONESIA[m - 1]} ${y}`
}

// Applies Indonesian date formatting to every `date`-type field, and collapses any
// "<BASE>_MULAI" / "<BASE>_SELESAI" field pair into a single "<BASE>" placeholder written
// as a range (e.g. "13.00 - 15.00 WIB" for time fields, "Senin - Rabu" for text) — this way
// the document template only ever needs the original single {{BASE}} placeholder.
function formatPlaceholders(data: Record<string, string>, schema: FormField[]): Record<string, string> {
  const typeByKey = new Map(schema.map((f) => [f.key, f.type]))
  const dateKeys = new Set(schema.filter((f) => f.type === 'date').map((f) => f.key))
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key.endsWith('_SELESAI') && typeByKey.has(key)) continue // folded into the _MULAI pass below
    if (key.endsWith('_MULAI') && typeByKey.has(key)) {
      const base = key.slice(0, -'_MULAI'.length)
      const endKey = `${base}_SELESAI`
      const isTime = typeByKey.get(key) === 'time'
      out[base] = `${value} - ${data[endKey] || ''}${isTime ? ' WIB' : ''}`
      continue
    }
    out[key] = dateKeys.has(key) ? formatIndoDate(value) : value
  }
  return out
}

// Groups consecutive fields marked `compact` into rows of up to 3 (e.g. Hari/Tanggal/Waktu
// triplets), others stay full-width. Capped at 3 so back-to-back triplets (like the four
// Loading In/Exhibition/Loading Out rows in Permohonan Penyelenggaraan) don't merge into one row.
const MAX_COMPACT_GROUP = 3
function groupFields(fields: FormField[]): FormField[][] {
  const groups: FormField[][] = []
  fields.forEach((field) => {
    const lastGroup = groups[groups.length - 1]
    if (field.compact && lastGroup && lastGroup[0].compact && lastGroup.length < MAX_COMPACT_GROUP) {
      lastGroup.push(field)
    } else {
      groups.push([field])
    }
  })
  return groups
}

function timeToMinutes(value: string): number | null {
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function computeTotalDuration(rows: Record<string, string>[], config: RepeatableConfig): string {
  const timeCols = config.columns.filter((c) => c.type === 'time')
  if (timeCols.length < 2) return '-'
  const [startKey, endKey] = [timeCols[0].key, timeCols[1].key]

  let totalMinutes = 0
  rows.forEach((row) => {
    const start = timeToMinutes(row[startKey])
    const end = timeToMinutes(row[endKey])
    if (start != null && end != null && end > start) totalMinutes += end - start
  })

  if (totalMinutes === 0) return '-'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h} jam${m ? ` ${m} menit` : ''}`
}

export function NewRequestModal({ onClose, onSuccess, resubmit }: NewRequestModalProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState(resubmit?.templateId || '')
  const [formData, setFormData] = useState<Record<string, string>>(resubmit?.formData || {})
  const [tableRows, setTableRows] = useState<Record<string, string>[]>(resubmit?.tableData || [])
  const [deadline, setDeadline] = useState(resubmit?.neededByDate || '')
  const [picPhone, setPicPhone] = useState(resubmit?.picPhone || '')
  const [divisi, setDivisi] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null)

  const [lainKepada, setLainKepada] = useState('')
  const [lainHal, setLainHal] = useState('')
  const [lainTanggal, setLainTanggal] = useState('')
  const [lainWaktuTempat, setLainWaktuTempat] = useState('')
  const [lainNamaKegiatan, setLainNamaKegiatan] = useState('')
  const [lainPicPhone, setLainPicPhone] = useState('')

  useEffect(() => {
    supabase.from('letter_templates').select('*').order('name').then(({ data }) => {
      setTemplates((data as any) || [])
    })
  }, [])

  const selected = templates.find((t) => t.id === selectedId) || null
  const isLain = selectedId === 'lain'

  const handleSelectTemplate = (id: string) => {
    setSelectedId(id)
    setErrorMsg('')
    const tpl = templates.find((t) => t.id === id)
    setFormData(tpl ? tpl.form_schema.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}) : {})
    setTableRows(tpl?.has_repeatable_table ? [emptyRow(tpl)] : [])
  }

  const addRow = () => selected && setTableRows((prev) => [...prev, emptyRow(selected)])
  const removeRow = (index: number) => setTableRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

  const submitSuratLain = async () => {
    if (!lainKepada.trim() || !lainHal.trim() || !lainTanggal || !lainWaktuTempat.trim() || !lainNamaKegiatan.trim() || !lainPicPhone.trim()) {
      setErrorMsg('Semua field wajib diisi.')
      return
    }
    setSubmitting(true)
    setErrorMsg('')
    try {
      const profile = await getCurrentUserProfile()
      if (!profile) throw new Error('Profil pengguna tidak ditemukan')

      const { error } = await supabase.from('surat_lain_requests').insert({
        requester_id: profile.id,
        kepada: lainKepada,
        hal: lainHal,
        hari_tanggal: lainTanggal,
        waktu_tempat: lainWaktuTempat,
        nama_kegiatan: lainNamaKegiatan,
        needed_by_date: lainTanggal,
        pic_phone: lainPicPhone,
      })
      if (error) throw error

      onSuccess()
      setResult({ type: 'success', title: 'Draft Tersimpan', message: 'Draft surat lain tersimpan, akan diproses manual oleh sekretaris.' })
    } catch (err: any) {
      setResult({ type: 'error', title: 'Gagal Menyimpan Draft', message: err.message || 'Terjadi kesalahan tidak diketahui.' })
    } finally {
      setSubmitting(false)
    }
  }

  const submitTemplateRequest = async () => {
    if (!selected) { setErrorMsg('Pilih jenis surat terlebih dahulu.'); return }
    for (const f of selected.form_schema) {
      if (!formData[f.key] || !String(formData[f.key]).trim()) {
        setErrorMsg(`Field "${f.label}" wajib diisi.`)
        return
      }
    }
    if (selected.has_repeatable_table) {
      const filled = tableRows.some((r) => Object.values(r).some((v) => v && v.trim()))
      if (!filled) { setErrorMsg(`Isi minimal 1 baris pada "${selected.repeatable_table_config?.label}".`); return }
    }
    if (!deadline) { setErrorMsg('Deadline dibutuhkan wajib diisi.'); return }
    if (!picPhone.trim()) { setErrorMsg('Nomor telepon PIC wajib diisi.'); return }
    if (!divisi) { setErrorMsg('Divisi wajib dipilih.'); return }

    setSubmitting(true)
    setErrorMsg('')
    try {
      const profile = await getCurrentUserProfile()
      if (!profile) throw new Error('Profil pengguna tidak ditemukan')

      if (resubmit) {
        // ponytail: resubmit reuses the existing doc/nomor surat (no re-generation);
        // full doc regeneration on revisi would need a new edge function, out of scope for now.
        const { error } = await supabase
          .from('letter_requests')
          .update({
            form_data: formData,
            table_data: selected.has_repeatable_table ? tableRows : null,
            needed_by_date: deadline,
            pic_phone: picPhone,
            status: 'pending',
            revision_note: null,
          })
          .eq('id', resubmit.id)
        if (error) throw error
        onSuccess()
        setResult({ type: 'success', title: 'Berhasil Diajukan Ulang', message: 'Request berhasil diajukan ulang, menunggu review sekretaris.' })
      } else {
        const { data, error: fnError } = await supabase.functions.invoke('generate-surat', {
          body: {
            template_doc_id: selected.google_doc_template_id,
            template_slug: selected.slug,
            jenis_kop: selected.kop_type,
            jenis_surat: selected.name,
            kategori_surat: KATEGORI_BY_KODE[selected.kode_surat],
            requester: profile.name,
            divisi,
            pic_phone: picPhone,
            placeholders: formatPlaceholders(formData, selected.form_schema),
            due_date: deadline,
            table_data: selected.has_repeatable_table ? tableRows : null,
            notes: catatan.trim(),
          },
        })
        if (fnError) throw new Error(await getFunctionErrorMessage(fnError, 'Gagal membuat surat.'))
        if (data?.error) throw new Error(data.error)

        const { error: insertError } = await supabase.from('letter_requests').insert({
          template_id: selected.id,
          requester_id: profile.id,
          form_data: formData,
          table_data: selected.has_repeatable_table ? tableRows : null,
          needed_by_date: deadline,
          pic_phone: picPhone,
          nomor_surat: data.nomor_surat,
          tanggal_surat: new Date().toISOString().slice(0, 10),
          google_doc_id: data.doc_id,
          google_doc_url: `https://docs.google.com/document/d/${data.doc_id}/edit`,
          catatan_sekretaris: catatan.trim() || null,
        })
        if (insertError) throw insertError
        onSuccess()
        setResult({ type: 'success', title: 'Surat Berhasil Diajukan', message: `Nomor surat ${data.nomor_surat} telah dibuat. Menunggu review sekretaris.` })
      }
    } catch (err: any) {
      setResult({ type: 'error', title: 'Gagal Mengirim Request', message: err.message || 'Terjadi kesalahan tidak diketahui.' })
    } finally {
      setSubmitting(false)
    }
  }

  const kopFs = templates.filter((t) => t.kop_type === 'FS')
  const kopPovi = templates.filter((t) => t.kop_type === 'POVI')

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(10,12,20,0.5)' }} onClick={onClose}>
      <div
        className="modal-in relative rounded-[26px] w-full max-w-[640px] max-h-[88vh] overflow-y-auto"
        style={{ background: 'var(--modal-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {submitting && <LoadingOverlay text={isLain ? 'Menyimpan draft...' : 'Membuat surat & mengisi dokumen...'} />}

        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--card-border)' }}>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {resubmit ? 'Ajukan Ulang Surat' : 'Ajukan Surat Baru'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!resubmit && (
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Jenis Surat</label>
              <select
                value={selectedId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="input-field"
              >
                <option value="">Pilih jenis surat...</option>
                <optgroup label="KOP FS">
                  {kopFs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
                <optgroup label="KOP POVI">
                  {kopPovi.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
                <optgroup label="Lainnya">
                  <option value="lain">Surat Lain (khusus, tanpa nomor surat)</option>
                </optgroup>
              </select>
            </div>
          )}

          {isLain && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl text-sm" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
                <b style={{ color: '#92400e' }}>Surat Lain</b> — alur khusus, diproses manual oleh sekretaris. Tanpa nomor surat otomatis & tanpa tracking status.
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Kepada</label>
                <input value={lainKepada} onChange={(e) => setLainKepada(e.target.value)} placeholder="Contoh: Dekan Fakultas Sastra" className={`input-field ${lainKepada.trim() ? 'input-filled' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Hal</label>
                <input value={lainHal} onChange={(e) => setLainHal(e.target.value)} placeholder="Perihal surat" className={`input-field ${lainHal.trim() ? 'input-filled' : ''}`} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Hari/Tanggal</label>
                  <input type="date" value={lainTanggal} onChange={(e) => setLainTanggal(e.target.value)} className={`input-field ${lainTanggal ? 'input-filled' : ''}`} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Waktu & Tempat</label>
                  <input value={lainWaktuTempat} onChange={(e) => setLainWaktuTempat(e.target.value)} placeholder="13.00 WIB, Aula FS" className={`input-field ${lainWaktuTempat.trim() ? 'input-filled' : ''}`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Nama Kegiatan</label>
                <input value={lainNamaKegiatan} onChange={(e) => setLainNamaKegiatan(e.target.value)} placeholder="Nama acara/kegiatan" className={`input-field ${lainNamaKegiatan.trim() ? 'input-filled' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Nomor Telepon PIC</label>
                <input value={lainPicPhone} onChange={(e) => setLainPicPhone(e.target.value)} placeholder="Contoh: 0812-3456-7890" className={`input-field ${lainPicPhone.trim() ? 'input-filled' : ''}`} />
              </div>
              {errorMsg && <p className="text-sm font-semibold" style={{ color: '#fb7185' }}>{errorMsg}</p>}
              <button
                onClick={submitSuratLain}
                disabled={submitting}
                className="w-full rounded-xl py-3 font-bold text-sm text-white disabled:opacity-50"
                style={{ background: '#92400e' }}
              >
                {submitting ? 'Mengirim...' : 'Submit Draft (Manual)'}
              </button>
            </div>
          )}

          {selected && (
            <div className="space-y-4">
              {groupFields(selected.form_schema).map((group, gi) => (
                <div key={gi} className={group[0].compact ? 'flex gap-3' : ''}>
                  {group.map((field) => {
                    const value = formData[field.key] || ''
                    const filled = value.trim().length > 0
                    const glowClass = filled ? 'input-filled' : ''
                    return (
                      <div key={field.key} className={group[0].compact ? 'flex-1' : ''}>
                        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={value}
                            onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                            rows={3}
                            className={`input-field ${glowClass}`}
                            placeholder={field.placeholder}
                          />
                        ) : field.type === 'number' ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={value}
                            onChange={(e) => setFormData((p) => ({ ...p, [field.key]: formatRupiah(e.target.value) }))}
                            className={`input-field ${glowClass}`}
                            placeholder={field.placeholder ? `Rp ${field.placeholder.replace(/\D/g, '')}` : 'Rp 0'}
                          />
                        ) : (
                          <input
                            type={field.type}
                            value={value}
                            onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                            className={`input-field ${glowClass}`}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}

              {selected.has_repeatable_table && selected.repeatable_table_config && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selected.repeatable_table_config.label}</h4>

                  <div className="flex gap-2 px-1">
                    {selected.repeatable_table_config.columns.map((col) => (
                      <span
                        key={col.key}
                        className={`text-[10px] font-extrabold uppercase tracking-wider ${col.type === 'time' ? 'w-24 shrink-0' : 'flex-1'}`}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {col.label}
                      </span>
                    ))}
                  </div>

                  {tableRows.map((row, index) => (
                    <div key={index} className="flex gap-2 items-center p-2 rounded-xl" style={{ background: 'var(--row-bg)' }}>
                      {selected.repeatable_table_config!.columns.map((col) => (
                        <input
                          key={col.key}
                          type={col.type}
                          value={row[col.key] || ''}
                          onChange={(e) => setTableRows((prev) => prev.map((r, i) => (i === index ? { ...r, [col.key]: e.target.value } : r)))}
                          placeholder={col.type === 'text' ? col.label : undefined}
                          className={`input-field text-sm ${col.type === 'time' ? 'w-24 shrink-0' : 'flex-1'}`}
                        />
                      ))}
                      {tableRows.length > 1 && (
                        <button onClick={() => removeRow(index)} className="p-2 rounded-lg shrink-0" style={{ color: '#fb7185' }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addRow} className="btn-outline flex items-center gap-2 text-sm">
                    <Plus size={16} /> Tambah Baris
                  </button>

                  {selected.repeatable_table_config.computeLabel && (
                    <p className="text-sm font-semibold" style={{ color: 'var(--accent-maroon-text)' }}>
                      Total {selected.repeatable_table_config.computeLabel} (otomatis): {computeTotalDuration(tableRows, selected.repeatable_table_config)}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Divisi</label>
                  <select value={divisi} onChange={(e) => setDivisi(e.target.value)} className={`input-field ${divisi ? 'input-filled' : ''}`}>
                    <option value="">Pilih divisi...</option>
                    {DIVISI_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Deadline Dibutuhkan</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`input-field ${deadline ? 'input-filled' : ''}`} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Nomor Telepon PIC</label>
                  <input value={picPhone} onChange={(e) => setPicPhone(e.target.value)} placeholder="Contoh: 0812-3456-7890" className={`input-field ${picPhone.trim() ? 'input-filled' : ''}`} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Catatan untuk Sekretaris <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(opsional, tidak masuk ke file surat)</span>
                  </label>
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={2}
                    className={`input-field ${catatan.trim() ? 'input-filled' : ''}`}
                    placeholder="Catatan internal, hanya terlihat oleh sekretaris"
                  />
                </div>
              </div>

              {!selected.google_doc_template_id && (
                <p className="text-sm" style={{ color: '#fb7185' }}>Template dokumen belum diset, tidak bisa submit dulu.</p>
              )}
              {errorMsg && <p className="text-sm font-semibold" style={{ color: '#fb7185' }}>{errorMsg}</p>}

              <button
                onClick={submitTemplateRequest}
                disabled={submitting || !selected.google_doc_template_id}
                className="btn-primary w-full disabled:opacity-50"
              >
                {submitting ? 'Mengirim...' : 'Submit Request'}
              </button>
            </div>
          )}
        </div>
      </div>

      {result && (
        <ResultModal
          type={result.type}
          title={result.title}
          message={result.message}
          onClose={() => {
            const wasSuccess = result.type === 'success'
            setResult(null)
            if (wasSuccess) onClose()
          }}
        />
      )}
    </div>
  )
}
