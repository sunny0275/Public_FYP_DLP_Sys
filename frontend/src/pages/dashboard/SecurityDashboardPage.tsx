import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { apiClient } from '../../api'
import DashboardSkeleton from '../../components/DashboardSkeleton'
import { AuditLogEntry, AuditLogPage } from '../../types'

interface DLPAlert {
  id: number
  alertType: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  timestamp: string
  userId: number
  userName: string
  policyViolated?: string
}

interface EDRIncident {
  id: number
  incidentType: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  affectedAsset: string
  detectionTime: string
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE'
  assignedTo?: string
}

interface Investigation {
  id: number
  title: string
  investigator: string
  startedAt: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  relatedIncidents: number
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
}

export default function SecurityDashboardPage() {
  const navigate = useNavigate()
  const { user: _user, theme } = useAuthStore()

  const [alerts, setAlerts] = useState<DLPAlert[]>([])
  const [incidents, setIncidents] = useState<EDRIncident[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [auditLogPage, setAuditLogPage] = useState<AuditLogPage | null>(null)
  const [logPage, setLogPage] = useState(0)
  const [auditLogLoading, setAuditLogLoading] = useState(false)
  const [auditLogError, setAuditLogError] = useState('')
  const LOG_PAGE_SIZE = 15

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [assetFilter, setAssetFilter] = useState<string>('')
  const [policyFilter, setPolicyFilter] = useState<string>('')
  const [logSeverityFilter, setLogSeverityFilter] = useState<string>('all')
  const [logSearchTerm, setLogSearchTerm] = useState('')
  const [logUserIdFilter, setLogUserIdFilter] = useState('')
  const [logUserNameFilter, setLogUserNameFilter] = useState('')
  const [logStartTime, setLogStartTime] = useState('')
  const [logEndTime, setLogEndTime] = useState('')

  useEffect(() => {
    loadSecurityData()
  }, [severityFilter])

  const formatTimestampHK = (timestamp?: string) => {
    if (!timestamp) return '—'
    return new Date(timestamp).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong' })
  }

  const logLatestAuditEntry = (logs: AuditLogEntry[]) => {
    console.log('Audit log API response (latest first)', logs)
    if (!logs.length) {
      console.log('Audit log response empty')
      return
    }

    const latest = logs[0]
    console.log('Latest audit entry (Time / User / Action / Result / IP)', {
      time: formatTimestampHK(latest.timestamp),
      user: latest.userName || latest.accountId || 'Unknown',
      action: latest.action,
      result: latest.result,
      ip: latest.ipAddress
    })
  }

  const loadAuditLogs = useCallback(async () => {
    setAuditLogLoading(true)
    setAuditLogError('')

    try {
      const userIdInput = logUserIdFilter.trim()
      const parsedUserId = userIdInput ? Number(userIdInput) : undefined
      const userId = parsedUserId !== undefined && !Number.isNaN(parsedUserId) ? parsedUserId : undefined

      const response = await apiClient.searchAuditLogs({
        page: logPage,
        size: LOG_PAGE_SIZE,
        userId,
        userName: logUserNameFilter.trim() || undefined,
        searchTerm: logSearchTerm.trim() || undefined,
        severity: logSeverityFilter !== 'all' ? logSeverityFilter : undefined,
        startTime: logStartTime || undefined,
        endTime: logEndTime || undefined
      })

      setAuditLogPage(response.data)
      logLatestAuditEntry(response.data.items || [])
    } catch (err: any) {
      setAuditLogError(err.response?.data?.message || 'Failed to load audit logs')
    } finally {
      setAuditLogLoading(false)
    }
  }, [logPage, logSeverityFilter, logSearchTerm, logUserIdFilter, logUserNameFilter, logStartTime, logEndTime])

  useEffect(() => {
    loadAuditLogs()
  }, [loadAuditLogs])

  const loadSecurityData = async () => {
    setLoading(true)
    setError('')

    const severityParam = severityFilter !== 'all' ? severityFilter : undefined
    const [alertsResult, incidentsResult, investigationsResult] = await Promise.allSettled([
      apiClient.getDLPAlerts(severityParam),
      apiClient.getEDRIncidents(),
      apiClient.getInvestigations()
    ])

    const failedSections: string[] = []

    if (alertsResult.status === 'fulfilled') {
      setAlerts(alertsResult.value.data || [])
    } else {
      failedSections.push('DLP alerts')
      setAlerts([])
      console.warn('Failed to load DLP alerts', alertsResult.reason)
    }

    if (incidentsResult.status === 'fulfilled') {
      setIncidents(incidentsResult.value.data || [])
    } else {
      failedSections.push('EDR incidents')
      setIncidents([])
      console.warn('Failed to load EDR incidents', incidentsResult.reason)
    }

    if (investigationsResult.status === 'fulfilled') {
      setInvestigations(investigationsResult.value.data || [])
    } else {
      failedSections.push('Investigations')
      setInvestigations([])
      console.warn('Failed to load investigations', investigationsResult.reason)
    }

    if (failedSections.length > 0) {
      setError(`Some sections failed to load: ${failedSections.join(', ')}`)
    } else {
      setError('')
    }
    setLoading(false)
  }

  const handleEscalate = (_incidentId: number) => {
    navigate('/edr')
  }

  const handleClearLogs = async () => {
    if (!window.confirm('Clear all activity logs? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)
      setError('')
      await apiClient.clearAuditLogs()
      await loadSecurityData()
      setLogPage(0)
      await loadAuditLogs()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clear activity logs')
    } finally {
      setLoading(false)
    }
  }

  const severityColorMap: Record<string, string> = {
    HIGH: '#ff6b6b',
    MEDIUM: '#ffa500',
    LOW: '#4caf50'
  }

  const renderPaginationControls = () => {
    const currentPage = auditLogPage?.currentPage ?? logPage
    const totalPages = Math.max(auditLogPage?.totalPages ?? 1, 1)
    const totalElements = auditLogPage?.totalElements ?? 0
    const itemsInPage = auditLogPage?.items || []
    const startIndex = totalElements === 0 ? 0 : currentPage * LOG_PAGE_SIZE + 1
    const endIndex = totalElements === 0 ? 0 : Math.min(totalElements, startIndex + itemsInPage.length - 1)

    return (
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{ fontSize: '0.85em', color: '#888' }}>
          {totalElements === 0 ? 'No audit logs found' : `Showing ${startIndex} - ${endIndex} of ${totalElements} entries`}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setLogPage(prev => Math.max(prev - 1, 0))}
            disabled={currentPage <= 0 || auditLogLoading}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              background: '#fff',
              cursor: currentPage <= 0 || auditLogLoading ? 'not-allowed' : 'pointer'
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.85em', color: '#555' }}>
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setLogPage(prev => prev + 1)}
            disabled={auditLogLoading || currentPage >= totalPages - 1}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              background: '#fff',
              cursor: auditLogLoading || currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Next →
          </button>
        </div>
      </div>
    )
  }

  const handleExportLogs = async () => {
    try {
      const response = await apiClient.exportLogs('24h')
      // Create download link
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString()}.json`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to export logs')
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '#ff0000'
      case 'HIGH': return '#ff6b6b'
      case 'MEDIUM': return '#ffa500'
      case 'LOW': return '#4caf50'
      default: return '#888'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return '#ff6b6b'
      case 'INVESTIGATING':
      case 'IN_PROGRESS': return '#ffa500'
      case 'RESOLVED':
      case 'CLOSED': return '#4caf50'
      case 'FALSE_POSITIVE': return '#888'
      default: return '#888'
    }
  }

  const logsToRender = auditLogPage?.items || []

  // Filter incidents
  const filteredIncidents = incidents.filter(incident => {
    if (assetFilter && !incident.affectedAsset.toLowerCase().includes(assetFilter.toLowerCase())) {
      return false
    }
    return true
  })

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (policyFilter && alert.policyViolated !== policyFilter) {
      return false
    }
    return true
  })

  if (loading) {
    return <DashboardSkeleton variant="security" />
  }

  return (
    <div className="dashboard">
      {error && (
        <div className="error-message" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}
      <div className="dashboard-header">
        <div>
          <h1>Security Dashboard</h1>
          <p style={{ color: '#888', marginTop: '8px' }}>
            Threat Detection & Response
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              background: theme === 'dark' ? '#2a2a2a' : '#fff',
              color: theme === 'dark' ? '#fff' : '#000'
            }}
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <button onClick={handleExportLogs} style={{ padding: '8px 16px' }}>
            📥 Export Logs
          </button>
        </div>
      </div>

      {/* DLP Alerts Timeline */}
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>DLP Alerts Timeline ({filteredAlerts.length})</h3>
          <input
            type="text"
            placeholder="Filter by policy..."
            value={policyFilter}
            onChange={(e) => setPolicyFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              background: theme === 'dark' ? '#2a2a2a' : '#fff',
              color: theme === 'dark' ? '#fff' : '#000',
              width: '200px'
            }}
          />
        </div>

        {filteredAlerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredAlerts.slice(0, 15).map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: '12px',
                  background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: getSeverityColor(alert.severity) }}>
                      {alert.alertType}
                    </div>
                    <div style={{ fontSize: '0.9em', marginTop: '4px' }}>
                      {alert.description}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#888', marginTop: '6px' }}>
                      {alert.userName} • {new Date(alert.timestamp).toLocaleString()}
                      {alert.policyViolated && ` • Policy: ${alert.policyViolated}`}
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75em',
                    fontWeight: '600',
                    background: getSeverityColor(alert.severity),
                    color: 'white'
                  }}>
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No DLP alerts</div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* EDR Incidents Heatmap */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>EDR Incidents ({filteredIncidents.length})</h3>
            <input
              type="text"
              placeholder="Filter by asset..."
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                width: '150px'
              }}
            />
          </div>

          {filteredIncidents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredIncidents.slice(0, 10).map((incident) => (
                <div
                  key={incident.id}
                  style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${getSeverityColor(incident.severity)}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{incident.incidentType}</div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                        Asset: {incident.affectedAsset}
                      </div>
                      <div style={{ fontSize: '0.8em', color: '#888', marginTop: '2px' }}>
                        {new Date(incident.detectionTime).toLocaleString()}
                      </div>
                      <div style={{
                        display: 'inline-block',
                        marginTop: '6px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75em',
                        background: getStatusColor(incident.status) + '33',
                        color: getStatusColor(incident.status),
                        fontWeight: '600'
                      }}>
                        {incident.status}
                      </div>
                    </div>
                    {incident.status === 'OPEN' && (
                      <button
                        onClick={() => handleEscalate(incident.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#ff6b6b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85em',
                          marginLeft: '12px'
                        }}
                        title="Escalate to full investigation"
                      >
                        ⚠ Escalate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No EDR incidents</div>
          )}
        </div>

        {/* Open Investigations */}
        <div className="dashboard-card">
          <h3>Open Investigations ({investigations.filter(i => i.status !== 'CLOSED').length})</h3>
          {investigations.length > 0 ? (
            <ul className="card-list">
              {investigations
                .filter(inv => inv.status !== 'CLOSED')
                .slice(0, 10)
                .map((inv) => (
                  <li key={inv.id}>
                    <div style={{ fontWeight: '500', color: getSeverityColor(inv.priority) }}>
                      {inv.title}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                      Investigator: {inv.investigator}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#888', marginTop: '2px' }}>
                      {inv.relatedIncidents} related incidents • Started {new Date(inv.startedAt).toLocaleDateString()}
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="empty-state">No open investigations</div>
          )}
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div className="dashboard-card">
        <h3>Recent Audit Logs</h3>
        {renderPaginationControls()}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85em' }}>Severity</label>
            <select
              value={logSeverityFilter}
              onChange={(e) => {
                setLogSeverityFilter(e.target.value)
                setLogPage(0)
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`
              }}
            >
              <option value="all">All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <input
            type="text"
            value={logSearchTerm}
            onChange={(e) => {
              setLogSearchTerm(e.target.value)
              setLogPage(0)
            }}
            placeholder="Search action, details, account, IP"
            style={{
              flex: '1 1 220px',
              padding: '6px 10px',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`
            }}
          />
          <input
            type="text"
            value={logUserIdFilter}
            onChange={(e) => {
              setLogUserIdFilter(e.target.value)
              setLogPage(0)
            }}
            placeholder="User ID"
            style={{
              minWidth: '140px',
              padding: '6px 10px',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`
            }}
          />
          <input
            type="text"
            value={logUserNameFilter}
            onChange={(e) => {
              setLogUserNameFilter(e.target.value)
              setLogPage(0)
            }}
            placeholder="User name"
            style={{
              minWidth: '180px',
              padding: '6px 10px',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`
            }}
          />
          <button
            onClick={handleClearLogs}
            style={{
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer'
            }}
          >
            Clear Logs
          </button>
          <button
            onClick={() => {
              loadSecurityData()
              loadAuditLogs()
            }}
            style={{
              background: theme === 'dark' ? '#444' : '#f0f0f0',
              border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`,
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <label style={{ fontSize: '0.85em' }}>From</label>
          <input
            type="datetime-local"
            value={logStartTime}
            onChange={(e) => {
              setLogStartTime(e.target.value)
              setLogPage(0)
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`
            }}
          />
          <label style={{ fontSize: '0.85em' }}>To</label>
          <input
            type="datetime-local"
            value={logEndTime}
            onChange={(e) => {
              setLogEndTime(e.target.value)
              setLogPage(0)
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`
            }}
          />
          {auditLogError && (
            <span style={{ color: '#d9534f', fontSize: '0.85em' }}>{auditLogError}</span>
          )}
        </div>
        {auditLogLoading && (
          <div style={{ marginBottom: '12px', fontSize: '0.85em', color: '#888' }}>
            Loading audit logs…
          </div>
        )}
        {logsToRender.length > 0 ? (
          <div style={{
            overflowX: 'auto',
            fontSize: '0.85em',
            fontFamily: 'monospace'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                  borderBottom: `2px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  textAlign: 'left'
                }}>
                  <th style={{ padding: '8px' }}>Timestamp</th>
                  <th style={{ padding: '8px' }}>User</th>
                  <th style={{ padding: '8px' }}>Severity</th>
                  <th style={{ padding: '8px' }}>Action</th>
                  <th style={{ padding: '8px' }}>Details</th>
                  <th style={{ padding: '8px' }}>Resource</th>
                  <th style={{ padding: '8px' }}>IP Address</th>
                  <th style={{ padding: '8px' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {logsToRender.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`
                    }}
                  >
                    <td style={{ padding: '8px' }}>{formatTimestampHK(log.timestamp)}</td>
                    <td style={{ padding: '8px' }}>
                      <div>{log.userName || log.accountId || '—'}</div>
                      {log.accountId && log.accountId !== log.userName && (
                        <div style={{ fontSize: '0.7em', color: '#888' }}>{log.accountId}</div>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: '999px',
                        fontSize: '0.75em',
                        fontWeight: 600,
                        background: severityColorMap[log.severity] || '#888',
                        color: 'white'
                      }}>
                        {log.severity}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div>{log.action}</div>
                      {log.details && (
                        <div style={{ fontSize: '0.75em', color: '#888', marginTop: '4px' }}>
                          {log.details}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>{log.details || '—'}</td>
                    <td style={{ padding: '8px' }}>{log.resource || '—'}</td>
                    <td style={{ padding: '8px' }}>{log.ipAddress || '—'}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        color: log.result === 'SUCCESS' ? '#4caf50' : '#ff6b6b',
                        fontWeight: '600'
                      }}>
                        {log.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            {auditLogLoading ? 'Loading audit logs…' : 'No audit logs match the current filters'}
          </div>
        )}
        {renderPaginationControls()}
      </div>
    </div>
  )
}
