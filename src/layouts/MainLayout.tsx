import { ReactNode, useState } from 'react'
import { LogOut, Sun, Moon, Menu, X } from 'lucide-react'
import { signOut, UserProfile } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { LogoutConfirmModal } from '../components/LogoutConfirmModal'

export interface NavItem {
  label: string
  icon: React.ComponentType<{ size?: number }>
  active: boolean
  onClick: () => void
}

interface MainLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  navItems: NavItem[]
  rightExtra?: ReactNode
  profile: UserProfile
}

function SidebarContent({
  navItems,
  profile,
  onNavigate,
  onLogoutClick,
}: {
  navItems: NavItem[]
  profile: UserProfile
  onNavigate?: () => void
  onLogoutClick: () => void
}) {
  return (
    <>
      <div className="p-4 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--card-border)' }}>
        <img src="/logo.svg" alt="Posko Visual 2026" style={{ width: 44, height: 44, borderRadius: '9999px' }} />
        <span className="font-bold text-[15px]" style={{ color: 'var(--text-primary)' }}>Posko Visual 2026</span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              onClick={() => {
                item.onClick()
                onNavigate?.()
              }}
              className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-[13.5px] font-bold transition-all active:scale-[0.97]"
              style={{
                background: item.active ? 'var(--accent-maroon-soft)' : 'transparent',
                color: item.active ? 'var(--accent-maroon-text)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={17} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t flex items-center gap-2.5" style={{ borderColor: 'var(--card-border)' }}>
        <div
          className="flex items-center justify-center rounded-[9px] text-white font-bold shrink-0"
          style={{
            width: 30, height: 30,
            background: profile?.is_sekretaris ? '#92400e' : 'var(--accent-maroon)',
          }}
        >
          {profile?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {profile?.name || '...'}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
            {profile?.jabatan || profile?.role}
          </p>
        </div>
        <button
          onClick={onLogoutClick}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors active:scale-90"
          style={{ color: '#fb7185' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,63,94,0.14)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut size={17} />
        </button>
      </div>
    </>
  )
}

export function MainLayout({ children, title, subtitle, navItems, rightExtra, profile }: MainLayoutProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--page-bg)' }}>
      {/* Desktop sidebar */}
      <div
        className="hidden md:flex w-[236px] shrink-0 flex-col border-r"
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--card-border)' }}
      >
        <SidebarContent navItems={navItems} profile={profile} onLogoutClick={() => setShowLogoutConfirm(true)} />
      </div>

      {/* Mobile drawer + backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-[90] transition-opacity duration-200 ${mobileNavOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ background: 'rgba(10,12,20,0.5)' }}
        onClick={() => setMobileNavOpen(false)}
      >
        <div
          className="h-full w-[78vw] max-w-[300px] flex flex-col transition-transform duration-200 ease-out"
          style={{
            background: 'var(--sidebar-bg)',
            transform: mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end p-2">
            <button
              onClick={() => setMobileNavOpen(false)}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 flex flex-col -mt-2">
            <SidebarContent
              navItems={navItems}
              profile={profile}
              onNavigate={() => setMobileNavOpen(false)}
              onLogoutClick={() => { setMobileNavOpen(false); setShowLogoutConfirm(true) }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop header */}
        <header
          className="hidden md:flex px-6 py-4 items-center justify-between border-b shrink-0"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <div>
            <h1 className="text-[19px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
            {subtitle && <p className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {rightExtra}
            <button
              onClick={toggleTheme}
              className="w-[38px] h-[38px] rounded-xl border flex items-center justify-center transition-transform active:scale-90"
              style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Mobile top app bar */}
        <header
          className="md:hidden flex items-center gap-2.5 px-3 py-3 border-b shrink-0 sticky top-0 z-30 backdrop-blur"
          style={{ borderColor: 'var(--card-border)', background: 'var(--sidebar-bg)' }}
        >
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {rightExtra}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ color: 'var(--text-secondary)' }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto animate-page-in">{children}</main>
      </div>

      {showLogoutConfirm && (
        <LogoutConfirmModal
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={handleLogout}
        />
      )}
    </div>
  )
}
