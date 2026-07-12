import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithGoogle, getCurrentUser } from '../lib/supabase'
import { AlertTriangle } from 'lucide-react'

function GoogleLogo() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) navigate('/dashboard', { replace: true })
    })
  }, [navigate])

  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--page-bg)' }}>
      <div
        className="w-full rounded-[28px] border p-10"
        style={{ maxWidth: 420, background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        <div className="flex items-center gap-3 mb-7">
          <img src="/logo.svg" alt="Posko Visual 2026" className="shrink-0" style={{ width: 44, height: 44, borderRadius: '9999px' }} />
          <div>
            <p className="font-bold text-[17px]" style={{ color: 'var(--text-primary)' }}>Posko Visual 2026</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sistem Persuratan · KOP FS &amp; POVI</p>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>Masuk ke akunmu</h1>
        <p className="text-sm mb-7" style={{ color: 'var(--text-secondary)' }}>
          Login pakai akun Google yang terdaftar sebagai BPH, Kadep, atau Kadiv.
        </p>

        {error && (
          <div
            className="mb-5 p-3.5 rounded-2xl flex items-start gap-2.5 text-sm"
            style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', color: '#fb7185' }}
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full py-3.5 rounded-xl border flex items-center justify-center gap-3 font-bold text-sm transition-transform"
          style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#4285F4' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--card-border)' }}
        >
          <GoogleLogo />
          Lanjutkan dengan Google
        </button>

        <p className="text-center text-[11.5px] mt-5" style={{ color: 'var(--text-muted)' }}>
          Khusus email kampus <b>@um.ac.id</b> yang terdaftar sebagai BPH/Kadep/Kadiv.
        </p>
      </div>
    </div>
  )
}
