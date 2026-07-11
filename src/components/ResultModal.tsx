import { CheckCircle, AlertTriangle } from 'lucide-react'

interface ResultModalProps {
  type: 'success' | 'error'
  title: string
  message: string
  onClose: () => void
}

export function ResultModal({ type, title, message, onClose }: ResultModalProps) {
  const isSuccess = type === 'success'
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,12,20,0.55)' }}
      onClick={onClose}
    >
      <div
        className="modal-in rounded-3xl w-full max-w-[400px] p-7 text-center"
        style={{ background: 'var(--modal-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 flex items-center justify-center rounded-2xl"
          style={{ width: 52, height: 52, background: isSuccess ? 'rgba(20,83,45,0.14)' : 'rgba(244,63,94,0.14)' }}
        >
          {isSuccess
            ? <CheckCircle size={24} style={{ color: '#14532d' }} />
            : <AlertTriangle size={24} style={{ color: '#fb7185' }} />}
        </div>
        <h3 className="text-lg font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-sm mb-6 whitespace-pre-wrap break-words" style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {message}
        </p>
        <button onClick={onClose} className="btn-primary w-full">OK</button>
      </div>
    </div>
  )
}
