import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'
import PasswordInput from '../../components/PasswordInput'


export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state: any) => state.setAuth)
  const updateUser = useAuthStore((state: any) => state.updateUser)
  const clearAuth = useAuthStore((state: any) => state.clearAuth)

  const [formData, setFormData] = useState({
    accountId: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const accountDisabledReason = searchParams.get('reason') === 'account_disabled'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.login({
        accountId: formData.accountId,
        password: formData.password
      })

      const loginData = response.data

      if (loginData.passwordChangeRequired || loginData.firstLogin) {
        const isPeriodicExpiry = loginData.passwordChangeRequired && loginData.mfaEnabled
        const targetPath = isPeriodicExpiry ? '/update-password' : '/change-password'

        if (loginData.accessToken && loginData.refreshToken) {
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
        } else {
          // Fallback: if no tokens, just update user info
        updateUser({
          userId: loginData.userId,
          accountId: loginData.accountId,
          email: loginData.email,
          fullName: loginData.fullName,
          firstLogin: loginData.firstLogin,
          passwordChangeRequired: loginData.passwordChangeRequired,
          mfaEnabled: loginData.mfaEnabled,
          mfaRequired: loginData.mfaRequired
        })
        }
        navigate(targetPath)
      } else if (loginData.mfaRequired && !loginData.mfaEnabled) {
        // MFA setup required
        if (loginData.accessToken && loginData.refreshToken) {
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
        } else {
          updateUser({
            userId: loginData.userId,
            accountId: loginData.accountId,
            email: loginData.email,
            fullName: loginData.fullName,
            firstLogin: loginData.firstLogin,
            passwordChangeRequired: loginData.passwordChangeRequired,
            mfaEnabled: loginData.mfaEnabled,
            mfaRequired: loginData.mfaRequired
          })
        }
        navigate('/mfa-setup')
      } else if (loginData.mfaRequired && loginData.mfaEnabled) {
        clearAuth()
        sessionStorage.setItem(
          'pending-login',
          JSON.stringify({
            accountId: formData.accountId,
            password: formData.password
          })
        )
        updateUser({
          userId: loginData.userId,
          accountId: loginData.accountId,
          email: loginData.email,
          fullName: loginData.fullName,
          firstLogin: loginData.firstLogin,
          passwordChangeRequired: loginData.passwordChangeRequired,
          mfaEnabled: loginData.mfaEnabled,
          mfaRequired: loginData.mfaRequired
        })
        navigate('/mfa-verify')
      } else if (!loginData.mfaEnabled && (loginData.mfaQrCodeUrl || loginData.mfaSecret)) {
        if (loginData.accessToken && loginData.refreshToken) {
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
              mfaEnabled: false,
              mfaRequired: true
            },
            loginData.accessToken,
            loginData.refreshToken
          )
        }
        navigate('/mfa-setup')
      } else if (loginData.accessToken && loginData.refreshToken) {
        // Successful login - only if password change is NOT required
        console.log('Successful login - navigating to dashboard/home')
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

        // Set accountId in Electron preload for security event reporting
        // This allows Electron main process to include the correct user accountId when sending security events
        // Only call if running in Electron (window.electronAPI is only available in Electron)
        console.log('[LoginPage] Calling setAccountId:', loginData.accountId)
        if (typeof window !== 'undefined' && (window as any).electronAPI?.setAccountId) {
          (window as any).electronAPI.setAccountId(loginData.accountId)
          console.log('[LoginPage] setAccountId called with:', loginData.accountId)
        } else {
          console.log('[LoginPage] electronAPI.setAccountId not available')
        }

        // Show password expiry warning if needed
        if (loginData.passwordExpiringSoon && loginData.daysUntilPasswordExpiry) {
          alert(`Warning: Your password will expire in ${loginData.daysUntilPasswordExpiry} days`)
        }

        // Role-based redirect: only ADMIN goes to the admin dashboard
        const roles: string[] = loginData.roles || []
        console.log('Login successful - User roles:', roles)
        
        // Check for ADMIN explicitly
        const isAdmin = roles.includes('ADMIN')
        console.log('Is admin?', isAdmin)
        
        const redirectByRole = () => {
          if (isAdmin) return '/dashboard/admin'
          return '/dashboard'
        }

        const target = redirectByRole()
        console.log('Redirecting after login to', target)
        navigate(target, { replace: true })
        window.history.replaceState(null, '', target)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="form-container">
        <h2>DLP Platform Login</h2>
        <p style={{ marginBottom: '20px', color: '#888' }}>Enterprise-Level Data Protection System</p>

        {accountDisabledReason && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            color: '#856404',
            fontSize: '0.9em'
          }}>
            <strong>Signed out:</strong> Your account has been disabled due to a UEBA policy violation. Please contact your administrator.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="accountId">Account ID</label>
            <input
              id="accountId"
              name="accountId"
              type="text"
              value={formData.accountId}
              onChange={handleChange}
              required
              autoFocus
              placeholder="Enter your account ID"
            />
          </div>

          <PasswordInput
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Enter your password"
            label="Password"
          />

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Forgot Password?
            </button>
          </div>
        </form>

        <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#888' }}>

        </div>
      </div>
    </div>
  )
}
