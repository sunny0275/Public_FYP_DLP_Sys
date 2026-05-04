import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { QRCodeSVG } from 'qrcode.react'

interface MfaData {
  secret: string
  qrCodeImage?: string
  qrCodeUrl?: string
}

const MFA_SETUP_SESSION_KEY = 'mfa-setup-session'
const MFA_SETUP_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

function isMfaSetupSessionValid(): boolean {
  const timestamp = sessionStorage.getItem(MFA_SETUP_SESSION_KEY)
  if (!timestamp) return false
  const elapsed = Date.now() - parseInt(timestamp, 10)
  return elapsed < MFA_SETUP_TIMEOUT_MS
}

function startMfaSetupSession(): void {
  sessionStorage.setItem(MFA_SETUP_SESSION_KEY, Date.now().toString())
}

function clearMfaSetupSession(): void {
  sessionStorage.removeItem(MFA_SETUP_SESSION_KEY)
}

export default function MfaSetupPage() {
  const navigate = useNavigate()
  const { user, updateUser, clearAuth } = useAuthStore()
  const isRebind = !!user?.mfaEnabled

  const [mfaData, setMfaData] = useState<MfaData | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [setupLoading, setSetupLoading] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Validate MFA setup session on mount
  useEffect(() => {
    // Check if we are in a valid MFA setup flow
    const isSetupRequired = !user?.mfaEnabled && user?.mfaRequired
    const hasValidSession = isMfaSetupSessionValid()

    if (!isSetupRequired && !hasValidSession) {
      console.warn('MFA setup session invalid or not required. Redirecting to login.')
      clearAuth()
      navigate('/login', { replace: true })
      return
    }

    // If this is a new session (no timestamp), start one
    if (!sessionStorage.getItem(MFA_SETUP_SESSION_KEY)) {
      startMfaSetupSession()
    }

    loadMfaSetup()
  }, [])

  const loadMfaSetup = async () => {
    try {
      const response = isRebind
        ? await apiClient.mfaBindInitiate()
        : await apiClient.setupMfa()
      setMfaData({
        secret: response.data?.secret ?? '',
        qrCodeImage: response.data?.qrCodeImage,
        qrCodeUrl: response.data?.qrCodeUrl ?? ''
      })
    } catch (err: any) {
      setError(err.response?.data?.message || (isRebind ? 'Failed to start MFA re-bind' : 'Failed to setup MFA'))
    } finally {
      setSetupLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (isRebind) {
        await apiClient.mfaBindVerify(verificationCode)
        setSuccess('MFA re-bound successfully. Redirecting...')
        updateUser({ mfaEnabled: true, mfaRequired: false })
        clearMfaSetupSession()
        setCountdown(2)
        setTimeout(() => navigate('/profile', { replace: true }), 2000)
      } else {
        await apiClient.verifyMfa(verificationCode)
        setSuccess('Finish setup complete! Redirecting to login shortly...')
        updateUser({
          mfaEnabled: true,
          mfaRequired: false,
          firstLogin: false,
          passwordChangeRequired: false
        })
        clearMfaSetupSession()
        setCountdown(3)
        setTimeout(() => {
          clearAuth()
          navigate('/login', { replace: true })
        }, 3000)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'MFA verification failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (countdown === null || isRebind) return
    if (countdown <= 0) {
      clearMfaSetupSession()
      clearAuth()
      navigate('/login', { replace: true })
      return
    }
    const timer = setTimeout(() => setCountdown((prev) => (prev !== null ? prev - 1 : null)), 1000)
    return () => clearTimeout(timer)
  }, [countdown, isRebind, clearAuth, navigate])

  if (setupLoading) {
    return (
      <div className="container">
        <div className="form-container">
          <h2>Setting up MFA...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="form-container">
        <h2>{isRebind ? 'Re-bind MFA (New Device)' : 'Setup Multi-Factor Authentication'}</h2>
        <p style={{ marginBottom: '20px', color: '#888' }}>
          {isRebind ? 'Scan the new QR code with your authenticator app on the new device.' : 'Scan the QR code with your authenticator app'}
        </p>

        {mfaData && (
          <div className="qr-code-container">
            {mfaData.qrCodeUrl && (
              <div
                style={{
                  padding: '20px',
                  background: 'white',
                  borderRadius: '8px',
                  display: 'inline-block'
                }}
              >
                <QRCodeSVG
                  value={mfaData.qrCodeUrl}
                  size={260}
                  includeMargin
                />
              </div>
            )}

            <div>
              <p style={{ marginBottom: '8px', fontWeight: '500' }}>Manual Entry Code:</p>
              <div className="secret-code">{mfaData.secret}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleVerify} style={{ marginTop: '20px' }}>
          <div className="form-group">
            <label htmlFor="verificationCode">Verification Code</label>
            <input
              id="verificationCode"
              name="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value)
                setError('')
              }}
              required
              placeholder="Enter 6-digit code"
              maxLength={6}
              pattern="\d{6}"
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          {countdown !== null && (
            <div className="success-message" style={{ marginTop: '8px', fontSize: '0.95em' }}>
              Redirecting to login in {countdown} second{countdown === 1 ? '' : 's'}...
            </div>
          )}

          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Verifying...' : isRebind ? 'Verify and Re-bind MFA' : 'Verify and Enable MFA'}
          </button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '0.85em', color: '#888', textAlign: 'left' }}>
          <p><strong>Setup Instructions:</strong></p>
          <ol style={{ marginTop: '8px', marginLeft: '20px' }}>
            <li>Install an authenticator app (Google Authenticator, Authy, etc.)</li>
            <li>Scan the QR code or enter the code manually</li>
            <li>Enter the 6-digit code from your app to verify</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
