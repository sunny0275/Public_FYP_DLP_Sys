import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { apiClient } from '../../api'
import DashboardSkeleton from '../../components/DashboardSkeleton'

interface PolicyViolation {
  id: number
  policyName: string
  violationType: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  violator: string
  department: string
  timestamp: string
  details: string
  resolved: boolean
}

interface ClassificationDrift {
  id: number
  documentId: number
  documentName: string
  originalClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'
  detectedClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'
  driftDetectedAt: string
  driftReason: string
  reviewRequired: boolean
}

interface SignatureExpiration {
  id: number
  documentName: string
  signedBy: string
  signatureDate: string
  expirationDate: string
  daysUntilExpiry: number
  certificateAuthority: string
  documentId: number
}

export default function ComplianceDashboardPage() {
  const { user: _user, theme } = useAuthStore()

  const [violations, setViolations] = useState<PolicyViolation[]>([])
  const [drifts, setDrifts] = useState<ClassificationDrift[]>([])
  const [expirations, setExpirations] = useState<SignatureExpiration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [violationFilter, setViolationFilter] = useState<string>('all')
  const [driftFilter, setDriftFilter] = useState<string>('all')

  useEffect(() => {
    loadComplianceData()
  }, [])

  const loadComplianceData = async () => {
    setLoading(true)
    setError('')

    try {
      const [violationsRes, driftsRes, expirationsRes] = await Promise.all([
        apiClient.getPolicyViolations(),
        apiClient.getClassificationDrift(),
        apiClient.getSignatureExpirations()
      ])

      setViolations(violationsRes.data || [])
      setDrifts(driftsRes.data || [])
      setExpirations(expirationsRes.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load compliance dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleResolveViolation = async (violationId: number) => {
    const resolution = prompt('Enter resolution notes (max 500 chars, optional):')
    if (resolution !== null && resolution.length > 500) {
      alert('Resolution notes too long. Maximum 500 characters.')
      return
    }

    if (!confirm('Mark this violation as resolved?')) return

    try {
      await apiClient.resolveViolation(violationId)
      setViolations(prev => prev.filter(v => v.id !== violationId))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to resolve violation')
    }
  }

  const handleApproveDrift = async (driftId: number) => {
    const notes = prompt('Enter approval notes (max 500 chars, optional):')
    if (notes !== null && notes.length > 500) {
      alert('Approval notes too long. Maximum 500 characters.')
      return
    }

    if (!confirm('Approve this classification change?')) return

    try {
      await apiClient.approveDrift(driftId)
      setDrifts(prev => prev.filter(d => d.id !== driftId))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve drift')
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

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'STRICTLY_CONFIDENTIAL': return '#ff0000'
      case 'CONFIDENTIAL': return '#ff6b6b'
      case 'INTERNAL': return '#ffa500'
      case 'PUBLIC': return '#4caf50'
      default: return '#888'
    }
  }

  const getExpiryColor = (days: number) => {
    if (days < 0) return '#ff0000' // Expired
    if (days <= 7) return '#ff6b6b' // Critical
    if (days <= 30) return '#ffa500' // Warning
    return '#4caf50' // OK
  }

  // Filter violations
  const filteredViolations = violationFilter === 'all'
    ? violations
    : violations.filter(v => v.resolved === (violationFilter === 'resolved'))

  // Filter drifts
  const filteredDrifts = driftFilter === 'all'
    ? drifts
    : drifts.filter(d => d.reviewRequired === (driftFilter === 'review'))

  if (loading) {
    return <DashboardSkeleton variant="compliance" />
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-message">{error}</div>
        <button onClick={loadComplianceData} className="primary" style={{ marginTop: '20px' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Compliance Dashboard</h1>
          <p style={{ color: '#888', marginTop: '8px' }}>
            Policy Enforcement & Data Governance
          </p>
        </div>
      </div>

      {/* Policy Violations */}
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Policy Violations ({filteredViolations.length})</h3>
          <select
            value={violationFilter}
            onChange={(e) => setViolationFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              background: theme === 'dark' ? '#2a2a2a' : '#fff',
              color: theme === 'dark' ? '#fff' : '#000'
            }}
          >
            <option value="all">All Violations</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {filteredViolations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredViolations.slice(0, 15).map((violation) => (
              <div
                key={violation.id}
                style={{
                  padding: '12px',
                  background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${getSeverityColor(violation.severity)}`,
                  opacity: violation.resolved ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '600', color: getSeverityColor(violation.severity) }}>
                        {violation.policyName}
                      </span>
                      {violation.resolved && (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7em',
                          background: '#4caf50',
                          color: 'white',
                          fontWeight: '600'
                        }}>
                          RESOLVED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.9em', marginTop: '6px' }}>
                      Type: {violation.violationType}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                      {violation.details}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#888', marginTop: '6px' }}>
                      {violation.violator} ({violation.department}) • {new Date(violation.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75em',
                      fontWeight: '600',
                      background: getSeverityColor(violation.severity),
                      color: 'white'
                    }}>
                      {violation.severity}
                    </span>
                    {!violation.resolved && (
                      <button
                        onClick={() => handleResolveViolation(violation.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85em'
                        }}
                        title="Mark as resolved"
                      >
                        ✓ Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ color: '#4caf50' }}>
            No policy violations - excellent compliance!
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Classification Drift */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Classification Drift ({filteredDrifts.length})</h3>
            <select
              value={driftFilter}
              onChange={(e) => setDriftFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
              }}
            >
              <option value="all">All Drifts</option>
              <option value="review">Requires Review</option>
            </select>
          </div>

          {filteredDrifts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredDrifts.slice(0, 10).map((drift) => (
                <div
                  key={drift.id}
                  style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                    borderRadius: '6px'
                  }}
                >
                  <div style={{ fontWeight: '500', marginBottom: '8px' }}>
                    {drift.documentName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75em',
                      fontWeight: '600',
                      background: getClassificationColor(drift.originalClassification) + '33',
                      color: getClassificationColor(drift.originalClassification)
                    }}>
                      {drift.originalClassification.replace('_', ' ')}
                    </span>
                    <span style={{ color: '#888' }}>→</span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75em',
                      fontWeight: '600',
                      background: getClassificationColor(drift.detectedClassification) + '33',
                      color: getClassificationColor(drift.detectedClassification)
                    }}>
                      {drift.detectedClassification.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '8px' }}>
                    Reason: {drift.driftReason}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '10px' }}>
                    Detected: {new Date(drift.driftDetectedAt).toLocaleString()}
                  </div>
                  {drift.reviewRequired && (
                    <button
                      onClick={() => handleApproveDrift(drift.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85em'
                      }}
                      title="Approve classification change"
                    >
                      ✓ Approve Change
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No classification drift detected</div>
          )}
        </div>

        {/* Signature Expirations */}
        <div className="dashboard-card">
          <h3>Signature Expirations ({expirations.length})</h3>
          {expirations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {expirations
                .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
                .slice(0, 10)
                .map((sig) => (
                  <div
                    key={sig.id}
                    style={{
                      padding: '12px',
                      background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${getExpiryColor(sig.daysUntilExpiry)}`
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '6px' }}>
                      {sig.documentName}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>
                      Signed by: {sig.signedBy} • CA: {sig.certificateAuthority}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '8px' }}>
                      Signature Date: {new Date(sig.signatureDate).toLocaleDateString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '0.8em',
                        fontWeight: '600',
                        background: getExpiryColor(sig.daysUntilExpiry),
                        color: 'white'
                      }}>
                        {sig.daysUntilExpiry < 0
                          ? `Expired ${Math.abs(sig.daysUntilExpiry)} days ago`
                          : sig.daysUntilExpiry === 0
                          ? 'Expires today'
                          : `${sig.daysUntilExpiry} days remaining`}
                      </span>
                      <span style={{ fontSize: '0.75em', color: '#888' }}>
                        Exp: {new Date(sig.expirationDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="empty-state">No signature expirations</div>
          )}
        </div>
      </div>

      {/* Compliance Summary Stats */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="dashboard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: '700', color: violations.filter(v => !v.resolved).length > 0 ? '#ff6b6b' : '#4caf50' }}>
            {violations.filter(v => !v.resolved).length}
          </div>
          <div style={{ fontSize: '0.9em', color: '#888', marginTop: '8px' }}>
            Unresolved Violations
          </div>
        </div>

        <div className="dashboard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: '700', color: drifts.filter(d => d.reviewRequired).length > 0 ? '#ffa500' : '#4caf50' }}>
            {drifts.filter(d => d.reviewRequired).length}
          </div>
          <div style={{ fontSize: '0.9em', color: '#888', marginTop: '8px' }}>
            Drifts Requiring Review
          </div>
        </div>

        <div className="dashboard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: '700', color: expirations.filter(e => e.daysUntilExpiry <= 7).length > 0 ? '#ff6b6b' : '#4caf50' }}>
            {expirations.filter(e => e.daysUntilExpiry <= 7).length}
          </div>
          <div style={{ fontSize: '0.9em', color: '#888', marginTop: '8px' }}>
            Signatures Expiring Soon
          </div>
        </div>

        <div className="dashboard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: '700', color: '#007bff' }}>
            {((violations.filter(v => v.resolved).length / Math.max(violations.length, 1)) * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '0.9em', color: '#888', marginTop: '8px' }}>
            Compliance Rate
          </div>
        </div>
      </div>
    </div>
  )
}
