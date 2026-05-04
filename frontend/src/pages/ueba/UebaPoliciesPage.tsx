import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import type { UebaRuleDto } from '../../types'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuthStore } from '../../store/authStore'

type Tab = 'rules' | 'risk-adaptive'

interface ThresholdBand {
  min: number
  max: number
  action: string
}

export default function UebaPoliciesPage() {
  const navigate = useNavigate()
  const { theme } = useAuthStore()
  const [tab, setTab] = useState<Tab>('rules')
  const [rules, setRules] = useState<UebaRuleDto[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [ruleTypeFilter, setRuleTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [thresholds, setThresholds] = useState<ThresholdBand[]>([])
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policySaving, setPolicySaving] = useState(false)

  const [editingRule, setEditingRule] = useState<UebaRuleDto | null>(null)
  const [form, setForm] = useState<Partial<UebaRuleDto>>({ name: '', ruleType: 'RISK_SCORING', priority: 100, enabled: true })
  const [saving, setSaving] = useState(false)

  const cardStyle = {
    background: theme === 'dark' ? '#2a2a2a' : '#fff',
    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px'
  }
  const inputStyle = (w = '100%') => ({
    width: w,
    padding: '8px',
    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
    borderRadius: '4px',
    background: theme === 'dark' ? '#333' : '#fff',
    color: theme === 'dark' ? '#fff' : '#000'
  })

  const loadRules = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.getUebaRules({
        page,
        size: 20,
        ...(ruleTypeFilter ? { ruleType: ruleTypeFilter } : {})
      })
      const d = res.data as { content?: UebaRuleDto[]; totalElements?: number; totalPages?: number }
      setRules(Array.isArray(d?.content) ? d.content : [])
      setTotalElements(d?.totalElements ?? 0)
      setTotalPages(d?.totalPages ?? 0)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load rules')
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  const loadPolicy = async () => {
    setPolicyLoading(true)
    try {
      const res = await apiClient.getUebaRiskAdaptivePolicy()
      const data = res.data as { thresholds?: ThresholdBand[] }
      setThresholds(Array.isArray(data?.thresholds) ? data.thresholds : [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load risk-adaptive policy')
    } finally {
      setPolicyLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'rules') loadRules()
    else loadPolicy()
  }, [tab, page, ruleTypeFilter])

  const handleSaveRule = async () => {
    if (!form.name?.trim() || !form.ruleType) return
    setSaving(true)
    setError('')
    try {
      if (editingRule?.id) {
        await apiClient.updateUebaRule(editingRule.id, form as UebaRuleDto)
      } else {
        await apiClient.createUebaRule(form as UebaRuleDto)
      }
      setEditingRule(null)
      setForm({ name: '', ruleType: 'RISK_SCORING', priority: 100, enabled: true })
      loadRules()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Delete this rule?')) return
    try {
      await apiClient.deleteUebaRule(id)
      if (editingRule?.id === id) setEditingRule(null)
      loadRules()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete rule')
    }
  }

  const handleToggleEnabled = async (id: number, enabled: boolean) => {
    try {
      await apiClient.setUebaRuleEnabled(id, enabled)
      loadRules()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update rule')
    }
  }

  const handleSavePolicy = async () => {
    setPolicySaving(true)
    setError('')
    try {
      await apiClient.setUebaRiskAdaptivePolicy(thresholds)
      loadPolicy()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save policy')
    } finally {
      setPolicySaving(false)
    }
  }

  const addBand = () => setThresholds([...thresholds, { min: 0, max: 100, action: 'NONE' }])
  const removeBand = (i: number) => setThresholds(thresholds.filter((_, idx) => idx !== i))
  const updateBand = (i: number, field: keyof ThresholdBand, value: number | string) => {
    const next = [...thresholds]
    next[i] = { ...next[i], [field]: value }
    setThresholds(next)
  }

  return (
    <DashboardLayout>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0 }}>UEBA Rules & Policy</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => navigate('/ueba')}>Back to risk overview</button>
          <button
            onClick={() => setTab('rules')}
            style={{ fontWeight: tab === 'rules' ? 600 : 400 }}
          >
            Rules
          </button>
          <button
            onClick={() => setTab('risk-adaptive')}
            style={{ fontWeight: tab === 'risk-adaptive' ? 600 : 400 }}
          >
            Risk-adaptive policy
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: '#f44336', color: '#f44336' }}>{error}</div>
      )}

      {tab === 'rules' && (
        <>
          <div style={{ ...cardStyle, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label>
              Rule type:
              <select
                value={ruleTypeFilter}
                onChange={e => { setRuleTypeFilter(e.target.value); setPage(0) }}
                style={{ marginLeft: '8px', ...inputStyle('140px') }}
              >
                <option value="">All</option>
                <option value="RISK_SCORING">RISK_SCORING</option>
                <option value="ANOMALY_DETECTION">ANOMALY_DETECTION</option>
                <option value="RESPONSE">RESPONSE</option>
                <option value="FEATURE_WEIGHT">FEATURE_WEIGHT</option>
              </select>
            </label>
            <button
              onClick={() => { setEditingRule(null); setForm({ name: '', ruleType: 'RISK_SCORING', conditionJson: '{"feature":"audit_failures","operator":"GT","value":0}', weight: 10, priority: 100, enabled: true }); }}
              style={{ padding: '8px 16px' }}
            >
              Add rule
            </button>
          </div>

          {(editingRule || form.name || form.conditionJson) && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>{editingRule ? 'Edit rule' : 'Add rule'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label>Name</label>
                  <input
                    value={form.name ?? ''}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={inputStyle()}
                    placeholder="Rule name"
                  />
                </div>
                <div>
                  <label>Type</label>
                  <select
                    value={form.ruleType ?? 'RISK_SCORING'}
                    onChange={e => setForm(f => ({ ...f, ruleType: e.target.value }))}
                    style={inputStyle()}
                  >
                    <option value="RISK_SCORING">RISK_SCORING</option>
                    <option value="ANOMALY_DETECTION">ANOMALY_DETECTION</option>
                    <option value="RESPONSE">RESPONSE</option>
                    <option value="FEATURE_WEIGHT">FEATURE_WEIGHT</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>{'Condition JSON (e.g. {"feature":"audit_failures","operator":"GT","value":2})'}</label>
                  <input
                    value={form.conditionJson ?? ''}
                    onChange={e => setForm(f => ({ ...f, conditionJson: e.target.value }))}
                    style={inputStyle()}
                    placeholder='{"feature":"audit_failures","operator":"GT","value":2}'
                  />
                </div>
                <div>
                  <label>Weight (scoring) or action (response)</label>
                  <input
                    value={form.ruleType === 'RESPONSE' ? (form.actionOrWeight ?? '') : (form.weight ?? '')}
                    onChange={e => {
                      const v = e.target.value
                      if (form.ruleType === 'RESPONSE') setForm(f => ({ ...f, actionOrWeight: v }))
                      else setForm(f => ({ ...f, weight: v === '' ? undefined : Number(v) }))
                    }}
                    style={inputStyle()}
                    placeholder="10 or STEP_UP_AUTH"
                  />
                </div>
                <div>
                  <label>Priority</label>
                  <input
                    type="number"
                    value={form.priority ?? 100}
                    onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value, 10) || 100 }))}
                    style={inputStyle()}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveRule} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => { setEditingRule(null); setForm({ name: '', ruleType: 'RISK_SCORING', priority: 100, enabled: true }); }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={cardStyle}>
            {loading ? (
              <p>Loading…</p>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Condition / weight</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Priority</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Enabled</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}` }}>
                        <td style={{ padding: '8px' }}>{r.name}</td>
                        <td style={{ padding: '8px' }}>{r.ruleType}</td>
                        <td style={{ padding: '8px', fontSize: '12px' }}>{r.conditionJson || '-'} / {r.weight ?? r.actionOrWeight ?? '-'}</td>
                        <td style={{ padding: '8px' }}>{r.priority}</td>
                        <td style={{ padding: '8px' }}>
                          <button
                            onClick={() => handleToggleEnabled(r.id!, !r.enabled)}
                            style={{ fontSize: '12px' }}
                          >
                            {r.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <button onClick={() => { setEditingRule(r); setForm({ ...r }); }}>Edit</button>
                          <button onClick={() => handleDeleteRule(r.id!)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
                    <span>Page {page + 1} / {totalPages}, {totalElements} total</span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {tab === 'risk-adaptive' && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Risk band → action</h3>
          <p style={{ color: '#888', marginBottom: '16px' }}>Configure recommended actions by risk score range (e.g. STEP_UP_AUTH, ESCALATE_APPROVAL, RESTRICT_ACCESS, SUSPEND_ACCOUNT). Saving replaces all RESPONSE-type rules.</p>
          {policyLoading ? (
            <p>Loading…</p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Min score</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Max score</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((band, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#eee'}` }}>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={band.min}
                          onChange={e => updateBand(i, 'min', parseInt(e.target.value, 10) || 0)}
                          style={inputStyle('80px')}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={band.max}
                          onChange={e => updateBand(i, 'max', parseInt(e.target.value, 10) || 100)}
                          style={inputStyle('80px')}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          value={band.action}
                          onChange={e => updateBand(i, 'action', e.target.value)}
                          style={inputStyle('180px')}
                          placeholder="STEP_UP_AUTH / ESCALATE_APPROVAL / NONE"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={() => removeBand(i)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addBand}>Add band</button>
                <button onClick={handleSavePolicy} disabled={policySaving}>{policySaving ? 'Saving…' : 'Save policy'}</button>
              </div>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
