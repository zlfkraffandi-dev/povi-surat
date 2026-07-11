import { createContext, useContext, useState, ReactNode } from 'react'
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  msg: string
  type: ToastType
}

interface ToastContextValue {
  pushToast: (msg: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const STYLES: Record<ToastType, { bg: string; border: string; text: string; Icon: typeof CheckCircle }> = {
  success: { bg: 'rgba(20,83,45,0.12)', border: 'rgba(20,83,45,0.35)', text: '#14532d', Icon: CheckCircle },
  error: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.35)', text: '#fb7185', Icon: AlertTriangle },
  info: { bg: 'rgba(29,53,87,0.12)', border: 'rgba(29,53,87,0.35)', text: '#1d3557', Icon: Info },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = (msg: string, type: ToastType = 'info') => {
    const id = `t${Date.now()}${Math.random()}`
    setToasts((prev) => [...prev, { id, msg, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3400)
  }

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] w-80 flex flex-col gap-2.5">
        {toasts.map((t) => {
          const style = STYLES[t.type]
          const Icon = style.Icon
          return (
            <div
              key={t.id}
              className="toast-in rounded-2xl px-4 py-3 flex items-start gap-2.5 border"
              style={{ background: style.bg, borderColor: style.border, color: style.text }}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <p className="text-sm font-semibold">{t.msg}</p>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
