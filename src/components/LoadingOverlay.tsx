interface LoadingOverlayProps {
  text?: string
  fixed?: boolean
}

export function LoadingOverlay({ text = 'Memproses...', fixed = false }: LoadingOverlayProps) {
  return (
    <div
      className={`${fixed ? 'fixed z-[95]' : 'absolute z-20 rounded-[26px]'} inset-0 flex items-center justify-center`}
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div className="text-center">
        <div
          className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3"
          style={{ borderColor: 'var(--accent-maroon)' }}
        />
        <p className="text-sm font-semibold text-white">{text}</p>
      </div>
    </div>
  )
}
