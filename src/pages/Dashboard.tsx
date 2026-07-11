import { useEffect, useState } from 'react'
import { getCurrentUserProfile, UserProfile } from '../lib/supabase'
import { RequesterDashboard } from '../views/RequesterDashboard'
import { SekretarisDashboard } from '../views/SekretarisDashboard'

function LoadingSkeleton() {
  return (
    <div className="page-container">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 96, borderRadius: 20 }} />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 76, borderRadius: 18 }} />
        ))}
      </div>
    </div>
  )
}

export function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    getCurrentUserProfile()
      .then((p) => {
        setProfile(p)
        if (!p) setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setTimeout(() => setLoading(false), 550))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
        <div className="text-center max-w-sm">
          <p className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Gagal memuat profil</p>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            Akun kamu mungkin belum terdaftar di sistem, atau ada masalah koneksi. Coba muat ulang halaman.
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary">Muat Ulang</button>
        </div>
      </div>
    )
  }

  return profile.is_sekretaris
    ? <SekretarisDashboard profile={profile} />
    : <RequesterDashboard profile={profile} />
}
