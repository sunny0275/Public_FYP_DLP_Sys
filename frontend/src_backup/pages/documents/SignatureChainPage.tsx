import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'

const BLOCKCHAIN_EXPLORER_TX_BASE =
  (import.meta.env.VITE_BLOCKCHAIN_EXPLORER_TX_BASE as string | undefined) ||
  'https://sepolia.etherscan.io/tx/'

interface SignatureRecord {
  id: number
  documentId: number
  userId: number
  signatureHex: string
  publicKeyHex?: string
  documentHash: string
  timestampToken: string
  blockchainTxHash?: string
  certificatePem?: string
  issuerCertificatePem?: string
  certificateSerialHex?: string
  pki?: {
    subject?: string
    issuer?: string
    serialHex?: string
    notBefore?: string
    notAfter?: string
    keyUsage?: string[]
    extendedKeyUsage?: string[]
    ocspUrls?: string[]
    crlDistributionPoints?: string[]
    error?: string
  }
  signedAt: string
  ipAddress: string
  deviceFingerprint: string
  status: 'PENDING' | 'VALID' | 'INVALID' | 'REVOKED'
  revocationReason?: string
  uploader?: {
    id: number
    accountId: string
    fullName: string
    department: string
  }
  // Signature type info from backend
  signatureType?: string
  signatureTypeLabel?: string
  badgeColor?: number
  user: {
    id: number
    accountId: string
    fullName: string
    email: string
    department: string
    position?: string
    roles?: string[]
  }
}

export default function SignatureChainPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()

  const [signatures, setSignatures] = useState<SignatureRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState<number | null>(null)

  useEffect(() => {
    if (documentId) {
      loadSignatureChain()
    }
  }, [documentId])

  const loadSignatureChain = async () => {
    if (!documentId) return

    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getSignatureChain(parseInt(documentId))
      setSignatures(response.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load signature chain')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (signatureId: number) => {
    setVerifying(signatureId)

    try {
      const result = await apiClient.verifySignature(signatureId)

      if (result.data.valid) {
        alert('✓ Signature verified successfully!\n\nThis signature is cryptographically valid.')
      } else {
        alert('✗ Signature verification failed!\n\nThis signature may have been tampered with.')
      }

      // Reload signature chain to get updated status
      await loadSignatureChain()
    } catch (err: any) {
      alert('Verification error: ' + (err.response?.data?.message || 'Unknown error'))
    } finally {
      setVerifying(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      VALID: { bg: '#4caf50', color: 'white' },
      PENDING: { bg: '#ff9800', color: 'white' },
      INVALID: { bg: '#f44336', color: 'white' },
      REVOKED: { bg: '#9e9e9e', color: 'white' }
    }

    const style = styles[status] || styles.PENDING

    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        background: style.bg,
        color: style.color
      }}>
        {status}
      </span>
    )
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <DashboardLayout>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <button
              onClick={() => navigate(-1)}
              style={{
                padding: '8px 16px',
                background: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: '28px', margin: 0 }}>Document Signature Chain</h1>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              Document ID: {documentId} | {signatures.length} signature{signatures.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p>Loading signature chain...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            background: '#ffebee',
            padding: '20px',
            borderRadius: '8px',
            color: '#c62828',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && signatures.length === 0 && (
          <div style={{
            background: 'white',
            padding: '60px',
            borderRadius: '8px',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '18px', color: '#666' }}>No signatures found for this document</p>
            <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
              This document has not been electronically signed yet
            </p>
          </div>
        )}

        {/* Signature Chain */}
        {!loading && !error && signatures.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Uploader Info Banner */}
            {signatures[0]?.uploader && (
              <div style={{
                background: '#e3f2fd',
                border: '2px solid #2196f3',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{
                  background: '#2196f3',
                  color: 'white',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  📤
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#1565c0', fontWeight: 'bold' }}>
                    {signatures[0].signatureTypeLabel || 'Document Uploader'}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1976d2' }}>
                    {signatures[0].uploader.fullName}
                    <span style={{ marginLeft: '8px', color: '#666', fontWeight: 'normal' }}>
                      ({signatures[0].uploader.accountId})
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {signatures[0].uploader.department}
                  </div>
                </div>
              </div>
            )}

            {signatures.map((signature, index) => {
              // Determine signature type
              const sigType = signature.signatureType || 'UPLOAD'
              
              // Determine badge color based on signature type
              const getTypeBadgeColor = (type: string) => {
                switch (type) {
                  case 'CLASSIFICATION_APPROVE': return '#ff9800'
                  case 'APPROVE_SHARE': return '#9c27b0'
                  case 'MANUAL_SIGN': return '#00bcd4'
                  case 'UPLOAD_CREATE':
                  case 'UPLOAD_JOB':
                  case 'UPLOAD_RESOLVE':
                  case 'UPLOAD': return '#2196f3'
                  default: return '#2196f3'
                }
              }
              
              // Determine label based on type (if no label provided)
              const getTypeLabel = (type: string) => {
                switch (type) {
                  case 'CLASSIFICATION_APPROVE': return 'Classification Approval'
                  case 'APPROVE_SHARE': return 'Share Approval'
                  case 'MANUAL_SIGN': return 'Manual Signature'
                  case 'UPLOAD_CREATE':
                  case 'UPLOAD_JOB':
                  case 'UPLOAD_RESOLVE':
                  case 'UPLOAD': return 'Document Upload'
                  default: return type || 'Signature'
                }
              }
              
              return (
              <div
                key={signature.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  border: signature.status === 'VALID' ? '2px solid #4caf50' : '1px solid #e0e0e0'
                }}
              >
                {/* Signature Header */}
                <div style={{
                  background: signature.status === 'VALID' ? '#e8f5e9' : '#f5f5f5',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        background: signature.status === 'VALID' ? '#4caf50' : '#666',
                        color: 'white',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 'bold'
                      }}>
                        {index + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                          {signature.user.fullName}
                          <span style={{ 
                            marginLeft: '8px',
                            padding: '2px 8px',
                            background: getTypeBadgeColor(sigType),
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'normal'
                          }}>
                          {signature.signatureTypeLabel || getTypeLabel(sigType)}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          ID: {signature.user.accountId || signature.user.id} | {signature.user.roles?.[0] || 'EMPLOYEE'} | {signature.user.department}
                        </div>
                        {signature.user.position && (
                          <div style={{ fontSize: '12px', color: '#888' }}>
                            Position: {signature.user.position}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {getStatusBadge(signature.status)}
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      {formatTimestamp(signature.signedAt)}
                    </div>
                  </div>
                </div>

                {/* Signature Details */}
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Left Column */}
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          Email
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>
                          {signature.user.email}
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          IP Address
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'monospace' }}>
                          {signature.ipAddress}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          Document Hash
                        </div>
                        <div style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          background: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          wordBreak: 'break-all'
                        }}>
                          {signature.documentHash.substring(0, 32)}...
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          ECDSA Signature
                        </div>
                        <div style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          background: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          wordBreak: 'break-all',
                          maxHeight: '60px',
                          overflow: 'auto'
                        }}>
                          {signature.signatureHex.substring(0, 64)}...
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          RFC 3161 Timestamp
                        </div>
                        <div style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          background: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          wordBreak: 'break-all'
                        }}>
                          {signature.timestampToken.substring(0, 32)}...
                        </div>
                      </div>

                      {(signature.certificateSerialHex || signature.certificatePem) && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            X.509 Certificate Chain (PKI)
                          </div>
                          {signature.pki?.error && (
                            <div style={{ fontSize: '12px', color: '#c62828', marginBottom: '8px' }}>
                              {signature.pki.error}
                            </div>
                          )}
                          {signature.pki && !signature.pki.error && (
                            <div style={{
                              border: '1px solid #e0e0e0',
                              borderRadius: '8px',
                              padding: '10px',
                              background: '#fff'
                            }}>
                              <div style={{ fontSize: '12px', color: '#333', marginBottom: '6px' }}>
                                <strong>Subject:</strong> <span style={{ fontFamily: 'monospace' }}>{signature.pki.subject}</span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#333', marginBottom: '6px' }}>
                                <strong>Issuer:</strong> <span style={{ fontFamily: 'monospace' }}>{signature.pki.issuer}</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div style={{ fontSize: '12px' }}>
                                  <strong>Not Before:</strong> {signature.pki.notBefore}
                                </div>
                                <div style={{ fontSize: '12px' }}>
                                  <strong>Not After:</strong> {signature.pki.notAfter}
                                </div>
                              </div>
                              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                                <strong>Key Usage:</strong> {(signature.pki.keyUsage || []).join(', ') || '—'}
                              </div>
                              <div style={{ marginTop: '6px', fontSize: '12px' }}>
                                <strong>OCSP URL:</strong> {(signature.pki.ocspUrls || []).join(', ') || '—'}
                              </div>
                              <div style={{ marginTop: '6px', fontSize: '12px' }}>
                                <strong>CRL DP:</strong> {(signature.pki.crlDistributionPoints || []).join(', ') || '—'}
                              </div>
                            </div>
                          )}
                          {signature.certificateSerialHex && (
                            <div style={{ fontSize: '12px', color: '#444', marginBottom: '6px' }}>
                              Serial: <span style={{ fontFamily: 'monospace' }}>{signature.certificateSerialHex}</span>
                            </div>
                          )}
                          {signature.certificatePem && (
                            <details style={{ background: '#f5f5f5', padding: '10px', borderRadius: '6px' }}>
                              <summary style={{ cursor: 'pointer', fontSize: '12px' }}>Signer Certificate (PEM)</summary>
                              <pre style={{ margin: '10px 0 0 0', fontSize: '11px', overflowX: 'auto' }}>
                                {signature.certificatePem}
                              </pre>
                            </details>
                          )}
                          {signature.issuerCertificatePem && (
                            <details style={{ background: '#f5f5f5', padding: '10px', borderRadius: '6px', marginTop: '8px' }}>
                              <summary style={{ cursor: 'pointer', fontSize: '12px' }}>Issuer (CA) Certificate (PEM)</summary>
                              <pre style={{ margin: '10px 0 0 0', fontSize: '11px', overflowX: 'auto' }}>
                                {signature.issuerCertificatePem}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}

                      {signature.blockchainTxHash && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            Blockchain Anchor
                          </div>
                          <a
                            href={`${BLOCKCHAIN_EXPLORER_TX_BASE}${signature.blockchainTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              color: '#2196f3',
                              textDecoration: 'none'
                            }}
                          >
                            {signature.blockchainTxHash.substring(0, 20)}... ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Revocation Reason */}
                  {signature.status === 'REVOKED' && signature.revocationReason && (
                    <div style={{
                      marginTop: '16px',
                      background: '#ffebee',
                      padding: '12px',
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#c62828', fontWeight: 'bold', marginBottom: '4px' }}>
                        Revocation Reason:
                      </div>
                      <div style={{ fontSize: '13px', color: '#c62828' }}>
                        {signature.revocationReason}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    {signature.status !== 'REVOKED' && (
                      <button
                        onClick={() => handleVerify(signature.id)}
                        disabled={verifying === signature.id}
                        style={{
                          padding: '8px 16px',
                          background: verifying === signature.id ? '#ccc' : '#2196f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: verifying === signature.id ? 'not-allowed' : 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        {verifying === signature.id ? 'Verifying...' : '🔍 Verify Signature'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
