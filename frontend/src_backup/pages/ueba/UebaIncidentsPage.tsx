import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'

export default function UebaIncidentsPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()
  const [incidents, setIncidents] = useState<any[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [size] = useState(20)
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadIncidents = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getUebaIncidents({
        page,
        size,
        ...(severityFilter ? { severity: severityFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {})
      })
      if (res.success && res.data) {
        const d = res.data as { content?: any[]; totalElements?: number; totalPages?: number }
        setIncidents(Array.isArray(d.content) ? d.content : [])
        setTotalElements(d.totalElements ?? 0)
        setTotalPages(d.totalPages ?? 0)
      } else {
        setIncidents([])
        setTotalElements(0)
        setTotalPages(0)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load UEBA incidents')
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadIncidents()
  }, [page, severityFilter, statusFilter])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return '#e53935' // red
      case 'MEDIUM': return '#fbc02d' // yellow
      case 'LOW': return '#43a047' // green
      default: return '#9e9e9e'
    }
  }

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
        <h1 style={{ margin: 0 }}>UEBA Anomaly Incidents</h1>
        <button onClick={() => navigate('/ueba')} style={{ padding: '8px 16px' }}>
          Back to risk overview
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: '#f44336', color: '#f44336' }}>{error}</div>
      )}

      <div style={{ ...cardStyle, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Severity:
          <select
            value={severityFilter}
            onChange={e => { setSeverityFilter(e.target.value); setPage(0) }}
            style={{
              marginLeft: '8px',
              padding: '6px 10px',
              background: theme === 'dark' ? '#1a1a1a' : '#fff',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              borderRadius: '4px',
              color: theme === 'dark' ? '#fff' : '#000'
            }}
          >
            <option value="">All</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </label>
        <label>
          Status:
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            style={{
              marginLeft: '8px',
              padding: '6px 10px',
              background: theme === 'dark' ? '#1a1a1a' : '#fff',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              borderRadius: '4px',
              color: theme === 'dark' ? '#fff' : '#000'
            }}
          >
            <option value="">All</option>
            <option value="OPEN">OPEN</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </label>
      </div>

      <div style={cardStyle}>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}>
                    <th style={{ textAlign: 'left', padding: '10px' }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>User</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Risk score</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Severity</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc: any) => (
                    <tr key={inc.id} style={{ borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}` }}>
                      <td style={{ padding: '10px' }}>{inc.id}</td>
                      <td style={{ padding: '10px' }}>{inc.userId ?? inc.accountId ?? '—'}</td>
                      <td style={{ padding: '10px' }}>{inc.riskScore ?? '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            minWidth: '72px',
                            textAlign: 'center',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontWeight: 700,
                            color: '#111',
                            background: getSeverityColor(inc.severity || '')
                          }}
                        >
                          {inc.severity ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{inc.action ?? '—'}</td>
                      <td style={{ padding: '10px' }}>{inc.category ?? '—'}</td>
                      <td style={{ padding: '10px' }}>{inc.timestamp ?? '—'}</td>
                      <td style={{ padding: '10px' }}>{inc.status ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
                <span>Page {page + 1} / {totalPages}, {totalElements} total</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
