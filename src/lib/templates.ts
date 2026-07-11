export interface FormField {
  key: string
  type: 'text' | 'date' | 'textarea' | 'number' | 'time'
  label: string
  placeholder?: string
  compact?: boolean
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
}
