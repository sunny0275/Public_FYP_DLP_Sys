import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'

export default function UebaDashboardPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()
  const [focusUsers, setFocusUsers] = useState<any[]>([])
  const [userIdInput, setUserIdInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadRiskScore = async () => {
    const uid = userIdInput.trim() ? Number(userIdInput) : undefined
    if (uid !== undefined && Number.isNaN(uid)) {
      setError('Please enter a valid user ID')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getUebaRiskScore({
        ...(uid !== undefined ? { userId: uid } : {})
      })
      if (res.success && res.data) {
        const score = (res.data as any).score
        if (score !== undefined) {
          setError('')
        }
      } else {
        setError('Failed to load risk score')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load risk score')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Load users with UEBA scores < 100 (i.e., risky users).
   * The backend query already excludes ADMIN and system accounts.
   */
  const loadFocusUsers = async () => {
    try {
      setLoading(true)
      setError('')
      // includeAll=false returns only users with score < 100 (actual risky users).
      // ADMIN and system accounts are excluded server-side.
      const res = await apiClient.getUebaUserScores({
        includeAll: false,
        sortBy: 'score',
        sortOrder: 'asc',
        page: 0,
        size: 100
      })
      const users = res.data?.content || []
      setFocusUsers(users)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load risky users')
      setFocusUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRiskScore()
    loadFocusUsers()
  }, [])

  const cardStyle = {
    background: theme === 'dark' ? '#2a2a2a' : '#fff',
    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px'
  }

  return (
    <DashboardLayout>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0 }}>UEBA Risk Overview</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="User ID (optional)"
            value={userIdInput}
            onChange={e => setUserIdInput(e.target.value)}
            style={{
              padding: '8px 12px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              borderRadius: '4px',
              background: theme === 'dark' ? '#1a1a1a' : '#fff',
              color: theme === 'dark' ? '#fff' : '#000',
              width: '140px'
            }}
          />
          <button onClick={loadRiskScore} disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? 'Loading…' : 'Query risk'}
          </button>
          <button onClick={() => navigate('/ueba/incidents')} style={{ padding: '8px 16px' }}>
            Anomaly incidents
          </button>
          <button onClick={() => navigate('/ueba/users')} style={{ padding: '8px 16px' }}>
            All UEBA users
          </button>
          <button onClick={() => navigate('/ueba/policies')} style={{ padding: '8px 16px' }}>
            Rules & policy
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: '#f44336', color: '#f44336' }}>{error}</div>
      )}

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Risky users (score below 100)</h3>
        <p style={{ color: '#888', fontSize: '0.85em', marginBottom: '12px' }}>
          Users with UEBA score below 100 — lower scores indicate anomalous behavior detected.
          Score ≤70 triggers account disable. ADMIN accounts are excluded.
        </p>
        {focusUsers.length === 0 ? (
          <p style={{ margin: 0, color: '#888' }}>No users below 100.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {focusUsers.map((u) => (
              <div key={u.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', background: theme === 'dark' ? '#1f1f1f' : '#f7f7f7' }}>
                <div style={{ fontSize: '0.9em' }}>
                  <strong>{u.accountId}</strong> · {u.fullName || '—'} · {u.department || 'N/A'}
                </div>
                <div style={{ fontWeight: 700, color: u.uebaScore <= 50 ? '#e53935' : u.uebaScore <= 90 ? '#fbc02d' : '#43a047' }}>
                  {u.uebaScore}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>About</h3>
        <p style={{ margin: 0, color: '#888' }}>
          UEBA (User and Entity Behavior Analytics) monitors user behavior to detect anomalies.
          When audit events (e.g., access denials) trigger HIGH/CRITICAL risk, the LLM analyzes
          the context and applies confidence-weighted scoring. Score ≤70 disables the account.
        </p>
      </div>
    </DashboardLayout>
  )
}
