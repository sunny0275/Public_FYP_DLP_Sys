import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSessionMonitor } from '../hooks/useSessionMonitor'
import { useEffect } from 'react'
import { getPreferredDashboardPath } from '../utils/dashboardPaths'

interface DashboardLayoutProps {
  children: ReactNode
}

interface DashboardTab {
  path: string
  label: string
  role: string[]
}

const DASHBOARD_TABS: DashboardTab[] = [
  { path: '/dashboard/admin', label: 'Admin', role: ['ADMIN'] },
  { path: '/dashboard', label: 'Overview', role: ['EMPLOYEE', 'REVIEWER', 'MANAGER'] },
  { path: '/dashboard/security', label: 'Security', role: ['ADMIN'] },
  { path: '/ueba', label: 'UEBA', role: ['ADMIN'] }
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth, theme } = useAuthStore()
  const { toast, extendSession, dismissToast } = useSessionMonitor()

  const userRoles = user?.roles || []
  const isAdmin = userRoles.includes('ADMIN')
  const homePath = getPreferredDashboardPath(user)

  // Role-specific landing: if user visits /dashboard, ADMIN should be redirected to the admin dashboard
  useEffect(() => {
    if (location.pathname !== '/dashboard') return
    if (isAdmin) {
      navigate('/dashboard/admin', { replace: true })
      return
    }
  }, [location.pathname, isAdmin, userRoles, navigate])

  const availableTabs = DASHBOARD_TABS.filter(tab => {
    if (isAdmin && tab.path === '/dashboard') return false
    return tab.role.some(role => userRoles.includes(role))
  })

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="dashboard-container" data-theme={theme}>
      {/* Header */}
      <div style={{
        background: theme === 'dark' ? '#1a1a1a' : '#fff',
        borderBottom: '1px solid ' + (theme === 'dark' ? '#333' : '#e0e0e0'),
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>DLP Platform</h1>
          <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>
            {user?.fullName} • {user?.department || 'N/A'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => navigate(homePath)}
            style={{ padding: '8px 12px' }}
            title="Return to home dashboard"
          >
            Home
          </button>

          <button
            onClick={() => navigate('/me')}
            style={{ padding: '8px 12px' }}
            title="Open my profile"
          >
            My Profile
          </button>

          {/* Notifications Bell - click goes to notifications page */}
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid ' + (theme === 'dark' ? '#444' : '#ddd'),
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              position: 'relative'
            }}
            title="Notifications"
          >
            🔔
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              background: '#ff4444',
              borderRadius: '50%'
            }}></span>
          </button>

          {/* Blockchain log - admin only */}
          {userRoles.includes('ADMIN') && (
            <button
              type="button"
              onClick={() => navigate('/audit?blockchain=1')}
              style={{
                padding: '8px 12px',
                background: 'transparent',
                border: '1px solid ' + (theme === 'dark' ? '#444' : '#ddd'),
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              title="Blockchain log – audit entries anchored to blockchain"
            >
              ⛓️ Blockchain log
            </button>
          )}

          {/* Logout */}
          <button onClick={handleLogout} style={{ padding: '8px 16px' }}>
            Logout
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      {availableTabs.length > 1 && (
        <div style={{
          background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
          borderBottom: '1px solid ' + (theme === 'dark' ? '#333' : '#e0e0e0'),
          padding: '0 24px',
          display: 'flex',
          gap: '8px'
        }}>
          {availableTabs.map((tab) => {
            const isActive = location.pathname === tab.path
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                style={{
                  padding: '12px 20px',
                  background: isActive ? (theme === 'dark' ? '#1a1a1a' : '#fff') : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #007bff' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? (theme === 'dark' ? '#fff' : '#000') : '#888',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Main Content */}
      <div style={{ padding: '24px' }}>
        {children}
      </div>

      {/* Session Expiry Toast */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: theme === 'dark' ? '#2a2a2a' : '#fff',
          border: `2px solid #ffa500`,
          borderRadius: '8px',
          padding: '16px 20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 9999,
          minWidth: '320px',
          maxWidth: '400px'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <div style={{ fontSize: '24px' }}>⏰</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#ffa500' }}>
                Session Expiring Soon
              </div>
              <div style={{ fontSize: '0.9em', marginBottom: '12px' }}>
                {toast.message}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={extendSession}
                  style={{
                    padding: '8px 16px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: '600'
                  }}
                >
                  Extend Session
                </button>
                <button
                  onClick={dismissToast}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    color: theme === 'dark' ? '#fff' : '#000',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9em'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
