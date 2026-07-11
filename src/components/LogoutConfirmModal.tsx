import { LogOut } from 'lucide-react'

interface LogoutConfirmModalProps {
  onCancel: () => void
  onConfirm: () => void
}

export function LogoutConfirmModal({ onCancel, onConfirm }: LogoutConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center"
      style={{ background: 'rgba(10,12,20,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="modal-in rounded-3xl p-8 text-center"
        style={{ background: 'var(--modal-bg)', maxWidth: 380, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 flex items-center justify-center rounded-2xl"
          style={{ width: 52, height: 52, background: 'rgba(244,63,94,0.14)' }}
        >
          <LogOut size={24} style={{ color: '#fb7185' }} />
        </div>
        <h3 className="text-lg font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
          Yakin ingin keluar?
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Kamu akan keluar dari akun Sekre Otomatis dan perlu masuk kembali untuk melanjutkan.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-outline flex-1">Batal</button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm text-white"
            style={{ background: '#fb7185' }}
          >
            Keluar
          </button>
        </div>
      </div>
    </div>
  )
}
