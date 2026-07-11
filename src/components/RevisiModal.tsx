import { useState } from 'react'

interface RevisiModalProps {
  onCancel: () => void
  onConfirm: (note: string) => void
  submitting?: boolean
}

export function RevisiModal({ onCancel, onConfirm, submitting }: RevisiModalProps) {
  const [note, setNote] = useState('')

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" style={{ background: 'rgba(10,12,20,0.5)' }} onClick={onCancel}>
      <div
        className="modal-in rounded-3xl w-full max-w-[420px] p-6"
        style={{ background: 'var(--modal-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Minta Revisi</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Jelaskan bagian yang perlu diperbaiki oleh requester.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="input-field mb-5"
          placeholder="Catatan revisi..."
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-outline flex-1">Batal</button>
          <button
            onClick={() => note.trim() && onConfirm(note)}
            disabled={submitting}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm text-white disabled:opacity-50"
            style={{ background: '#fb7185' }}
          >
            {submitting ? 'Mengirim...' : 'Kirim Revisi'}
          </button>
        </div>
      </div>
    </div>
  )
}
