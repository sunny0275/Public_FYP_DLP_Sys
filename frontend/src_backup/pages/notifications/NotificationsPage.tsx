import { useState, useEffect } from 'react'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'
import type { Alert } from '../../types'

export default function NotificationsPage() {
  const { theme } = useAuthStore()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiClient.getRecentAlerts()
        if (!cancelled && res.success && res.data) setAlerts(res.data)
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load notifications')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return '#f44336'
      case 'MEDIUM': return '#ff9800'
      default: return '#757575'
    }
  }

  const formatTime = (t: string) => {
    try { return new Date(t).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) }
    catch { return t }
  }

  return (
    <DashboardLayout>
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: '28px', fontWeight: '600' }}>Notifications</h1>
        <p style={{ margin: '0 0 20px', color: theme === 'dark' ? '#aaa' : '#666', fontSize: '14px' }}>
          Warning alerts, failures, and UEBA account actions. Admins see all; users see their own.
        </p>

        {error && (
          <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading...</div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No notifications</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {alerts.map((alert) => (
              <li
                key={alert.id}
                style={{
                  padding: '16px',
                  marginBottom: '12px',
                  background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                  borderRadius: '8px',
                  border: `1px solid ${theme === 'dark' ? '#444' : '#eee'}`,
                  borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '600', color: getSeverityColor(alert.severity), marginRight: '8px' }}>
                      {alert.alertType}
                    </span>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#999' : '#666' }}>
                      {formatTime(alert.alertTime)}
                    </span>
                    {alert.resourceType && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>{alert.resourceType}</span>
                    )}
                    {alert.description && (
                      <div style={{ marginTop: '8px', fontSize: '14px', color: theme === 'dark' ? '#ddd' : '#333' }}>
                        {alert.description}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: getSeverityColor(alert.severity) + '33',
                      color: getSeverityColor(alert.severity)
                    }}
                  >
                    {alert.severity}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  )
}
