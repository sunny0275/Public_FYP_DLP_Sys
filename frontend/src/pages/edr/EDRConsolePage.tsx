import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'

export default function EDRConsolePage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [blockModal, setBlockModal] = useState<{ hostId?: string; userId?: number } | null>(null)
  const [isolateModal, setIsolateModal] = useState<{ hostId: string } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [severityFilter, actionFilter])

  const loadEvents = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getEDREvents({
        ...(severityFilter ? { severity: severityFilter } : {}),
        ...(actionFilter ? { action: actionFilter } : {})
      })
      if (res.success && Array.isArray(res.data)) {
        setEvents(res.data)
      } else {
        setEvents([])
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load EDR events')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = async () => {
    if (!blockModal) return
    setSubmitting(true)
    try {
      await apiClient.edrBlock({
        hostId: blockModal.hostId,
        userId: blockModal.userId,
        reason: actionReason || 'Blocked from EDR console'
      })
      setBlockModal(null)
      setActionReason('')
      loadEvents()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Block action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleIsolate = async () => {
    if (!isolateModal) return
    setSubmitting(true)
    try {
      await apiClient.edrIsolate({
        hostId: isolateModal.hostId,
        reason: actionReason || 'Isolated from EDR console'
      })
      setIsolateModal(null)
      setActionReason('')
      loadEvents()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Isolate action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return '#f44336'
      case 'MEDIUM': return '#ff9800'
      case 'LOW': return '#4caf50'
      default: return '#757575'
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
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>EDR Console</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => navigate('/edr/policies')}
              style={{
                padding: '8px 16px',
                background: theme === 'dark' ? '#444' : '#f5f5f5',
                color: theme === 'dark' ? '#fff' : '#333',
                border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              EDR Policies
            </button>
            <button type="button" onClick={loadEvents} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                  borderRadius: '4px',
                  background: theme === 'dark' ? '#333' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#333'
                }}
              >
                <option value="">All</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Action</label>
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                placeholder="Filter by action"
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                  borderRadius: '4px',
                  background: theme === 'dark' ? '#333' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#333'
                }}
              />
            </div>
          </div>

          <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Events / Incidents</h3>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>Loading events...</div>
          ) : events.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>No EDR events match the filters.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme === 'dark' ? '#444' : '#ddd'}`, textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Time</th>
                    <th style={{ padding: '10px' }}>User</th>
                    <th style={{ padding: '10px' }}>Action</th>
                    <th style={{ padding: '10px' }}>Severity</th>
                    <th style={{ padding: '10px' }}>Summary</th>
                    <th style={{ padding: '10px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt: any, idx: number) => (
                    <tr key={evt.id || idx} style={{ borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#eee'}` }}>
                      <td style={{ padding: '10px' }}>{evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '—'}</td>
                      <td style={{ padding: '10px' }}>{evt.userName || evt.accountId || '—'}</td>
                      <td style={{ padding: '10px' }}>{evt.action || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: getSeverityColor(evt.severity || '') + '33',
                          color: getSeverityColor(evt.severity || '')
                        }}>
                          {evt.severity || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{evt.summary || evt.details || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setBlockModal({ hostId: evt.hostId || undefined, userId: evt.userId })}
                          style={{
                            padding: '4px 10px',
                            marginRight: '6px',
                            fontSize: '12px',
                            background: '#ff9800',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Block
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsolateModal({ hostId: evt.hostId || evt.id?.toString() || 'unknown' })}
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            background: '#f44336',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Isolate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Block modal */}
      {blockModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => !submitting && setBlockModal(null)}>
          <div style={{
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            padding: '24px',
            borderRadius: '8px',
            minWidth: '320px'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Block</h3>
            <p>HostId: {blockModal.hostId || '—'} | UserId: {blockModal.userId ?? '—'}</p>
            <input
              type="text"
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
              placeholder="Reason (optional)"
              style={{ width: '100%', padding: '8px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => !submitting && setBlockModal(null)} disabled={submitting}>Cancel</button>
              <button onClick={handleBlock} disabled={submitting} style={{ background: '#ff9800', color: '#fff' }}>
                {submitting ? 'Recording...' : 'Record block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Isolate modal */}
      {isolateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => !submitting && setIsolateModal(null)}>
          <div style={{
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            padding: '24px',
            borderRadius: '8px',
            minWidth: '320px'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Isolate host</h3>
            <p>HostId: {isolateModal.hostId}</p>
            <input
              type="text"
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
              placeholder="Reason (optional)"
              style={{ width: '100%', padding: '8px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => !submitting && setIsolateModal(null)} disabled={submitting}>Cancel</button>
              <button onClick={handleIsolate} disabled={submitting} style={{ background: '#f44336', color: '#fff' }}>
                {submitting ? 'Recording...' : 'Record isolate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
