import { useState, useEffect } from 'react'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'

interface WorkflowStatistics {
  totalWorkflows: number
  completedWorkflows: number
  runningWorkflows: number
  cancelledWorkflows: number
  averageDurationDays: number
  approvalRate: number
  timeoutRate: number
  completionRate: number
  period: string
  byTemplate: TemplateStatistics[]
  byDepartment: DepartmentStatistics[]
  trends: TrendData[]
}

interface TemplateStatistics {
  templateId: number
  templateName: string
  totalWorkflows: number
  avgDurationDays: number
  approvalRate: number
  completedCount: number
  runningCount: number
  cancelledCount: number
}

interface DepartmentStatistics {
  department: string
  totalWorkflows: number
  avgDurationDays: number
  approvalRate: number
}

interface TrendData {
  date: string
  started: number
  completed: number
  cancelled: number
}

export default function FlowStatisticsPage() {
  const [stats, setStats] = useState<WorkflowStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [periodFilter, setPeriodFilter] = useState<number | null>(30)

  useEffect(() => {
    loadStatistics()
  }, [periodFilter])

  const loadStatistics = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getWorkflowStatistics(null, periodFilter)
      setStats(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <p>Loading statistics...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div style={{ padding: '24px' }}>
          <div style={{
            background: '#ffebee',
            padding: '20px',
            borderRadius: '8px',
            color: '#c62828'
          }}>
            {error}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!stats) return null

  return (
    <DashboardLayout>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <h1 style={{ fontSize: '28px', margin: 0 }}>Workflow Statistics</h1>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              Period: {stats.period}
            </p>
          </div>

          {/* Period Filter */}
          <select
            value={periodFilter || 'all'}
            onChange={(e) => setPeriodFilter(e.target.value === 'all' ? null : parseInt(e.target.value))}
            style={{
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <StatCard
            title="Total Workflows"
            value={stats.totalWorkflows.toString()}
            icon="📊"
            color="#2196f3"
          />
          <StatCard
            title="Average Duration"
            value={`${stats.averageDurationDays} days`}
            icon="⏱️"
            color="#ff9800"
          />
          <StatCard
            title="Approval Rate"
            value={`${stats.approvalRate}%`}
            icon="✓"
            color="#4caf50"
          />
          <StatCard
            title="Completion Rate"
            value={`${stats.completionRate}%`}
            icon="🎯"
            color="#9c27b0"
          />
        </div>

        {/* Status Breakdown */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Workflow Status Breakdown</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px'
          }}>
            <StatusCard
              label="Completed"
              count={stats.completedWorkflows}
              total={stats.totalWorkflows}
              color="#4caf50"
            />
            <StatusCard
              label="Running"
              count={stats.runningWorkflows}
              total={stats.totalWorkflows}
              color="#2196f3"
            />
            <StatusCard
              label="Cancelled"
              count={stats.cancelledWorkflows}
              total={stats.totalWorkflows}
              color="#f44336"
            />
          </div>
        </div>

        {/* Template Performance */}
        {stats.byTemplate.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '30px'
          }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Performance by Template</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Template</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Total</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Avg Duration</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Approval Rate</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.byTemplate.map(template => (
                  <tr key={template.templateId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{template.templateName}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{template.totalWorkflows}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{template.avgDurationDays} days</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        background: template.approvalRate >= 80 ? '#e8f5e9' : template.approvalRate >= 60 ? '#fff3cd' : '#ffebee',
                        color: template.approvalRate >= 80 ? '#2e7d32' : template.approvalRate >= 60 ? '#856404' : '#c62828',
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}>
                        {template.approvalRate}%
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px' }}>
                      <span style={{ color: '#4caf50' }}>✓ {template.completedCount}</span>
                      {' | '}
                      <span style={{ color: '#2196f3' }}>● {template.runningCount}</span>
                      {' | '}
                      <span style={{ color: '#f44336' }}>✗ {template.cancelledCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Department Performance */}
        {stats.byDepartment.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '30px'
          }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Performance by Department</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {stats.byDepartment.map(dept => (
                <div
                  key={dept.department}
                  style={{
                    background: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                    {dept.department}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    <div style={{ marginBottom: '4px' }}>Total: <strong>{dept.totalWorkflows}</strong></div>
                    <div style={{ marginBottom: '4px' }}>Avg Duration: <strong>{dept.avgDurationDays} days</strong></div>
                    <div>Approval Rate: <strong>{dept.approvalRate}%</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trends Chart (Simple Bar Chart) */}
        {stats.trends.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Workflow Trends (Last 30 Days)</h2>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: '4px', minWidth: '600px', alignItems: 'flex-end', height: '200px' }}>
                {stats.trends.slice(-14).map((trend, index) => {
                  const maxValue = Math.max(...stats.trends.map(t => t.started + t.completed + t.cancelled), 1)
                  const totalHeight = ((trend.started + trend.completed + trend.cancelled) / maxValue) * 180

                  return (
                    <div
                      key={index}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <div style={{
                        width: '100%',
                        height: `${totalHeight}px`,
                        background: `linear-gradient(to top, #4caf50 0%, #4caf50 ${(trend.completed / (trend.started + trend.completed + trend.cancelled)) * 100}%, #2196f3 ${(trend.completed / (trend.started + trend.completed + trend.cancelled)) * 100}%, #2196f3 100%)`,
                        borderRadius: '4px 4px 0 0',
                        position: 'relative',
                        minHeight: '2px'
                      }} title={`Started: ${trend.started}, Completed: ${trend.completed}, Cancelled: ${trend.cancelled}`} />
                      <div style={{ fontSize: '10px', color: '#666', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                        {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '30px', justifyContent: 'center', fontSize: '13px' }}>
                <div><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#4caf50', marginRight: '4px' }}></span> Completed</div>
                <div><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#2196f3', marginRight: '4px' }}></span> Started</div>
                <div><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#f44336', marginRight: '4px' }}></span> Cancelled</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

// Helper Components

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>{title}</div>
        <div style={{ fontSize: '24px' }}>{icon}</div>
      </div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: color }}>{value}</div>
    </div>
  )
}

function StatusCard({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '36px', fontWeight: 'bold', color: color, marginBottom: '8px' }}>
        {count}
      </div>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>{label}</div>
      <div style={{ background: '#f0f0f0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: `${percentage}%`, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{percentage}%</div>
    </div>
  )
}
