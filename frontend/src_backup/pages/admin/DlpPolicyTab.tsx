import { useState, useEffect } from 'react'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

export default function DlpPolicyTab() {
  const { theme } = useAuthStore()
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reason, setReason] = useState('')
  const [activeSection, setActiveSection] = useState<'classification' | 'sharing'>('classification')

  useEffect(() => {
    loadPolicies()
  }, [])

  const loadPolicies = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getDlpPolicies()
      if (res.success && res.data) {
        setConfig(res.data)
      } else {
        setConfig({
          classification: {
            confidenceThreshold: 0.7,
            autoReviewEnabled: true,
            autoReviewThreshold: 0.6
          },
          sharing: {
            batchExportLimit: 10
          }
        })
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load DLP policies')
      setConfig({
        classification: { confidenceThreshold: 0.7, autoReviewEnabled: true, autoReviewThreshold: 0.6 },
        sharing: { batchExportLimit: 10 }
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await apiClient.updateDlpPolicies(config, reason || 'DLP policy updated')
      setSuccess('DLP policies updated successfully. Changes take effect immediately.')
      setReason('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update DLP policies')
    } finally {
      setSaving(false)
    }
  }

  const updateClassification = (field: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      classification: {
        ...(prev?.classification || {}),
        [field]: value
      }
    }))
  }

  const updateSharing = (field: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      sharing: {
        ...(prev?.sharing || {}),
        [field]: value
      }
    }))
  }

  const cardStyle = {
    background: theme === 'dark' ? '#2a2a2a' : '#fff',
    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px'
  }
  const inputStyle = {
    width: '100%',
    padding: '8px',
    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
    borderRadius: '4px',
    background: theme === 'dark' ? '#333' : '#fff',
    color: theme === 'dark' ? '#fff' : '#000'
  }
  const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading DLP policies...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      <h2 style={{ marginTop: 0, marginBottom: '20px' }}>DLP Policy Configuration</h2>
      <p style={{ color: theme === 'dark' ? '#aaa' : '#666', marginBottom: '20px', fontSize: '14px' }}>
        Configure document classification thresholds, access rules, and sharing policies. Changes take effect immediately.
      </p>

      {error && (
        <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', marginBottom: '16px' }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveSection('classification')}
          style={{
            padding: '8px 16px',
            background: activeSection === 'classification' ? '#2196f3' : (theme === 'dark' ? '#333' : '#f5f5f5'),
            color: activeSection === 'classification' ? '#fff' : (theme === 'dark' ? '#fff' : '#333'),
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          Document Classification
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('sharing')}
          style={{
            padding: '8px 16px',
            background: activeSection === 'sharing' ? '#2196f3' : (theme === 'dark' ? '#333' : '#f5f5f5'),
            color: activeSection === 'sharing' ? '#fff' : (theme === 'dark' ? '#fff' : '#333'),
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          Sharing / Export
        </button>
      </div>

      {activeSection === 'classification' && config?.classification && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Document Classification Policy</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={labelStyle}>LLM confidence threshold (0–1)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={config.classification.confidenceThreshold ?? 0.7}
                onChange={(e) => updateClassification('confidenceThreshold', parseFloat(e.target.value) || 0.7)}
                style={inputStyle}
              />
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#999' : '#666' }}>
                Below this threshold, classification may require manual review.
              </span>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!config.classification.autoReviewEnabled}
                  onChange={(e) => updateClassification('autoReviewEnabled', e.target.checked)}
                />
                Enable automatic review when confidence is low
              </label>
            </div>
            <div>
              <label style={labelStyle}>Auto-review threshold (0–1)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={config.classification.autoReviewThreshold ?? 0.6}
                onChange={(e) => updateClassification('autoReviewThreshold', parseFloat(e.target.value) || 0.6)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      )}

      {activeSection === 'sharing' && config?.sharing && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Sharing / Export Policy</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Batch export limit (documents)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.sharing.batchExportLimit ?? 10}
                onChange={(e) => updateSharing('batchExportLimit', parseInt(e.target.value, 10) || 10)}
                style={inputStyle}
              />
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#999' : '#666' }}>
                Max documents for batch export without approval.
              </span>
            </div>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <label style={labelStyle}>Change reason (optional, for audit)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Align with new compliance requirements"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 20px',
            background: saving ? '#999' : '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 600
          }}
        >
          {saving ? 'Saving...' : 'Save DLP Policies'}
        </button>
        <button
          type="button"
          onClick={loadPolicies}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: theme === 'dark' ? '#444' : '#f5f5f5',
            color: theme === 'dark' ? '#fff' : '#333',
            border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Reload
        </button>
      </div>
    </div>
  )
}
