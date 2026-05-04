import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { apiClient } from '../../api'
import { ensureDownloadFilename } from '../../utils/fileType'
import DRMViewer from '../../components/DRMViewer'
import '../../modal.css'

interface ShareLinkData {
  id: number
  token: string
  documentId: number
  documentName: string
  fileType?: string
  shareType: string
  permission: string
  status: string
  expiresAt: string | null
  accessCount: number
  accessLimit: number | null
  requiresPassword: boolean
  requiresWatermark: boolean
  allowDownload: boolean
  allowCopy: boolean
  allowPrint: boolean
  description: string | null
  createdAt: string
  createdByName: string
}

type AccessState = 'loading' | 'password_required' | 'access_granted' | 'error'
type ErrorType = 'expired' | 'revoked' | 'ip_blocked' | 'access_limit' | 'not_found' | 'invalid_password' | 'unknown'

export default function SharedDocumentPage() {
  const { token } = useParams<{ token: string }>()

  const [accessState, setAccessState] = useState<AccessState>('loading')
  const [errorType, setErrorType] = useState<ErrorType>('unknown')
  const [errorMessage, setErrorMessage] = useState('')

  const [shareData, setShareData] = useState<ShareLinkData | null>(null)
  const [password, setPassword] = useState('')
  const [passwordAttempts, setPasswordAttempts] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Document preview state
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [viewStartTime, setViewStartTime] = useState<number | null>(null)
  const [pageViews, setPageViews] = useState<number[]>([])

  useEffect(() => {
    if (token) {
      validateShareLink()
    }
  }, [token])

  // Load preview when access is granted
  useEffect(() => {
    if (accessState === 'access_granted' && shareData && token) {
      loadDocumentPreview()
      setViewStartTime(Date.now())
    }
  }, [accessState, shareData, token])

  // Track view duration for access logging
  useEffect(() => {
    if (accessState === 'access_granted' && viewStartTime) {
      return () => {
        // Log access when component unmounts or access ends
        if (token) {
          const viewDuration = Math.floor((Date.now() - viewStartTime) / 1000) // seconds
          logAccess(viewDuration)
        }
      }
    }
  }, [accessState, viewStartTime, token])

  // Cleanup: revoke object URL when component unmounts
  useEffect(() => {
    return () => {
      if (documentPreviewUrl) {
        URL.revokeObjectURL(documentPreviewUrl)
      }
    }
  }, [documentPreviewUrl])

  const validateShareLink = async () => {
    setAccessState('loading')
    setErrorMessage('')

    try {
      const response = await apiClient.getShareLink(token!)
      const data = response.data as ShareLinkData

      // Check link status
      if (data.status === 'EXPIRED') {
        setAccessState('error')
        setErrorType('expired')
        setErrorMessage('This share link has expired')
        return
      }

      if (data.status === 'REVOKED') {
        setAccessState('error')
        setErrorType('revoked')
        setErrorMessage('This share link has been revoked by the owner')
        return
      }

      // Check access limit
      if (data.accessLimit !== null && data.accessCount >= data.accessLimit) {
        setAccessState('error')
        setErrorType('access_limit')
        setErrorMessage(`This link has reached its access limit (${data.accessLimit} views)`)
        return
      }

      setShareData(data)

      // Check if password is required
      if (data.requiresPassword) {
        setAccessState('password_required')
      } else {
        setAccessState('access_granted')
        loadDocumentPreview()
      }
    } catch (err: any) {
      console.error('Share link validation error:', err)
      setAccessState('error')

      if (err.response?.status === 404) {
        setErrorType('not_found')
        setErrorMessage('Share link not found')
      } else if (err.response?.status === 403) {
        const message = err.response?.data?.message || ''
        if (message.includes('IP')) {
          setErrorType('ip_blocked')
          setErrorMessage('Your IP address is not authorized to access this link')
        } else {
          setErrorType('unknown')
          setErrorMessage(message || 'Access denied')
        }
      } else {
        setErrorType('unknown')
        setErrorMessage(err.response?.data?.message || 'Failed to load share link')
      }
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      alert('Please enter the password')
      return
    }

    if (passwordAttempts >= 5) {
      setAccessState('error')
      setErrorType('invalid_password')
      setErrorMessage('Too many failed password attempts. Access denied.')
      return
    }

    setSubmitting(true)

    try {
      const response = await apiClient.getShareLink(token!, password)
      const data = response.data as ShareLinkData

      setShareData(data)
      setAccessState('access_granted')
    } catch (err: any) {
      setPasswordAttempts(prev => prev + 1)
      const attemptsLeft = 5 - (passwordAttempts + 1)

      if (attemptsLeft > 0) {
        alert(`Incorrect password. ${attemptsLeft} attempt(s) remaining.`)
      } else {
        setAccessState('error')
        setErrorType('invalid_password')
        setErrorMessage('Too many failed password attempts. Access denied.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const loadDocumentPreview = async () => {
    if (!token || !shareData) return

    setPreviewLoading(true)
    setViewStartTime(Date.now())

    try {
      // Fetch watermarked preview from server (server-side watermarking)
      const blob = await apiClient.getShareLinkPreview(token, password || undefined)

      // Create object URL for the blob
      const previewUrl = URL.createObjectURL(blob)
      
      // Revoke old URL if exists
      if (documentPreviewUrl) {
        URL.revokeObjectURL(documentPreviewUrl)
      }
      
      setDocumentPreviewUrl(previewUrl)
      setPageViews(prev => [...prev, Date.now()])
    } catch (err: any) {
      console.error('Failed to load preview:', err)
      alert(err.response?.data?.message || 'Failed to load document preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Log access when component unmounts
  useEffect(() => {
    return () => {
      if (viewStartTime && token) {
        const viewDuration = Math.floor((Date.now() - viewStartTime) / 1000) // seconds
        logAccess(viewDuration)
      }
    }
  }, [viewStartTime, token])

  const logAccess = async (viewDuration: number) => {
    if (!token) return

    try {
      await apiClient.logShareAccess(token, {
        viewDuration,
        pageViews: pageViews.length > 0 ? pageViews : undefined,
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      console.error('Failed to log access:', err)
      // Non-critical error, don't show to user
    }
  }

  const handleDownload = async () => {
    if (!shareData || !shareData.allowDownload || !token) {
      alert('Download is not permitted for this share link')
      return
    }

    try {
      const blob = await apiClient.getShareLinkDownload(token, password || undefined)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = ensureDownloadFilename(shareData.documentName, shareData.fileType ?? undefined)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to download document')
    }
  }

  const renderErrorPage = () => {
    const errorIcons = {
      expired: '⏰',
      revoked: '🚫',
      ip_blocked: '🔒',
      access_limit: '📊',
      not_found: '❓',
      invalid_password: '🔑',
      unknown: '⚠️'
    }

    const errorTitles = {
      expired: 'Link Expired',
      revoked: 'Link Revoked',
      ip_blocked: 'Access Denied',
      access_limit: 'Access Limit Reached',
      not_found: 'Link Not Found',
      invalid_password: 'Access Denied',
      unknown: 'Access Error'
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '48px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          <div style={{ fontSize: '72px', marginBottom: '24px' }}>
            {errorIcons[errorType]}
          </div>
          <h1 style={{ fontSize: '28px', marginBottom: '16px', color: '#333' }}>
            {errorTitles[errorType]}
          </h1>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '32px', lineHeight: '1.6' }}>
            {errorMessage}
          </p>
          <p style={{ fontSize: '14px', color: '#999' }}>
            If you believe this is an error, please contact the person who shared this link.
          </p>
        </div>
      </div>
    )
  }

  const renderPasswordPrompt = () => {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '48px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#333' }}>
              Password Required
            </h1>
            <p style={{ fontSize: '14px', color: '#666' }}>
              This document is password protected
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                Enter Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter the access password"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  transition: 'border-color 0.2s'
                }}
                disabled={submitting}
                autoFocus
              />
              {passwordAttempts > 0 && (
                <p style={{ marginTop: '8px', fontSize: '14px', color: '#f44336' }}>
                  {5 - passwordAttempts} attempt(s) remaining
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !password.trim()}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 'bold',
                background: submitting ? '#ccc' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {submitting ? 'Verifying...' : 'Access Document'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const renderDocumentView = () => {
    if (!shareData) return null

    return (
      <div style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#333' }}>
                {shareData.documentName}
              </h1>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                Shared by {shareData.createdByName} on {new Date(shareData.createdAt).toLocaleDateString()}
              </p>
              {shareData.description && (
                <p style={{ fontSize: '14px', color: '#555', marginTop: '8px' }}>
                  {shareData.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {shareData.allowDownload && (
                <button
                  onClick={handleDownload}
                  style={{
                    padding: '10px 20px',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📥 Download
                </button>
              )}
            </div>
          </div>

          {/* Share info */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: '#f8f9fa',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#666'
          }}>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <strong>Permission:</strong> {shareData.permission}
              </div>
              {shareData.accessLimit && (
                <div>
                  <strong>Views:</strong> {shareData.accessCount} / {shareData.accessLimit}
                </div>
              )}
              {shareData.expiresAt && (
                <div>
                  <strong>Expires:</strong> {new Date(shareData.expiresAt).toLocaleString()}
                </div>
              )}
              {shareData.requiresWatermark && (
                <div style={{ color: '#ff9800' }}>
                  ⚠️ Watermarked document
                </div>
              )}
            </div>
          </div>

          {/* Security notices */}
          <div style={{ marginTop: '16px', padding: '12px', background: '#fff3cd', borderRadius: '6px', fontSize: '13px' }}>
            <strong>🔒 Security Notice:</strong>
            <ul style={{ margin: '8px 0 0 20px', paddingLeft: 0 }}>
              {!shareData.allowCopy && <li>Copy/paste is disabled</li>}
              {!shareData.allowPrint && <li>Printing is disabled</li>}
              {!shareData.allowDownload && <li>Download is disabled</li>}
              {shareData.requiresWatermark && <li>All views are watermarked with your access information</li>}
            </ul>
          </div>
        </div>

        {/* Preview */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '24px',
          minHeight: '600px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'relative'
        }}>
          {previewLoading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ fontSize: '18px', color: '#666' }}>Loading preview...</p>
            </div>
          ) : documentPreviewUrl ? (
            <DRMViewer
              documentUrl={documentPreviewUrl}
              documentName={shareData.documentName}
              allowCopy={shareData.allowCopy}
              allowPrint={shareData.allowPrint}
              allowDownload={shareData.allowDownload}
              requiresWatermark={shareData.requiresWatermark}
              watermarkText={`Shared via DLP System | ${new Date().toISOString()}`}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ fontSize: '18px', color: '#666' }}>Document preview unavailable</p>
              <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
                The document could not be loaded. Please contact the person who shared this link.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#999'
        }}>
          <p>This document is shared via Enterprise DLP System</p>
          <p style={{ marginTop: '4px' }}>All access is monitored and logged for security purposes</p>
        </div>
      </div>
    )
  }

  if (accessState === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <h2>Validating share link...</h2>
        </div>
      </div>
    )
  }

  if (accessState === 'error') {
    return renderErrorPage()
  }

  if (accessState === 'password_required') {
    return renderPasswordPrompt()
  }

  return renderDocumentView()
}
