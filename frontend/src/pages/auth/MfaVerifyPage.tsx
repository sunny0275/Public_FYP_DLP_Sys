import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

export default function MfaVerifyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((state: any) => state.setAuth)
  const MAX_ATTEMPTS = 5

  // Get credentials from sessionStorage (set by LoginPage) or navigation state
  const [credentials, setCredentials] = useState<{ accountId: string; password: string } | null>(null)

  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)

  useEffect(() => {
    // Try to get credentials from sessionStorage first, then location.state
    const pendingLogin = sessionStorage.getItem('pending-login')
    if (pendingLogin) {
      try {
        const parsed = JSON.parse(pendingLogin)
        setCredentials(parsed)
      } catch (e) {
        console.error('Failed to parse pending-login from sessionStorage:', e)
      }
    } else if (location.state) {
      const { accountId, password } = location.state as { accountId?: string; password?: string }
      if (accountId && password) {
        setCredentials({ accountId, password })
      }
    }

    // Redirect to login if no credentials found
    if (!credentials && !pendingLogin && !location.state) {
      navigate('/login')
    }
  }, [navigate, location.state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (attemptsLeft <= 0) return
    setLoading(true)
    setError('')

    // Validate MFA code format
    if (!/^\d{6}$/.test(mfaCode)) {
      setError('Please enter a valid 6-digit code')
      setLoading(false)
      return
    }

    if (!credentials) {
      setError('Unable to retrieve login details. Please log in again.')
      setLoading(false)
      navigate('/login')
      return
    }

    try {
      // Resend login request with MFA code
      const response = await apiClient.login({
        accountId: credentials.accountId,
        password: credentials.password,
        mfaCode
      })

      const loginData = response.data

      // Check if we got tokens (successful MFA verification)
      if (loginData.accessToken && loginData.refreshToken) {
        // Store authentication
        setAuth(
          {
            userId: loginData.userId,
            accountId: loginData.accountId,
            email: loginData.email,
            fullName: loginData.fullName,
            department: loginData.department,
            position: loginData.position,
            roles: loginData.roles || [],
            availableDashboards: loginData.availableDashboards || [],
            firstLogin: loginData.firstLogin,
            passwordChangeRequired: loginData.passwordChangeRequired,
            mfaEnabled: loginData.mfaEnabled,
            mfaRequired: loginData.mfaRequired
          },
          loginData.accessToken,
          loginData.refreshToken
        )

        // Clear pending login from sessionStorage
        sessionStorage.removeItem('pending-login')

        // NOTE: setAccountId is now called inside authStore.setAuth() automatically
        // See: frontend/src/store/authStore.ts - setAuth function

        // Role-based redirect: only ADMIN goes to the admin dashboard
        const roles: string[] = loginData.roles || []
        console.log('MFA verification successful - User roles:', roles)
        
        // Check for ADMIN explicitly
        const isAdmin = roles.includes('ADMIN')
        console.log('Is admin?', isAdmin)
        
        if (isAdmin) {
          console.log('Redirecting ADMIN to /dashboard/admin')
          navigate('/dashboard/admin', { replace: true })
        } else {
          console.log('Redirecting non-admin user to /home')
          navigate('/home', { replace: true })
        }
      } else {
        setAttemptsLeft((prev) => {
          const next = prev - 1
          if (next <= 0) {
            setError('Too many failed attempts. Please go back to login and try again later.')
          } else {
            setError(`Invalid verification code. Attempts left: ${next}`)
          }
          return next
        })
      }
    } catch (err: any) {
      console.error('MFA verification error:', err)
      // If backend locked the account, stop further attempts on this page.
      if (err.response?.status === 403) {
        setAttemptsLeft(0)
        setError(err.response?.data?.message || 'Account locked. Please try again later.')
      } else {
        setAttemptsLeft((prev) => {
          const next = prev - 1
          const msg = err.response?.data?.message || err.response?.data?.error || 'Invalid verification code'
          if (next <= 0) {
            setError('Too many failed attempts. Please go back to login and try again later.')
          } else {
            setError(`${msg} (Attempts left: ${next})`)
          }
          return next
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    sessionStorage.removeItem('pending-login')
    useAuthStore.getState().clearAuth()
    navigate('/login', { replace: true })
  }

  if (!credentials) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="container">
      <div className="form-container">
        <h2>Two-Factor Authentication</h2>
        <p style={{ marginBottom: '20px', color: '#888' }}>
          Enter the 6-digit code from your authenticator app
        </p>

        <div style={{
          padding: '15px',
          background: '#f0f7ff',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #d0e7ff'
        }}>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#0066cc' }}>
            <strong>Account:</strong> {credentials.accountId}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="mfaCode">Verification Code</label>
            <input
              id="mfaCode"
              name="mfaCode"
              type="text"
              value={mfaCode}
              onChange={(e) => {
                // Only allow digits
                const value = e.target.value.replace(/\D/g, '')
                if (value.length <= 6) {
                  setMfaCode(value)
                  setError('')
                }
              }}
              required
              autoFocus
              placeholder="000000"
              maxLength={6}
              pattern="\d{6}"
              disabled={attemptsLeft <= 0 || loading}
              style={{
                fontSize: '1.5em',
                letterSpacing: '0.5em',
                textAlign: 'center',
                fontFamily: 'monospace'
              }}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="primary" disabled={loading || mfaCode.length !== 6 || attemptsLeft <= 0}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={handleBack}
            style={{
              marginTop: '10px',
              background: 'transparent',
              color: '#666',
              border: '1px solid #ddd'
            }}
          >
            Back to Login
          </button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '0.85em', color: '#888', textAlign: 'center' }}>
          <p>Can't access your authenticator app?</p>
          <p style={{ marginTop: '8px' }}>
            Contact your system administrator for assistance.
          </p>
        </div>
      </div>
    </div>
  )
}
