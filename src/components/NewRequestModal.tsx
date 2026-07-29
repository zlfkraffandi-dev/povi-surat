import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Upload, Link as LinkIcon, Paperclip, Loader2 } from 'lucide-react'
import { supabase, getCurrentUserProfile } from '../lib/supabase'
import { Template, RepeatableConfig, FormField } from '../lib/templates'
import { LampiranItem } from '../lib/letterRequests'
import { getFunctionErrorMessage, sanitizeErrorMessage } from '../lib/functionError'
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

function formatPlaceholders(data: Record<string, string>, _schema: FormField[]): Record<string, string> {
  return { ...data }
}

const SECTION_HINTS: Record<string, string> = {
  'Loading In': 'Waktu bongkar muat / persiapan memasukkan barang ke venue',
  'Loading Out': 'Waktu bongkar muat / mengeluarkan barang dari venue setelah acara',
  'Exhibition': 'Waktu pelaksanaan pameran / acara utama',
}

// Groups consecutive fields marked `compact` into rows of up to 3 (e.g. Hari/Tanggal/Waktu
// triplets), others stay full-width. Capped at 3 so back-to-back triplets (like the four
// Loading In/Exhibition/Loading Out rows in Permohonan Penyelenggaraan) don't merge into one row.
const MAX_COMPACT_GROUP = 3
function groupFields(fields: FormField[]): FormField[][] {
  const groups: FormField[][] = []
  fields.forEach((field) => {
    const lastGroup = groups[groups.length - 1]
    // A new section (e.g. "Loading In H-2" after "Loading In H-1") always starts
    // its own row, even mid-count — otherwise a 5-field section spills its
    // last fields into the next section's first row.
    const sameSection = lastGroup && splitLabel(field.label).section === splitLabel(lastGroup[0].label).section
    if (field.compact && lastGroup && lastGroup[0].compact && lastGroup.length < MAX_COMPACT_GROUP && sameSection) {
      lastGroup.push(field)
    } else {
      groups.push([field])
    }
  })
  return groups
}

// Splits a "Section: Field" label into its section heading and short field label; labels
// without a colon (most templates) are left untouched with no section heading.
function splitLabel(label: string): { section: string | null; short: string } {
  const idx = label.indexOf(': ')
  if (idx === -1) return { section: null, short: label }
  return { section: label.slice(0, idx), short: label.slice(idx + 2) }
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
  const [lampiranList, setLampiranList] = useState<LampiranItem[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [dragOver, setDragOver] = useState(false)
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
    supabase.from('letter_templates').select('*').eq('is_active', true).order('name').then(({ data }) => {
      setTemplates((data as any) || [])
    })
  }, [])

  const selected = templates.find((t) => t.id === selectedId) || null
  const isLain = selectedId === 'lain'

  // Auto-save draft to localStorage (only for new requests, not resubmit)
  const draftKey = selected && !resubmit ? `draft_${selected.id}` : null

  // Restore draft on template select
  useEffect(() => {
    if (!draftKey || resubmit) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (!saved) return
      const draft = JSON.parse(saved)
      if (draft.formData && Object.keys(formData).length === 0) setFormData(draft.formData)
      if (draft.tableRows) setTableRows(draft.tableRows)
      if (draft.deadline && !deadline) setDeadline(draft.deadline)
      if (draft.picPhone && !picPhone) setPicPhone(draft.picPhone)
      if (draft.divisi && !divisi) setDivisi(draft.divisi)
      if (draft.catatan && !catatan) setCatatan(draft.catatan)
    } catch {}
  }, [draftKey])

  const fillDemoData = () => {
    if (!selected && !isLain) return
    const demo = isLain
      ? {
          kepada: 'Bapak/Ibu Dosen',
          hal: 'Undangan Kegiatan',
          tanggal: new Date().toISOString().slice(0, 10),
          waktuTempat: '08:00 WIB, Ruang 1',
          namaKegiatan: 'Demo Acara',
          picPhone: '081234567890',
        }
      : selected?.form_schema.reduce((acc, f) => {
          let val = 'Demo Data'
          if (f.type === 'number') val = '100.000'
          if (f.type === 'select' && f.options) val = f.options[0]
          return { ...acc, [f.key]: val }
        }, {}) || {}
    if (isLain) {
      setLainKepada(demo.kepada)
      setLainHal(demo.hal)
      setLainTanggal(demo.tanggal)
      setLainWaktuTempat(demo.waktuTempat)
      setLainNamaKegiatan(demo.namaKegiatan)
      setLainPicPhone(demo.picPhone)
    } else {
      setFormData(demo as Record<string, string>)
      setDeadline(new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10))
      setPicPhone('081234567890')
      setDivisi(DIVISI_OPTIONS[0])
    }
  }

  // Save draft on change (debounced via timeout)
  useEffect(() => {
    if (!draftKey || resubmit) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ formData, tableRows, deadline, picPhone, divisi, catatan }))
      } catch {}
    }, 500)
    return () => clearTimeout(timer)
  }, [draftKey, formData, tableRows, deadline, picPhone, divisi, catatan])

  // Clear draft on successful submit
  const clearDraft = () => { if (draftKey) localStorage.removeItem(draftKey) }

  const handleSelectTemplate = (id: string) => {
    setSelectedId(id)
    setErrorMsg('')
    const tpl = templates.find((t) => t.id === id)
    setFormData(tpl ? tpl.form_schema.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}) : {})
    setTableRows(tpl?.has_repeatable_table ? [emptyRow(tpl)] : [])
  }

  const addRow = () => selected && setTableRows((prev) => [...prev, emptyRow(selected)])
  const removeRow = (index: number) => setTableRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

  // Each file uploads independently and drops out of uploadingFiles as soon as
  // it finishes, so a batch of files shows per-file progress instead of one
  // all-or-nothing spinner.
  const uploadOneFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`File "${file.name}" terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimal 5 MB.`)
      return
    }
    setUploadingFiles((prev) => [...prev, file.name])
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const { data, error } = await supabase.functions.invoke('upload-lampiran', {
        body: { fileName: file.name, mimeType: file.type, base64Content, jenisSurat: selected?.name || (isLain ? 'Surat Lain' : '') },
      })
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Gagal upload lampiran.'))
      if (data?.error) throw new Error(data.error)
      setLampiranList((prev) => [...prev, { type: 'file', url: data.url, name: file.name, driveFileId: data.driveFileId }])
    } catch (err: any) {
      setErrorMsg(`Gagal upload "${file.name}": ${sanitizeErrorMessage(err.message || '', 'Gagal upload lampiran.')}`)
    } finally {
      setUploadingFiles((prev) => prev.filter((n) => n !== file.name))
    }
  }

  const uploadFiles = (files: FileList | File[]) => {
    setErrorMsg('')
    Array.from(files).forEach((file) => uploadOneFile(file))
  }

  const addLampiranLink = () => {
    if (!linkInput.trim()) return
    setLampiranList((prev) => [...prev, { type: 'link', url: linkInput.trim(), name: linkInput.trim() }])
    setLinkInput('')
  }

  const removeLampiran = (index: number) => setLampiranList((prev) => prev.filter((_, i) => i !== index))

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
        lampiran: lampiranList.length > 0 ? lampiranList : null,
      })
      if (error) throw error

      onSuccess()
      setResult({ type: 'success', title: 'Draft Tersimpan', message: 'Draft surat lain tersimpan, akan diproses manual oleh sekretaris.' })
    } catch (err: any) {
      setResult({ type: 'error', title: 'Gagal Menyimpan Draft', message: sanitizeErrorMessage(err.message || '', 'Gagal menyimpan draft.') })
    } finally {
      setSubmitting(false)
    }
  }

  const validateForm = (): boolean => {
    if (!selected) { setErrorMsg('Pilih jenis surat terlebih dahulu.'); return false }
    for (const f of selected.form_schema) {
      if (!formData[f.key] || !String(formData[f.key]).trim()) {
        setErrorMsg(`Field "${f.label}" wajib diisi.`)
        return false
      }
    }
    if (selected.has_repeatable_table) {
      const filled = tableRows.some((r) => Object.values(r).some((v) => v && v.trim()))
      if (!filled) { setErrorMsg(`Isi minimal 1 baris pada "${selected.repeatable_table_config?.label}".`); return false }
    }
    if (!deadline) { setErrorMsg('Deadline dibutuhkan wajib diisi.'); return false }
    if (!picPhone.trim()) { setErrorMsg('Nomor telepon PIC wajib diisi.'); return false }
    if (!divisi) { setErrorMsg('Divisi wajib dipilih.'); return false }
    return true
  }

  const handlePreview = () => {
    setErrorMsg('')
    if (validateForm()) setShowPreview(true)
  }

  const submitTemplateRequest = async () => {
    if (!selected || !validateForm()) return

    setSubmitting(true)
    setErrorMsg('')
    try {
      const profile = await getCurrentUserProfile()
      if (!profile) throw new Error('Profil pengguna tidak ditemukan')

      const selectField = selected.form_schema.find((f) => f.type === 'select')
      const templateDocId = selected.doc_id_by_option && selectField
        ? selected.doc_id_by_option[formData[selectField.key]]
        : selected.google_doc_template_id
      if (!templateDocId) throw new Error(`Dokumen untuk pilihan "${selectField ? formData[selectField.key] : ''}" belum tersedia.`)

      if (resubmit) {
        // Regenerate the Google Doc with updated data so the document stays in
        // sync with the revised form_data.
        const { data, error: fnError } = await supabase.functions.invoke('generate-surat', {
          body: {
            template_doc_id: templateDocId,
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
          },
        })
        if (fnError) throw new Error(await getFunctionErrorMessage(fnError, 'Gagal membuat ulang surat.'))
        if (data?.error) throw new Error(data.error)

        const { error } = await supabase
          .from('letter_requests')
          .update({
            form_data: formData,
            table_data: selected.has_repeatable_table ? tableRows : null,
            needed_by_date: deadline,
            pic_phone: picPhone,
            status: 'pending',
            revision_note: null,
            lampiran: lampiranList.length > 0 ? lampiranList : null,
            google_doc_id: data.doc_id,
            google_doc_url: `https://docs.google.com/document/d/${data.doc_id}/edit`,
            nomor_surat: data.nomor_surat,
          })
          .eq('id', resubmit.id)
        if (error) throw error
        onSuccess()
        clearDraft()
        setResult({ type: 'success', title: 'Berhasil Diajukan Ulang', message: `Dokumen diperbarui dengan data terbaru (${data.nomor_surat}). Menunggu review sekretaris.` })
      } else {
        const { data, error: fnError } = await supabase.functions.invoke('generate-surat', {
          body: {
            template_doc_id: templateDocId,
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
          lampiran: lampiranList.length > 0 ? lampiranList : null,
        })
        if (insertError) throw insertError
        onSuccess()
        clearDraft()
        setResult({ type: 'success', title: 'Surat Berhasil Diajukan', message: `Nomor surat ${data.nomor_surat} telah dibuat. Menunggu review sekretaris.` })
      }
    } catch (err: any) {
      setResult({ type: 'error', title: 'Gagal Mengirim Request', message: sanitizeErrorMessage(err.message || '', 'Gagal mengirim request.') })
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
          <h2 className="text-lg font-extrabold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            {resubmit ? 'Ajukan Ulang Surat' : 'Ajukan Surat Baru'}
            {!resubmit && <button onClick={fillDemoData} className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold uppercase tracking-wider">Isi Demo</button>}
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
              {(() => {
                let prevSection: string | null = null
                return groupFields(selected.form_schema).map((group, gi) => {
                  const section = splitLabel(group[0].label).section
                  const showHeading = section !== null && section !== prevSection
                  prevSection = section
                  return (
                    <div key={gi} className={showHeading ? 'pt-2' : ''}>
                      {showHeading && (
                        <div className="mb-2">
                          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{section}</h4>
                          {SECTION_HINTS[section!.replace(/\s+H-?\d+$/i, '')] && (
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              {SECTION_HINTS[section!.replace(/\s+H-?\d+$/i, '')]}
                            </p>
                          )}
                        </div>
                      )}
                      <div className={group[0].compact ? 'flex flex-wrap gap-3' : ''}>
                        {group.map((field) => {
                          const value = formData[field.key] || ''
                          const filled = value.trim().length > 0
                          const glowClass = filled ? 'input-filled' : ''
                          return (
                            <div key={field.key} className={group[0].compact ? 'flex-1 min-w-[140px]' : ''}>
                              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{splitLabel(field.label).short}</label>
                              {field.type === 'select' ? (
                                <select
                                  value={value}
                                  onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                                  className={`input-field ${glowClass}`}
                                >
                                  <option value="">Pilih...</option>
                                  {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              ) : field.type === 'textarea' ? (
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
                    </div>
                  )
                })
              })()}

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

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Lampiran <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(opsional, boleh lebih dari satu)</span>
                </label>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
                  }}
                  className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-5 text-center cursor-pointer transition-colors"
                  style={{ borderColor: dragOver ? 'var(--accent-maroon-text)' : 'var(--card-border)', background: dragOver ? 'var(--accent-maroon-soft)' : 'var(--row-bg)' }}
                  onClick={() => document.getElementById('lampiran-file-input')?.click()}
                >
                  <input
                    id="lampiran-file-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = '' }}
                  />
                  {uploadingFiles.length > 0 ? (
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-maroon-text)' }} />
                  ) : (
                    <Upload size={20} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {uploadingFiles.length > 0
                      ? `Mengupload ${uploadingFiles.length} file...`
                      : 'Tarik file ke sini atau klik untuk pilih'}
                  </p>
                </div>

                <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLampiranLink() } }}
                    placeholder="Atau tempel link (Contoh: https://drive.google.com/...)"
                    className="input-field flex-1 text-sm"
                  />
                  <button type="button" onClick={addLampiranLink} className="btn-outline flex items-center gap-1.5 text-sm px-3">
                    <LinkIcon size={14} /> Tambah
                  </button>
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  ⚠️ Pastikan link bisa diakses siapa saja (Anyone with the link). Link Google Drive pribadi akan muncul "Access Denied" bagi sekretaris.
                </p>

                {(lampiranList.length > 0 || uploadingFiles.length > 0) && (
                  <div className="space-y-1.5 mt-2">
                    {uploadingFiles.map((name) => (
                      <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--row-bg)', opacity: 0.7 }}>
                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-maroon-text)' }} />
                        <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{name}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mengupload...</span>
                      </div>
                    ))}
                    {lampiranList.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--row-bg)' }}>
                        {item.type === 'file' ? <Paperclip size={14} style={{ color: 'var(--text-muted)' }} /> : <LinkIcon size={14} style={{ color: 'var(--text-muted)' }} />}
                        <span className="truncate flex-1" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                        <button onClick={() => removeLampiran(i)} style={{ color: '#fb7185' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!selected.google_doc_template_id && !selected.doc_id_by_option && (
                <p className="text-sm" style={{ color: '#fb7185' }}>Template dokumen belum diset, tidak bisa submit dulu.</p>
              )}
              {errorMsg && <p className="text-sm font-semibold" style={{ color: '#fb7185' }}>{errorMsg}</p>}

              {showPreview ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--row-bg)', border: '1px solid var(--card-border)' }}>
                    <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>📋 Ringkasan Data — Periksa sebelum submit</h4>
                    {selected.form_schema.map((f) => (
                      <div key={f.key} className="flex justify-between gap-2 text-sm">
                        <span style={{ color: 'var(--text-muted)' }}>{splitLabel(f.label).short}</span>
                        <span className="font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{formData[f.key] || '-'}</span>
                      </div>
                    ))}
                    {selected.has_repeatable_table && selected.repeatable_table_config && (
                      <div className="pt-1">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{selected.repeatable_table_config.label}: {tableRows.length} baris</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 text-sm pt-1 border-t" style={{ borderColor: 'var(--card-border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Divisi</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{divisi}</span>
                    </div>
                    <div className="flex justify-between gap-2 text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>Deadline</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{deadline}</span>
                    </div>
                    <div className="flex justify-between gap-2 text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>PIC Phone</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{picPhone}</span>
                    </div>
                    {lampiranList.length > 0 && (
                      <div className="flex justify-between gap-2 text-sm">
                        <span style={{ color: 'var(--text-muted)' }}>Lampiran</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{lampiranList.length} file</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowPreview(false)} className="btn-outline flex-1">← Kembali Edit</button>
                    <button
                      onClick={submitTemplateRequest}
                      disabled={submitting}
                      className="btn-primary flex-1 disabled:opacity-50"
                    >
                      {submitting ? 'Mengirim...' : 'Konfirmasi & Submit'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handlePreview}
                  disabled={uploadingFiles.length > 0 || (!selected.google_doc_template_id && !selected.doc_id_by_option)}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {uploadingFiles.length > 0 ? 'Menunggu upload lampiran...' : 'Preview & Submit'}
                </button>
              )}
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
