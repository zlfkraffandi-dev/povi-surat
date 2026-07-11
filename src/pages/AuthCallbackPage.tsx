import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from '../lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    getSession().then((session) => {
      if (cancelled) return
      navigate(session ? '/dashboard' : '/login', { replace: true })
    })

    return () => { cancelled = true }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
      <div className="text-center">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
          style={{ borderColor: 'var(--accent-maroon)' }}
        ></div>
        <p style={{ color: 'var(--text-secondary)' }}>Memproses login...</p>
      </div>
    </div>
  )
}
