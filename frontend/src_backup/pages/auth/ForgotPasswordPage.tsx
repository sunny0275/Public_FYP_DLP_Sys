import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [accountId, setAccountId] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!accountId.trim() || !email.trim()) {
      setError('Please provide both Account ID and Email')
      return
    }

    setLoading(true)
    setError('')

    try {
      await apiClient.forgotPassword(accountId.trim(), email.trim())
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="container">
        <div className="auth-form">
          <h2>Password Reset Request Submitted</h2>
          <div style={{
            padding: '20px',
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '8px',
            marginBottom: '20px',
            color: '#155724'
          }}>
            <h3 style={{ marginTop: 0 }}>✓ Request Received</h3>
            <p>
              Your password reset request has been submitted successfully.
            </p>
            <p>
              An administrator will review your request and contact you with a temporary password
              via your registered email address.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>What happens next:</strong>
              <ul style={{ marginTop: '10px' }}>
                <li>Admin reviews your identity verification</li>
                <li>Admin resets your password to a temporary value</li>
                <li>You'll receive the temporary password securely</li>
                <li>Use the temporary password to login and set a new password</li>
              </ul>
            </p>
          </div>
          <p style={{ color: '#888', fontSize: '14px' }}>
            This process typically takes 1-2 business days. If urgent, please contact your IT department directly.
          </p>
          <button onClick={() => navigate('/login')} className="primary">
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="auth-form">
        <h2>Forgot Password</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Submit a password reset request. An administrator will review and contact you with a temporary password.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="accountId">Account ID</label>
            <input
              id="accountId"
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Enter your account ID"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
            />
            <small style={{ color: '#888', fontSize: '13px' }}>
              This must match the email address registered with your account
            </small>
          </div>

          <div style={{
            padding: '15px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            <strong>⚠️ Important:</strong>
            <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
              <li>Password reset requests are reviewed manually by administrators</li>
              <li>You'll be contacted via your registered email</li>
              <li>Processing time: 1-2 business days</li>
              <li>For urgent issues, contact IT support directly</li>
            </ul>
          </div>

          <button type="submit" className="primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Reset Request'}
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer' }}
            >
              ← Back to Login
            </button>
          </div>
        </form>

        <div style={{
          marginTop: '30px',
          padding: '15px',
          background: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#666'
        }}>
          <strong>Security Notice:</strong> For your security, password resets require administrator
          approval. If you didn't request this reset, please contact your security team immediately.
        </div>
      </div>
    </div>
  )
}
