import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import LLMTuningTab from './LLMTuningTab'
import UebaTuningTab from './UebaTuningTab'
import { useAuthStore } from '../../store/authStore'
import './AdminPage.css'

interface User {
  id: number
  accountId: string
  email: string
  fullName: string
  department: string
  roles: string[]
  mfaEnabled: boolean
  accountEnabled: boolean
  accountLocked: boolean
  lastLoginAt: string | null
  passwordExpiryDate: string
  createdAt: string
  deletedAt?: string | null
}

type AdminTab = 'users' | 'llm' | 'ueba' | 'security'
type SecurityTab = 'blocked-ips' | 'ip-policies'

export default function AdminPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showWipeModal, setShowWipeModal] = useState(false)
  const [wipeConfirmText, setWipeConfirmText] = useState('')
  const [wipeDeleteFiles, setWipeDeleteFiles] = useState(true)
  const [wiping, setWiping] = useState(false)
  const [initialPassword, setInitialPassword] = useState<string | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [accountIdPreview, setAccountIdPreview] = useState<string>('')
  const [resettingUebaUserId, setResettingUebaUserId] = useState<number | null>(null)
  const [incidentRunning, setIncidentRunning] = useState(false)
  const [pendingShareApprovals, setPendingShareApprovals] = useState<any[]>([])
  const [pendingShareTotal, setPendingShareTotal] = useState(0)
  const [pendingShareLoading, setPendingShareLoading] = useState(false)
  const [approvingShareId, setApprovingShareId] = useState<number | null>(null)
  const [rejectingShareId, setRejectingShareId] = useState<number | null>(null)
  const [showRejectShareModal, setShowRejectShareModal] = useState(false)
  const [rejectTargetShare, setRejectTargetShare] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectCorrectedLevel, setRejectCorrectedLevel] = useState<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'>('CONFIDENTIAL')
  const [userQuery, setUserQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED' | 'LOCKED'>('ALL')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [securitySubTab, setSecuritySubTab] = useState<SecurityTab>('blocked-ips')
  const [formData, setFormData] = useState({
    accountId: '',
    email: '',
    fullName: '',
    department: '',
    // Default to lowest-privilege business role
    roles: ['EMPLOYEE']
  })

  useEffect(() => {
    loadUsers()
    loadDepartments()
    loadPendingShareApprovals()
  }, [])

  useEffect(() => {
    const dept = formData.department
    const role = formData.roles[0] || 'EMPLOYEE'
    if (!dept || !role) {
      setAccountIdPreview('')
      setFormData(prev => ({ ...prev, accountId: '' }))
      return
    }

    const t = window.setTimeout(async () => {
      try {
        const res = await apiClient.getNextAccountId(dept, role)
        const nextId = res.data.accountId
        setAccountIdPreview(nextId)
        setFormData(prev => ({ ...prev, accountId: nextId }))
      } catch {
        setAccountIdPreview('')
        setFormData(prev => ({ ...prev, accountId: '' }))
      }
    }, 250)

    return () => window.clearTimeout(t)
  }, [formData.department, formData.roles])

  const loadDepartments = async () => {
    try {
      const response = await apiClient.getDepartments()
      setDepartments(response.data || [])
    } catch (err: any) {
      console.error('Failed to load departments:', err)
      // Fallback to default departments if API fails
      setDepartments(['IT Department', 'Finance', 'HR'])
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.getAllUsers()
      // Filter out archived identities (archived_*) and logically deleted accounts (deletedAt is set)
      const visibleUsers = (response.data || []).filter((u: User) =>
        !u.accountId.startsWith('archived_') && !u.deletedAt
      )
      setUsers(visibleUsers)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const loadPendingShareApprovals = async () => {
    setPendingShareLoading(true)
    try {
      const response = await apiClient.getPendingShareApprovals(0, 8)
      const pageData = response.data || { content: [], totalElements: 0 }
      setPendingShareApprovals(pageData.content || [])
      setPendingShareTotal(pageData.totalElements || 0)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load pending share approvals')
      setPendingShareApprovals([])
      setPendingShareTotal(0)
    } finally {
      setPendingShareLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInitialPassword(null)

    try {
      // Uniqueness is enforced by backend (includes logically deleted users)
      const response = await apiClient.createUser(formData)

      // Show initial password (ONE-TIME DISPLAY)
      if (response.data.initialPassword) {
        setInitialPassword(response.data.initialPassword)
      }

      // Reset form and reload users
      setFormData({
        accountId: '',
        email: '',
        fullName: '',
        department: '',
        roles: ['EMPLOYEE']
      })
      setAccountIdPreview('')
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user')
    }
  }

  const handleUnlock = async (userId: number) => {
    try {
      await apiClient.unlockUser(userId)
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to unlock user')
    }
  }

  const handleDisable = async (userId: number) => {
    if (!confirm('Are you sure you want to disable this user?')) return
    try {
      await apiClient.disableUser(userId)
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disable user')
    }
  }

  const handleEnable = async (userId: number) => {
    try {
      await apiClient.enableUser(userId)
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to enable user')
    }
  }

  const handleIncidentWorkflow = async (user: User) => {
    if (!confirm(`Run incident workflow for ${user.accountId}?\n\nThis will revoke their encryption key, force a password change, and create a security alert.`)) {
      return
    }
    setIncidentRunning(true)
    setError('')
    try {
      await apiClient.adminRevokeForceResetAndAlert(user.id, `Incident workflow triggered for ${user.accountId}`)
      alert('Incident workflow executed:\n- Key revoked\n- Password change required\n- Security alert logged')
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to execute incident workflow')
    } finally {
      setIncidentRunning(false)
    }
  }

  const handleResetPassword = async (userId: number) => {
    if (!confirm('Are you sure you want to change this user\'s password?\n\nA new random temporary password will be generated and shown once, and the user must change it on next login.')) return
    setError('')
    setInitialPassword(null)

    try {
      const response = await apiClient.resetUserPassword(userId)

      // Show temporary password (ONE-TIME DISPLAY)
      if (response.data.temporaryPassword) {
        setInitialPassword(response.data.temporaryPassword)
      }

      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password')
    }
  }

  const handleResetUebaScore = async (user: User) => {
    const shouldEnable = !user.accountEnabled
      ? confirm(`User ${user.accountId} is disabled. Re-enable account while resetting UEBA score?`)
      : false
    if (!confirm(`Reset UEBA score to 100 for ${user.accountId}?`)) return

    setResettingUebaUserId(user.id)
    setError('')
    try {
      await apiClient.resetUserUebaScore(user.id, shouldEnable)
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset UEBA score for selected user')
    } finally {
      setResettingUebaUserId(null)
    }
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this user account?\n\nThe account must already be disabled. This operation cannot be undone.')) return
    setError('')

    try {
      const response = await apiClient.deleteUser(userId)
      // If backend sends a specific message, show it
      if (response.message) {
        alert(response.message)
      }
      await loadUsers()
    } catch (err: any) {
      const apiMessage = err.response?.data?.message
      const apiDetails = err.response?.data?.details
      const friendly =
        apiDetails ||
        apiMessage ||
        'Failed to delete account. Make sure the user is disabled and not the last ADMIN.'
      setError(friendly)
    }
  }

  const handleRoleChange = (role: string) => {
    setFormData(prev => ({ ...prev, roles: [role] }))
  }

  const handleWipeDocuments = async () => {
    setError('')
    setWiping(true)
    try {
      await apiClient.wipeDocumentLibrary('WIPE_DOCUMENTS', wipeDeleteFiles)
      alert(
        'Document Library has been reset (database cleared'
          + (wipeDeleteFiles ? ', uploads files deleted).' : ').')
      )
      setShowWipeModal(false)
      setWipeConfirmText('')
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Reset Document Library failed')
    } finally {
      setWiping(false)
    }
  }

  const handleApprovePendingShare = async (shareId: number) => {
    setApprovingShareId(shareId)
    setError('')
    try {
      await apiClient.approveShareLink(shareId)
      await loadPendingShareApprovals()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve share link')
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

  const handleRejectPendingShare = async () => {
    if (!rejectTargetShare?.id) return
    setRejectingShareId(rejectTargetShare.id)
    setError('')
    try {
      await apiClient.rejectShareLink(rejectTargetShare.id, {
        reason: rejectReason || undefined,
        correctedClassificationLevel: rejectCorrectedLevel
      })
      setShowRejectShareModal(false)
      setRejectTargetShare(null)
      await loadPendingShareApprovals()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject share link')
    } finally {
      setRejectingShareId(null)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <h2>Loading users...</h2>
      </div>
    )
  }

  const tabStyle = (tab: AdminTab) => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: activeTab === tab ? '3px solid #2196f3' : '3px solid transparent',
    background: activeTab === tab ? (theme === 'dark' ? '#333' : '#f0f7ff') : 'transparent',
    color: theme === 'dark' ? '#fff' : '#333',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? 600 : 400,
    fontSize: '15px'
  })

  const rolesSet = Array.from(new Set(users.flatMap((u) => u.roles || []))).sort()
  const filteredUsers = users.filter((u) => {
    const q = userQuery.trim().toLowerCase()
    const queryMatched = !q
      || u.accountId?.toLowerCase().includes(q)
      || u.fullName?.toLowerCase().includes(q)
      || u.email?.toLowerCase().includes(q)
      || u.department?.toLowerCase().includes(q)
    const statusMatched = statusFilter === 'ALL'
      || (statusFilter === 'LOCKED' && u.accountLocked)
      || (statusFilter === 'DISABLED' && !u.accountEnabled)
      || (statusFilter === 'ACTIVE' && u.accountEnabled && !u.accountLocked)
    const roleMatched = roleFilter === 'ALL' || (u.roles || []).includes(roleFilter)
    return queryMatched && statusMatched && roleMatched
  })

  const activeCount = users.filter((u) => u.accountEnabled && !u.accountLocked).length
  const lockedCount = users.filter((u) => u.accountLocked).length
  const disabledCount = users.filter((u) => !u.accountEnabled).length

  return (
    <div className="container admin-page-shell">
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Admin Panel</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/admin/blockchain-health')}>
            Blockchain Health
          </button>
          <button onClick={() => navigate('/classification/review')}>
            Classification Review
          </button>
          <button onClick={() => navigate('/ueba/users')}>
            UEBA Users
          </button>
          <button onClick={() => navigate('/admin/blocked-ips')}>
            Blocked IPs
          </button>
          <button onClick={() => navigate('/dashboard/admin')}>
            Back to Dashboard
          </button>
        </div>
      </div>

      <div
        style={{
          marginBottom: '16px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
          background: theme === 'dark' ? '#1f1f1f' : '#f8f9fa'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600 }}>
            Pending Share Approvals ({pendingShareTotal})
          </div>
          <button
            onClick={loadPendingShareApprovals}
            disabled={pendingShareLoading}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: 'none',
              background: pendingShareLoading ? '#999' : '#1976d2',
              color: '#fff',
              cursor: pendingShareLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {pendingShareLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
          {pendingShareApprovals.length === 0 ? (
            <div style={{ fontSize: '13px', color: theme === 'dark' ? '#ccc' : '#666' }}>
              No pending share approvals.
            </div>
          ) : (
            pendingShareApprovals.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: '6px',
                  background: theme === 'dark' ? '#2a2a2a' : '#fff',
                  border: `1px solid ${theme === 'dark' ? '#3a3a3a' : '#eee'}`
                }}
              >
                <div style={{ fontSize: '13px' }}>
                  <div><strong>{s.documentName || `Document #${s.documentId}`}</strong></div>
                  <div style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                    Creator: {s.creatorName || 'Unknown'} · Type: {s.shareType} · Permission: {s.permission}
                  </div>
                  <div style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                    Current Level: {s.documentClassificationLevel || 'N/A'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openRejectShareModal(s)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#c62828',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprovePendingShare(s.id)}
                    disabled={approvingShareId === s.id}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#2e7d32',
                      color: '#fff',
                      cursor: approvingShareId === s.id ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {approvingShareId === s.id ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
        marginBottom: '20px'
      }}>
        <button type="button" style={tabStyle('users')} onClick={() => setActiveTab('users')}>
          Users &amp; Orgs
        </button>
        <button type="button" style={tabStyle('llm')} onClick={() => setActiveTab('llm')}>
          LLM Tuning
        </button>
        <button type="button" style={tabStyle('ueba')} onClick={() => setActiveTab('ueba')}>
          UEBA Tuning
        </button>
        <button type="button" style={tabStyle('security')} onClick={() => { setActiveTab('security'); setSecuritySubTab('blocked-ips'); }}>
          Security
        </button>
      </div>

      {activeTab === 'security' && (
        <div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setSecuritySubTab('blocked-ips')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: securitySubTab === 'blocked-ips' ? '2px solid #dc3545' : '2px solid transparent',
                background: 'transparent',
                color: securitySubTab === 'blocked-ips' ? '#dc3545' : '#666',
                cursor: 'pointer',
                fontWeight: securitySubTab === 'blocked-ips' ? 600 : 400,
                fontSize: '14px'
              }}
            >
              Blocked IPs
            </button>
          </div>
          {securitySubTab === 'blocked-ips' && <BlockedIpsEmbed />}
        </div>
      )}

      {activeTab === 'llm' && <LLMTuningTab />}

      {activeTab === 'ueba' && <UebaTuningTab />}

      {activeTab === 'users' && (
        <>
      <div className="admin-summary-grid">
        <div className="admin-summary-card">
          <div className="admin-summary-label">Total Users</div>
          <div className="admin-summary-value">{users.length}</div>
        </div>
        <div className="admin-summary-card">
          <div className="admin-summary-label">Active</div>
          <div className="admin-summary-value" style={{ color: '#2e7d32' }}>{activeCount}</div>
        </div>
        <div className="admin-summary-card">
          <div className="admin-summary-label">Locked</div>
          <div className="admin-summary-value" style={{ color: '#c62828' }}>{lockedCount}</div>
        </div>
        <div className="admin-summary-card">
          <div className="admin-summary-label">Disabled</div>
          <div className="admin-summary-value" style={{ color: '#ef6c00' }}>{disabledCount}</div>
        </div>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>User Management</h2>
        <div>
          <button
            onClick={() => setShowWipeModal(true)}
            style={{
              marginRight: '10px',
              background: '#dc3545',
              color: '#fff',
              border: 'none'
            }}
          >
            Reset Document Library
          </button>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="primary">
            {showCreateForm ? 'Cancel' : 'Create New User'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Reset Document Library Modal */}
      {showWipeModal && (
        <div className="modal-overlay" onClick={() => !wiping && setShowWipeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>Reset Document Library</h2>
              <button className="modal-close" onClick={() => !wiping && setShowWipeModal(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ padding: '12px', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '8px' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px', color: '#856404' }}>
                  ⚠️ Dangerous operation (cannot be undone)
                </div>
                <div style={{ fontSize: '13px', color: '#856404', lineHeight: 1.5 }}>
                  This will remove all document-related data (documents / signatures / share links / upload jobs / workflow tasks, etc.).
                  {wipeDeleteFiles ? ' It will also delete files in the uploads folder.' : ' (Uploads files will be kept.)'}
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={wipeDeleteFiles}
                    onChange={(e) => setWipeDeleteFiles(e.target.checked)}
                    disabled={wiping}
                  />
                  Also delete uploads files (deleteFiles=true)
                </label>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700 }}>
                  Type <span style={{ fontFamily: 'monospace' }}>WIPE_DOCUMENTS</span> to confirm
                </label>
                <input
                  type="text"
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value)}
                  disabled={wiping}
                  placeholder="WIPE_DOCUMENTS"
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => !wiping && setShowWipeModal(false)} disabled={wiping}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={handleWipeDocuments}
                disabled={wiping || wipeConfirmText !== 'WIPE_DOCUMENTS'}
                style={{ background: '#dc3545' }}
              >
                {wiping ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initial/Temporary Password Display (ONE-TIME ONLY) */}
      {initialPassword && (
        <div style={{
          padding: '20px',
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, color: '#856404' }}>⚠️ IMPORTANT: Save This Password</h3>
          <p style={{ marginBottom: '10px' }}>
            The temporary password is shown below. <strong>This will only be displayed once.</strong>
          </p>
          <div style={{
            padding: '15px',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '18px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            textAlign: 'center'
          }}>
            {initialPassword}
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(initialPassword)
                alert('Password copied to clipboard!')
              } catch (err) {
                // Fallback for older browsers
                const textarea = document.createElement('textarea')
                textarea.value = initialPassword
                textarea.style.position = 'fixed'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.select()
                try { document.execCommand('copy') } catch {}
                document.body.removeChild(textarea)
                alert('Password copied to clipboard!')
              }
            }}
            style={{ marginTop: '10px' }}
            className="primary"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={() => setInitialPassword(null)}
            style={{ marginTop: '10px', marginLeft: '10px' }}
          >
            Clear (I've saved it)
          </button>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <div style={{
          padding: '20px',
          background: '#f8f9fa',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2>Create New User</h2>
          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label>Account ID (auto-generated)</label>
                <input
                  type="text"
                  value={formData.accountId}
                  readOnly
                  placeholder="Will be generated after selecting Department + Role"
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  Format: <strong>DEPT_ROLE_YEAR_SEQ</strong> (e.g., <strong>IT_EM_2026_001</strong>)
                  {accountIdPreview ? (
                    <> • Next ID: <strong>{accountIdPreview}</strong></>
                  ) : null}
                </div>
              </div>
              <div>
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="e.g., john.doe@company.com"
                />
              </div>
              <div>
                <label>Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  placeholder="e.g., John Doe"
                />
              </div>
              <div>
                <label>Department *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                  style={{
                    padding: '8px',
                    width: '100%',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  <option value="">Select department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Role *</label>
                <select
                  value={formData.roles[0] || 'EMPLOYEE'}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  required
                  style={{
                    padding: '8px',
                    width: '100%',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="REVIEWER">REVIEWER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <button type="submit" className="primary">Create User</button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{ marginLeft: '10px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="admin-users-filter-row">
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Search account / name / email / department"
          className="admin-users-search"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="admin-users-select">
          <option value="ALL">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="LOCKED">Locked</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-users-select">
          <option value="ALL">All roles</option>
          {rolesSet.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: '12px', color: '#555', fontSize: '0.9em' }}>
        Showing {filteredUsers.length} / {users.length} users. Built-in `admin` is visible for auditing; profile edit is restricted but password reset is allowed.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-users-table">
          <thead>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left' }}>Account ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Full Name</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Department</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Roles</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>MFA</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, idx) => {
              const isBuiltInAdmin = user.accountId === 'admin'
              return (
              <tr key={user.id} className={idx % 2 === 0 ? 'admin-users-row-even' : 'admin-users-row-odd'}>
                <td style={{ padding: '12px' }}>{user.accountId}</td>
                <td style={{ padding: '12px' }}>{user.fullName}</td>
                <td style={{ padding: '12px' }}>{user.email}</td>
                <td style={{ padding: '12px' }}>{user.department}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    background: user.roles.includes('ADMIN') ? '#ffc107' : '#28a745',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    {user.roles.join(', ')}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {user.mfaEnabled ? '✓' : '✗'}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {user.accountLocked ? (
                    <span className="admin-status-pill admin-status-locked">Locked</span>
                  ) : !user.accountEnabled ? (
                    <span className="admin-status-pill admin-status-disabled">Disabled</span>
                  ) : (
                    <span className="admin-status-pill admin-status-active">Active</span>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                    disabled={isBuiltInAdmin}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      marginRight: '5px',
                      background: isBuiltInAdmin ? '#ccc' : '#6c757d',
                      color: isBuiltInAdmin ? '#666' : '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isBuiltInAdmin ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Edit
                  </button>
                  {user.accountLocked && !isBuiltInAdmin && (
                    <button
                      onClick={() => handleUnlock(user.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        marginRight: '5px',
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Unlock
                    </button>
                  )}
                  {user.accountEnabled ? (
                    <button
                      onClick={() => handleDisable(user.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        marginRight: '5px',
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnable(user.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        marginRight: '5px',
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Enable
                    </button>
                  )}
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      marginRight: '5px',
                      background: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Change Password
                  </button>
                  {!isBuiltInAdmin && (
                    <button
                      onClick={() => handleResetUebaScore(user)}
                      disabled={resettingUebaUserId === user.id}
                      title="Reset UEBA score to 100"
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        marginRight: '5px',
                        background: '#6f42c1',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: resettingUebaUserId === user.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {resettingUebaUserId === user.id ? 'Resetting UEBA...' : 'Reset UEBA'}
                    </button>
                  )}
                  {!isBuiltInAdmin && (
                    <button
                      onClick={() => handleIncidentWorkflow(user)}
                      title="Revoke key + force password change + security alert"
                      disabled={incidentRunning}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        marginRight: '5px',
                        background: '#c82333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: incidentRunning ? 'wait' : 'pointer'
                      }}
                    >
                      Incident: Revoke+Reset
                    </button>
                  )}
                  {!user.accountEnabled && !isBuiltInAdmin && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        background: '#6c757d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No users match current filters.
        </div>
      )}

      {showRejectShareModal && rejectTargetShare && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            padding: 24,
            borderRadius: 8,
            maxWidth: 520,
            width: '100%'
          }}>
            <h3 style={{ marginTop: 0 }}>Reject Share Approval</h3>
            <p>
              Document <strong>{rejectTargetShare.documentName || `#${rejectTargetShare.documentId}`}</strong>
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Correct classification level</label>
              <select
                value={rejectCorrectedLevel}
                onChange={(e) => setRejectCorrectedLevel(e.target.value as any)}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="INTERNAL">INTERNAL</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="STRICTLY_CONFIDENTIAL">STRICTLY_CONFIDENTIAL</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Reject reason (optional)</label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. External sharing policy not satisfied"
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowRejectShareModal(false); setRejectTargetShare(null) }}
                disabled={rejectingShareId === rejectTargetShare.id}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectPendingShare}
                disabled={rejectingShareId === rejectTargetShare.id}
                style={{ background: '#c62828', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: rejectingShareId === rejectTargetShare.id ? 'wait' : 'pointer' }}
              >
                {rejectingShareId === rejectTargetShare.id ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}

// Embedded Blocked IPs component for Admin Security tab
function BlockedIpsEmbed() {
  const { theme } = useAuthStore()

  const [blockedIps, setBlockedIps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unblocking, setUnblocking] = useState<string | null>(null)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [newBlockIp, setNewBlockIp] = useState('')
  const [newBlockReason, setNewBlockReason] = useState('')
  const [blocking, setBlocking] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getBlockedIps()
      const ips = res.data?.blockedIps
      if (ips) {
        const list = Object.values(ips) as any[]
        list.sort((a, b) => new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime())
        setBlockedIps(list)
      } else {
        setBlockedIps([])
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load blocked IPs')
    } finally {
      setLoading(false)
    }
  }

  const handleUnblock = async (ipAddress: string) => {
    if (!confirm(`Unblock IP address ${ipAddress}?`)) return
    setUnblocking(ipAddress)
    try {
      await apiClient.unblockIp(ipAddress)
      alert(`IP ${ipAddress} has been unblocked`)
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unblock IP')
    } finally {
      setUnblocking(null)
    }
  }

  const handleUnblockAll = async () => {
    if (blockedIps.length === 0) { alert('No blocked IPs to unblock'); return }
    if (!confirm(`Unblock ALL ${blockedIps.length} IP address(es)?`)) return
    try {
      const res = await apiClient.unblockAllIps()
      alert(res.data?.message || `Unblocked ${blockedIps.length} IP(s)`)
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unblock IPs')
    }
  }

  const handleBlockIp = async () => {
    if (!newBlockIp.trim()) { alert('Please enter an IP address'); return }
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    const localhostRegex = /^localhost$/i
    if (!ipv4Regex.test(newBlockIp.trim()) && !ipv6Regex.test(newBlockIp.trim()) && !localhostRegex.test(newBlockIp.trim())) {
      alert('Please enter a valid IP address (e.g., 192.168.1.1)')
      return
    }
    setBlocking(true)
    try {
      await apiClient.blockIp(newBlockIp.trim(), newBlockReason.trim() || 'Manual block by admin')
      alert(`IP ${newBlockIp} has been blocked`)
      setNewBlockIp('')
      setNewBlockReason('')
      setShowBlockForm(false)
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to block IP')
    } finally {
      setBlocking(false)
    }
  }

  const cardStyle = (isAlt: boolean) => ({
    background: isAlt
      ? (theme === 'dark' ? '#1e1e1e' : '#fff')
      : (theme === 'dark' ? '#222' : '#f8f9fa'),
    borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`
  })

  return (
    <div>
      {error && <div style={{ padding: '12px 16px', marginBottom: '16px', background: '#ffebee', color: '#c62828', borderRadius: '6px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={load} disabled={loading} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: theme === 'dark' ? '#333' : '#e0e0e0', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button
          onClick={handleUnblockAll}
          disabled={loading || blockedIps.length === 0}
          style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: blockedIps.length === 0 ? '#ccc' : '#dc3545', color: '#fff', cursor: blockedIps.length === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}
        >
          Unblock All ({blockedIps.length})
        </button>
        <button
          onClick={() => setShowBlockForm(!showBlockForm)}
          style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: showBlockForm ? '#6c757d' : '#28a745', color: '#fff', cursor: 'pointer', fontSize: '14px' }}
        >
          {showBlockForm ? 'Cancel' : '+ Block IP Manually'}
        </button>
      </div>

      {showBlockForm && (
        <div style={{
          padding: '16px',
          marginBottom: '16px',
          background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
          border: `1px solid ${theme === 'dark' ? '#444' : '#dee2e6'}`,
          borderRadius: '8px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#888' }}>IP Address *</label>
            <input
              type="text"
              value={newBlockIp}
              onChange={(e) => setNewBlockIp(e.target.value)}
              placeholder="e.g. 192.168.1.1"
              style={{ padding: '8px 12px', border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`, borderRadius: '6px', background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', width: '180px', fontSize: '14px' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#888' }}>Reason (optional)</label>
            <input
              type="text"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              placeholder="Reason for blocking"
              style={{ padding: '8px 12px', border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`, borderRadius: '6px', background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', width: '100%', fontSize: '14px' }}
            />
          </div>
          <button
            onClick={handleBlockIp}
            disabled={blocking || !newBlockIp.trim()}
            style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: blocking ? '#6c757d' : '#dc3545', color: '#fff', cursor: blocking ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600 }}
          >
            {blocking ? 'Blocking...' : 'Block IP'}
          </button>
        </div>
      )}

      {loading && blockedIps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>Loading...</div>
      ) : blockedIps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa', borderRadius: '8px', color: '#888' }}>
          No blocked IPs.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>IP Address</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>Level</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>Frozen Until</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedIps.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    No blocked IPs
                  </td>
                </tr>
              ) : blockedIps.map((ip, index) => (
                <tr key={ip.ipAddress} style={cardStyle(index % 2 === 1)}>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    <code style={{ padding: '2px 6px', background: theme === 'dark' ? '#333' : '#eee', borderRadius: '4px', fontFamily: 'monospace' }}>{ip.ipAddress}</code>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      background: ip.blocked ? '#dc354520' : '#fd7e1420', 
                      color: ip.blocked ? '#dc3545' : '#fd7e14', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      fontWeight: 600 
                    }}>
                      {ip.status || (ip.blocked ? 'PERMANENTLY BLOCKED' : 'FROZEN')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px', color: '#666' }}>
                    {ip.freezeLevelDescription}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    {ip.frozenUntil ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {ip.frozenUntil}
                      </span>
                    ) : ip.blockedAt ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {ip.blockedAt}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleUnblock(ip.ipAddress)}
                      disabled={unblocking === ip.ipAddress}
                      style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', background: unblocking === ip.ipAddress ? '#6c757d' : '#28a745', color: '#fff', cursor: unblocking === ip.ipAddress ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}
                    >
                      {unblocking === ip.ipAddress ? '...' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
