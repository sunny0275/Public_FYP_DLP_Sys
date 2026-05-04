import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'
import DashboardLayout from '../../components/DashboardLayout'
import '../../modal.css'

interface Share {
  id: number
  token: string | null
  documentId: number
  documentName: string
  shareType: string
  permission: string
  status: string
  expiresAt: string | null
  accessCount: number
  accessLimit: number | null
  requiresApproval: boolean
  approvalGranted: boolean
  requiresWatermark: boolean
  allowDownload: boolean
  allowEdit: boolean
  allowCopy: boolean
  allowPrint: boolean
  description: string | null
  createdAt: string
  createdBy: number
  createdByName: string
  revokedAt: string | null
  revokedBy: number | null
  revokedReason: string | null
}

type FilterType = 'all' | 'INTERNAL'
type FilterStatus = 'all' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'

export default function MySharesPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()

  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Bulk operations
  const [selectedShares, setSelectedShares] = useState<number[]>([])

  // Share details modal
  const [selectedShare, setSelectedShare] = useState<Share | null>(null)
  const [showShareDetails, setShowShareDetails] = useState(false)

  // Edit share modal
  const [editShare, setEditShare] = useState<Share | null>(null)
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editAccessLimit, setEditAccessLimit] = useState<string>('')
  const [editPermission, setEditPermission] = useState<string>('READ_ONLY')
  const [editAllowCopy, setEditAllowCopy] = useState(false)
  const [editAllowPrint, setEditAllowPrint] = useState(false)
  const [editAllowDownload, setEditAllowDownload] = useState(false)
  const [editAllowEdit, setEditAllowEdit] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    loadShares()
  }, [page])

  const loadShares = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getMyShares(page, 20)
      setShares(response.data?.content || [])
      setTotalPages(response.data?.totalPages || 1)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load shares')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeShare = async (shareId: number) => {
    const reason = prompt('Enter reason for revoking this share:')
    if (!reason) return

    try {
      await apiClient.revokeShareLink(shareId, reason)
      loadShares()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to revoke share')
    }
  }

  const handleBulkRevoke = async () => {
    if (selectedShares.length === 0) {
      alert('Please select shares to revoke')
      return
    }

    const reason = prompt(`Revoke ${selectedShares.length} share(s)? Enter reason:`)
    if (!reason) return

    try {
      await Promise.all(selectedShares.map(id => apiClient.revokeShareLink(id, reason)))
      setSelectedShares([])
      loadShares()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to revoke shares')
    }
  }

  const handleViewShare = (share: Share) => {
    setSelectedShare(share)
    setShowShareDetails(true)
  }

  const openEditShare = (share: Share) => {
    setEditShare(share)
    setEditExpiresAt(share.expiresAt ? share.expiresAt.slice(0, 16) : '')
    setEditAccessLimit(share.accessLimit != null ? String(share.accessLimit) : '')
    setEditPermission(share.permission || 'READ_ONLY')
    setEditAllowCopy(share.allowCopy ?? false)
    setEditAllowPrint(share.allowPrint ?? false)
    setEditAllowDownload(share.allowDownload ?? false)
    setEditAllowEdit(share.allowEdit ?? false)
    setEditError('')
  }

  const closeEditShare = () => {
    setEditShare(null)
    setEditError('')
  }

  const handleUpdateShare = async (e: React.FormEvent) => {
    if (!editShare) return
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      const accessLimitNum = editAccessLimit.trim() === '' ? undefined : parseInt(editAccessLimit, 10)
      await apiClient.updateShare(editShare.id, {
        ...(editExpiresAt ? { expiresAt: new Date(editExpiresAt).toISOString() } : {}),
        ...(accessLimitNum !== undefined && !isNaN(accessLimitNum) ? { accessLimit: accessLimitNum } : {}),
        permission: editPermission as 'READ_ONLY' | 'DOWNLOAD' | 'EDIT' | 'FULL',
        allowCopy: editAllowCopy,
        allowPrint: editAllowPrint,
        allowDownload: editAllowDownload,
        allowEdit: editAllowEdit
      })
      closeEditShare()
      loadShares()
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update share')
    } finally {
      setEditSaving(false)
    }
  }

  const handleCopyLink = (share: Share) => {
    if (!share.token) {
      alert('This share does not have a shareable link')
      return
    }
    const link = `${window.location.origin}/shared/${share.token}`
    navigator.clipboard.writeText(link)
    alert('Share link copied to clipboard!')
  }

  const toggleShareSelection = (shareId: number) => {
    if (selectedShares.includes(shareId)) {
      setSelectedShares(selectedShares.filter(id => id !== shareId))
    } else {
      setSelectedShares([...selectedShares, shareId])
    }
  }

  const toggleSelectAll = () => {
    if (selectedShares.length === filteredShares.length) {
      setSelectedShares([])
    } else {
      setSelectedShares(filteredShares.map(s => s.id))
    }
  }

  // Apply filters
  const filteredShares = shares.filter(share => {
    // Type filter
    if (filterType !== 'all' && share.shareType !== filterType) return false

    // Status filter
    if (filterStatus !== 'all' && share.status !== filterStatus) return false

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      if (!share.documentName.toLowerCase().includes(query) &&
          !(share.description || '').toLowerCase().includes(query)) {
        return false
      }
    }

    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#4caf50'
      case 'EXPIRED': return '#ff9800'
      case 'REVOKED': return '#f44336'
      case 'PENDING_APPROVAL': return '#2196f3'
      default: return '#888'
    }
  }

  const getShareTypeColor = (type: string) => {
    return type === 'INTERNAL' ? '#2196f3' : '#ff9800'
  }

  const formatExpiryDate = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never'
    const date = new Date(expiresAt)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 0) {
      return 'Expired'
    } else if (diffHours < 24) {
      return `Expires in ${diffHours}h`
    } else {
      const diffDays = Math.floor(diffHours / 24)
      return `Expires in ${diffDays}d`
    }
  }

  if (loading && shares.length === 0) {
    return (
      <DashboardLayout>
        <div className="dashboard">
          <h2>My Shares</h2>
          <p>Loading shares...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="dashboard">
        <div style={{ marginBottom: '24px' }}>
          <h1>My Shares</h1>
          <p style={{ color: '#666', marginTop: '8px' }}>Manage all your document shares in one place</p>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>
        )}

        {/* Filters and Controls */}
        <div style={{
          marginBottom: '24px',
          padding: '20px',
          background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by document name or description..."
                style={{ width: '100%', padding: '8px 12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                style={{ padding: '8px 12px' }}
              >
                <option value="all">All Types</option>
                <option value="INTERNAL">Internal</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                style={{ padding: '8px 12px' }}
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>

            <button onClick={loadShares} style={{ padding: '8px 16px', background: '#6c757d' }}>
              Refresh
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedShares.length > 0 && (
            <div style={{
              padding: '12px',
              background: '#007bff22',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontWeight: 'bold', color: '#007bff' }}>
                {selectedShares.length} share(s) selected
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleBulkRevoke}
                  style={{ padding: '6px 12px', background: '#f44336', fontSize: '0.9em' }}
                >
                  Revoke Selected
                </button>
                <button
                  onClick={() => setSelectedShares([])}
                  style={{ padding: '6px 12px', background: '#6c757d', fontSize: '0.9em' }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Summary */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '24px' }}>
          <div className="dashboard-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#007bff', marginBottom: '8px' }}>
              {shares.length}
            </div>
            <div style={{ color: '#666' }}>Total Shares</div>
          </div>
          <div className="dashboard-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#4caf50', marginBottom: '8px' }}>
              {shares.filter(s => s.status === 'ACTIVE').length}
            </div>
            <div style={{ color: '#666' }}>Active Shares</div>
          </div>
          <div className="dashboard-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#ff9800', marginBottom: '8px' }}>
              {shares.filter(s => s.shareType === 'INTERNAL').length}
            </div>
            <div style={{ color: '#666' }}>Internal Shares</div>
          </div>
          <div className="dashboard-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#f44336', marginBottom: '8px' }}>
              {shares.filter(s => s.status === 'REVOKED').length}
            </div>
            <div style={{ color: '#666' }}>Revoked</div>
          </div>
        </div>

        {/* Shares List */}
        {filteredShares.length === 0 ? (
          <div className="dashboard-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
            <h3>No shares found</h3>
            <p>
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'You haven\'t created any shares yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Select All */}
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={selectedShares.length === filteredShares.length && filteredShares.length > 0}
                onChange={toggleSelectAll}
                style={{ marginRight: '8px' }}
                id="select-all"
              />
              <label htmlFor="select-all" style={{ cursor: 'pointer', fontSize: '0.9em' }}>
                Select all ({filteredShares.length})
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredShares.map(share => (
                <div
                  key={share.id}
                  className="dashboard-card"
                  style={{
                    padding: '20px',
                    border: selectedShares.includes(share.id) ? '2px solid #007bff' : undefined
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                    <input
                      type="checkbox"
                      checked={selectedShares.includes(share.id)}
                      onChange={() => toggleShareSelection(share.id)}
                      style={{ marginTop: '4px' }}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div>
                          <h3
                            style={{ marginBottom: '8px', cursor: 'pointer' }}
                            onClick={() => handleViewShare(share)}
                          >
                            {share.documentName}
                          </h3>
                          {share.description && (
                            <p style={{ color: '#666', fontSize: '0.9em', marginBottom: '8px' }}>
                              {share.description}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.8em',
                            fontWeight: '600',
                            background: getShareTypeColor(share.shareType) + '22',
                            color: getShareTypeColor(share.shareType)
                          }}>
                            {share.shareType}
                          </span>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.8em',
                            fontWeight: '600',
                            background: getStatusColor(share.status) + '22',
                            color: getStatusColor(share.status)
                          }}>
                            {share.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.85em', color: '#666', marginBottom: '12px' }}>
                        <div>
                          <strong>Permission:</strong> {share.permission}
                        </div>
                        <div>
                          <strong>Accessed:</strong> {share.accessCount} times
                          {share.accessLimit && ` / ${share.accessLimit}`}
                        </div>
                        {share.expiresAt && (
                          <div style={{ color: share.status === 'EXPIRED' ? '#f44336' : undefined }}>
                            <strong>Expiry:</strong> {formatExpiryDate(share.expiresAt)}
                          </div>
                        )}
                        <div>
                          <strong>Created:</strong> {new Date(share.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleViewShare(share)}
                          style={{ padding: '6px 12px', background: '#007bff', fontSize: '0.9em' }}
                        >
                          View Details
                        </button>
                        {share.token && share.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleCopyLink(share)}
                            style={{ padding: '6px 12px', background: '#17a2b8', fontSize: '0.9em' }}
                          >
                            Copy Link
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/documents/${share.documentId}`)}
                          style={{ padding: '6px 12px', background: '#6c757d', fontSize: '0.9em' }}
                        >
                          View Document
                        </button>
                        {share.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => openEditShare(share)}
                              style={{ padding: '6px 12px', background: '#17a2b8', fontSize: '0.9em' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRevokeShare(share.id)}
                              style={{ padding: '6px 12px', background: '#f44336', fontSize: '0.9em' }}
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '8px 16px' }}
            >
              Previous
            </button>
            <span style={{ padding: '8px 16px', background: '#f0f0f0', borderRadius: '4px' }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: '8px 16px' }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Share Details Modal */}
      {showShareDetails && selectedShare && (
        <div className="modal-overlay" onClick={() => setShowShareDetails(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Share Details</h2>
              <button className="modal-close" onClick={() => setShowShareDetails(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '8px' }}>{selectedShare.documentName}</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.85em',
                    fontWeight: '600',
                    background: getShareTypeColor(selectedShare.shareType) + '22',
                    color: getShareTypeColor(selectedShare.shareType)
                  }}>
                    {selectedShare.shareType}
                  </span>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.85em',
                    fontWeight: '600',
                    background: getStatusColor(selectedShare.status) + '22',
                    color: getStatusColor(selectedShare.status)
                  }}>
                    {selectedShare.status}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedShare.description && (
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Description</div>
                    <div>{selectedShare.description}</div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Permission Level</div>
                  <div>{selectedShare.permission}</div>
                </div>

                {selectedShare.token && (
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Share Link</div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={`${window.location.origin}/shared/${selectedShare.token}`}
                        readOnly
                        style={{ flex: 1, padding: '8px', background: '#f0f0f0' }}
                      />
                      <button
                        onClick={() => handleCopyLink(selectedShare)}
                        style={{ padding: '8px 12px', fontSize: '0.9em' }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Access Statistics</div>
                  <div>
                    {selectedShare.accessCount} views
                    {selectedShare.accessLimit && ` (limit: ${selectedShare.accessLimit})`}
                  </div>
                </div>

                {selectedShare.expiresAt && (
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Expiration</div>
                    <div>
                      {new Date(selectedShare.expiresAt).toLocaleString()}
                      <br />
                      <span style={{ fontSize: '0.9em', color: '#666' }}>
                        ({formatExpiryDate(selectedShare.expiresAt)})
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Security Options</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>{selectedShare.requiresWatermark ? '✓' : '✗'} Watermark required</div>
                    <div>{selectedShare.allowDownload ? '✓' : '✗'} Download allowed</div>
                    <div>{selectedShare.allowCopy ? '✓' : '✗'} Copy allowed</div>
                    <div>{selectedShare.allowPrint ? '✓' : '✗'} Print allowed</div>
                  </div>
                </div>

                {selectedShare.requiresApproval && (
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Approval Status</div>
                    <div style={{
                      fontWeight: 'bold',
                      color: selectedShare.approvalGranted ? '#4caf50' : '#ff9800'
                    }}>
                      {selectedShare.approvalGranted ? 'Approved' : 'Pending Approval'}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Created</div>
                  <div>
                    {new Date(selectedShare.createdAt).toLocaleString()}
                    <br />
                    <span style={{ fontSize: '0.9em', color: '#666' }}>by {selectedShare.createdByName}</span>
                  </div>
                </div>

                {selectedShare.revokedAt && (
                  <>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Revoked</div>
                      <div>{new Date(selectedShare.revokedAt).toLocaleString()}</div>
                    </div>
                    {selectedShare.revokedReason && (
                      <div>
                        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Revocation Reason</div>
                        <div>{selectedShare.revokedReason}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowShareDetails(false)}
                style={{ padding: '10px 20px', background: '#6c757d' }}
              >
                Close
              </button>
              {selectedShare.status === 'ACTIVE' && (
                <>
                  <button
                    onClick={() => {
                      setShowShareDetails(false)
                      openEditShare(selectedShare)
                    }}
                    style={{ padding: '10px 20px', background: '#17a2b8' }}
                  >
                    Edit (extend expiry / permissions)
                  </button>
                  <button
                    onClick={() => {
                      setShowShareDetails(false)
                      handleRevokeShare(selectedShare.id)
                    }}
                    style={{ padding: '10px 20px', background: '#f44336' }}
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Share Modal */}
      {editShare && (
        <div className="modal-overlay" onClick={closeEditShare}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit share: {editShare.documentName}</h2>
              <button className="modal-close" onClick={closeEditShare}>&times;</button>
            </div>
            <form onSubmit={handleUpdateShare}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Expires at (leave empty = no change)</label>
                  <input
                    type="datetime-local"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Access limit (leave empty = no change)</label>
                  <input
                    type="number"
                    min={1}
                    value={editAccessLimit}
                    onChange={(e) => setEditAccessLimit(e.target.value)}
                    placeholder="Unlimited"
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Permission</label>
                  <select
                    value={editPermission}
                    onChange={(e) => setEditPermission(e.target.value)}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    <option value="READ_ONLY">Read only</option>
                    <option value="DOWNLOAD">Download</option>
                    <option value="EDIT">Edit</option>
                    <option value="FULL">Full</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginBottom: '16px' }}>
                  <label><input type="checkbox" checked={editAllowCopy} onChange={(e) => setEditAllowCopy(e.target.checked)} /> Allow copy</label>
                  <label><input type="checkbox" checked={editAllowPrint} onChange={(e) => setEditAllowPrint(e.target.checked)} /> Allow print</label>
                  <label><input type="checkbox" checked={editAllowDownload} onChange={(e) => setEditAllowDownload(e.target.checked)} /> Allow download</label>
                  <label><input type="checkbox" checked={editAllowEdit} onChange={(e) => setEditAllowEdit(e.target.checked)} /> Allow edit</label>
                </div>
                {editError && <div className="error-message" style={{ marginBottom: '12px' }}>{editError}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeEditShare} style={{ padding: '10px 20px', background: '#6c757d' }}>Cancel</button>
                <button type="submit" disabled={editSaving} style={{ padding: '10px 20px', background: '#007bff' }}>{editSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
