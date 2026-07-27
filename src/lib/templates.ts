export interface FormField {
  key: string
  type: 'text' | 'date' | 'textarea' | 'number' | 'time' | 'select'
  label: string
  placeholder?: string
  compact?: boolean
  options?: string[]
}

export interface RepeatableColumn {
  key: string
  type: 'text' | 'date' | 'time' | 'number'
  label: string
}

export interface RepeatableConfig {
  key: string
  label: string
  columns: RepeatableColumn[]
  computeLabel?: string
}

export interface Template {
  id: string
  slug: string
  name: string
  kop_type: 'FS' | 'POVI'
  kode_surat: '01' | '02' | '03'
  google_doc_template_id: string | null
  form_schema: FormField[]
  has_repeatable_table: boolean
  repeatable_table_config: RepeatableConfig | null
  requires_nomor_surat: boolean
  // Templates with multiple recipient-specific document variants (e.g. Izin
  // Keramaian: Dishub/Polres/RT-RW) key their real doc id here instead of
  // google_doc_template_id, keyed by the value of the template's single
  // 'select' field.
  doc_id_by_option: Record<string, string> | null
}
