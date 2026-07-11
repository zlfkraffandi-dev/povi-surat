import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getSession, onAuthStateChange } from '../lib/supabase'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    getSession().then((session) => setIsAuthenticated(!!session))

    const { data: { subscription } } = onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription?.unsubscribe()
  }, [])

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--page-bg)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: 'var(--accent-maroon)' }}
          ></div>
          <p style={{ color: 'var(--text-secondary)' }}>Memuat...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
