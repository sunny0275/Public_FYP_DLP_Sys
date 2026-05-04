import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { UserSummary, RecentDocument, Alert } from '../../types'
import DashboardSkeleton from '../../components/DashboardSkeleton'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [summary, setSummary] = useState<UserSummary | null>(null)
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [pendingReviewCount, setPendingReviewCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isReviewer = user?.roles?.some(r => r === 'REVIEWER' || r === 'ROLE_REVIEWER') || false

  useEffect(() => {
    // Admin should not stay on the Overview page; redirect defensively
    if (user?.roles?.includes('ADMIN')) {
      navigate('/dashboard/admin', { replace: true })
      return
    }
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    setError('')

    try {
      const promises: Promise<any>[] = [
        apiClient.getUserSummary(),
        apiClient.getRecentDocuments(),
        apiClient.getRecentAlerts()
      ]

      // Load pending review count if user is REVIEWER
      if (isReviewer) {
        promises.push(apiClient.getPendingReviewCount())
      }

      const [summaryRes, docsRes, alertsRes, reviewCountRes] = await Promise.all(promises)

      setSummary(summaryRes.data)
      setRecentDocs(docsRes.data)
      setAlerts(alertsRes.data)
      
      if (isReviewer && reviewCountRes) {
        setPendingReviewCount(reviewCountRes.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <DashboardSkeleton variant="default" />
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-message">{error}</div>
        <button onClick={loadDashboardData} className="primary" style={{ marginTop: '20px' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <h1>Home{user ? ` – Welcome, ${user.fullName}` : ''}</h1>

      {summary && (
        <div className="dashboard-card" style={{ marginBottom: '24px' }}>
          <h3>Profile</h3>
          <div style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <p><strong>Account ID:</strong> {summary.accountId}</p>
            <p><strong>Email:</strong> {summary.email}</p>
            <p><strong>Department:</strong> {summary.department}</p>
            <p><strong>Position:</strong> {summary.position}</p>
          </div>
          {summary.passwordExpiringSoon && summary.daysUntilPasswordExpiry !== null && (
            <div className="info-message" style={{ marginTop: '10px' }}>
              Your password will expire in {summary.daysUntilPasswordExpiry} day(s)
            </div>
          )}
        </div>
      )}

      {/* Reviewer Alert Card */}
      {isReviewer && pendingReviewCount !== null && pendingReviewCount > 0 && (
        <div className="dashboard-card" style={{ 
          marginBottom: '24px', 
          background: '#fff3cd', 
          border: '2px solid #ffc107',
          cursor: 'pointer'
        }}
        onClick={() => navigate('/classification/review')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#856404' }}>⚠️ Classification Review Required</h3>
              <p style={{ margin: 0, color: '#856404', fontSize: '0.95em' }}>
                {pendingReviewCount} document{pendingReviewCount !== 1 ? 's' : ''} pending classification review
              </p>
            </div>
            <button
              style={{
                padding: '10px 20px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onClick={(e) => {
                e.stopPropagation()
                navigate('/classification/review')
              }}
            >
              Review Now →
            </button>
          </div>
        </div>
      )}

      {/* Main entry points */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '1.5em', color: '#333' }}>Quick actions</h2>
        <div className="dashboard-grid">
          {/* Classification Review (for REVIEWER role) - Show first for reviewers */}
          {isReviewer && (
            <div 
              className="dashboard-card" 
              style={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s ease',
                border: '2px solid #e0e0e0'
              }}
              onClick={() => navigate('/classification/review')}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ff9800'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,152,0,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>🔍</div>
              <h3>Classification Review</h3>
              <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
                Review and approve document classification levels
              </p>
              <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#ff9800', marginTop: '8px' }}>
                Pending: {pendingReviewCount ?? 0}
              </div>
            </div>
          )}

          {/* Documents - Hide for REVIEWER */}
          {!isReviewer && (
            <div 
              className="dashboard-card" 
              style={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s ease',
                border: '2px solid #e0e0e0'
              }}
              onClick={() => navigate('/documents')}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#007bff'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,123,255,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>📁</div>
              <h3>Documents</h3>
              <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
                Browse, search, and filter documents you have access to
              </p>
              <ul style={{ paddingLeft: '18px', fontSize: '0.9em', color: '#888', textAlign: 'left' }}>
                <li>Full-text search and advanced filters</li>
                <li>Classification-aware access control</li>
                <li>Batch operations</li>
              </ul>
            </div>
          )}

          {/* Upload - Hide for REVIEWER */}
          {!isReviewer && (
            <div 
              className="dashboard-card" 
              style={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s ease',
                border: '2px solid #e0e0e0'
              }}
              onClick={() => navigate('/upload')}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#28a745'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(40,167,69,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>📤</div>
              <h3>Upload</h3>
              <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
                Upload a new document securely. The system will run automatic classification.
              </p>
              <ul style={{ paddingLeft: '18px', fontSize: '0.9em', color: '#888', textAlign: 'left' }}>
                <li>File size and type validation</li>
                <li>Background automatic classification</li>
                <li>OCR text extraction</li>
              </ul>
            </div>
          )}

          {/* My shares - Hide for REVIEWER */}
          {!isReviewer && (
            <div 
              className="dashboard-card" 
              style={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s ease',
                border: '2px solid #e0e0e0'
              }}
              onClick={() => navigate('/my-shares')}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#6f42c1'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(111,66,193,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>🔗</div>
              <h3>My shares</h3>
              <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
                Manage document links you have shared
              </p>
              <ul style={{ paddingLeft: '18px', fontSize: '0.9em', color: '#888', textAlign: 'left' }}>
                <li>View share status</li>
                <li>Manage permissions</li>
                <li>Revoke share links</li>
              </ul>
            </div>
          )}

          {/* Profile & security */}
          <div 
            className="dashboard-card" 
            style={{ 
              cursor: 'pointer', 
              transition: 'all 0.3s ease',
              border: '2px solid #e0e0e0'
            }}
            onClick={() => navigate('/me')}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#dc3545'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,53,69,0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>👤</div>
            <h3>Profile & security</h3>
            <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
              Manage your profile, MFA, and password settings
            </p>
            <ul style={{ paddingLeft: '18px', fontSize: '0.9em', color: '#888', textAlign: 'left' }}>
              <li>View roles and department</li>
              <li>Change password / manage MFA</li>
              <li>Update profile info</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick info */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '1.5em', color: '#333' }}>Quick info</h2>
        <div className="dashboard-grid">
          {/* Recent documents */}
          <div className="dashboard-card">
            <h3>Recent documents</h3>
            {recentDocs.length > 0 ? (
              <ul className="card-list">
                {recentDocs.slice(0, 10).map((doc) => (
                  <li 
                    key={doc.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ fontWeight: '500' }}>{doc.documentName}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/documents/${doc.id}/signatures`)
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.8em',
                          background: '#2196f3',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="View signature chain"
                      >
                        ✍️ Signatures
                      </button>
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#888' }}>
                      {doc.classificationLevel} - {doc.department}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">No recent documents</div>
            )}
            {recentDocs.length > 10 && (
              <button 
                onClick={() => navigate('/documents')}
                style={{ 
                  marginTop: '12px', 
                  padding: '6px 12px', 
                  fontSize: '0.9em',
                  background: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                View all →
              </button>
            )}
          </div>

          {/* Recent alerts */}
          <div className="dashboard-card">
            <h3>Recent alerts ({summary?.alertCount || 0})</h3>
            <div style={{ marginBottom: '10px', fontSize: '0.9em', color: '#888' }}>
              Warning alerts, failures, and UEBA account actions.
            </div>
            {alerts.length > 0 ? (
              <ul className="card-list">
                {alerts.slice(0, 5).map((alert) => (
                  <li key={alert.id}>
                    <div style={{ fontWeight: '500', color: alert.severity === 'HIGH' ? '#ff6b6b' : 'inherit' }}>
                      {alert.alertType}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#888' }}>
                      {alert.description}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">No alerts</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
