import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'
import type { AuditLogPage as AuditLogPageType } from '../../types'
import { AuditLogEntry, AuditLogSearchParams } from '../../types'

export default function AuditLogPage() {
  const { theme, user } = useAuthStore()
  const hasRole = (...roles: string[]) =>
    (user?.roles || []).some((r: string) =>
      roles.some(role => r === role || r === `ROLE_${role}`)
    )
  const isAdmin = hasRole('ADMIN')
  const canManageLegacy = hasRole('ADMIN', 'REVIEWER')

  const [auditLogPage, setAuditLogPage] = useState<AuditLogPageType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const [pageSize] = useState(20)

  // Filters - default to show all logs (no filters)
  const [filters, setFilters] = useState<AuditLogSearchParams>({ page: 0, size: 20 })
  const [showFilters, setShowFilters] = useState(false)

  // Legacy (unchained) audit logs
  const [legacyCount, setLegacyCount] = useState<number | null>(null)
  const [legacyLoading, setLegacyLoading] = useState(false)
  const [legacyActionLoading, setLegacyActionLoading] = useState(false)

  useEffect(() => {
    loadAuditLogs()
  }, [page, pageSize, filters])

  const loadLegacyCount = useCallback(async () => {
    setLegacyLoading(true)
    try {
      const res = await apiClient.getLegacyAuditCount()
      setLegacyCount(res.data?.legacyCount ?? 0)
    } catch {
      setLegacyCount(null)
    } finally {
      setLegacyLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canManageLegacy) loadLegacyCount()
  }, [loadLegacyCount, canManageLegacy])

  const loadAuditLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: AuditLogSearchParams = {
        ...filters,
        page,
        size: pageSize
      }
      const response = await apiClient.searchAuditLogs(params)
      if (response.success && response.data) {
        setAuditLogPage(response.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters])

  const handleFilterChange = (key: keyof AuditLogSearchParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0) // Reset to first page when filters change
  }

  const handleApplyFilters = () => {
    setPage(0)
    loadAuditLogs()
  }

  const handleResetFilters = () => {
    setFilters({ page: 0, size: 20 })
    setPage(0)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await apiClient.exportAuditLogs({
        ...filters,
        format: 'csv',
        page: 0,
        size: 10000 // Export more records
      })
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      alert('Audit logs exported successfully')
    } catch (err: any) {
      alert('Failed to export audit logs: ' + (err.response?.data?.message || err.message))
    } finally {
      setExporting(false)
    }
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case 'SUCCESS': return '#4caf50'
      case 'FAILURE': return '#f44336'
      case 'WARNING': return '#ff9800'
      case 'CRITICAL': return '#b71c1c'
      case 'DENIED': return '#d32f2f'
      default: return '#757575'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'AUTH': return '#2196f3'
      case 'DOCUMENT': return '#9c27b0'
      case 'ADMIN': return '#ff5722'
      case 'SYSTEM': return '#607d8b'
      default: return '#757575'
    }
  }

  const getSeverity = (result: string, action?: string) => {
    // Screen recording/screenshot attempts are always HIGH severity
    if (action && (
      action.includes('SCREENSHOT') ||
      action.includes('SCREEN_RECORD') ||
      action.includes('CLIPBOARD_IMAGE') ||
      action.includes('SCREEN_CAPTURE')
    )) {
      return 'HIGH'
    }
    
    // DENIED or FAILURE = HIGH severity
    if (result === 'FAILURE' || result === 'DENIED') return 'HIGH'
    if (result === 'WARNING') return 'MEDIUM'
    return 'LOW'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return '#f44336'   // red
      case 'MEDIUM': return '#ff9800' // yellow/orange
      default: return '#4caf50'       // green
    }
  }

  const getChainStatusMeta = (status?: string) => {
    switch (status) {
      case 'ANCHORED':
        return { label: 'Anchored', bg: '#4caf5033', color: '#2e7d32' }
      case 'HASHED':
        return { label: 'Hashed', bg: '#03a9f433', color: '#01579b' }
      case 'ANCHOR_FAILED':
        return { label: 'Anchor failed', bg: '#f4433633', color: '#b71c1c' }
      case 'NOT_CHAINED':
        return { label: 'Not chained', bg: '#ff980033', color: '#e65100' }
      default:
        return { label: 'Unknown', bg: '#9e9e9e33', color: '#616161' }
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const totalElements = auditLogPage?.totalElements || 0
  const totalPages = auditLogPage?.totalPages || 0
  const currentPage = auditLogPage?.currentPage ?? page
  const items = auditLogPage?.items || []
  const activeQuickFilter: 'WINDOW_FOCUS_LOST' | 'APP_SWITCH' | 'BLOCKCHAIN' | 'UNAUTHORIZED_ACCESS' | null =
    filters.searchTerm === 'BLOCKCHAIN'
      ? 'BLOCKCHAIN'
      : (filters.action === 'UNAUTHORIZED_ACCESS'
        ? 'UNAUTHORIZED_ACCESS'
        : (filters.action === 'WINDOW_FOCUS_LOST' || filters.action === 'APP_SWITCH'
        ? filters.action
        : null))

  const applyQuickFilter = (quick: 'WINDOW_FOCUS_LOST' | 'APP_SWITCH' | 'BLOCKCHAIN' | 'UNAUTHORIZED_ACCESS' | null) => {
    setFilters(prev => {
      if (quick === 'WINDOW_FOCUS_LOST' || quick === 'APP_SWITCH' || quick === 'UNAUTHORIZED_ACCESS') {
        return { ...prev, action: quick, searchTerm: undefined }
      }
      if (quick === 'BLOCKCHAIN') {
        return { ...prev, action: undefined, searchTerm: 'BLOCKCHAIN' }
      }
      return { ...prev, action: undefined, searchTerm: undefined }
    })
    setPage(0)
  }

  return (
    <DashboardLayout>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>Audit Logs</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: '8px 16px',
                background: exporting ? '#ccc' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: exporting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {exporting ? 'Exporting...' : 'Export Report'}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '8px 16px',
                background: showFilters ? '#ff9800' : '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>

        {/* Quick filters: focus/device and blockchain */}
        <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: theme === 'dark' ? '#aaa' : '#666', marginRight: '8px' }}>Quick:</span>
          <button
            type="button"
            onClick={() => applyQuickFilter('WINDOW_FOCUS_LOST')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${activeQuickFilter === 'WINDOW_FOCUS_LOST' ? '#2196f3' : theme === 'dark' ? '#555' : '#ddd'}`,
              background: activeQuickFilter === 'WINDOW_FOCUS_LOST' ? '#2196f333' : 'transparent',
              color: theme === 'dark' ? '#eee' : '#333',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Window focus lost
          </button>
          <button
            type="button"
            onClick={() => applyQuickFilter('APP_SWITCH')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${activeQuickFilter === 'APP_SWITCH' ? '#2196f3' : theme === 'dark' ? '#555' : '#ddd'}`,
              background: activeQuickFilter === 'APP_SWITCH' ? '#2196f333' : 'transparent',
              color: theme === 'dark' ? '#eee' : '#333',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            App switch
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => applyQuickFilter('BLOCKCHAIN')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${activeQuickFilter === 'BLOCKCHAIN' ? '#2196f3' : theme === 'dark' ? '#555' : '#ddd'}`,
                background: activeQuickFilter === 'BLOCKCHAIN' ? '#2196f333' : 'transparent',
                color: theme === 'dark' ? '#eee' : '#333',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Blockchain
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => applyQuickFilter('UNAUTHORIZED_ACCESS')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${activeQuickFilter === 'UNAUTHORIZED_ACCESS' ? '#f44336' : theme === 'dark' ? '#555' : '#ddd'}`,
                background: activeQuickFilter === 'UNAUTHORIZED_ACCESS' ? '#f4433633' : 'transparent',
                color: activeQuickFilter === 'UNAUTHORIZED_ACCESS' ? '#f44336' : (theme === 'dark' ? '#eee' : '#333'),
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Unauthorized Access
            </button>
          )}
          <button
            type="button"
            onClick={() => applyQuickFilter(null)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
              background: 'transparent',
              color: theme === 'dark' ? '#999' : '#666',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Clear quick
          </button>
        </div>

        {/* Legacy (unchained) logs: mark as NOT_CHAINED or clear — only for audit roles */}
        {canManageLegacy && (legacyCount === null || legacyCount > 0) && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: theme === 'dark' ? '#2a2a2a' : '#fff8e1',
            border: `1px solid ${theme === 'dark' ? '#444' : '#ffcc02'}`,
            borderRadius: '8px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              Legacy (unchained) logs: {legacyLoading ? '…' : (legacyCount ?? '—')}
            </span>
            <button
              type="button"
              disabled={legacyActionLoading || (legacyCount !== null && legacyCount === 0)}
              onClick={async () => {
                setLegacyActionLoading(true)
                try {
                  const res = await apiClient.markLegacyAsNotChained()
                  alert(`Marked ${res.data?.markedCount ?? 0} legacy logs as "Not chained".`)
                  loadLegacyCount()
                  loadAuditLogs()
                } catch (e: any) {
                  alert(e.response?.data?.message || 'Failed to mark legacy logs')
                } finally {
                  setLegacyActionLoading(false)
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', background: '#ff9800', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }}
            >
              {legacyActionLoading ? '…' : 'Mark all as Not chained'}
            </button>
            <button
              type="button"
              disabled={legacyActionLoading || (legacyCount !== null && legacyCount === 0)}
              onClick={async () => {
                if (!confirm(`Delete ${legacyCount ?? 0} legacy (unchained) audit logs? This cannot be undone.`)) return
                setLegacyActionLoading(true)
                try {
                  const res = await apiClient.clearLegacyAuditLogs()
                  alert(`Deleted ${res.data?.deletedCount ?? 0} legacy logs.`)
                  loadLegacyCount()
                  loadAuditLogs()
                } catch (e: any) {
                  alert(e.response?.data?.message || 'Failed to clear legacy logs')
                } finally {
                  setLegacyActionLoading(false)
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', background: '#f44336', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }}
            >
              {legacyActionLoading ? '…' : 'Clear legacy only'}
            </button>
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <div style={{
            background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Username</label>
                <input
                  type="text"
                  value={filters.userName || ''}
                  onChange={(e) => handleFilterChange('userName', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                  placeholder="Username"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Account ID</label>
                <input
                  type="text"
                  value={filters.accountId || ''}
                  onChange={(e) => handleFilterChange('accountId', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                  placeholder="Account ID"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Document ID</label>
                <input
                  type="number"
                  value={filters.documentId || ''}
                  onChange={(e) => handleFilterChange('documentId', e.target.value ? Number(e.target.value) : undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                  placeholder="Document ID"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Action Type</label>
                <input
                  type="text"
                  value={filters.action || ''}
                  onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                  placeholder="e.g. VIEW_DOCUMENT"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Category</label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                >
                  <option value="">All</option>
                  <option value="AUTH">AUTH</option>
                  <option value="DOCUMENT">DOCUMENT</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SYSTEM">SYSTEM</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Result</label>
                <select
                  value={filters.result || ''}
                  onChange={(e) => handleFilterChange('result', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                >
                  <option value="">All</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILURE">FAILURE</option>
                  <option value="WARNING">WARNING</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="DENIED">DENIED</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Severity</label>
                <select
                  value={filters.severity || ''}
                  onChange={(e) => handleFilterChange('severity', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                >
                  <option value="">All</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Start Time</label>
                <input
                  type="datetime-local"
                  value={filters.startTime || ''}
                  onChange={(e) => handleFilterChange('startTime', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>End Time</label>
                <input
                  type="datetime-local"
                  value={filters.endTime || ''}
                  onChange={(e) => handleFilterChange('endTime', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Search Keyword</label>
                <input
                  type="text"
                  value={filters.searchTerm || ''}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value || undefined)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    background: theme === 'dark' ? '#333' : 'white',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                  placeholder="Search action, details, etc."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleApplyFilters}
                style={{
                  padding: '8px 16px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Apply Filters
              </button>
              <button
                onClick={handleResetFilters}
                style={{
                  padding: '8px 16px',
                  background: '#757575',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px',
            background: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* Audit Logs Table */}
        <div style={{
          background: theme === 'dark' ? '#2a2a2a' : 'white',
          borderRadius: '8px',
          border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: theme === 'dark' ? '#333' : '#f5f5f5', borderBottom: `2px solid ${theme === 'dark' ? '#555' : '#ddd'}` }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Time</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>User</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Action</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Category</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Severity</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Result</th>
                  {isAdmin && (
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Chain Status</th>
                  )}
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>IP Address</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  items.map((log) => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#eee'}`,
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? '#333' : '#f9f9f9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      onClick={() => {
                        setSelectedLog(log)
                        setShowDetailModal(true)
                      }}
                    >
                      <td style={{ padding: '12px', fontSize: '13px' }}>{formatTimestamp(log.timestamp)}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        {log.userName || log.accountId || 'Unknown'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{log.action}</td>
                      <td style={{ padding: '12px' }}>
                        {log.category && (
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                            background: getCategoryColor(log.category) + '33',
                            color: getCategoryColor(log.category)
                          }}>
                            {log.category}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: getSeverityColor(getSeverity(log.result, log.action)) + '33',
                          color: getSeverityColor(getSeverity(log.result, log.action))
                        }}>
                          {getSeverity(log.result, log.action)}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: getResultColor(log.result) + '33',
                          color: getResultColor(log.result)
                        }}>
                          {log.result}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '12px' }}>
                          {(() => {
                            const chain = getChainStatusMeta(log.anchorStatus)
                            return (
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '500',
                                background: chain.bg,
                                color: chain.color
                              }}>
                                {chain.label}
                              </span>
                            )
                          })()}
                        </td>
                      )}
                      <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace' }}>
                        {log.ipAddress || '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                            setShowDetailModal(true)
                          }}
                          style={{
                            padding: '4px 12px',
                            background: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`
            }}>
              <div style={{ fontSize: '14px', color: theme === 'dark' ? '#ccc' : '#666' }}>
                Showing {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPage(0)}
                  disabled={currentPage === 0 || loading}
                  style={{
                    padding: '6px 12px',
                    background: currentPage === 0 ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  First
                </button>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0 || loading}
                  style={{
                    padding: '6px 12px',
                    background: currentPage === 0 ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Previous
                </button>
                <span style={{ padding: '6px 12px', fontSize: '13px' }}>
                  Page {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1 || loading}
                  style={{
                    padding: '6px 12px',
                    background: currentPage >= totalPages - 1 ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1 || loading}
                  style={{
                    padding: '6px 12px',
                    background: currentPage >= totalPages - 1 ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedLog && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setShowDetailModal(false)}
          >
            <div
              style={{
                background: theme === 'dark' ? '#2a2a2a' : 'white',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Audit Log Details</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <strong>ID:</strong> {selectedLog.id}
                </div>
                <div>
                  <strong>Time:</strong> {formatTimestamp(selectedLog.timestamp)}
                </div>
                <div>
                  <strong>User ID:</strong> {selectedLog.userId || '—'}
                </div>
                <div>
                  <strong>Account ID:</strong> {selectedLog.accountId || '—'}
                </div>
                <div>
                  <strong>Username:</strong> {selectedLog.userName || '—'}
                </div>
                <div>
                  <strong>Action:</strong> {selectedLog.action}
                </div>
                <div>
                  <strong>Category:</strong> {selectedLog.category || '—'}
                </div>
                <div>
                  <strong>Result:</strong> {selectedLog.result}
                </div>
                <div>
                  <strong>IP Address:</strong> {selectedLog.ipAddress || '—'}
                </div>
                {isAdmin && (
                  <div>
                    <strong>Immutable Hash:</strong>
                    <div style={{
                      marginTop: '8px',
                      padding: '10px',
                      background: theme === 'dark' ? '#333' : '#f5f5f5',
                      borderRadius: '4px',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}>
                      {selectedLog.immutableHash || '—'}
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div>
                    <strong>On-chain Anchor:</strong> {selectedLog.anchorStatus || '—'}
                  </div>
                )}
                {isAdmin && (
                  <div>
                    <strong>Blockchain Tx Hash:</strong>
                    <div style={{
                      marginTop: '8px',
                      padding: '10px',
                      background: theme === 'dark' ? '#333' : '#f5f5f5',
                      borderRadius: '4px',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}>
                      {selectedLog.blockchainTxHash || '—'}
                    </div>
                  </div>
                )}
                <div>
                  <strong>Details:</strong>
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: theme === 'dark' ? '#333' : '#f5f5f5',
                    borderRadius: '4px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '13px'
                  }}>
                    {selectedLog.details || '—'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#757575',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
