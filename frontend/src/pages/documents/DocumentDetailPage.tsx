import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'
import DashboardLayout from '../../components/DashboardLayout'
import ShareDialog from '../../components/ShareDialog'
import DRMViewer from '../../components/DRMViewer'
import { API_BASE_URL } from '../../types'

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, theme } = useAuthStore()

  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareDialogInitialTab, setShareDialogInitialTab] = useState<'internal' | 'existing'>('internal')
  const [versions, setVersions] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [activitySeverityFilter, setActivitySeverityFilter] = useState<string>('all')
  const [activitySearchTerm, setActivitySearchTerm] = useState('')
  const [activitySortField, setActivitySortField] = useState<'timestamp' | 'userName' | 'action' | 'result'>('timestamp')
  const [activitySortDirection, setActivitySortDirection] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState<'info' | 'preview' | 'versions' | 'activity'>('info')
  const [editingMetadata, setEditingMetadata] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    department: '',
    classificationLevel: '',
    tags: [] as string[]
  })
  const [departments, setDepartments] = useState<string[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [comparisonResult, setComparisonResult] = useState<any>(null)
  const [comparingVersions, setComparingVersions] = useState<{ v1: any | null, v2: any | null }>({ v1: null, v2: null })

  useEffect(() => {
    if (id) {
      loadDocument()
    }
  }, [id])

  // Record VIEW audit when user explicitly clicks Preview tab
  useEffect(() => {
    if (activeTab === 'preview' && id && document) {
      // Only record once per session (when first switching to preview)
      apiClient.recordDocumentView(Number(id)).catch(err => {
        console.warn('Failed to record document view:', err)
      })
    }
  }, [activeTab, id])

  useEffect(() => {
    if (editingMetadata) {
      loadEditOptions()
    }
  }, [editingMetadata])

  const loadEditOptions = async () => {
    try {
      const [deptsRes, tagsRes] = await Promise.all([
        apiClient.getDepartments(),
        apiClient.getAllTags()
      ])
      setDepartments(deptsRes.data || [])
      setTags(tagsRes.data || [])
    } catch (err) {
      console.error('Failed to load edit options:', err)
    }
  }

  const handleSaveMetadata = async () => {
    if (!id) return

    try {
      await apiClient.updateDocument(Number(id), {
        name: editForm.name,
        description: editForm.description,
        department: editForm.department,
        classificationLevel: editForm.classificationLevel || undefined,
        tags: editForm.tags
      })
      setEditingMetadata(false)
      loadDocument() // Reload to see updated data
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update metadata')
    }
  }

    const loadDocument = async () => {
    setLoading(true)
    setError('')

    try {
      // Fetch document first to check permission
      const docRes = await apiClient.getDocument(Number(id))
      setDocument(docRes.data)
      
      // Initialize edit form
      setEditForm({
        name: docRes.data.name || '',
        description: docRes.data.description || '',
        department: docRes.data.department || '',
        classificationLevel: docRes.data.classificationLevel || '',
        tags: docRes.data.tags?.map((t: any) => t.id?.toString() || t.name) || []
      })

      // Only fetch versions and activity if user has access to the document
      const [versionsRes, activityRes] = await Promise.all([
        apiClient.getDocumentVersions(Number(id)),
        apiClient.getDocumentActivity(Number(id))
      ])
      setVersions(versionsRes.data || [])
      setActivities(activityRes.data || [])
    } catch (err: any) {
      if (err.response?.status === 403) {
        const errorMsg = 'You do not have permission to view this document'
        setError(errorMsg)
        // Note: Alert is already shown by apiClient interceptor (client.ts)
        // No need to show duplicate alert here
        setTimeout(() => navigate('/'), 100)
      } else if (err.response?.status === 404) {
        setError('Document not found')
      } else {
        setError(err.response?.data?.message || 'Failed to load document')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreVersion = async (versionId: number) => {
    if (!confirm('Are you sure you want to restore to this version? The current version will be saved as a new version.')) {
      return
    }

    try {
      await apiClient.restoreDocumentVersion(Number(id), versionId)
      alert('Document restored successfully!')
      loadDocument() // Reload to see updated version
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to restore version')
    }
  }

  const handleCompareVersions = async (v1: any, v2: any) => {
    try {
      const response = await apiClient.compareDocumentVersions(Number(id), v1.id, v2.id)
      setComparisonResult(response.data)
      setComparingVersions({ v1, v2 })
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to compare versions')
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

  const severityOrder: Record<string, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  }

  const mapResultToSeverity = (result?: string) => {
    if (!result) return 'LOW'
    if (result === 'FAILURE') return 'HIGH'
    if (result === 'WARNING') return 'MEDIUM'
    return 'LOW'
  }

  const normalizedActivitySearch = activitySearchTerm.trim().toLowerCase()

  const filteredActivities = activities.filter((activity) => {
    const severity = mapResultToSeverity(activity.result)

    if (activitySeverityFilter !== 'all' && severity !== activitySeverityFilter) {
      return false
    }

    if (!normalizedActivitySearch) {
      return true
    }

    const haystack = [
      activity.userName,
      activity.accountId,
      activity.action,
      activity.result,
      activity.details
    ]
      .filter(Boolean)
      .map(value => value.toString().toLowerCase())
      .join(' ')

    return haystack.includes(normalizedActivitySearch)
  })

  const sortedActivities = [...filteredActivities].sort((a, b) => {
    const direction = activitySortDirection === 'asc' ? 1 : -1

    switch (activitySortField) {
      case 'timestamp': {
        const aTime = new Date(a.timestamp || '').getTime()
        const bTime = new Date(b.timestamp || '').getTime()
        return (aTime - bTime) * direction
      }
      case 'userName': {
        const aName = (a.userName || a.accountId || '').toString()
        const bName = (b.userName || b.accountId || '').toString()
        return aName.localeCompare(bName) * direction
      }
      case 'action': {
        return (a.action || '').localeCompare(b.action || '') * direction
      }
      case 'result': {
        return (severityOrder[mapResultToSeverity(a.result)] - severityOrder[mapResultToSeverity(b.result)]) * direction
      }
      default:
        return 0
    }
  })

  const handleExportActivities = () => {
    const payload = sortedActivities.map((activity) => ({
      time: activity.timestamp,
      user: activity.userName || activity.accountId,
      action: activity.action,
      result: activity.result,
      ip: activity.ipAddress,
      details: activity.details
    }))

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `document-${id}-activity-${new Date().toISOString()}.json`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const severityColorMap: Record<string, string> = {
    HIGH: '#ff6b6b',
    MEDIUM: '#ffa500',
    LOW: '#4caf50'
  }

  const formatTimestampHK = (timestamp?: string) => {
    if (!timestamp) return '—'
    return new Date(timestamp).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
  }

  const toggleActivitySort = (field: 'timestamp' | 'userName' | 'action' | 'result') => {
    if (activitySortField === field) {
      setActivitySortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setActivitySortField(field)
      setActivitySortDirection(field === 'timestamp' ? 'desc' : 'asc')
    }
  }

  const renderSortIndicator = (field: 'timestamp' | 'userName' | 'action' | 'result') => {
    if (activitySortField !== field) return '↕'
    return activitySortDirection === 'asc' ? '↑' : '↓'
  }


  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard">
          <h2>Loading document...</h2>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !document) {
    const isForbidden = error && (error.includes('permission') || error.includes('Permission'));
    return (
      <DashboardLayout>
        <div className="dashboard">
          {isForbidden ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              gap: '24px'
            }}>
              <div style={{
                fontSize: '4rem',
                lineHeight: 1,
                filter: 'drop-shadow(0 2px 8px rgba(220,53,69,0.3))'
              }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{
                padding: '16px 24px',
                borderRadius: '8px',
                border: '1px solid rgba(220,53,69,0.3)',
                background: 'rgba(220,53,69,0.05)',
                maxWidth: '480px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '1.1em',
                  fontWeight: 600,
                  color: '#dc3545',
                  marginBottom: '8px'
                }}>
                  Access Denied
                </div>
                <div style={{ fontSize: '0.95em', color: '#666', lineHeight: 1.5 }}>
                  {error || 'You do not have permission to view this document.'}
                </div>
                <div style={{
                  marginTop: '12px',
                  fontSize: '0.8em',
                  color: '#888',
                  padding: '8px 12px',
                  background: 'rgba(255,193,7,0.1)',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,193,7,0.3)'
                }}>
                  This attempt has been logged and reported to the security system for review.
                </div>
              </div>
              <button
                onClick={() => navigate('/documents')}
                style={{
                  padding: '10px 28px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95em',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Return to Document Library
              </button>
            </div>
          ) : (
            <>
              <div className="error-message" style={{ marginBottom: '20px' }}>{error || 'Document not found'}</div>
              <button onClick={() => navigate('/documents')} style={{ padding: '10px 20px' }}>
                ← Back to Documents
              </button>
            </>
          )}
        </div>
      </DashboardLayout>
    )
  }

  const isOwner = document.ownerId === user?.userId

  return (
    <DashboardLayout>
      <div className="dashboard">
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => navigate('/documents')} style={{ padding: '8px 16px', background: '#6c757d', marginBottom: '16px' }}>
            ← Back to Documents
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h1 style={{ marginBottom: '8px' }}>{document.name}</h1>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
                <span style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.9em',
                  fontWeight: '600',
                  background: getClassificationColor(document.classificationLevel) + '33',
                  color: getClassificationColor(document.classificationLevel)
                }}>
                  {document.classificationLevel?.replace('_', ' ')}
                </span>
                <span style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.9em',
                  fontWeight: '600',
                  background: getStatusColor(document.status) + '33',
                  color: getStatusColor(document.status)
                }}>
                  {document.status}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {isOwner && (
                <>
                  <button onClick={() => { setShareDialogInitialTab('internal'); setShowShareDialog(true); }} style={{ padding: '10px 20px', background: '#17a2b8' }}>
                    🔗 Share
                  </button>
                  <button
                    onClick={() => { setShareDialogInitialTab('existing'); setShowShareDialog(true); }}
                    style={{ padding: '10px 20px', background: '#6c757d' }}
                    title="View and manage shared persons"
                  >
                    👥 Manage shares
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs: Info / Preview / Versions / Activity */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['info', 'preview', 'versions', 'activity'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '16px',
                  border: '1px solid #ddd',
                  background: activeTab === tab ? '#007bff' : '#f5f5f5',
                  color: activeTab === tab ? '#fff' : '#333',
                  cursor: 'pointer',
                  fontSize: '0.9em'
                }}
              >
                {tab === 'info' && 'Info'}
                {tab === 'preview' && 'Preview'}
                {tab === 'versions' && 'Versions'}
                {tab === 'activity' && 'Activity'}
              </button>
            ))}
          </div>

          {activeTab === 'info' && (
            <>
              <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {/* Metadata */}
                <div className="dashboard-card">
                  <h3 style={{ marginBottom: '16px' }}>Document Information</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Owner</div>
                      <div style={{ fontWeight: '500' }}>{document.ownerName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Department</div>
                      <div style={{ fontWeight: '500' }}>{document.department}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>File Type</div>
                      <div style={{ fontWeight: '500' }}>{document.fileType}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>File Size</div>
                      <div style={{ fontWeight: '500' }}>{(document.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    {document.pageCount && (
                      <div>
                        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Pages</div>
                        <div style={{ fontWeight: '500' }}>{document.pageCount}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Created</div>
                      <div style={{ fontWeight: '500' }}>{new Date(document.createdAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Last Updated</div>
                      <div style={{ fontWeight: '500' }}>{new Date(document.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="dashboard-card">
                  <h3 style={{ marginBottom: '16px' }}>Statistics</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Views</div>
                      <div style={{ fontWeight: '500', fontSize: '1.5em', color: '#007bff' }}>{document.viewCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Downloads</div>
                      <div style={{ fontWeight: '500', fontSize: '1.5em', color: '#28a745' }}>{document.downloadCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Shares</div>
                      <div style={{ fontWeight: '500', fontSize: '1.5em', color: '#ff9800' }}>{document.shareCount || 0}</div>
                    </div>
                  </div>
                </div>
              </div>

              {document.description && (
                <div className="dashboard-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}>Description</h3>
                    {document.ownerId === user?.userId && (
                      <button
                        onClick={() => setEditingMetadata(true)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.85em',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Edit Metadata
                      </button>
                    )}
                  </div>
                  <p style={{ color: theme === 'dark' ? '#ccc' : '#555', lineHeight: '1.6' }}>
                    {document.description}
                  </p>
                </div>
              )}

              {!document.description && document.ownerId === user?.userId && (
                <div className="dashboard-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Description</h3>
                    <button
                      onClick={() => setEditingMetadata(true)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85em',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Edit Metadata
                    </button>
                  </div>
                </div>
              )}

              {document.tags && document.tags.length > 0 && (
                <div className="dashboard-card">
                  <h3 style={{ marginBottom: '12px' }}>Tags</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {document.tags.map((tag: any) => (
                      <span
                        key={tag.id}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '12px',
                          fontSize: '0.9em',
                          background: tag.color || '#007bff',
                          color: '#fff'
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Signature Chain */}
              <div className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0 }}>Digital Signatures</h3>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => navigate(`/documents/${document.id}/signatures`)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.85em',
                      background: '#2196f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    View Signature Chain
                  </button>
                  </div>
                </div>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Signatures are created automatically after upload. You can view the signature chain here.
                </p>
              </div>

              {document.classificationReason && (
                <div className="dashboard-card">
                  <h3 style={{ marginBottom: '12px' }}>Classification Details</h3>
                  {document.autoClassified && (
                    <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#007bff33', borderRadius: '6px', color: '#007bff', fontSize: '0.9em' }}>
                      🤖 This document was automatically classified using AI
                    </div>
                  )}
                  {document.classificationConfidence !== null && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Confidence</div>
                      <div style={{ fontWeight: '500' }}>{(document.classificationConfidence * 100).toFixed(1)}%</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Reason</div>
                    <p style={{ color: theme === 'dark' ? '#ccc' : '#555', lineHeight: '1.6' }}>
                      {document.classificationReason}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'preview' && (
            <div className="dashboard-card">
              <h3 style={{ marginBottom: '16px' }}>Document Preview</h3>
              <DRMViewer
                documentUrl={`${API_BASE_URL}/docs/${document.id}/content`}
                documentName={document.name}
                allowCopy={false}
                allowPrint={false}
                allowDownload={false}
                requiresWatermark={true}
                watermarkText={`User: ${user?.fullName || user?.accountId || ''} | Dept: ${user?.department || ''}`}
              />
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="dashboard-card">
              <h3 style={{ marginBottom: '12px' }}>Version History</h3>
              {versions.length > 0 ? (
                <>
                  {/* Version Comparison UI */}
                  {versions.length >= 2 && (
                    <div style={{ marginBottom: '20px', padding: '16px', background: theme === 'dark' ? '#333' : '#f5f5f5', borderRadius: '8px' }}>
                      <h4 style={{ marginBottom: '12px' }}>Compare Versions</h4>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                          value={comparingVersions.v1?.id || ''}
                          onChange={(e) => {
                            const v = versions.find((v: any) => v.id.toString() === e.target.value)
                            setComparingVersions({ ...comparingVersions, v1: v || null })
                          }}
                          style={{ padding: '8px', borderRadius: '4px', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
                        >
                          <option value="">Select Version 1</option>
                          {versions.map((v: any) => (
                            <option key={v.id} value={v.id}>Version {v.versionNumber}</option>
                          ))}
                        </select>
                        <span>vs</span>
                        <select
                          value={comparingVersions.v2?.id || ''}
                          onChange={(e) => {
                            const v = versions.find((v: any) => v.id.toString() === e.target.value)
                            setComparingVersions({ ...comparingVersions, v2: v || null })
                          }}
                          style={{ padding: '8px', borderRadius: '4px', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
                        >
                          <option value="">Select Version 2</option>
                          {versions.map((v: any) => (
                            <option key={v.id} value={v.id}>Version {v.versionNumber}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (comparingVersions.v1 && comparingVersions.v2) {
                              handleCompareVersions(comparingVersions.v1, comparingVersions.v2)
                            } else {
                              alert('Please select two versions to compare')
                            }
                          }}
                          disabled={!comparingVersions.v1 || !comparingVersions.v2}
                          style={{
                            padding: '8px 16px',
                            background: comparingVersions.v1 && comparingVersions.v2 ? '#007bff' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: comparingVersions.v1 && comparingVersions.v2 ? 'pointer' : 'not-allowed'
                          }}
                        >
                          Compare
                        </button>
                      </div>
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Version</th>
                        <th style={{ padding: '8px' }}>Created At</th>
                        <th style={{ padding: '8px' }}>Created By</th>
                        <th style={{ padding: '8px' }}>Size</th>
                        <th style={{ padding: '8px' }}>Notes</th>
                        <th style={{ padding: '8px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v: any) => (
                        <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px' }}>{v.versionNumber}</td>
                          <td style={{ padding: '8px' }}>{new Date(v.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '8px' }}>{v.createdByName || v.createdBy || v.creator}</td>
                          <td style={{ padding: '8px' }}>{v.size || v.fileSize ? ((v.size || v.fileSize) / 1024 / 1024).toFixed(2) + ' MB' : '-'}</td>
                          <td style={{ padding: '8px' }}>{v.description || '-'}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {v.versionNumber !== document.version && (
                                <button
                                  onClick={() => handleRestoreVersion(v.id)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.85em',
                                    background: '#ff9800',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                  title="Restore to this version"
                                >
                                  🔄 Restore
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="empty-state">No version history available.</div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="dashboard-card">
              <h3 style={{ marginBottom: '12px' }}>Activity Log</h3>
              <div style={{
                marginBottom: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.85em' }}>Severity</label>
                  <select
                    value={activitySeverityFilter}
                    onChange={(e) => setActivitySeverityFilter(e.target.value)}
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
                  value={activitySearchTerm}
                  onChange={(e) => setActivitySearchTerm(e.target.value)}
                  placeholder="Search user/action/result/details"
                  style={{
                    flex: '1 1 240px',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`
                  }}
                />

                <button
                  onClick={handleExportActivities}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Export Logs
                </button>

                <div style={{ fontSize: '0.8em', color: '#666' }}>
                  {sortedActivities.length} entries
                </div>
              </div>
              {sortedActivities.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                      <th
                        style={{ padding: '8px', cursor: 'pointer' }}
                        onClick={() => toggleActivitySort('timestamp')}
                      >
                        Time {renderSortIndicator('timestamp')}
                      </th>
                      <th
                        style={{ padding: '8px', cursor: 'pointer' }}
                        onClick={() => toggleActivitySort('userName')}
                      >
                        User {renderSortIndicator('userName')}
                      </th>
                      <th
                        style={{ padding: '8px', cursor: 'pointer' }}
                        onClick={() => toggleActivitySort('action')}
                      >
                        Action {renderSortIndicator('action')}
                      </th>
                      <th
                        style={{ padding: '8px', cursor: 'pointer' }}
                        onClick={() => toggleActivitySort('result')}
                      >
                        Result {renderSortIndicator('result')}
                      </th>
                      <th style={{ padding: '8px' }}>Severity</th>
                      <th style={{ padding: '8px' }}>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedActivities.map((a: any, index: number) => {
                      const severity = mapResultToSeverity(a.result)
                      return (
                      <tr key={`activity-${a.id || a.timestamp || index}`} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px' }}>{formatTimestampHK(a.timestamp)}</td>
                        <td style={{ padding: '8px' }}>{a.userName || a.userId}</td>
                        <td style={{ padding: '8px' }}>{a.action}</td>
                        <td style={{ padding: '8px' }}>{a.result}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75em',
                            fontWeight: 600,
                            background: severityColorMap[severity] || '#888',
                            color: '#fff'
                          }}>
                            {severity}
                          </span>
                        </td>
                        <td style={{ padding: '8px' }}>{a.ipAddress}</td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">No activity records.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share Dialog */}
      {showShareDialog && isOwner && (
        <ShareDialog
          initialTab={shareDialogInitialTab}
          documentId={document.id}
          documentName={document.name}
          onClose={() => setShowShareDialog(false)}
          onSuccess={() => {
            setShowShareDialog(false)
            loadDocument() // Reload to see updated share count
          }}
        />
      )}

      {/* Version Comparison Modal */}
      {comparisonResult && comparingVersions.v1 && comparingVersions.v2 && (
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
          onClick={() => {
            setComparisonResult(null)
            setComparingVersions({ v1: null, v2: null })
          }}
        >
          <div
            className="dashboard-card"
            style={{
              maxWidth: '900px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              background: theme === 'dark' ? '#2a2a2a' : '#fff',
              padding: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Version Comparison</h2>
              <button
                onClick={() => {
                  setComparisonResult(null)
                  setComparingVersions({ v1: null, v2: null })
                }}
                style={{
                  padding: '8px 16px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <h3>Version {comparisonResult.version1?.versionNumber || comparingVersions.v1?.versionNumber}</h3>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Created: {new Date(comparisonResult.version1?.createdAt || comparingVersions.v1?.createdAt).toLocaleString()}
                </p>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Size: {comparisonResult.version1?.fileSize ? (comparisonResult.version1.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '-'}
                </p>
              </div>
              <div>
                <h3>Version {comparisonResult.version2?.versionNumber || comparingVersions.v2?.versionNumber}</h3>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Created: {new Date(comparisonResult.version2?.createdAt || comparingVersions.v2?.createdAt).toLocaleString()}
                </p>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Size: {comparisonResult.version2?.fileSize ? (comparisonResult.version2.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '-'}
                </p>
              </div>
            </div>

            {comparisonResult.textSimilarity !== undefined && (
              <div style={{ marginBottom: '20px', padding: '12px', background: theme === 'dark' ? '#333' : '#f5f5f5', borderRadius: '8px' }}>
                <strong>Text Similarity: </strong>
                {(comparisonResult.textSimilarity * 100).toFixed(2)}%
              </div>
            )}

            {comparisonResult.text1Preview && comparisonResult.text2Preview && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4>Version 1 Preview</h4>
                  <pre style={{ 
                    padding: '12px', 
                    background: theme === 'dark' ? '#1a1a1a' : '#f9f9f9', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: '0.85em'
                  }}>
                    {comparisonResult.text1Preview}
                  </pre>
                </div>
                <div>
                  <h4>Version 2 Preview</h4>
                  <pre style={{ 
                    padding: '12px', 
                    background: theme === 'dark' ? '#1a1a1a' : '#f9f9f9', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: '0.85em'
                  }}>
                    {comparisonResult.text2Preview}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingMetadata && (
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
          onClick={() => setEditingMetadata(false)}
        >
          <div
            className="dashboard-card"
            style={{
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              background: theme === 'dark' ? '#2a2a2a' : '#fff',
              padding: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Edit Document Metadata</h2>
              <button
                onClick={() => setEditingMetadata(false)}
                style={{
                  padding: '8px 16px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveMetadata() }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Document Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Department *</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Classification Level</label>
                <select
                  value={editForm.classificationLevel}
                  onChange={(e) => setEditForm({ ...editForm, classificationLevel: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                >
                  <option value="">Auto-classify</option>
                  <option value="PUBLIC">Public</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="STRICTLY_CONFIDENTIAL">Strictly Confidential</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Tags</label>
                <div style={{ fontSize: '12px', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#666' }}>
                  Selected: {editForm.tags.length}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {tags.map((tag: any) => (
                    <label
                      key={tag.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '0.85em',
                        cursor: 'pointer',
                        userSelect: 'none',
                        fontWeight: editForm.tags.includes(tag.id.toString()) ? 700 : 500,
                        background: editForm.tags.includes(tag.id.toString())
                          ? (tag.color || '#007bff')
                          : (theme === 'dark' ? '#333' : '#f0f0f0'),
                        color: editForm.tags.includes(tag.id.toString()) ? '#fff' : (theme === 'dark' ? '#fff' : '#000'),
                        border: `1px solid ${editForm.tags.includes(tag.id.toString()) ? '#0056b3' : (theme === 'dark' ? '#444' : '#ddd')}`,
                        boxShadow: editForm.tags.includes(tag.id.toString()) ? '0 0 0 2px rgba(0,123,255,0.25)' : 'none'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editForm.tags.includes(tag.id.toString())}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({ ...editForm, tags: [...editForm.tags, tag.id.toString()] })
                          } else {
                            setEditForm({ ...editForm, tags: editForm.tags.filter(t => t !== tag.id.toString()) })
                          }
                        }}
                        style={{ marginRight: '6px', cursor: 'pointer' }}
                      />
                      {editForm.tags.includes(tag.id.toString()) ? '✓ ' : ''}{tag.name}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingMetadata(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
