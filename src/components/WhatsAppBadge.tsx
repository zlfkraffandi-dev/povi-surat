interface WhatsAppBadgeProps {
  waLink: string | null
  phone: string
}

export function WhatsAppBadge({ waLink, phone }: WhatsAppBadgeProps) {
  if (!waLink) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{phone}</span>

  return (
    <a
      href={waLink}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors"
      style={{ color: '#16a34a', borderColor: '#16a34a', background: 'rgba(22,163,74,0.08)' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.06c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.17-1.56-1.17-2.98s.75-2.11 1.01-2.4c.26-.29.58-.36.77-.36l.55.01c.18 0 .41-.07.64.49.24.58.81 2 .88 2.14.07.15.12.32.02.51-.1.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.61-.07.16-.19.68-.79.87-1.06.18-.28.37-.23.62-.14.26.1 1.63.77 1.91.91.28.14.47.21.53.33.07.12.07.68-.17 1.35z"/>
      </svg>
      WhatsApp
    </a>
  )
}
