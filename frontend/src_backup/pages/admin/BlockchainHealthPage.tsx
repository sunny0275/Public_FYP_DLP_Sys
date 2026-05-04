import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

export default function BlockchainHealthPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()
  const [blockchainHealth, setBlockchainHealth] = useState<any | null>(null)
  const [blockchainHealthLoading, setBlockchainHealthLoading] = useState(false)
  const [blockchainHealthError, setBlockchainHealthError] = useState('')
  const [txHashQuery, setTxHashQuery] = useState('')
  const [txLookupLoading, setTxLookupLoading] = useState(false)
  const [txLookupError, setTxLookupError] = useState('')
  const [txLookupResult, setTxLookupResult] = useState<any | null>(null)

  const loadBlockchainHealth = async () => {
    setBlockchainHealthLoading(true)
    setBlockchainHealthError('')
    try {
      const response = await apiClient.getBlockchainHealth()
      setBlockchainHealth(response.data || null)
    } catch (err: any) {
      setBlockchainHealth(null)
      setBlockchainHealthError(err.response?.data?.message || 'Failed to load blockchain health')
    } finally {
      setBlockchainHealthLoading(false)
    }
  }

  const handleLookupTx = async () => {
    const txHash = txHashQuery.trim()
    if (!txHash) {
      setTxLookupError('Please enter a transaction hash')
      return
    }
    setTxLookupLoading(true)
    setTxLookupError('')
    setTxLookupResult(null)
    try {
      const response = await apiClient.getBlockchainTransaction(txHash)
      setTxLookupResult(response.data || null)
    } catch (err: any) {
      setTxLookupResult(err?.response?.data?.data || null)
      setTxLookupError(err.response?.data?.message || 'Failed to lookup transaction')
    } finally {
      setTxLookupLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ marginBottom: '6px' }}>Blockchain Health</h1>
            <p style={{ margin: 0, color: '#888' }}>
              Runtime status and transaction diagnostics.
            </p>
          </div>
          <button onClick={() => navigate('/admin')}>Back to Admin Panel</button>
        </div>

        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600 }}>Chain Runtime</div>
            <button
              onClick={loadBlockchainHealth}
              disabled={blockchainHealthLoading}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: blockchainHealthLoading ? '#999' : '#1976d2',
                color: '#fff',
                cursor: blockchainHealthLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {blockchainHealthLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {blockchainHealthError ? (
            <div style={{ marginTop: '10px', color: '#d32f2f', fontSize: '13px' }}>{blockchainHealthError}</div>
          ) : blockchainHealth ? (
            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '13px' }}>
              <div><strong>Status:</strong> {blockchainHealth.status || 'UNKNOWN'}</div>
              <div><strong>Enabled:</strong> {String(blockchainHealth.enabled)}</div>
              <div><strong>Ready:</strong> {String(blockchainHealth.ready)}</div>
              <div><strong>PrivateKey Valid:</strong> {String(blockchainHealth.privateKeyValid)}</div>
              <div><strong>RPC Reachable:</strong> {String(blockchainHealth.rpcReachable)}</div>
              <div><strong>Configured Chain:</strong> {String(blockchainHealth.configuredChainId ?? 'N/A')}</div>
              <div><strong>Actual Chain:</strong> {String(blockchainHealth.actualChainId ?? 'N/A')}</div>
              <div><strong>Address:</strong> {blockchainHealth.address || 'N/A'}</div>
              <div><strong>Balance (ETH):</strong> {String(blockchainHealth.balanceEth ?? 'N/A')}</div>
              <div><strong>RPC:</strong> {blockchainHealth.rpcUrl || 'N/A'}</div>
            </div>
          ) : (
            <div style={{ marginTop: '10px', fontSize: '13px', color: theme === 'dark' ? '#ccc' : '#666' }}>
              No data. Click Refresh to query blockchain health.
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>Lookup Transaction by Hash</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={txHashQuery}
              onChange={(e) => setTxHashQuery(e.target.value)}
              placeholder="0x..."
              style={{
                flex: '1 1 420px',
                minWidth: '260px',
                padding: '8px',
                borderRadius: '6px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#111'
              }}
            />
            <button
              onClick={handleLookupTx}
              disabled={txLookupLoading}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: txLookupLoading ? '#999' : '#5e35b1',
                color: '#fff',
                cursor: txLookupLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {txLookupLoading ? 'Checking...' : 'Check Tx'}
            </button>
          </div>
          {txLookupError && (
            <div style={{ marginTop: '8px', color: '#d32f2f', fontSize: '13px' }}>{txLookupError}</div>
          )}
          {txLookupResult && (
            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '13px' }}>
              <div><strong>Status:</strong> {txLookupResult.status || 'N/A'}</div>
              <div><strong>Found:</strong> {String(txLookupResult.found ?? false)}</div>
              <div><strong>Mined:</strong> {String(txLookupResult.mined ?? false)}</div>
              <div><strong>Block:</strong> {String(txLookupResult.blockNumber ?? 'N/A')}</div>
              <div><strong>From:</strong> {txLookupResult.from || 'N/A'}</div>
              <div><strong>To:</strong> {txLookupResult.to || 'N/A'}</div>
              <div><strong>Receipt Status:</strong> {txLookupResult.receiptStatus || 'N/A'}</div>
              <div><strong>Chain:</strong> {String(txLookupResult.actualChainId ?? txLookupResult.configuredChainId ?? 'N/A')}</div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>Input:</strong> <span style={{ fontFamily: 'monospace' }}>{txLookupResult.input || 'N/A'}</span>
              </div>
              {txLookupResult.message && (
                <div style={{ gridColumn: '1 / -1', color: theme === 'dark' ? '#ccc' : '#555' }}>
                  <strong>Message:</strong> {txLookupResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
