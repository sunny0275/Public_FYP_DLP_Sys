import { useState } from 'react'
import { apiClient } from '../api'
import '../modal.css'

interface SignatureDialogProps {
  documentId: number
  documentName: string
  onSign: (signature: any) => void
  onClose: () => void
}

export default function SignatureDialog({ documentId, documentName, onSign, onClose }: SignatureDialogProps) {
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  const handleSign = async () => {
    setSigning(true)
    setError('')

    try {
      // Get canonical document hash (raw bytes) from backend
      const hashRes = await apiClient.getDocumentHash(documentId)
      const documentHash = hashRes.data.hash

      // Sign the document (server-managed per-user key; no password/MFA prompt)
      const signatureResponse = await apiClient.signDocument({
        documentId,
        documentHash
      })

      alert('Document signed successfully!')
      onSign(signatureResponse.data)
      onClose()

    } catch (error: any) {
      console.error('Signature error:', error)
      setError(error.response?.data?.message || 'Failed to sign document. Please try again.')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <h2>Sign Document</h2>

        {/* Document Info */}
        <div style={{
          background: '#f5f5f5',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Document:</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>
            {documentName}
          </p>
        </div>

        {/* Warning */}
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffeb3b',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
            <strong>⚠️ Legal Notice:</strong> By signing this document, you are creating a legally binding
            digital signature. This action cannot be undone and will be permanently recorded in the audit trail.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#c62828' }}>
              {error}
            </p>
          </div>
        )}

        {/* Info */}
        <div style={{
          background: '#f5f5f5',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#555'
        }}>
          This signature will be created automatically using your account’s signing key (stored encrypted on the server).
        </div>

        {/* Technical Info */}
        <div style={{
          background: '#e3f2fd',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#1976d2' }}>
            <strong>🔒 Signature Technology:</strong>
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '12px', color: '#1976d2' }}>
            <li>ECDSA with secp256k1 curve (Ethereum-compatible)</li>
            <li>RFC 3161 cryptographic timestamp</li>
            <li>SHA-256 document hashing</li>
            <li>Per-user signing key stored encrypted on the server</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={signing}
            style={{
              padding: '10px 20px',
              background: '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: signing ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSign}
            disabled={signing}
            style={{
              padding: '10px 20px',
              background: signing ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: signing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {signing ? 'Signing...' : '✍ Sign Document'}
          </button>
        </div>
      </div>
    </div>
  )
}
