import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { getPreferredDashboardPath } from '../../utils/dashboardPaths'
import PasswordInput from '../../components/PasswordInput'

export default function PeriodicPasswordChangePage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
    setSuccess('')
  }

  const validatePassword = (password: string): string[] => {
    const errors: string[] = []

    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long')
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one digit')
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match')
      setLoading(false)
      return
    }

    const validationErrors = validatePassword(formData.newPassword)
    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '))
      setLoading(false)
      return
    }

    try {
      await apiClient.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword
      })

      updateUser({
        passwordChangeRequired: false
      })

      setSuccess('Password updated successfully! Redirecting...')

      setTimeout(() => {
        navigate(getPreferredDashboardPath(user) || '/dashboard', { replace: true })
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Password change failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="form-container">
        <h2>Update Password</h2>
        <p style={{ marginBottom: '20px', color: '#888' }}>
          Your password has expired. Please update it to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <PasswordInput
            id="currentPassword"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            required
            autoFocus
            placeholder="Enter current password"
            label="Current Password"
          />

          <PasswordInput
            id="newPassword"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            required
            placeholder="Enter new password"
            label="New Password"
          />

          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            placeholder="Confirm new password"
            label="Confirm New Password"
          />

          <div className="info-message" style={{ textAlign: 'left', marginTop: '10px' }}>
            <strong>Password requirements:</strong>
            <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
              <li>At least 12 characters long</li>
              <li>At least one uppercase letter</li>
              <li>At least one lowercase letter</li>
              <li>At least one digit</li>
              <li>At least one special character</li>
            </ul>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
