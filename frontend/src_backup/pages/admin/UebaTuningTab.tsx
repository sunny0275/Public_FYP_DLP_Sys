import { useEffect, useState, useRef } from 'react'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

interface UebaTuningStatus {
  tuningEnabled: boolean
  exampleCount: number
  minExamplesRequired: number
  readyToTune: boolean
  gcsConfigured: boolean
  lastAutoTriggerResult?: Record<string, any> | null
}

interface UebaTuningVersion {
  currentVersion: string
  nextVersion: string
  namingConvention: string
  continualTraining: boolean
}

interface UebaTuningExample {
  id: number
  userId: number | null
  accountId: string
  action: string
  category: string
  result: string
  details: string
  createdAt?: string
  systemPromptSnapshot?: string
  anomalyType?: string
  source?: string
}

export default function UebaTuningTab() {
  const { theme } = useAuthStore()
  const [status, setStatus] = useState<UebaTuningStatus | null>(null)
  const [version, setVersion] = useState<UebaTuningVersion | null>(null)
  const [examples, setExamples] = useState<UebaTuningExample[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [minExamplesInput, setMinExamplesInput] = useState('')
  const [settingMin, setSettingMin] = useState(false)
  const [examplesLoading, setExamplesLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadStatus = async () => {
    setError('')
    try {
      const [statusRes, versionRes] = await Promise.all([
        apiClient.getUebaTuningStatus(),
        apiClient.getUebaTuningVersion()
      ])
      setStatus(statusRes.data || null)
      setVersion(versionRes.data || null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load UEBA tuning status')
    } finally {
      setLoading(false)
    }
  }

  const loadExamples = async () => {
    setExamplesLoading(true)
    setError('')
    try {
      const res = await apiClient.getUebaTuningExamples(100)
      setExamples((res.data || []) as UebaTuningExample[])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load UEBA tuning examples')
    } finally {
      setExamplesLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    loadExamples()
  }, [])

  const handleAutoTrigger = async () => {
    setTriggering(true)
    setError('')
    try {
      await apiClient.triggerUebaAutoTuning()
      await loadStatus()
      await loadExamples()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to trigger UEBA auto tuning')
    } finally {
      setTriggering(false)
    }
  }

  const handleImportExamples = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError('')
    try {
      await apiClient.importUebaTuningExamples(file)
      await loadStatus()
      await loadExamples()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to import UEBA tuning examples')
    } finally {
      setImporting(false)
    }
  }

  const handleToggleAutoTuning = async () => {
    const next = !status?.tuningEnabled
    if (!window.confirm(`Disable UEBA auto-tuning?${next ? '' : ' Re-enable will resume scheduled triggers.'}`)) return
    setToggling(true)
    setError('')
    try {
      await apiClient.setUebaTuningAutoToggle(next)
      await loadStatus()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle UEBA auto-tuning')
    } finally {
      setToggling(false)
    }
  }

  const handleSetMinExamples = async () => {
    const val = parseInt(minExamplesInput, 10)
    if (isNaN(val) || val < 1000) {
      alert('Minimum examples must be at least 1000')
      return
    }
    setSettingMin(true)
    setError('')
    try {
      await apiClient.setUebaMinExamples(val)
      setMinExamplesInput('')
      await loadStatus()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set min examples')
    } finally {
      setSettingMin(false)
    }
  }

  const handleDeleteExample = async (id: number) => {
    if (!confirm(`Delete tuning example #${id}?`)) return
    try {
      await apiClient.deleteUebaTuningExample(id)
      await loadExamples()
      await loadStatus()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete example')
    }
  }

  const handleClearAllExamples = async () => {
    if (!confirm('Delete ALL UEBA tuning examples? This cannot be undone!')) return
    if (!confirm('Are you REALLY sure? All training data will be permanently deleted!')) return
    try {
      await apiClient.clearUebaTuningExamples()
      await loadExamples()
      await loadStatus()
      alert('All UEBA tuning examples cleared')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to clear examples')
    }
  }

  const renderLastResult = () => {
    if (!status?.lastAutoTriggerResult) {
      return <div style={{ color: '#888' }}>No trigger attempt yet.</div>
    }

    const last = status.lastAutoTriggerResult
    return (
      <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
        <div><strong>Triggered:</strong> {String(last.triggered ?? last.state ?? 'N/A')}</div>
        {last.reason && <div><strong>Reason:</strong> {String(last.reason)}</div>}
        {last.gcsUri && <div><strong>Dataset URI:</strong> {String(last.gcsUri)}</div>}
        {last.trainDatasetUri && <div><strong>Train Dataset:</strong> {String(last.trainDatasetUri)}</div>}
        {last.validationDatasetUri && <div><strong>Validation Dataset:</strong> {String(last.validationDatasetUri)}</div>}
        {last.trainCount && <div><strong>Train Count:</strong> {String(last.trainCount)}</div>}
        {last.validationCount && <div><strong>Validation Count:</strong> {String(last.validationCount)}</div>}
        {last.tuningJobResourceName && <div><strong>Tuning Job:</strong> {String(last.tuningJobResourceName)}</div>}
        {last.state && <div><strong>State:</strong> {String(last.state)}</div>}
        {last.jobId && <div><strong>Job ID:</strong> {String(last.jobId)}</div>}
        {last.error && <div style={{ color: '#dc3545' }}><strong>Error:</strong> {String(last.error)}</div>}
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    background: theme === 'dark' ? '#1e1e1e' : '#fff',
    border: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`,
    borderRadius: '8px',
    padding: '20px',
  }

  if (loading) {
    return <h3>Loading UEBA tuning status...</h3>
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#dc3545',
          color: '#fff',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: '8px' }}>UEBA Model Tuning</h2>
        <p style={{ color: '#666', marginTop: 0, marginBottom: '16px' }}>
          UEBA analysis uses a fine-tuned Gemini model to classify user behavior anomalies.
          View sample count, import examples, and trigger tuning jobs.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Samples Collected</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{status?.exampleCount ?? 0}</div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '220px'
          }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Minimum Required</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{status?.minExamplesRequired ?? 1000}</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="number"
                min={1000}
                placeholder={`Min 1000`}
                value={minExamplesInput}
                onChange={(e) => setMinExamplesInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetMinExamples()}
                style={{
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`,
                  background: theme === 'dark' ? '#1a1a1a' : '#fff',
                  color: theme === 'dark' ? '#fff' : '#000',
                  fontSize: '12px',
                  width: '90px'
                }}
              />
              <button
                onClick={handleSetMinExamples}
                disabled={settingMin || !minExamplesInput}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: settingMin || !minExamplesInput ? '#888' : '#1976d2',
                  color: '#fff',
                  cursor: settingMin || !minExamplesInput ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {settingMin ? '...' : 'Set'}
              </button>
            </div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Ready</div>
            <div style={{
              fontSize: '24px',
              fontWeight: 700,
              color: (status?.readyToTune ?? false) ? '#28a745' : '#ffa500'
            }}>
              {(status?.readyToTune ?? false) ? 'YES' : 'NO'}
            </div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Current Version</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{version?.currentVersion ?? 'v0'}</div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Next Version</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{version?.nextVersion ?? 'v1'}</div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '12px',
          background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px'
        }}>
          <div><strong>Base Model:</strong> gemini-2.5-flash</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>GCS Configured:</strong> {status?.gcsConfigured ? 'Yes' : 'No'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>Continual Training:</strong> {version?.continualTraining ? 'Enabled' : 'Disabled'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>Naming:</strong> {version?.namingConvention ?? 'LLM_UEBA_v0'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div style={{
            color: status?.tuningEnabled ? '#2e7d32' : '#c62828',
            fontWeight: 700
          }}>
            <strong>Auto Tuning:</strong> {status?.tuningEnabled ? 'ON' : 'OFF'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={handleToggleAutoTuning}
            disabled={toggling}
            style={{
              padding: '10px 20px',
              background: toggling ? '#ccc' : (status?.tuningEnabled ? '#c62828' : '#2e7d32'),
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: toggling ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {toggling ? '...' : (status?.tuningEnabled ? 'Disable Auto Tuning' : 'Enable Auto Tuning')}
          </button>
          <button
            onClick={handleAutoTrigger}
            disabled={triggering || !status?.gcsConfigured}
            style={{
              padding: '10px 20px',
              background: triggering ? '#ccc' : (!status?.readyToTune ? '#ffa500' : '#28a745'),
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: triggering ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            {triggering ? 'Triggering...' : 'Trigger Auto Tuning Now'}
          </button>
          <button onClick={loadStatus} disabled={triggering} style={{
            padding: '10px 20px',
            background: theme === 'dark' ? '#333' : '#e0e0e0',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}>
            Refresh
          </button>
        </div>

        <h3 style={{ marginBottom: '8px' }}>Last Auto Trigger Result</h3>
        {renderLastResult()}
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Tuning Examples</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClearAllExamples}
              disabled={examples.length === 0}
              style={{
                padding: '8px 16px',
                background: examples.length === 0 ? '#888' : '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: examples.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Clear All
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl"
              onChange={handleImportExamples}
              style={{ display: 'none' }}
              id="ueba-tuning-file"
            />
            <label
              htmlFor="ueba-tuning-file"
              style={{
                padding: '8px 16px',
                background: importing ? '#ccc' : '#1976d2',
                color: '#fff',
                borderRadius: '6px',
                cursor: importing ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                display: 'inline-block'
              }}
            >
              {importing ? 'Importing...' : 'Import JSONL'}
            </label>
            <button
              onClick={loadExamples}
              disabled={examplesLoading}
              style={{
                padding: '8px 16px',
                background: theme === 'dark' ? '#333' : '#e0e0e0',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {examplesLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#666', marginTop: 0 }}>
          Import UEBA tuning examples in Vertex AI JSONL format. Each line should contain system instruction and conversation.
        </p>

        {examplesLoading ? (
          <div style={{ color: '#888' }}>Loading examples...</div>
        ) : examples.length === 0 ? (
          <div style={{ color: '#888' }}>No UEBA tuning examples collected yet.</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Account</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Result</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Anomaly</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Created</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((ex) => (
                  <tr key={ex.id} style={{ borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}` }}>
                    <td style={{ padding: '8px' }}>{ex.id}</td>
                    <td style={{ padding: '8px' }}>{ex.accountId}</td>
                    <td style={{ padding: '8px' }}>{ex.action}</td>
                    <td style={{ padding: '8px' }}>{ex.category}</td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{ex.result}</td>
                    <td style={{ padding: '8px', color: '#888' }}>{ex.anomalyType || '—'}</td>
                    <td style={{ padding: '8px' }}>{ex.createdAt ? new Date(ex.createdAt).toLocaleString() : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteExample(ex.id)}
                        style={{
                          padding: '4px 10px',
                          background: '#dc3545',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
