import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'
import DashboardLayout from '../../components/DashboardLayout'

export default function DocumentsPage() {
  const navigate = useNavigate()
  const { user, theme } = useAuthStore()

  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [classificationLevel, setClassificationLevel] = useState('')
  const [status, setStatus] = useState('')
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Sorting
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Pagination
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  // Batch selection
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set())
  const [showBatchShareDialog, setShowBatchShareDialog] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Available options
  const [departments, setDepartments] = useState<string[]>([])

  // Debounce search query
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Load filters from sessionStorage on mount
  useEffect(() => {
    const savedFilters = sessionStorage.getItem('documents-filters')
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters)
        setQuery(filters.query || '')
        setDepartment(filters.department || '')
        setClassificationLevel(filters.classificationLevel || '')
        setStatus(filters.status || '')
        setDateRange(filters.dateRange || 'all')
        setSortBy(filters.sortBy || 'updatedAt')
        setSortOrder(filters.sortOrder || 'desc')
        setPage(filters.page || 0)
        setPageSize(filters.pageSize || 20)
      } catch (e) {
        console.error('Failed to load saved filters:', e)
      }
    }
  }, [])

  // Save filters to sessionStorage
  useEffect(() => {
    const filters = {
      query,
      department,
      classificationLevel,
      status,
      dateRange,
      sortBy,
      sortOrder,
      page,
      pageSize
    }
    sessionStorage.setItem('documents-filters', JSON.stringify(filters))
  }, [query, department, classificationLevel, status, dateRange, sortBy, sortOrder, page, pageSize])

  // Debounce search query (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 500)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    loadFilters()
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [page, debouncedQuery, department, classificationLevel, status, dateRange, customStartDate, customEndDate, sortBy, sortOrder, pageSize])

  const loadFilters = async () => {
    try {
      const depts = await apiClient.getDepartments()
      setDepartments(depts.data || [])
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
  }

  const getDateRangeFilter = () => {
    if (dateRange === 'all') return undefined
    const now = new Date()
    let startDate: Date

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        if (customStartDate && customEndDate) {
          return { startDate: customStartDate, endDate: customEndDate }
        }
        return undefined
      default:
        return undefined
    }

    return { startDate: startDate.toISOString(), endDate: now.toISOString() }
  }

  const loadDocuments = async () => {
    setLoading(true)
    setError('')

    try {
      const dateFilter = getDateRangeFilter()
      const response = await apiClient.searchDocuments({
        query: debouncedQuery || undefined,
        department: department || undefined,
        classificationLevel: classificationLevel || undefined,
        status: status || undefined,
        startDate: dateFilter?.startDate,
        endDate: dateFilter?.endDate,
        page,
        pageSize,
        sortBy,
        sortOrder
      })

      const content = response.data.content || []

      // Client-side sort to ensure all sort buttons work consistently
      const sorted = [...content].sort((a: any, b: any) => {
        const orderMultiplier = sortOrder === 'asc' ? 1 : -1
        switch (sortBy) {
          case 'name': {
            const an = (a.name || '').toString().toLowerCase()
            const bn = (b.name || '').toString().toLowerCase()
            if (an < bn) return -1 * orderMultiplier
            if (an > bn) return 1 * orderMultiplier
            return 0
          }
          case 'ownerName': {
            const ao = (a.ownerName || a.owner || '').toString().toLowerCase()
            const bo = (b.ownerName || b.owner || '').toString().toLowerCase()
            if (ao < bo) return -1 * orderMultiplier
            if (ao > bo) return 1 * orderMultiplier
            return 0
          }
          case 'department': {
            const ad = (a.department || '').toString().toLowerCase()
            const bd = (b.department || '').toString().toLowerCase()
            if (ad < bd) return -1 * orderMultiplier
            if (ad > bd) return 1 * orderMultiplier
            return 0
          }
          case 'updatedAt':
          default: {
            const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
            const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
            if (at < bt) return -1 * orderMultiplier
            if (at > bt) return 1 * orderMultiplier
            return 0
          }
        }
      })

      setDocuments(sorted)
      setTotalPages(response.data.totalPages || 0)
      setTotalElements(response.data.totalElements || 0)
      // Clear selection when documents change
      setSelectedDocs(new Set())
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    // Debounce will trigger loadDocuments automatically
  }

  const handleReset = () => {
    setQuery('')
    setDebouncedQuery('')
    setDepartment('')
    setClassificationLevel('')
    setStatus('')
    setDateRange('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setSortBy('updatedAt')
    setSortOrder('desc')
    setPage(0)
    setSelectedDocs(new Set())
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(0)
  }

  const handleSelectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set())
    } else {
      setSelectedDocs(new Set(documents.map(doc => doc.id)))
    }
  }

  const handleSelectDoc = (docId: number) => {
    const newSelected = new Set(selectedDocs)
    if (newSelected.has(docId)) {
      newSelected.delete(docId)
    } else {
      newSelected.add(docId)
    }
    setSelectedDocs(newSelected)
  }

  const handleBatchExport = async () => {
    if (selectedDocs.size === 0) return

    setExporting(true)
    try {
      const response = await apiClient.batchExportDocuments(Array.from(selectedDocs))
      const result = response.data

      if (result.deniedCount > 0) {
        const deniedList = result.deniedDocuments.map((d: any) => 
          `- ${d.documentName}: ${d.reason}`
        ).join('\n')
        alert(`Export completed with some restrictions:\n\n${deniedList}`)
      }

      if (result.exportedCount > 0 && result.downloadUrl) {
        alert(`Batch export preparation succeeded for ${result.exportedCount} document(s), but download is not permitted. Documents must be previewed individually to ensure per-viewer watermarks are applied for audit traceability.`)
      } else {
        alert('No documents were exported. Please check permissions.')
      }

      setSelectedDocs(new Set())
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to export documents')
    } finally {
      setExporting(false)
    }
  }

  const handleBatchShare = async (shareParams: any) => {
    if (selectedDocs.size === 0) return

    setShowBatchShareDialog(true)
    try {
      const response = await apiClient.batchShareDocuments({
        documentIds: Array.from(selectedDocs),
        ...shareParams
      })
      const result = response.data

      if (result.deniedCount > 0) {
        const deniedList = result.deniedDocuments.map((d: any) => 
          `- ${d.documentName}: ${d.reason}`
        ).join('\n')
        alert(`Share completed with some restrictions:\n\n${deniedList}`)
      }

      if (result.sharedCount > 0) {
        alert(`Successfully shared ${result.sharedCount} document(s)`)
        setSelectedDocs(new Set())
        loadDocuments()
      } else {
        alert('No documents were shared. Please check permissions.')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to share documents')
    } finally {
      setShowBatchShareDialog(false)
    }
  }

  const getClassificationColor = (level: string) => {
    switch (level) {
      case 'PUBLIC': return '#4caf50'
      case 'INTERNAL': return '#2196f3'
      case 'CONFIDENTIAL': return '#ff9800'
      case 'STRICTLY_CONFIDENTIAL': return '#f44336'
      default: return '#888'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CLASSIFIED':
      case 'ACTIVE': return '#4caf50'
      case 'PROCESSING': return '#2196f3'
      case 'REVIEW_REQUIRED': return '#ff9800'
      case 'FAILED':
      case 'QUARANTINED': return '#f44336'
      default: return '#888'
    }
  }

  if (loading && documents.length === 0) {
    return (
      <DashboardLayout>
        <div className="dashboard">
          <h2>Loading documents...</h2>
        </div>
      </DashboardLayout>
    )
  }

  const selectedDocsArray = documents.filter(doc => selectedDocs.has(doc.id))
  const canBatchShareSelected = selectedDocsArray.length > 0 && selectedDocsArray.every(doc => doc.ownerId === user?.userId)

  return (
    <DashboardLayout>
      <div className="dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1>Document Library</h1>
          <button onClick={() => navigate('/upload')} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            📤 Upload Document
          </button>
        </div>

        {/* Search and Filters */}
        <div className="dashboard-card" style={{ marginBottom: '20px' }}>
          <form onSubmit={handleSearch}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Search by name or description..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  background: theme === 'dark' ? '#2a2a2a' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#000'
                }}
              />

              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  background: theme === 'dark' ? '#2a2a2a' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#000'
                }}
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <select
                value={classificationLevel}
                onChange={(e) => setClassificationLevel(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  background: theme === 'dark' ? '#2a2a2a' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#000'
                }}
              >
                <option value="">All Classifications</option>
                <option value="PUBLIC">Public</option>
                <option value="INTERNAL">Internal</option>
                <option value="CONFIDENTIAL">Confidential</option>
                <option value="STRICTLY_CONFIDENTIAL">Strictly Confidential</option>
              </select>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  background: theme === 'dark' ? '#2a2a2a' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#000'
                }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="CLASSIFIED">Classified</option>
                <option value="PROCESSING">Processing</option>
                <option value="REVIEW_REQUIRED">Review Required</option>
                <option value="ARCHIVED">Archived</option>
                <option value="FAILED">Failed</option>
                <option value="QUARANTINED">Quarantined</option>
              </select>

              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value as any)
                  setPage(0)
                }}
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  background: theme === 'dark' ? '#2a2a2a' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#000'
                }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9em' }}>From:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value)
                    setPage(0)
                  }}
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
                <label style={{ fontSize: '0.9em' }}>To:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value)
                    setPage(0)
                  }}
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" style={{ padding: '10px 20px' }}>
                🔍 Search
              </button>
              <button type="button" onClick={handleReset} style={{ padding: '10px 20px', background: '#6c757d' }}>
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Results Info and Batch Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ color: '#888' }}>
          Showing {documents.length} of {totalElements} documents
            {selectedDocs.size > 0 && (
              <span style={{ marginLeft: '12px', color: '#007bff', fontWeight: '500' }}>
                ({selectedDocs.size} selected)
              </span>
            )}
          </div>
          {selectedDocs.size > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleBatchExport}
                disabled={exporting}
                style={{
                  padding: '8px 16px',
                  background: exporting ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: exporting ? 'not-allowed' : 'pointer'
                }}
              >
                {exporting ? '⏳ Exporting...' : `📦 Export Selected (${selectedDocs.size})`}
              </button>
              <button
                onClick={() => {
                  if (!canBatchShareSelected) {
                    alert('Only document owner can share. Please select only your own documents.')
                    return
                  }
                  // For now, use a simple prompt. In the future, this can be replaced with BatchShareDialog
                  const shareType = prompt('Share type (PUBLIC/PRIVATE):', 'PRIVATE')
                  if (shareType) {
                    handleBatchShare({
                      shareType: shareType as 'PUBLIC' | 'PRIVATE',
                      permissions: ['VIEW'],
                      expiresInDays: 7
                    })
                  }
                }}
                disabled={exporting || showBatchShareDialog || !canBatchShareSelected}
                style={{
                  padding: '8px 16px',
                  background: (exporting || showBatchShareDialog || !canBatchShareSelected) ? '#6c757d' : '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (exporting || showBatchShareDialog || !canBatchShareSelected) ? 'not-allowed' : 'pointer'
                }}
                title={!canBatchShareSelected ? 'Only owner can share selected documents' : undefined}
              >
                {showBatchShareDialog ? '⏳ Sharing...' : (exporting ? '⏳ Exporting...' : `🔗 Share Selected (${selectedDocs.size})`)}
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>
        )}

        {/* Documents Table */}
        {documents.length > 0 ? (
          <div className="dashboard-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme === 'dark' ? '#444' : '#ddd'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedDocs.size === documents.length && documents.length > 0}
                        onChange={handleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th
                      style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('name')}
                    >
                      Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('ownerName')}
                    >
                      Owner {sortBy === 'ownerName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('department')}
                    >
                      Department {sortBy === 'department' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ padding: '12px' }}>Classification</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th
                      style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('updatedAt')}
                    >
                      Updated {sortBy === 'updatedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`,
                        background: selectedDocs.has(doc.id) ? (theme === 'dark' ? '#2a3a4a' : '#e3f2fd') : 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => handleSelectDoc(doc.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', cursor: 'pointer', color: '#007bff' }} onClick={() => navigate(`/documents/${doc.id}`)}>
                          {doc.name}
                        </div>
                        {doc.description && (
                          <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                            {doc.description.substring(0, 80)}{doc.description.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>{doc.ownerName}</td>
                      <td style={{ padding: '12px' }}>{doc.department}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8em',
                          fontWeight: '600',
                          background: getClassificationColor(doc.classificationLevel) + '33',
                          color: getClassificationColor(doc.classificationLevel)
                        }}>
                          {doc.classificationLevel?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8em',
                            fontWeight: '600',
                            background: getStatusColor(doc.status) + '33',
                            color: getStatusColor(doc.status)
                          }}>
                            {doc.status?.replace('_', ' ')}
                          </span>
                          {doc.requiresReview && (
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7em',
                              fontWeight: '500',
                              background: '#ff980033',
                              color: '#ff9800',
                              display: 'inline-block',
                              width: 'fit-content'
                            }}>
                              ⏳ Pending Review
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9em' }}>
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => navigate(`/documents/${doc.id}`)}
                            disabled={doc.canView === false}
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '0.85em', 
                              background: doc.canView === false ? '#6c757d' : '#007bff',
                              cursor: doc.canView === false ? 'not-allowed' : 'pointer',
                              opacity: doc.canView === false ? 0.6 : 1
                            }}
                            title={doc.canView === false ? 'You do not have permission to view this document' : 'View details'}
                          >
                            👁 View
                          </button>
                          <button
                            onClick={() => navigate(`/documents/${doc.id}/signatures`)}
                            disabled={doc.canView === false}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.85em',
                              background: doc.canView === false ? '#6c757d' : '#2196f3',
                              cursor: doc.canView === false ? 'not-allowed' : 'pointer',
                              opacity: doc.canView === false ? 0.6 : 1
                            }}
                            title={doc.canView === false ? 'You do not have permission to view signatures for this document' : 'View signature chain'}
                          >
                            ✍️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-state">No documents found. Try adjusting your filters or upload a new document.</div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              style={{ padding: '8px 12px', fontSize: '0.9em' }}
            >
              First
            </button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '8px 16px' }}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.9em', color: '#888' }}>
              Page{' '}
              <input
                type="number"
                min="1"
                max={totalPages}
                value={page + 1}
                onChange={(e) => {
                  const newPage = parseInt(e.target.value) - 1
                  if (newPage >= 0 && newPage < totalPages) {
                    setPage(newPage)
                  }
                }}
                style={{
                  width: '50px',
                  padding: '4px',
                  textAlign: 'center',
                  borderRadius: '4px',
                  border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  background: theme === 'dark' ? '#2a2a2a' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#000'
                }}
              />
              {' '}of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: '8px 16px' }}
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              style={{ padding: '8px 12px', fontSize: '0.9em' }}
            >
              Last
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(0)
              }}
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                marginLeft: '12px'
              }}
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
