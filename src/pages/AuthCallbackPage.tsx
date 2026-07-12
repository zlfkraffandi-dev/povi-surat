import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, getCurrentUserProfile, signOut } from '../lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    // Supabase's own trigger rejects sign-in for emails outside pre_approved_users before a
    // session ever exists, and reports it back as ?error=... / #error=... on this callback URL
    // instead of a normal session — catch that case here rather than falling through silently.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('error') || hashParams.get('error')) {
      navigate('/login?error=wrong_account', { replace: true })
      return
    }

    getSession().then(async (session) => {
      if (cancelled) return
      if (!session) { navigate('/login?error=wrong_account', { replace: true }); return }

      const profile = await getCurrentUserProfile()
      if (cancelled) return

      if (!profile) {
        await signOut()
        navigate('/login?error=wrong_account', { replace: true })
        return
      }
      navigate('/dashboard', { replace: true })
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
