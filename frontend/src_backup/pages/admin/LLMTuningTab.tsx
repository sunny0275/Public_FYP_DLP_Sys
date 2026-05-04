import { useEffect, useState, useRef } from 'react'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

interface TuningStatusData {
  exampleCount: number
  minExamples: number
  autoTuningEnabled: boolean
  currentVersion?: string
  nextVersion?: string
  gcsConfigured?: boolean
  continualTraining?: boolean
  baseModel?: string
  readyToTune?: boolean
  lastAutoTrigger?: Record<string, any> | null
}

interface TuningSample {
  id: number
  documentId: number
  uploadJobId: number
  suggestedLevel: string
  correctLevel: string
  createdAt?: string
}

export default function LLMTuningTab() {
  const { theme } = useAuthStore()
  const [status, setStatus] = useState<TuningStatusData | null>(null)
  const [samples, setSamples] = useState<TuningSample[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [samplesLoading, setSamplesLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [minExamplesInput, setMinExamplesInput] = useState('')
  const [settingMin, setSettingMin] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const loadStatus = async () => {
    setError('')
    try {
      const res = await apiClient.getClassificationTuningStatus()
      setStatus(res.data || null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load LLM tuning status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    loadSamples()
  }, [])

  const loadSamples = async () => {
    setSamplesLoading(true)
    setError('')
    try {
      const res = await apiClient.getClassificationTuningSamples(100)
      setSamples((res.data?.items || []) as TuningSample[])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tuning samples')
    } finally {
      setSamplesLoading(false)
    }
  }

  const handleAutoTrigger = async () => {
    setTriggering(true)
    setError('')
    try {
      await apiClient.triggerClassificationAutoTuning()
      await loadStatus()
      await loadSamples()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to trigger auto tuning')
    } finally {
      setTriggering(false)
    }
  }

  const handleClearSamples = async () => {
    if (!window.confirm('Clear all LLM tuning samples? This cannot be undone.')) return
    setClearing(true)
    setError('')
    try {
      await apiClient.clearClassificationTuningSamples()
      await loadStatus()
      await loadSamples()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clear tuning samples')
    } finally {
      setClearing(false)
    }
  }

  const handleToggleAutoTuning = async () => {
    const next = !status?.autoTuningEnabled
    if (!window.confirm(`Disable LLM auto-tuning?${next ? '' : ' Re-enable will resume scheduled triggers.'}`)) return
    setToggling(true)
    setError('')
    try {
      await apiClient.setClassificationTuningAutoToggle(next)
      await loadStatus()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle auto-tuning')
    } finally {
      setToggling(false)
    }
  }

  const handleSetMinExamples = async () => {
    const val = parseInt(minExamplesInput, 10)
    if (isNaN(val) || val < 100) {
      alert('Minimum examples must be at least 100')
      return
    }
    setSettingMin(true)
    setError('')
    try {
      await apiClient.setClassificationMinExamples(val)
      setMinExamplesInput('')
      await loadStatus()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set min examples')
    } finally {
      setSettingMin(false)
    }
  }

  const handleImportExamples = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError('')
    try {
      await apiClient.importClassificationTuningExamples?.(file)
      await loadStatus()
      await loadSamples()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to import tuning examples')
    } finally {
      setImporting(false)
    }
  }

  const renderLastResult = () => {
    if (!status?.lastAutoTrigger) {
      return <div style={{ color: '#888' }}>No trigger attempt yet.</div>
    }

    const last = status.lastAutoTrigger
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

  const readyToTune = (status?.exampleCount ?? 0) >= (status?.minExamples ?? 100)

  if (loading) {
    return <h3>Loading LLM tuning status...</h3>
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
        <h2 style={{ marginTop: 0, marginBottom: '8px' }}>LLM Auto Tuning</h2>
        <p style={{ color: '#666', marginTop: 0, marginBottom: '16px' }}>
          View current sample count and trigger the auto flow manually.
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
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{status?.minExamples ?? 100}</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="number"
                min={100}
                placeholder={`Min 100`}
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
              color: readyToTune ? '#28a745' : '#ffa500'
            }}>
              {readyToTune ? 'YES' : 'NO'}
            </div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Current Version</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{status?.currentVersion ?? 'v0'}</div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Next Version</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{status?.nextVersion ?? 'v1'}</div>
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
          <div><strong>Base Model:</strong> {status?.baseModel ?? 'gemini-2.5-flash'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>GCS Configured:</strong> {status?.gcsConfigured ? 'Yes' : 'No'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>Continual Training:</strong> {status?.continualTraining ? 'Enabled' : 'Disabled'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>Naming:</strong> LLM_Classification_v*</div>
          <div style={{ color: '#888' }}>|</div>
          <div style={{
            color: status?.autoTuningEnabled ? '#2e7d32' : '#c62828',
            fontWeight: 700
          }}>
            <strong>Auto Tuning:</strong> {status?.autoTuningEnabled ? 'ON' : 'OFF'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={handleToggleAutoTuning}
            disabled={toggling}
            style={{
              padding: '10px 20px',
              background: toggling ? '#ccc' : (status?.autoTuningEnabled ? '#c62828' : '#2e7d32'),
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: toggling ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {toggling ? '...' : status?.autoTuningEnabled ? 'Disable Auto Tuning' : 'Enable Auto Tuning'}
          </button>
          <button
            onClick={handleAutoTrigger}
            disabled={triggering || !status?.gcsConfigured}
            style={{
              padding: '10px 20px',
              background: triggering ? '#ccc' : (!readyToTune ? '#ffa500' : '#28a745'),
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
          <h3 style={{ margin: 0 }}>Collected Samples</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl"
              onChange={handleImportExamples}
              style={{ display: 'none' }}
              id="classification-tuning-file"
            />
            <label
              htmlFor="classification-tuning-file"
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
              onClick={loadSamples}
              disabled={samplesLoading || clearing}
              style={{
                padding: '8px 16px',
                background: theme === 'dark' ? '#333' : '#e0e0e0',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {samplesLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={handleClearSamples}
              disabled={clearing || samplesLoading || (status?.exampleCount ?? 0) === 0}
              style={{ background: '#c62828', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: (clearing || samplesLoading || (status?.exampleCount ?? 0) === 0) ? 'not-allowed' : 'pointer' }}
            >
              {clearing ? 'Clearing...' : 'Clear Samples'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#666', marginTop: 0 }}>
          Import classification tuning examples in Vertex AI JSONL format. Each line should contain system instruction and conversation.
        </p>

        {samplesLoading ? (
          <div style={{ color: '#888' }}>Loading samples...</div>
        ) : samples.length === 0 ? (
          <div style={{ color: '#888' }}>No samples collected.</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Document</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Upload Job</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Suggested</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Correct</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}` }}>
                    <td style={{ padding: '8px' }}>{s.id}</td>
                    <td style={{ padding: '8px' }}>{s.documentId}</td>
                    <td style={{ padding: '8px' }}>{s.uploadJobId}</td>
                    <td style={{ padding: '8px' }}>{s.suggestedLevel}</td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{s.correctLevel}</td>
                    <td style={{ padding: '8px' }}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
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
