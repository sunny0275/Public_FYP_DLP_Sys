import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const updateUser = useAuthStore((state: any) => state.updateUser)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    fullName: ''
  })

  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getMyProfile()
      setProfile(response.data)
      setFormData({
        email: response.data.email,
        fullName: response.data.fullName
      })
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setError('')
    setSuccess('')
    if (profile) {
      setFormData({
        email: profile.email,
        fullName: profile.fullName
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const response = await apiClient.updateMyProfile(formData)

      // Update profile state
      setProfile(response.data)

      // Update auth store with new user info
      updateUser({
        email: response.data.email,
        fullName: response.data.fullName
      })

      setSuccess('Profile updated successfully')
      setIsEditing(false)
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <h2>Loading profile...</h2>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container">
        <div className="error-message">Failed to load profile</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My Profile</h1>
        <button onClick={() => {
          const roles = user?.roles || []
          if (roles.includes('ADMIN')) {
            navigate('/dashboard/admin')
          } else {
            navigate('/home')
          }
        }}>
          Back to Dashboard
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div style={{ padding: '10px', marginBottom: '20px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px', color: '#155724' }}>{success}</div>}

      <div style={{
        background: '#fff',
        padding: '30px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        maxWidth: '600px'
      }}>
        <form onSubmit={handleSubmit}>
          {/* Editable Fields */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Email *
            </label>
            {isEditing ? (
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="Enter your email"
              />
            ) : (
              <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                {profile.email}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Full Name *
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder="Enter your full name"
              />
            ) : (
              <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                {profile.fullName}
              </div>
            )}
          </div>

          {/* Read-Only Fields */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#6c757d' }}>
              Account ID (Read-Only)
            </label>
            <div style={{ padding: '10px', background: '#e9ecef', borderRadius: '4px', color: '#6c757d' }}>
              {profile.accountId}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#6c757d' }}>
              Department (Read-Only)
            </label>
            <div style={{ padding: '10px', background: '#e9ecef', borderRadius: '4px', color: '#6c757d' }}>
              {profile.department}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#6c757d' }}>
              Roles (Read-Only)
            </label>
            <div style={{ padding: '10px', background: '#e9ecef', borderRadius: '4px', color: '#6c757d' }}>
              {profile.roles.join(', ')}
            </div>
          </div>

          {/* Security Information */}
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
            <h3 style={{ marginBottom: '15px' }}>Security Information</h3>

            <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>MFA Status:</strong>
                <span style={{ marginLeft: '10px', color: profile.mfaEnabled ? '#28a745' : '#dc3545' }}>
                  {profile.mfaEnabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/mfa-setup')}
                style={{ fontSize: '14px' }}
              >
                {profile.mfaEnabled ? 'Re-bind MFA' : 'Setup MFA'}
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <strong>Account Status:</strong>
              <span style={{ marginLeft: '10px', color: profile.accountEnabled ? '#28a745' : '#dc3545' }}>
                {profile.accountLocked ? '🔒 Locked' : profile.accountEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <strong>Password Expires:</strong>
              <span style={{ marginLeft: '10px' }}>
                {new Date(profile.passwordExpiryDate).toLocaleDateString()}
              </span>
            </div>

            {profile.lastLoginAt && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Last Login:</strong>
                <span style={{ marginLeft: '10px' }}>
                  {new Date(profile.lastLoginAt).toLocaleString()}
                </span>
              </div>
            )}

            <div style={{ marginTop: '15px' }}>
              <button
                type="button"
                onClick={() => navigate('/change-password')}
                style={{ width: '100%' }}
              >
                Change Password
              </button>
            </div>

            <div style={{ marginTop: '15px' }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const blob = await apiClient.getActivityReport()
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `my-activity-report-${new Date().toISOString().slice(0, 10)}.csv`
                    a.click()
                    window.URL.revokeObjectURL(url)
                  } catch (e: any) {
                    setError(e.response?.data?.message || e.response?.data?.error || 'Failed to download activity report')
                  }
                }}
                style={{ width: '100%' }}
              >
                Download activity report (CSV)
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
            {isEditing ? (
              <>
                <button
                  type="submit"
                  className="primary"
                  disabled={saving}
                  style={{ marginRight: '10px' }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="primary"
                style={{ width: '100%' }}
              >
                Edit Profile
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: '15px', fontSize: '0.9em', color: '#6c757d' }}>
          <strong>Note:</strong> Department, position, and roles can only be modified by administrators.
          To update these fields, please contact your system administrator.
        </div>
      </div>
    </div>
  )
}
