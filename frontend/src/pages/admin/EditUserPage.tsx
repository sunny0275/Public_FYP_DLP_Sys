import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiClient } from '../../api'

// Valid roles only: ADMIN, MANAGER, REVIEWER, EMPLOYEE
const AVAILABLE_ROLES = ['EMPLOYEE', 'REVIEWER', 'MANAGER', 'ADMIN']

export default function EditUserPage() {
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    department: '',
    roles: [] as string[],
    accountEnabled: true
  })

  useEffect(() => {
    loadUser()
    loadDepartments()
  }, [userId])

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

  const loadUser = async () => {
    if (!userId) {
      setError('Invalid user ID')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getUserById(parseInt(userId))
      const user = response.data

      setFormData({
        email: user.email || '',
        fullName: user.fullName || '',
        department: user.department || '',
        roles: user.roles || [],
        accountEnabled: user.accountEnabled ?? true
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      await apiClient.updateUser(parseInt(userId!), formData)
      navigate('/admin')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: [role]
    }))
  }

  if (loading) {
    return (
      <div className="container">
        <h2>Loading user...</h2>
      </div>
    )
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Edit User</h1>
        <button onClick={() => navigate('/admin')}>
          Back to Admin Panel
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} style={{
        maxWidth: '800px',
        padding: '20px',
        background: '#f8f9fa',
        border: '1px solid #ddd',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
              {AVAILABLE_ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={formData.accountEnabled}
                onChange={(e) => setFormData({ ...formData, accountEnabled: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              Account Enabled
            </label>
            <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
              Disabled accounts cannot login
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            className="primary"
            disabled={saving || formData.roles.length !== 1}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
