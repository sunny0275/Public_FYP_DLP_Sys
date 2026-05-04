import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'

export default function EDRPoliciesPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()
  const [policies, setPolicies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ name: '', description: '', rulesJson: '[]', status: 'DRAFT' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPolicies()
  }, [])

  const loadPolicies = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getEDRPolicies()
      setPolicies(res.success && Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load EDR policies')
      setPolicies([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      await apiClient.saveEDRPolicy({
        id: editing?.id,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        rulesJson: form.rulesJson.trim() || '[]',
        status: form.status
      })
      setEditing(null)
      setForm({ name: '', description: '', rulesJson: '[]', status: 'DRAFT' })
      loadPolicies()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save policy')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this EDR policy?')) return
    try {
      await apiClient.deleteEDRPolicy(id)
      loadPolicies()
      if (editing?.id === id) setEditing(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete policy')
    }
  }

  const startEdit = (policy: any) => {
    setEditing(policy)
    setForm({
      name: policy.name || '',
      description: policy.description || '',
      rulesJson: typeof policy.rulesJson === 'string' ? policy.rulesJson : JSON.stringify(policy.rulesJson || [], null, 2),
      status: policy.status || 'DRAFT'
    })
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

  return (
    <DashboardLayout>
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>EDR Policies</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => navigate('/edr')}>Back to EDR Console</button>
            <button
              onClick={() => { setEditing(null); setForm({ name: '', description: '', rulesJson: '[]', status: 'DRAFT' }); }}
              style={{ background: '#2196f3', color: '#fff' }}
            >
              New policy
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {(editing || (!editing && form.name)) && (
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>{editing ? 'Edit policy' : 'New policy'}</h3>
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="Policy name"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={inputStyle}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Rules (JSON)</label>
                <textarea
                  value={form.rulesJson}
                  onChange={e => setForm(f => ({ ...f, rulesJson: e.target.value }))}
                  rows={6}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '13px' }}
                  placeholder='[{"type":"CLIPBOARD","action":"ALERT"}]'
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} style={{ background: '#4caf50', color: '#fff' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(null); setForm({ name: '', description: '', rulesJson: '[]', status: 'DRAFT' }); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Policies</h3>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>Loading...</div>
          ) : policies.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>No EDR policies. Create one above.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {policies.map(p => (
                <li
                  key={p.id}
                  style={{
                    padding: '12px',
                    borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#eee'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong>{p.name}</strong>
                    <span style={{ marginLeft: '12px', fontSize: '12px', color: '#888' }}>{p.status}</span>
                    {p.description && <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{p.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => startEdit(p)} style={{ padding: '4px 12px', fontSize: '13px' }}>Edit</button>
                    <button type="button" onClick={() => handleDelete(p.id)} style={{ padding: '4px 12px', fontSize: '13px', background: '#f44336', color: '#fff' }}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
