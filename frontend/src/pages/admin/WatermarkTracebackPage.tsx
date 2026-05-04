import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

interface WatermarkFingerprint {
  id: number
  payloadHash: string
  shortCode: string | null
  userId: number | null
  userAccountId?: string | null
  userFullName?: string | null
  userDepartment?: string | null
  documentId: number | null
  deviceId: string | null
  createdAt: string | null
}

interface AuditLogItem {
  id: number
  timestamp: string
  userId: number | null
  accountId: string | null
  action: string
  category: string
  details: string | null
  result: string
  ipAddress: string | null
}

interface ExpandedDetailsState {
  [key: number]: boolean
}

interface ShortCodeLookup {
  shortCode: string
  found: boolean
  message?: string
  partialMatch?: boolean
}

interface SearchResult {
  items: AuditLogItem[]
  totalElements: number
  totalPages: number
  currentPage: number
  pageSize: number
  searchCriteria?: string
  searchType?: string
  resolvedUserId?: number | null
  resolvedUserAccountId?: string | null
  fingerprints?: WatermarkFingerprint[]
  shortCodeLookup?: ShortCodeLookup
  auditLogsFallback?: boolean
  auditLogsFallbackReason?: string
}

/** Backend short-code / payload-hash hits return accessLogs; general search returns items. */
function normalizeWatermarkSearchPayload(raw: Record<string, unknown> | null | undefined): SearchResult {
  if (!raw || typeof raw !== 'object') {
    return {
      items: [],
      totalElements: 0,
      totalPages: 0,
      currentPage: 0,
      pageSize: 0,
    }
  }

  const accessLogs = raw.accessLogs
  if (raw.found === true && Array.isArray(accessLogs)) {
    const fingerprints: WatermarkFingerprint[] = []
    if (raw.fingerprint && typeof raw.fingerprint === 'object') {
      fingerprints.push(raw.fingerprint as WatermarkFingerprint)
    }
    const docFps = raw.allDocumentFingerprints
    if (Array.isArray(docFps)) {
      for (const f of docFps) {
        if (f && typeof f === 'object' && !fingerprints.some((p) => p.id === (f as WatermarkFingerprint).id)) {
          fingerprints.push(f as WatermarkFingerprint)
        }
      }
    }
    const label =
      typeof raw.shortCode === 'string'
        ? raw.shortCode
        : typeof raw.payloadHash === 'string'
          ? raw.payloadHash
          : ''
    return {
      items: accessLogs as AuditLogItem[],
      totalElements: Number(raw.totalAccessLogs ?? accessLogs.length) || 0,
      totalPages: 1,
      currentPage: 0,
      pageSize: accessLogs.length,
      searchCriteria: typeof raw.searchCriteria === 'string' ? raw.searchCriteria : undefined,
      searchType: typeof raw.searchType === 'string' ? raw.searchType : undefined,
      resolvedUserId:
        raw.fingerprint && typeof raw.fingerprint === 'object' && 'userId' in raw.fingerprint
          ? ((raw.fingerprint as { userId?: number | null }).userId ?? null)
          : null,
      resolvedUserAccountId: typeof raw.resolvedUserAccountId === 'string' ? raw.resolvedUserAccountId : null,
      fingerprints: fingerprints.length > 0 ? fingerprints : undefined,
      shortCodeLookup: label
        ? { found: true, shortCode: label }
        : { found: true, shortCode: '(matched)' },
      auditLogsFallback: raw.auditLogsFallback === true,
      auditLogsFallbackReason: typeof raw.auditLogsFallbackReason === 'string' ? raw.auditLogsFallbackReason : undefined,
    }
  }

  const items = raw.items
  return {
    items: Array.isArray(items) ? (items as AuditLogItem[]) : [],
    totalElements: typeof raw.totalElements === 'number' ? raw.totalElements : 0,
    totalPages: typeof raw.totalPages === 'number' ? raw.totalPages : 0,
    currentPage: typeof raw.currentPage === 'number' ? raw.currentPage : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 0,
    searchCriteria: typeof raw.searchCriteria === 'string' ? raw.searchCriteria : undefined,
    searchType: typeof raw.searchType === 'string' ? raw.searchType : undefined,
    resolvedUserId: typeof raw.resolvedUserId === 'number' ? raw.resolvedUserId : null,
    fingerprints: Array.isArray(raw.fingerprints) ? (raw.fingerprints as WatermarkFingerprint[]) : undefined,
    shortCodeLookup: raw.shortCodeLookup as SearchResult['shortCodeLookup'],
  }
}

function normalizeShortCodeInput(value: string): string {
  let s = value.trim()
  if (s.startsWith('#')) s = s.slice(1).trim()
  return s.toUpperCase()
}

const buildWatermarkDetails = (fp: WatermarkFingerprint, defaultIp: string = 'N/A'): string => {
  const accountId = fp.userAccountId || fp.userId?.toString() || 'SYSTEM'
  const timestamp = fp.createdAt 
    ? new Date(fp.createdAt).toLocaleString('zh-CN', { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).replace(/\//g, '-')
    : new Date().toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).replace(/\//g, '-')
  const shortCode = fp.shortCode || 'N/A'
  return `UID: ${accountId} | ${timestamp} | ${defaultIp} | #${shortCode}`
}

const datetimeLocalInputStyle = (theme: string) => ({
  flex: '1 1 200px',
  minWidth: 0,
  maxWidth: '100%',
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '10px',
  borderRadius: '4px',
  border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
  background: theme === 'dark' ? '#2a2a2a' : '#fff',
  color: theme === 'dark' ? '#fff' : '#000',
})

export default function WatermarkTracebackPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()

  // Search form state
  const [userAccountId, setUserAccountId] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [shortCode, setShortCode] = useState('')

  // Results state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [expandedDetails, setExpandedDetails] = useState<ExpandedDetailsState>({})

  // Detect fingerprint search type
  const isFingerprintSearch = searchResult?.searchType === 'SHORT_CODE_EXACT_MATCH' || searchResult?.searchType === 'PAYLOAD_HASH_EXACT_MATCH'
  // Fingerprint search defaults to matched-only filter
  const filterMatchedOnly = isFingerprintSearch

  // Compute matched fingerprint IDs: fingerprints that appear in matched audit logs
  const getMatchedFpIds = (): Set<number> => {
    const matched = new Set<number>()
    if (!searchResult?.fingerprints?.length || !searchResult.items?.length) return matched
    for (const log of searchResult.items) {
      const details = formatDetails(log.details)
      const docObj = details.jsonObj as Record<string, unknown> | null
      for (const fp of searchResult.fingerprints!) {
        const userMatch = fp.userAccountId && log.accountId === fp.userAccountId
        const docMatch = fp.documentId && docObj && docObj.documentId === fp.documentId
        if (userMatch || docMatch) matched.add(fp.id)
      }
    }
    return matched
  }

  // Compute which audit logs match any fingerprint (by user or document context)
  const getMatchedLogIds = (): Set<number> => {
    const matched = new Set<number>()
    if (!searchResult?.fingerprints?.length || !searchResult.items?.length) return matched
    for (const log of searchResult.items) {
      const details = formatDetails(log.details)
      const docObj = details.jsonObj as Record<string, unknown> | null
      for (const fp of searchResult.fingerprints!) {
        const userMatch = fp.userAccountId && log.accountId === fp.userAccountId
        const docMatch = fp.documentId && docObj && docObj.documentId === fp.documentId
        if (userMatch || docMatch) { matched.add(log.id); break }
      }
    }
    return matched
  }

  const handleSearch = async () => {
    setLoading(true)
    setError('')
    setSearchResult(null)

    try {
      const params: any = { page: 0, size: 50 }
      if (userAccountId) params.userAccountId = userAccountId.trim()
      if (ipAddress) params.ipAddress = ipAddress.trim()
      if (shortCode) params.shortCode = normalizeShortCodeInput(shortCode)
      if (startTime) params.startTime = startTime
      if (endTime) params.endTime = endTime

      const res = await apiClient.watermarkTracebackSearch(params)
      setSearchResult(normalizeWatermarkSearchPayload(res.data as Record<string, unknown>))
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setUserAccountId('')
    setIpAddress('')
    setStartTime('')
    setEndTime('')
    setShortCode('')
    setSearchResult(null)
    setError('')
    setExpandedDetails({})
  }

  // Format details JSON for display
  const formatDetails = (details: string | null): { display: string; isJson: boolean; jsonObj: object | null } => {
    if (!details) return { display: '-', isJson: false, jsonObj: null }
    try {
      const parsed = JSON.parse(details)
      return { display: JSON.stringify(parsed, null, 2), isJson: true, jsonObj: parsed }
    } catch {
      return { display: details, isJson: false, jsonObj: null }
    }
  }

  // Toggle details expansion
  const toggleDetails = (id: number) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case 'SUCCESS': return '#4caf50'
      case 'FAILURE': return '#ff6b6b'
      case 'DENIED': return '#ffa500'
      default: return '#888'
    }
  }

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString()
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Watermark Traceback</h1>
          <p style={{ color: '#888', marginTop: '8px' }}>
            Search and trace document leaks using watermark metadata
          </p>
        </div>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 16px' }}>
          Back
        </button>
      </div>

      {/* Search Form */}
      <div className="dashboard-card">
        <h3 style={{ marginBottom: '8px' }}>Search Watermark Records</h3>
        <p style={{ color: '#888', marginBottom: '16px', fontSize: '0.9em' }}>
          Enter any combination of fields. Short Code and Payload Hash provide exact matches.
          User, Document, IP, and Time can narrow down results.
        </p>

        {error && (
          <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '16px',
            minWidth: 0,
          }}
        >
          {/* Short Code - Highest Priority */}
          <div style={{ minWidth: 0 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', color: '#888' }}>
              Short Code (Doc Fingerprint)
            </label>
            <input
              type="text"
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder="e.g., ABC1234 or #ABC1234"
              style={{
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: '4px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* User Account ID */}
          <div style={{ minWidth: 0 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', color: '#888' }}>
              User Account ID
            </label>
            <input
              type="text"
              value={userAccountId}
              onChange={(e) => setUserAccountId(e.target.value)}
              placeholder="e.g., it1, admin"
              style={{
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: '4px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
              }}
            />
          </div>

          {/* IP Address */}
          <div style={{ minWidth: 0 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', color: '#888' }}>
              IP Address
            </label>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g., 192.168.1.100"
              style={{
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: '4px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
              }}
            />
          </div>
        </div>

        {/* Time range on its own row so datetime-local controls do not overflow the card */}
        <div style={{ marginBottom: '16px', width: '100%', minWidth: 0, maxWidth: '100%' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', color: '#888' }}>
            Created At (Time Range)
          </label>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              minWidth: 0,
            }}
          >
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={datetimeLocalInputStyle(theme)}
            />
            <span style={{ color: '#888', flex: '0 0 auto' }}>to</span>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={datetimeLocalInputStyle(theme)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '10px 24px',
              background: loading ? '#999' : '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button
            onClick={handleClear}
            style={{
              padding: '10px 24px',
              background: theme === 'dark' ? '#333' : '#e0e0e0',
              color: theme === 'dark' ? '#fff' : '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>
      {searchResult && (
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Search Results</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {searchResult.searchType && (
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.8em',
                  fontWeight: '600',
                  background: '#1976d222',
                  color: '#1976d2'
                }}>
                  {searchResult.searchType.replace('_', ' ')}
                </span>
              )}
              <span style={{ color: '#888', fontSize: '0.9em' }}>
                {searchResult.totalElements} audit log(s)
              </span>
            </div>
          </div>

          {/* Search Criteria Info */}
          {searchResult.searchCriteria && (
            <div style={{
              padding: '12px',
              background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '0.85em'
            }}>
              <strong>Search Criteria:</strong> {searchResult.searchCriteria}
              {searchResult.resolvedUserAccountId && (
                <div style={{ marginTop: '4px' }}>
                  <strong>Resolved User ID:</strong> {searchResult.resolvedUserAccountId}
                  {searchResult.resolvedUserId && (
                    <span style={{ color: '#888', marginLeft: '8px' }}>(ID: {searchResult.resolvedUserId})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Partial Match Warning */}
          {searchResult.shortCodeLookup?.partialMatch && (
            <div style={{
              padding: '12px',
              background: '#fff3e0',
              borderRadius: '4px',
              marginBottom: '16px',
              color: '#e65100'
            }}>
              <strong>Partial Match:</strong> {searchResult.shortCodeLookup.message}
            </div>
          )}

          {/* Short Code Lookup Result */}
          {searchResult.shortCodeLookup && (
            <div style={{
              padding: '12px',
              background: searchResult.shortCodeLookup.found ? '#e8f5e9' : '#ffebee',
              borderRadius: '4px',
              marginBottom: '16px',
              color: searchResult.shortCodeLookup.found ? '#2e7d32' : '#c62828'
            }}>
              {searchResult.shortCodeLookup.found ? (
                <strong>Short Code FOUND in database</strong>
              ) : (
                <>
                  <strong>Short Code NOT FOUND:</strong> {searchResult.shortCodeLookup.shortCode}
                  <p style={{ marginTop: '4px', fontSize: '0.9em' }}>{searchResult.shortCodeLookup.message}</p>
                </>
              )}
            </div>
          )}

          {/* Fallback Search Indicator */}
          {searchResult.auditLogsFallback && (
            <div style={{
              padding: '12px',
              background: '#fff3e0',
              borderRadius: '4px',
              marginBottom: '16px',
              color: '#e65100'
            }}>
              <strong>Fallback Search Used:</strong>
              <p style={{ marginTop: '4px', fontSize: '0.9em' }}>{searchResult.auditLogsFallbackReason}</p>
            </div>
          )}

          {/* Audit Logs */}
          {(searchResult.items?.length ?? 0) > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#888', fontSize: '0.9em' }}>
                  {searchResult.items.length} audit log(s)
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Result</th>
                      <th>IP Address</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.items
                      .map((log) => {
                        const matchedIds = getMatchedLogIds()
                        const isMatched = matchedIds.has(log.id)
                        return (
                          <tr
                            key={log.id}
                            style={isMatched ? { background: '#e8f5e9' } : {}}
                          >
                            <td style={{ whiteSpace: 'nowrap' }}>{formatTimestamp(log.timestamp)}</td>
                            <td>
                              {log.accountId || log.userId || '-'}
                            </td>
                            <td>{log.action}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8em',
                                fontWeight: '600',
                                background: getResultColor(log.result) + '22',
                                color: getResultColor(log.result)
                              }}>
                                {log.result}
                              </span>
                            </td>
                            <td>{log.ipAddress || '-'}</td>
                            <td style={{ maxWidth: '300px' }}>
                              {log.details ? (
                                <div>
                                  {(() => {
                                    const formatted = formatDetails(log.details)
                                    if (!formatted.isJson) {
                                      return (
                                        <div style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>
                                          {log.details.length > 100 ? `${log.details.substring(0, 100)}...` : log.details}
                                        </div>
                                      )
                                    }
                                    const isExpanded = expandedDetails[log.id]
                                    const preview = formatted.display.substring(0, 80)
                                    return (
                                      <div>
                                        <button
                                          onClick={() => toggleDetails(log.id)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#1976d2',
                                            cursor: 'pointer',
                                            fontSize: '0.85em',
                                            padding: '2px 6px',
                                            textDecoration: 'underline'
                                          }}
                                        >
                                          {isExpanded ? '▼ Hide' : '▶ Show'} JSON
                                        </button>
                                        {isExpanded && (
                                          <pre style={{
                                            margin: '8px 0 0 0',
                                            padding: '8px',
                                            background: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
                                            borderRadius: '4px',
                                            fontSize: '0.75em',
                                            maxHeight: '200px',
                                            overflow: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all'
                                          }}>
                                            {formatted.display}
                                          </pre>
                                        )}
                                        {!isExpanded && (
                                          <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                                            {preview}...
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                              ) : '-'}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
              No audit logs found matching the search criteria.
            </div>
          )}

          {/* Watermark Fingerprints */}
          {searchResult.fingerprints && searchResult.fingerprints.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Watermark Fingerprints (
                {filterMatchedOnly
                  ? `${getMatchedFpIds().size} / ${searchResult.fingerprints.length}`
                  : searchResult.fingerprints.length}
                )</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '1100px' }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Short Code</th>
                      <th>User</th>
                      <th>Document ID</th>
                      <th>Payload Hash</th>
                      <th>Watermark Details</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.fingerprints
                      .filter(fp => !filterMatchedOnly || getMatchedFpIds().has(fp.id))
                      .map((fp) => {
                        const isMatched = getMatchedFpIds().has(fp.id)
                        return (
                          <tr key={fp.id} style={isMatched && filterMatchedOnly ? { background: '#e8f5e9' } : {}}>
                            <td>{fp.id}</td>
                            <td style={{ fontFamily: 'monospace', color: '#1976d2', fontWeight: 'bold' }}>{fp.shortCode || '-'}</td>
                            <td>
                              {fp.userAccountId ? (
                                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{fp.userAccountId}</span>
                              ) : (
                                <span style={{ color: '#888', fontStyle: 'italic' }}>System</span>
                              )}
                            </td>
                            <td>
                              {fp.documentId ? (
                                <span style={{ fontFamily: 'monospace' }}>#{fp.documentId}</span>
                              ) : '-'}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75em', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fp.payloadHash ? (
                                <span title={fp.payloadHash}>{fp.payloadHash.substring(0, 16)}...</span>
                              ) : '-'}
                            </td>
                            <td style={{
                              fontFamily: 'monospace',
                              fontSize: '0.72em',
                              color: '#333',
                              background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                              padding: '4px 6px',
                              borderRadius: '3px',
                              maxWidth: '320px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }} title={buildWatermarkDetails(fp)}>
                              {buildWatermarkDetails(fp)}
                            </td>
                            <td>{fp.createdAt ? formatTimestamp(fp.createdAt) : '-'}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>

              {/* Legend for system fingerprints */}
              <div style={{ marginTop: '8px', fontSize: '0.8em', color: '#888' }}>
                <strong>Note:</strong> Fingerprints with <span style={{ color: '#888', fontStyle: 'italic' }}>"System (null userId)"</span> are generated during document upload by system (no user context). The audit logs should still be found by document ID or payload hash matching.
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
