import { Template, FormField } from './templates'

export interface LetterRequestRow {
  id: string
  template_id: string | null
  requester_id: string
  form_data: Record<string, any>
  table_data: Record<string, string>[] | null
  needed_by_date: string
  nomor_surat: string | null
  tanggal_surat: string | null
  google_doc_id: string | null
  google_doc_url: string | null
  drive_file_id: string | null
  status: 'pending' | 'approved' | 'revisi' | 'selesai'
  revision_note: string | null
  pic_phone: string | null
  created_at: string
  letter_templates: Template | null
  users?: { name: string } | null
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return '-'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function daysUntil(iso: string | null): number {
  if (!iso) return 999
  const target = new Date(iso + 'T00:00:00').getTime()
  return Math.ceil((target - Date.now()) / 86400000)
}

// Same normalization as generate-surat's toWaLink: 0-prefixed -> 62, already-62 kept, else prefix 62.
export function toWaLink(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('0') ? '62' + digits.slice(1) : digits.startsWith('62') ? digits : '62' + digits
  return `https://wa.me/${normalized}`
}

export interface EnrichedRequest {
  id: string
  typeName: string
  kop: string
  requesterName?: string
  submittedLabel: string
  deadlineLabel: string
  deadlineUrgent: boolean
  status: string
  nomorSurat: string
  picPhone: string
  picWaLink: string | null
  googleDocUrl: string | null
  hasFile: boolean
  downloadUrl: string | null
  revisionNote: string | null
  raw: LetterRequestRow
}

export function enrichRequest(row: LetterRequestRow, withRequester: boolean): EnrichedRequest {
  const tpl = row.letter_templates
  const urgent = daysUntil(row.needed_by_date) <= 2 && (row.status === 'pending' || row.status === 'revisi')
  return {
    id: row.id,
    typeName: tpl?.name || row.template_id || '-',
    kop: tpl?.kop_type || 'FS',
    requesterName: withRequester ? row.users?.name : undefined,
    submittedLabel: fmtDateTime(row.created_at),
    deadlineLabel: fmtDate(row.needed_by_date),
    deadlineUrgent: urgent,
    status: row.status,
    nomorSurat: row.nomor_surat || '-',
    picPhone: row.pic_phone || '-',
    picWaLink: toWaLink(row.pic_phone),
    googleDocUrl: row.google_doc_url,
    hasFile: row.status === 'approved' && !!row.drive_file_id,
    downloadUrl: row.drive_file_id ? `https://drive.google.com/file/d/${row.drive_file_id}/view` : null,
    revisionNote: row.revision_note,
    raw: row,
  }
}

export interface DetailField {
  label: string
  isTable: boolean
  value?: string
  rows?: string[]
}

export function buildDetailFields(row: LetterRequestRow): DetailField[] {
  const tpl = row.letter_templates
  if (!tpl) return []
  return tpl.form_schema.map((f: FormField) => {
    let val = row.form_data?.[f.key]
    if (f.type === 'date') val = fmtDate(val)
    return { label: f.label, isTable: false, value: val || '-' }
  }).concat(
    tpl.has_repeatable_table && tpl.repeatable_table_config
      ? [{
          label: tpl.repeatable_table_config.label,
          isTable: true,
          rows: (row.table_data || []).map((r) =>
            tpl.repeatable_table_config!.columns.map((c) => `${c.label}: ${r[c.key] || '-'}`).join(' · ')
          ),
        }]
      : []
  )
}
