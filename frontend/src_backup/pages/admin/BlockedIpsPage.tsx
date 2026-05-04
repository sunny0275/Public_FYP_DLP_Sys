import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

interface BlockedIpInfo {
  ipAddress: string
  status?: string
  blocked?: boolean
  freezeLevelDescription?: string
  frozenUntil?: string
  blockedAt?: string
}

export default function BlockedIpsPage() {
  const { theme } = useAuthStore()
  const navigate = useNavigate()

  const [blockedIps, setBlockedIps] = useState<BlockedIpInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unblocking, setUnblocking] = useState<string | null>(null)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [newBlockIp, setNewBlockIp] = useState('')
  const [newBlockReason, setNewBlockReason] = useState('')
  const [blocking, setBlocking] = useState(false)

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getBlockedIps()
      const ips = res.data?.blockedIps
      if (ips) {
        const list = Object.values(ips) as BlockedIpInfo[]
        // Sort by blockedAt descending (newest first)
        list.sort((a, b) => {
          const dateA = a.blockedAt ? new Date(a.blockedAt).getTime() : 0
          const dateB = b.blockedAt ? new Date(b.blockedAt).getTime() : 0
          return dateB - dateA
        })
        setBlockedIps(list)
      } else {
        setBlockedIps([])
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load blocked IPs')
    } finally {
      setLoading(false)
    }
  }

  const handleUnblock = async (ipAddress: string) => {
    if (!confirm(`Unblock IP address ${ipAddress}?`)) return
    setUnblocking(ipAddress)
    try {
      await apiClient.unblockIp(ipAddress)
      alert(`IP ${ipAddress} has been unblocked`)
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unblock IP')
    } finally {
      setUnblocking(null)
    }
  }

  const handleUnblockAll = async () => {
    if (blockedIps.length === 0) { alert('No blocked IPs to unblock'); return }
    if (!confirm(`Unblock ALL ${blockedIps.length} IP address(es)?`)) return
    try {
      const res = await apiClient.unblockAllIps()
      alert(res.data?.message || `Unblocked ${blockedIps.length} IP(s)`)
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unblock IPs')
    }
  }

  const handleBlockIp = async () => {
    if (!newBlockIp.trim()) { alert('Please enter an IP address'); return }
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    const localhostRegex = /^localhost$/i
    if (!ipv4Regex.test(newBlockIp.trim()) && !ipv6Regex.test(newBlockIp.trim()) && !localhostRegex.test(newBlockIp.trim())) {
      alert('Please enter a valid IP address (e.g., 192.168.1.1)')
      return
    }
    setBlocking(true)
    try {
      await apiClient.blockIp(newBlockIp.trim(), newBlockReason.trim() || 'Manual block by admin')
      alert(`IP ${newBlockIp} has been blocked`)
      setNewBlockIp('')
      setNewBlockReason('')
      setShowBlockForm(false)
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to block IP')
    } finally {
      setBlocking(false)
    }
  }

  const cardStyle = (isAlt: boolean) => ({
    background: isAlt
      ? (theme === 'dark' ? '#1e1e1e' : '#fff')
      : (theme === 'dark' ? '#222' : '#f8f9fa'),
    borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`
  })

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {error && <div style={{ padding: '12px 16px', marginBottom: '16px', background: '#ffebee', color: '#c62828', borderRadius: '6px' }}>{error}</div>}

      <button
        onClick={() => navigate(-1)}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          border: 'none',
          background: theme === 'dark' ? '#333' : '#e0e0e0',
          color: theme === 'dark' ? '#fff' : '#333',
          cursor: 'pointer',
          fontSize: '14px',
          marginBottom: '16px'
        }}
      >
        ← Back
      </button>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={load} disabled={loading} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: theme === 'dark' ? '#333' : '#e0e0e0', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button
          onClick={handleUnblockAll}
          disabled={loading || blockedIps.length === 0}
          style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: blockedIps.length === 0 ? '#ccc' : '#dc3545', color: '#fff', cursor: blockedIps.length === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}
        >
          Unblock All ({blockedIps.length})
        </button>
        <button
          onClick={() => setShowBlockForm(!showBlockForm)}
          style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: showBlockForm ? '#6c757d' : '#28a745', color: '#fff', cursor: 'pointer', fontSize: '14px' }}
        >
          {showBlockForm ? 'Cancel' : '+ Block IP Manually'}
        </button>
      </div>

      {showBlockForm && (
        <div style={{
          padding: '16px',
          marginBottom: '16px',
          background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
          border: `1px solid ${theme === 'dark' ? '#444' : '#dee2e6'}`,
          borderRadius: '8px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#888' }}>IP Address *</label>
            <input
              type="text"
              value={newBlockIp}
              onChange={(e) => setNewBlockIp(e.target.value)}
              placeholder="e.g. 192.168.1.1"
              style={{ padding: '8px 12px', border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`, borderRadius: '6px', background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', width: '180px', fontSize: '14px' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#888' }}>Reason (optional)</label>
            <input
              type="text"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              placeholder="Reason for blocking"
              style={{ padding: '8px 12px', border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`, borderRadius: '6px', background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', width: '100%', fontSize: '14px' }}
            />
          </div>
          <button
            onClick={handleBlockIp}
            disabled={blocking || !newBlockIp.trim()}
            style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: blocking ? '#6c757d' : '#dc3545', color: '#fff', cursor: blocking ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600 }}
          >
            {blocking ? 'Blocking...' : 'Block IP'}
          </button>
        </div>
      )}

      {loading && blockedIps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>Loading...</div>
      ) : blockedIps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa', borderRadius: '8px', color: '#888' }}>
          No blocked IPs.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>IP Address</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>Level</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>Frozen Until</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#dee2e6'}` }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedIps.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    No blocked IPs
                  </td>
                </tr>
              ) : blockedIps.map((ip, index) => (
                <tr key={ip.ipAddress} style={cardStyle(index % 2 === 1)}>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    <code style={{ padding: '2px 6px', background: theme === 'dark' ? '#333' : '#eee', borderRadius: '4px', fontFamily: 'monospace' }}>{ip.ipAddress}</code>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 10px',
                      background: ip.blocked ? '#dc354520' : '#fd7e1420',
                      color: ip.blocked ? '#dc3545' : '#fd7e14',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      {ip.status || (ip.blocked ? 'PERMANENTLY BLOCKED' : 'FROZEN')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px', color: '#666' }}>
                    {ip.freezeLevelDescription}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    {ip.frozenUntil ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {ip.frozenUntil}
                      </span>
                    ) : ip.blockedAt ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {ip.blockedAt}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleUnblock(ip.ipAddress)}
                      disabled={unblocking === ip.ipAddress}
                      style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', background: unblocking === ip.ipAddress ? '#6c757d' : '#28a745', color: '#fff', cursor: unblocking === ip.ipAddress ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}
                    >
                      {unblocking === ip.ipAddress ? '...' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}