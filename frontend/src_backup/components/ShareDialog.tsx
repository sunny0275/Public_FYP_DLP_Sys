import { useState, useEffect } from 'react'
import { apiClient } from '../api'
import { useAuthStore } from '../store/authStore'
import '../modal.css'

function ExistingSharesTab({
  documentId: _documentId,
  existingShares,
  loadExistingShares,
  handleRevokeShare,
  onClose: _onClose
}: {
  documentId: number
  existingShares: any[]
  loadExistingShares: () => void
  handleRevokeShare: (id: number) => void
  onClose: () => void
}) {
  const { user } = useAuthStore()
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientSuggestions, setRecipientSuggestions] = useState<any[]>([])
  const [recipientSearching, setRecipientSearching] = useState(false)
  const [addingToShareId, setAddingToShareId] = useState<number | null>(null)
  const [updatingShareId, setUpdatingShareId] = useState<number | null>(null)

  useEffect(() => {
    const q = recipientSearch.trim()
    if (q.length < 2) {
      setRecipientSuggestions([])
      return
    }
    const t = window.setTimeout(async () => {
      setRecipientSearching(true)
      try {
        const res = await apiClient.searchUsers(q, 10)
        setRecipientSuggestions((res.data || []).filter((u: any) => u.id !== user?.userId))
      } catch {
        setRecipientSuggestions([])
      } finally {
        setRecipientSearching(false)
      }
    }, 250)
    return () => window.clearTimeout(t)
  }, [recipientSearch, user?.userId])

  const handleAddRecipient = async (shareId: number, userId: number) => {
    setAddingToShareId(shareId)
    try {
      await apiClient.updateShareRecipients(shareId, { addRecipientIds: [userId] })
      loadExistingShares()
      setRecipientSearch('')
      setRecipientSuggestions([])
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add recipient')
    } finally {
      setAddingToShareId(null)
    }
  }

  const handleRemoveRecipient = async (shareId: number, userId: number) => {
    if (!confirm('Remove this person from the share?')) return
    try {
      await apiClient.updateShareRecipients(shareId, { removeRecipientIds: [userId] })
      loadExistingShares()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove recipient')
    }
  }

  const handleUpdatePermission = async (shareId: number, permission: string) => {
    setUpdatingShareId(shareId)
    try {
      await apiClient.updateShare(shareId, { permission: permission as any })
      loadExistingShares()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update permission')
    } finally {
      setUpdatingShareId(null)
    }
  }

  if (existingShares.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        No shares found for this document. Use &quot;Internal Share&quot; to create one.
      </div>
    )
  }

  return (
    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
      {existingShares.map(share => (
        <div
          key={share.id}
          style={{
            padding: '15px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            marginBottom: '12px',
            background: '#fafafa'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong>INTERNAL</strong>
              <span style={{ marginLeft: '10px', color: '#666' }}>{share.permission}</span>
            </div>
            <span style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              background: share.status === 'ACTIVE' ? '#d4edda' : '#f8d7da',
              color: share.status === 'ACTIVE' ? '#155724' : '#721c24'
            }}>
              {share.status}
            </span>
          </div>

          {/* Internal shares only - show recipients list */}
          <div style={{ marginBottom: '12px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Shared with:</div>
              {(share.recipients || []).length === 0 ? (
                <div style={{ fontSize: '13px', color: '#666' }}>No recipients</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(share.recipients || []).map((r: any) => (
                    <span
                      key={r.userId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#e3f2fd',
                        fontSize: '13px'
                      }}
                    >
                      {r.fullName} ({r.accountId})
                      {r.department && <span style={{ color: '#666' }}>• {r.department}</span>}
                      {share.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(share.id, r.userId)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#d32f2f', fontWeight: 700 }}
                          title="Remove"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {share.status === 'ACTIVE' && (
                <div style={{ marginTop: '10px' }}>
                  {addingToShareId === share.id ? (
                    <>
                      <input
                        type="text"
                        placeholder="Search by name or account ID..."
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        autoFocus
                        style={{ width: '100%', padding: '8px', marginBottom: '6px' }}
                      />
                      <button type="button" onClick={() => { setAddingToShareId(null); setRecipientSearch(''); setRecipientSuggestions([]); }} style={{ fontSize: '12px', marginBottom: '8px' }}>
                        Cancel
                      </button>
                      {recipientSearching && <div style={{ fontSize: '12px', color: '#666' }}>Searching...</div>}
                      {recipientSuggestions.length > 0 && (
                        <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', padding: '6px' }}>
                          {recipientSuggestions
                            .filter(u => !(share.recipients || []).some((r: any) => r.userId === u.id))
                            .map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleAddRecipient(share.id, u.id)}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '6px 8px',
                                  border: '1px solid #eee',
                                  borderRadius: '4px',
                                  marginBottom: '4px',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '13px'
                                }}
                              >
                                {u.fullName} ({u.accountId}) • {u.department || '—'}
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingToShareId(share.id)}
                      style={{ padding: '6px 12px', fontSize: '13px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      + Add recipient
                    </button>
                  )}
                </div>
              )}

              {share.status === 'ACTIVE' && (
                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Permission: </label>
                  <select
                    value={share.permission}
                    onChange={(e) => handleUpdatePermission(share.id, e.target.value)}
                    disabled={updatingShareId === share.id}
                    style={{ padding: '6px 10px', marginLeft: '8px', borderRadius: '4px' }}
                  >
                    <option value="READ_ONLY">Read Only</option>
                    <option value="DOWNLOAD">Download</option>
                    <option value="EDIT">Edit</option>
                    <option value="FULL">Full Access</option>
                  </select>
                </div>
              )}
            </div>

          <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
            Created: {new Date(share.createdAt).toLocaleString()}
            {share.expiresAt && <> • Expires: {new Date(share.expiresAt).toLocaleString()}</>}
            {share.accessCount !== undefined && <> • Accessed: {share.accessCount} times</>}
            {share.requiresApproval && <> • {share.approvalGranted ? 'Approved' : 'Pending Approval'}</>}
          </div>

          {share.status === 'ACTIVE' && (
            <button
              onClick={() => handleRevokeShare(share.id)}
              className="secondary"
              style={{ fontSize: '14px', padding: '6px 12px' }}
            >
              Revoke
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

interface ShareDialogProps {
  documentId: number
  documentName: string
  onClose: () => void
  onSuccess?: () => void
  initialTab?: 'internal' | 'existing'
}

type ShareTab = 'internal' | 'existing'

export default function ShareDialog({ documentId, documentName, onClose, onSuccess, initialTab = 'internal' }: ShareDialogProps) {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<ShareTab>(initialTab)

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  // Form state
  // Share type is always INTERNAL (external sharing disabled)
  const [permission, setPermission] = useState<'READ_ONLY' | 'DOWNLOAD' | 'EDIT' | 'FULL'>('READ_ONLY')
  const [recipientSearch, setRecipientSearch] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState<number[]>([])
  const [selectedRecipientUsers, setSelectedRecipientUsers] = useState<any[]>([])
  const [recipientSuggestions, setRecipientSuggestions] = useState<any[]>([])
  const [recipientSearching, setRecipientSearching] = useState(false)

  // Internal share settings
  const [description, setDescription] = useState('')

  // Existing shares
  const [existingShares, setExistingShares] = useState<any[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [requiresApproval, setRequiresApproval] = useState(false)

  useEffect(() => {
    if (activeTab === 'internal') {
      // reset search UI when switching to internal tab
      setRecipientSearch('')
      setRecipientSuggestions([])
    } else if (activeTab === 'existing') {
      loadExistingShares()
    }
  }, [activeTab])

  // Realtime recipient search (server-side)
  useEffect(() => {
    if (activeTab !== 'internal') return
    const q = recipientSearch.trim()
    if (q.length < 2) {
      setRecipientSuggestions([])
      return
    }

    const t = window.setTimeout(async () => {
      setRecipientSearching(true)
      try {
        const res = await apiClient.searchUsers(q, 10)
        const users = (res.data || []).filter((u: any) => u.id !== user?.userId)
        setRecipientSuggestions(users)
      } catch (err) {
        // fail silently for suggestions; sharing endpoint will still validate recipients
        setRecipientSuggestions([])
      } finally {
        setRecipientSearching(false)
      }
    }, 250)

    return () => window.clearTimeout(t)
  }, [recipientSearch, activeTab, user?.userId])

  const loadExistingShares = async () => {
    try {
      const response = await apiClient.getDocumentShares(documentId)
      setExistingShares(response.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load shares')
    }
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const shareData: any = {
        documentId,
        shareType: 'INTERNAL', // Always internal (external sharing disabled)
        permission,
      }

      if (selectedRecipients.length > 0) {
        shareData.recipientIds = selectedRecipients
      }

      if (description) shareData.description = description

      const response = await apiClient.createShareLink(shareData)

      setSuccess(true)
      setRequiresApproval(response.data.requiresApproval || false)

      if (onSuccess) onSuccess()

      // Refresh existing shares
      if (activeTab === 'existing') {
        loadExistingShares()
      }

    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeShare = async (shareId: number, reason?: string) => {
    if (!confirm('Are you sure you want to revoke this share link?')) return

    try {
      await apiClient.revokeShareLink(shareId, reason || 'Revoked by owner')
      loadExistingShares()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to revoke share')
    }
  }

  const addRecipient = (u: any) => {
    if (!u?.id) return
    if (selectedRecipients.includes(u.id)) return
    setSelectedRecipients(prev => [...prev, u.id])
    setSelectedRecipientUsers(prev => [...prev, u])
    setRecipientSearch('')
    setRecipientSuggestions([])
  }

  const removeRecipient = (userId: number) => {
    setSelectedRecipients(prev => prev.filter(id => id !== userId))
    setSelectedRecipientUsers(prev => prev.filter((u: any) => u.id !== userId))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share Document: {documentName}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
            <button
              onClick={() => setActiveTab('internal')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderBottom: activeTab === 'internal' ? '3px solid #007bff' : 'none',
                fontWeight: activeTab === 'internal' ? 'bold' : 'normal'
              }}
            >
              Internal Share
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderBottom: activeTab === 'existing' ? '3px solid #007bff' : 'none',
                fontWeight: activeTab === 'existing' ? 'bold' : 'normal'
              }}
            >
              Existing Shares ({existingShares.length})
            </button>
          </div>

          {error && (
            <div className="error-message" style={{ marginBottom: '15px' }}>
              {error}
            </div>
          )}

          {success && !requiresApproval && (
            <div className="success-message" style={{ marginBottom: '15px' }}>
              ✓ Share link created successfully!
            </div>
          )}

          {success && requiresApproval && (
            <div className="info-message" style={{ marginBottom: '15px' }}>
              ℹ Share link created and pending approval from administrator
            </div>
          )}

          {/* Internal Share Tab */}
          {activeTab === 'internal' && (
            <form onSubmit={handleShare}>
              {/* Recipient Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Select Recipients *
                </label>
                <input
                  type="text"
                  placeholder="Search by name / account ID / email (type 2+ chars)..."
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                />

                {recipientSearching && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    Searching...
                  </div>
                )}

                {recipientSuggestions.length > 0 && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', padding: '8px', marginBottom: '10px' }}>
                    {recipientSuggestions.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addRecipient(u)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px',
                          border: '1px solid #eee',
                          borderRadius: '6px',
                          marginBottom: '6px',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {u.fullName} ({u.accountId})
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {u.email} • {u.department || '—'} • {u.position || '—'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedRecipientUsers.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedRecipientUsers.map((u: any) => (
                      <span
                        key={u.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: '#e3f2fd',
                          color: '#0d47a1',
                          fontSize: '13px'
                        }}
                      >
                        {u.fullName} ({u.accountId})
                        <button
                          type="button"
                          onClick={() => removeRecipient(u.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#0d47a1',
                            fontWeight: 700
                          }}
                          aria-label="Remove recipient"
                          title="Remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    No recipients selected yet.
                  </div>
                )}
              </div>

              {/* Permission */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Permission Level *
                </label>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as any)}
                  style={{ width: '100%', padding: '8px' }}
                  required
                >
                  <option value="READ_ONLY">Read Only</option>
                  <option value="DOWNLOAD">Download</option>
                  <option value="EDIT">Edit</option>
                  <option value="FULL">Full Access</option>
                </select>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Why are you sharing this document?"
                  style={{ width: '100%', padding: '8px', minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} className="secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={loading || selectedRecipients.length === 0}
                >
                  {loading ? 'Creating...' : 'Share Internally'}
                </button>
              </div>
            </form>
          )}

          {/* Existing Shares Tab - Manage shares and shared persons */}
          {activeTab === 'existing' && (
            <ExistingSharesTab
              documentId={documentId}
              existingShares={existingShares}
              loadExistingShares={loadExistingShares}
              handleRevokeShare={handleRevokeShare}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
