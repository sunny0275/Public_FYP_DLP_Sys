import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'
import { apiClient } from '../../api'

export default function UebaUsersPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()
  const [items, setItems] = useState<any[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resettingUserId, setResettingUserId] = useState<number | null>(null)

  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [includeAll, setIncludeAll] = useState(false)
  const [sortBy, setSortBy] = useState<'score' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadDepartments = async () => {
    try {
      const res = await apiClient.getDepartments()
      setDepartments(res.data || [])
    } catch {
      setDepartments([])
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getUebaUserScores({
        query: query || undefined,
        department: department || undefined,
        includeAll,
        sortBy,
        sortOrder,
        page: 0,
        size: 100
      })
      setItems(res.data?.content || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load UEBA user scores')
    } finally {
      setLoading(false)
    }
  }, [query, department, includeAll, sortBy, sortOrder])

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleResetUserScore = async (user: any) => {
    const shouldEnable = !user.accountEnabled
      ? window.confirm(`User ${user.accountId} is disabled. Re-enable account while resetting UEBA score?`)
      : false
    if (!window.confirm(`Reset UEBA score to 100 for ${user.accountId}?`)) return

    setResettingUserId(user.userId)
    try {
      await apiClient.resetUserUebaScore(user.userId, shouldEnable)
      await load()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset UEBA score for selected user')
    } finally {
      setResettingUserId(null)
    }
  }

  const isAdminUser = (roles: string[] | null | undefined) => {
    if (!roles || roles.length === 0) return false
    return roles.some(role => {
      const r = role.toUpperCase()
      return r === 'ADMIN' || r === 'ROLE_ADMIN'
    })
  }

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>UEBA User Scores</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => load()} disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button onClick={() => navigate('/ueba')} style={{ padding: '8px 16px' }}>Back to UEBA</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by account ID / name"
          style={{ padding: '8px 10px', minWidth: 220 }}
        />
        <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: '8px 10px' }}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ padding: '8px 10px' }}>
          <option value="createdAt">Sort by created time</option>
          <option value="score">Sort by UEBA score</option>
        </select>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} style={{ padding: '8px 10px' }}>
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} />
          Include score=100
        </label>
      </div>

      {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="dashboard-card">
        {loading && items.length === 0 ? (
          <div>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}>
                  <th style={{ textAlign: 'left', padding: 10 }}>Account ID</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Name</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Department</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Role</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>UEBA Score</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Created</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const admin = isAdminUser(u.roles)
                  return (
                  <tr key={u.userId} style={{ borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}` }}>
                    <td style={{ padding: 10 }}>{u.accountId}</td>
                    <td style={{ padding: 10 }}>{u.fullName}</td>
                    <td style={{ padding: 10 }}>{u.department || 'N/A'}</td>
                    <td style={{ padding: 10 }}>
                      {u.roles && u.roles.length > 0 ? (
                        u.roles.map((role: string, idx: number) => (
                          <span key={idx} style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            marginRight: 4,
                            borderRadius: 4,
                            fontSize: 11,
                            background: role.toUpperCase().includes('ADMIN') ? '#e3f2fd' : '#f5f5f5',
                            color: role.toUpperCase().includes('ADMIN') ? '#1565c0' : '#666'
                          }}>{role}</span>
                        ))
                      ) : '—'}
                    </td>
                    <td style={{ padding: 10, fontWeight: 700, color: u.uebaScore <= 50 ? '#ff6b6b' : u.uebaScore <= 90 ? '#ffa500' : '#4caf50' }}>
                      {u.uebaScore}
                      {admin && <span style={{ marginLeft: 6, fontSize: 11, color: '#1565c0' }}>(protected)</span>}
                    </td>
                    <td style={{ padding: 10 }}>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</td>
                    <td style={{ padding: 10 }}>{u.accountEnabled ? 'Enabled' : 'Disabled'}</td>
                    <td style={{ padding: 10 }}>
                      <button
                        onClick={() => handleResetUserScore(u)}
                        disabled={resettingUserId === u.userId || admin}
                        title={admin ? 'Admin accounts cannot be reset' : 'Reset score to 100'}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: 'none',
                          background: admin ? '#ccc' : '#6f42c1',
                          color: '#fff',
                          cursor: resettingUserId === u.userId || admin ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {resettingUserId === u.userId ? 'Resetting...' : admin ? 'Protected' : 'Reset'}
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
            {items.length === 0 && !loading && <div style={{ padding: 20, textAlign: 'center' }}>No users found</div>}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
