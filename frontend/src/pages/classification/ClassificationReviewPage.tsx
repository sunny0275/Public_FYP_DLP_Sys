import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'
import DRMViewer from '../../components/DRMViewer'

interface Document {
  id: number
  name: string
  description?: string
  ownerName: string
  department: string
  classificationLevel: string
  status: string
  requiresReview: boolean
  classificationConfidence?: number
  classificationReason?: string
  createdAt: string
  updatedAt: string
}

type ReviewTab = 'pending' | 'approved' | 'shares'

export default function ClassificationReviewPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()

  const [activeTab, setActiveTab] = useState<ReviewTab>('pending')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approving, setApproving] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [approvedCount, setApprovedCount] = useState(0)

  // Pagination
  const [page, setPage] = useState(0)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)

  // Approval form
  const [approveCurrentLevel, setApproveCurrentLevel] = useState(true)
  const [overrideLevel, setOverrideLevel] = useState<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'>('CONFIDENTIAL')
  const [comment, setComment] = useState('')

  // Approval result (signature info)
  const [approvalResult, setApprovalResult] = useState<{
    signatureId?: number
    signatureTimestamp?: string
    blockchainTxHash?: string
    signatureStatus?: string
  } | null>(null)

  // Approved document details modal
  const [viewApprovedDoc, setViewApprovedDoc] = useState<Document | null>(null)
  const [approvedDocSignatures, setApprovedDocSignatures] = useState<any[]>([])
  const [loadingSignatures, setLoadingSignatures] = useState(false)

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)

  // Share Approvals state
  const [pendingShares, setPendingShares] = useState<any[]>([])
  const [pendingSharesTotal, setPendingSharesTotal] = useState(0)
  const [loadingShares, setLoadingShares] = useState(false)
  const [approvingShareId, setApprovingShareId] = useState<number | null>(null)
  const [rejectingShareId, setRejectingShareId] = useState<number | null>(null)
  const [showRejectShareModal, setShowRejectShareModal] = useState(false)
  const [rejectTargetShare, setRejectTargetShare] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectCorrectedLevel, setRejectCorrectedLevel] = useState<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'>('CONFIDENTIAL')

  useEffect(() => {
    loadCounts()
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [activeTab, page, pageSize])

  const loadCounts = async () => {
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        apiClient.getPendingReviewCount(),
        apiClient.getApprovedDocumentsCount()
      ])
      if (pendingRes.success) setPendingCount(pendingRes.data || 0)
      if (approvedRes.success) setApprovedCount(approvedRes.data || 0)

      // Load pending shares count separately
      try {
        const pendingSharesRes = await apiClient.getPendingShareApprovals(0, 1)
        if (pendingSharesRes.success && pendingSharesRes.data) {
          setPendingSharesTotal(pendingSharesRes.data.totalElements || 0)
        }
      } catch (err: any) {
        console.error('Failed to load pending shares count:', err)
        setPendingSharesTotal(0)
      }
    } catch (err: any) {
      console.error('Failed to load counts:', err)
    }
  }

  const loadDocuments = async () => {
    // Shares tab is handled separately via loadPendingShares
    if (activeTab === 'shares') {
      return
    }
    setLoading(true)
    setError('')
    try {
      let res
      if (activeTab === 'pending') {
        res = await apiClient.getPendingReviewDocuments(page, pageSize, 'createdAt', 'DESC')
      } else {
        res = await apiClient.getApprovedDocuments(page, pageSize, 'updatedAt', 'DESC')
      }
      if (res.success && res.data) {
        setDocuments(res.data.content || [])
        setTotalPages(res.data.totalPages || 0)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to load ${activeTab} documents`)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedDoc) return

    setApproving(true)
    try {
      const response = await apiClient.approveClassification(selectedDoc.id, {
        approveCurrentLevel,
        approvedClassificationLevel: overrideLevel,
        comment: comment || undefined
      })
      // Capture signature info from response
      const result = response.data || {}
      setApprovalResult({
        signatureId: result.signatureId,
        signatureTimestamp: result.signatureTimestamp,
        blockchainTxHash: result.blockchainTxHash,
        signatureStatus: result.signatureStatus
      })
      setShowApproveModal(false)
      setSelectedDoc(null)
      setComment('')
      loadCounts()
      loadDocuments()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve classification')
    } finally {
      setApproving(false)
    }
  }

  const handleViewApproved = async (doc: Document) => {
    setViewApprovedDoc(doc)
    setApprovedDocSignatures([])
    setLoadingSignatures(true)
    try {
      const res = await apiClient.getSignatureChain(doc.id)
      if (res.success && res.data) {
        setApprovedDocSignatures(res.data)
      }
    } catch (err: any) {
      console.error('Failed to load signatures:', err)
    } finally {
      setLoadingSignatures(false)
    }
  }

  const handleTabChange = (tab: ReviewTab) => {
    setActiveTab(tab)
    setPage(0)
    setDocuments([])
    if (tab === 'shares') {
      loadPendingShares()
    }
  }

  const loadPendingShares = async () => {
    setLoadingShares(true)
    try {
      const res = await apiClient.getPendingShareApprovals(0, 20)
      if (res.success && res.data) {
        setPendingShares(res.data.content || [])
        setPendingSharesTotal(res.data.totalElements || 0)
      }
    } catch (err: any) {
      console.error('Failed to load pending shares:', err)
    } finally {
      setLoadingShares(false)
    }
  }

  const handleApproveShare = async (shareId: number) => {
    if (!confirm('Approve this share request?')) return
    setApprovingShareId(shareId)
    try {
      await apiClient.approveShareLink(shareId)
      alert('Share approved successfully')
      loadPendingShares()
      loadCounts()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve share')
    } finally {
      setApprovingShareId(null)
    }
  }

  const openRejectShareModal = (share: any) => {
    setRejectTargetShare(share)
    setRejectReason('')
    setRejectCorrectedLevel((share?.documentClassificationLevel as any) || 'CONFIDENTIAL')
    setShowRejectShareModal(true)
  }

  const handleRejectShare = async () => {
    if (!rejectTargetShare?.id) return
    setRejectingShareId(rejectTargetShare.id)
    try {
      await apiClient.rejectShareLink(rejectTargetShare.id, {
        reason: rejectReason || undefined,
        correctedClassificationLevel: rejectCorrectedLevel
      })
      alert('Share rejected')
      setShowRejectShareModal(false)
      setRejectTargetShare(null)
      loadPendingShares()
      loadCounts()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject share')
    } finally {
      setRejectingShareId(null)
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
      case 'REVIEW_REQUIRED': return '#ff9800'
      case 'CLASSIFIED': return '#4caf50'
      default: return '#888'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'REVIEW_REQUIRED': return 'Pending Review'
      case 'CLASSIFIED': return 'Approved'
      default: return status?.replace('_', ' ') || ''
    }
  }

  return (
    <DashboardLayout>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>Classification Review</h1>
            <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
              Review and approve document classification levels
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          marginBottom: '24px',
          borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`
        }}>
          <button
            onClick={() => handleTabChange('pending')}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'pending' ? '2px solid #2196f3' : '2px solid transparent',
              color: activeTab === 'pending' ? '#2196f3' : '#666',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Pending Review
            {pendingCount > 0 && (
              <span style={{
                background: '#ff9800',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('shares')}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'shares' ? '2px solid #9c27b0' : '2px solid transparent',
              color: activeTab === 'shares' ? '#9c27b0' : '#666',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Pending Share Approvals
            {pendingSharesTotal > 0 && (
              <span style={{
                background: '#9c27b0',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {pendingSharesTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('approved')}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'approved' ? '2px solid #4caf50' : '2px solid transparent',
              color: activeTab === 'approved' ? '#4caf50' : '#666',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Approved
            {approvedCount > 0 && (
              <span style={{
                background: '#4caf50',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {approvedCount}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
          </div>
        ) : activeTab === 'shares' ? (
          // shares tab has its own empty state in the shares section below
          null
        ) : documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px' }}>
              {activeTab === 'pending' ? 'No documents pending review' : 'No approved documents'}
            </div>
            <div style={{ fontSize: '14px', color: '#999' }}>
              {activeTab === 'pending' ? 'All documents have been reviewed and approved' : 'Approved documents will appear here'}
            </div>
          </div>
        ) : (
          <>
            <div style={{
              background: theme === 'dark' ? '#1e1e1e' : '#fff',
              borderRadius: '8px',
              border: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`,
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}` }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Document</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Owner</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Department</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Level</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Confidence</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>{activeTab === 'pending' ? 'Created' : 'Approved'}</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`,
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = theme === 'dark' ? '#2a2a2a' : '#f9f9f9'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', color: '#007bff', cursor: 'pointer' }}
                          onClick={() => navigate(`/documents/${doc.id}`)}>
                          {doc.name}
                        </div>
                        {doc.description && (
                          <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                            {doc.description.substring(0, 60)}{doc.description.length > 60 ? '...' : ''}
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
                        {doc.classificationConfidence !== null && doc.classificationConfidence !== undefined ? (
                          <span style={{ fontSize: '0.85em' }}>
                            {(doc.classificationConfidence * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: '#999' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8em',
                          fontWeight: '600',
                          background: getStatusColor(doc.status) + '33',
                          color: getStatusColor(doc.status)
                        }}>
                          {getStatusText(doc.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9em' }}>
                        {new Date(activeTab === 'pending' ? doc.createdAt : doc.updatedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {activeTab === 'pending' ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedDoc(doc)
                                  setShowApproveModal(true)
                                  setApproveCurrentLevel(true)
                                  setComment('')
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#4caf50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.85em',
                                  fontWeight: '500'
                                }}
                              >
                                Review
                              </button>
                              <button
                                onClick={() => {
                                  setPreviewDoc(doc)
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#2196f3',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.85em',
                                  fontWeight: '500'
                                }}
                              >
                                Preview
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleViewApproved(doc)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#ff9800',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.85em',
                                  fontWeight: '500',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span style={{ fontSize: '0.9em' }}>👤</span>
                                <span>Approver</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    padding: '8px 16px',
                    background: page === 0 ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{
                    padding: '8px 16px',
                    background: page >= totalPages - 1 ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Share Approvals Tab */}
        {activeTab === 'shares' && (
          <div>
            {loadingShares ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <div style={{ fontSize: '18px', color: '#666' }}>Loading share approvals...</div>
              </div>
            ) : pendingShares.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px' }}>
                  No pending share approvals
                </div>
                <div style={{ fontSize: '14px', color: '#999' }}>
                  Share requests for confidential documents will appear here
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingShares.map((share) => (
                  <div
                    key={share.id}
                    style={{
                      padding: '20px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`,
                      background: theme === 'dark' ? '#1e1e1e' : '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                          {share.documentName || `Document #${share.documentId}`}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                          <strong>Creator:</strong> {share.creatorName || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                          <strong>Type:</strong> {share.shareType} · <strong>Permission:</strong> {share.permission}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                          <strong>Current Level:</strong>{' '}
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.85em',
                            fontWeight: '600',
                            background: getClassificationColor(share.documentClassificationLevel) + '33',
                            color: getClassificationColor(share.documentClassificationLevel)
                          }}>
                            {share.documentClassificationLevel?.replace('_', ' ') || 'N/A'}
                          </span>
                        </div>
                        {share.recipients && share.recipients.length > 0 && (
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                            <strong>Recipients:</strong>{' '}
                            {share.recipients.map((r: any, idx: number) => (
                              <span key={r.userId || idx}>
                                {r.fullName} ({r.accountId}){idx < share.recipients.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {share.expiresAt && (
                          <div style={{ fontSize: '13px', color: '#999' }}>
                            <strong>Expires:</strong> {new Date(share.expiresAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => openRejectShareModal(share)}
                          style={{
                            padding: '10px 16px',
                            background: '#c62828',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveShare(share.id)}
                          disabled={approvingShareId === share.id}
                          style={{
                            padding: '10px 16px',
                            background: approvingShareId === share.id ? '#ccc' : '#2e7d32',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: approvingShareId === share.id ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          {approvingShareId === share.id ? 'Approving...' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approval Modal */}
        {showApproveModal && selectedDoc && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            if (!approving) {
              setShowApproveModal(false)
              setSelectedDoc(null)
            }
          }}
          >
            <div
              style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Approve Classification</h2>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Document:</strong> {selectedDoc.name}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Current Classification Level:</strong>{' '}
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    fontWeight: '600',
                    background: getClassificationColor(selectedDoc.classificationLevel) + '33',
                    color: getClassificationColor(selectedDoc.classificationLevel)
                  }}>
                    {selectedDoc.classificationLevel?.replace('_', ' ')}
                  </span>
                </div>
                {selectedDoc.classificationReason && (
                  <div style={{ marginBottom: '12px', fontSize: '0.9em', color: '#666' }}>
                    <strong>Reason:</strong> {selectedDoc.classificationReason}
                  </div>
                )}
                {selectedDoc.classificationConfidence !== null && selectedDoc.classificationConfidence !== undefined && (
                  <div style={{ marginBottom: '12px', fontSize: '0.9em', color: '#666' }}>
                    <strong>Confidence:</strong> {(selectedDoc.classificationConfidence * 100).toFixed(1)}%
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={approveCurrentLevel}
                    onChange={() => setApproveCurrentLevel(true)}
                    style={{ marginRight: '8px' }}
                  />
                  <span>Approve current classification level</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={!approveCurrentLevel}
                    onChange={() => setApproveCurrentLevel(false)}
                    style={{ marginRight: '8px' }}
                  />
                  <span>Override with new level</span>
                </label>
              </div>

              {!approveCurrentLevel && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    New Classification Level:
                  </label>
                  <select
                    value={overrideLevel}
                    onChange={(e) => setOverrideLevel(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: `1px solid ${theme === 'dark' ? '#333' : '#ccc'}`,
                      background: theme === 'dark' ? '#2a2a2a' : '#fff',
                      color: theme === 'dark' ? '#fff' : '#000'
                    }}
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="CONFIDENTIAL">Confidential</option>
                    <option value="STRICTLY_CONFIDENTIAL">Strictly Confidential</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Review Comment (Optional):
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add your review comments..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#333' : '#ccc'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => {
                    setShowApproveModal(false)
                    setSelectedDoc(null)
                    setComment('')
                  }}
                  disabled={approving}
                  style={{
                    padding: '10px 20px',
                    background: '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: approving ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  style={{
                    padding: '10px 20px',
                    background: approving ? '#ccc' : '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: approving ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {approving ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approval Result Modal - Shows E-Signature Info */}
        {approvalResult && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setApprovalResult(null)}
          >
            <div
              style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#4caf50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '30px' }}>✓</span>
              </div>
              <h2 style={{ margin: '0 0 8px', color: '#4caf50' }}>Classification Approved!</h2>
              <p style={{ margin: '0 0 20px', color: '#666' }}>
                The document has been successfully classified and the approval has been recorded.
              </p>

              {/* E-Signature Evidence */}
              {approvalResult.signatureId && (
                <div style={{
                  background: '#e8f5e9',
                  border: '1px solid #4caf50',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'left',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    color: '#2e7d32',
                    fontWeight: 'bold'
                  }}>
                    <span>🔒</span> Digital Signature Created
                  </div>
                  <div style={{ fontSize: '13px', color: '#555' }}>
                    <div style={{ marginBottom: '6px' }}>
                      <strong>Signature ID:</strong> {approvalResult.signatureId}
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      <strong>Status:</strong>
                      <span style={{
                        marginLeft: '6px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: '#4caf50',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {approvalResult.signatureStatus}
                      </span>
                    </div>
                    {approvalResult.signatureTimestamp && (
                      <div style={{ marginBottom: '6px' }}>
                        <strong>Signed At:</strong> {new Date(approvalResult.signatureTimestamp).toLocaleString()}
                      </div>
                    )}
                    {approvalResult.blockchainTxHash && (
                      <div style={{ marginTop: '10px', padding: '8px', background: '#fff', borderRadius: '4px' }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Blockchain Anchor (Ethereum)</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                          {approvalResult.blockchainTxHash.substring(0, 20)}...
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!approvalResult.signatureId && (
                <div style={{
                  background: '#fff3e0',
                  border: '1px solid #ff9800',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#e65100'
                }}>
                  ⚠️ Signature creation failed. The classification was still recorded.
                </div>
              )}

              {approvalResult.signatureId && (
                <button
                  onClick={() => {
                    // Navigate to signature chain page
                    const docId = approvalResult && documents.length > 0 ? documents[0]?.id : null
                    if (docId) {
                      navigate(`/documents/${docId}/signatures`)
                    }
                    setApprovalResult(null)
                  }}
                  style={{
                    padding: '10px 32px',
                    background: '#9c27b0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  ✍️ View Signature Chain
                </button>
              )}
              {!approvalResult.signatureId && (
                <button
                  onClick={() => setApprovalResult(null)}
                  style={{
                    padding: '10px 32px',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewDoc && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewDoc(null)
            }
          }}
          >
            <div
              style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                width: '95vw',
                height: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '16px 24px',
                borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>Document Preview</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
                    {previewDoc.name}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85em',
                    fontWeight: '600',
                    background: getClassificationColor(previewDoc.classificationLevel) + '33',
                    color: getClassificationColor(previewDoc.classificationLevel)
                  }}>
                    {previewDoc.classificationLevel?.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    style={{
                      padding: '8px 16px',
                      background: '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Document Viewer */}
              <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
                <DRMViewer
                  documentUrl={`/api/docs/${previewDoc.id}/content`}
                  documentName={previewDoc.name}
                  allowCopy={false}
                  allowPrint={false}
                  allowDownload={false}
                  requiresWatermark={true}
                  watermarkText={`Reviewer Preview | ${previewDoc.classificationLevel?.replace('_', ' ')}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Approved Document Details Modal */}
        {viewApprovedDoc && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewApprovedDoc(null)
            }
          }}
          >
            <div
              style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '700px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Approval Details</h2>
                <button
                  onClick={() => setViewApprovedDoc(null)}
                  style={{
                    padding: '8px 16px',
                    background: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Document:</strong> {viewApprovedDoc.name}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Classification Level:</strong>{' '}
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    fontWeight: '600',
                    background: getClassificationColor(viewApprovedDoc.classificationLevel) + '33',
                    color: getClassificationColor(viewApprovedDoc.classificationLevel)
                  }}>
                    {viewApprovedDoc.classificationLevel?.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Owner:</strong> {viewApprovedDoc.ownerName}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Department:</strong> {viewApprovedDoc.department}
                </div>
                {viewApprovedDoc.classificationReason && (
                  <div style={{ marginBottom: '12px', fontSize: '0.9em', color: '#666' }}>
                    <strong>Classification Reason:</strong> {viewApprovedDoc.classificationReason}
                  </div>
                )}
              </div>

              <div style={{ borderTop: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`, paddingTop: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Digital Signature Records</h3>
                
                {loadingSignatures ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    Loading signature records...
                  </div>
                ) : approvedDocSignatures.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    No signature records found for this document
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {approvedDocSignatures.map((sig: any, index: number) => (
                      <div
                        key={sig.id}
                        style={{
                          padding: '16px',
                          borderRadius: '8px',
                          border: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`,
                          background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2em' }}>✓</span>
                            <strong>{sig.user?.fullName || sig.user?.accountId || 'Unknown Signer'}</strong>
                            <span style={{ 
                              marginLeft: '8px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'normal',
                              background: sig.signatureType === 'CLASSIFICATION_APPROVE' ? '#ff9800' : 
                                         sig.signatureType === 'APPROVE_SHARE' ? '#9c27b0' : 
                                         sig.signatureType === 'MANUAL_SIGN' ? '#00bcd4' : 
                                         index === 0 ? '#2196f3' : '#9c27b0',
                              color: 'white'
                            }}>
                              {sig.signatureTypeLabel || (index === 0 ? 'Uploader' : 'Approver')}
                            </span>
                            <span style={{ color: '#666', fontSize: '0.85em' }}>({sig.user?.accountId || sig.userId})</span>
                          </div>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8em',
                            fontWeight: '600',
                            background: sig.status === 'VALID' ? '#4caf5033' : '#f4433633',
                            color: sig.status === 'VALID' ? '#4caf50' : '#f44336'
                          }}>
                            {sig.status || 'VALID'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <strong>Signed At:</strong> {sig.signedAt ? new Date(sig.signedAt).toLocaleString() : 'N/A'}
                          </div>
                          {sig.signatureId && (
                            <div style={{ marginBottom: '4px' }}>
                              <strong>Signature ID:</strong> {sig.signatureId}
                            </div>
                          )}
                          {sig.blockchainTxHash && (
                            <div style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
                              <strong>Blockchain Hash:</strong> {sig.blockchainTxHash}
                            </div>
                          )}
                          {sig.documentHash && (
                            <div style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
                              <strong>Document Hash:</strong> {sig.documentHash.substring(0, 32)}...
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => {
                    setViewApprovedDoc(null)
                    navigate(`/documents/${viewApprovedDoc.id}/signatures`)
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  View Full Signature Chain
                </button>
                <button
                  onClick={() => setViewApprovedDoc(null)}
                  style={{
                    padding: '10px 20px',
                    background: '#666',
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

        {/* Reject Share Modal */}
        {showRejectShareModal && rejectTargetShare && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => !rejectingShareId && setShowRejectShareModal(false)}
          >
            <div
              style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Reject Share Request</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Document:</strong> {rejectTargetShare.documentName || `#${rejectTargetShare.documentId}`}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Creator:</strong> {rejectTargetShare.creatorName || 'Unknown'}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Current Level:</strong>{' '}
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.85em',
                    fontWeight: '600',
                    background: getClassificationColor(rejectTargetShare.documentClassificationLevel) + '33',
                    color: getClassificationColor(rejectTargetShare.documentClassificationLevel)
                  }}>
                    {rejectTargetShare.documentClassificationLevel?.replace('_', ' ') || 'N/A'}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Correct classification level (optional - will update document level):
                </label>
                <select
                  value={rejectCorrectedLevel}
                  onChange={(e) => setRejectCorrectedLevel(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#333' : '#ccc'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="STRICTLY_CONFIDENTIAL">STRICTLY CONFIDENTIAL</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Reject reason (optional):
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., External sharing of confidential documents not permitted"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#333' : '#ccc'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowRejectShareModal(false)}
                  disabled={!!rejectingShareId}
                  style={{
                    padding: '10px 20px',
                    background: '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: rejectingShareId ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectShare}
                  disabled={!!rejectingShareId}
                  style={{
                    padding: '10px 20px',
                    background: rejectingShareId ? '#ccc' : '#c62828',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: rejectingShareId ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {rejectingShareId ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
