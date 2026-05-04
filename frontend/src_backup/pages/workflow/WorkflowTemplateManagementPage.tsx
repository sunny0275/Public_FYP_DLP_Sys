import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import WorkflowBuilder from '../../components/WorkflowBuilder'
import '../../modal.css'

interface WorkflowTemplate {
  id: number
  name: string
  description: string
  workflowType: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  version: number
  stepsJson: string
  createdBy: number
  createdByName?: string
  publishedBy?: number
  archivedBy?: number
  createdAt: string
  updatedAt: string
  publishedAt?: string
  archivedAt?: string
}

interface WorkflowStep {
  id: string
  type: 'APPROVAL' | 'PARALLEL' | 'CONDITIONAL' | 'SERVICE' | 'SIGNATURE'
  name: string
  approverRule: {
    type: 'ROLE' | 'DEPARTMENT' | 'SPECIFIC_USER' | 'MIXED'
    value: string
  }
  timeoutDays?: number
  required: boolean
}

type FilterStatus = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export default function WorkflowTemplateManagementPage() {
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Edit/Create modal
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formWorkflowType, setFormWorkflowType] = useState('APPROVAL')
  const [formStepsJson, setFormStepsJson] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Validation modal
  const [showValidation, setShowValidation] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)

  // Editor mode (visual vs JSON)
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual')
  const [parsedSteps, setParsedSteps] = useState<WorkflowStep[]>([])

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getAllWorkflowTemplates()
      setTemplates(response.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setIsCreating(true)
    setEditingTemplate(null)
    setFormName('')
    setFormDescription('')
    setFormWorkflowType('APPROVAL')
    setFormStepsJson('[]')
    setParsedSteps([])
    setEditorMode('visual')
    setShowEditor(true)
  }

  const handleEdit = (template: WorkflowTemplate) => {
    if (template.status !== 'DRAFT') {
      alert('Can only edit draft templates. Create a new version instead.')
      return
    }

    setIsCreating(false)
    setEditingTemplate(template)
    setFormName(template.name)
    setFormDescription(template.description)
    setFormWorkflowType(template.workflowType)
    setFormStepsJson(template.stepsJson)

    // Try to parse existing steps for visual editor
    try {
      const steps = JSON.parse(template.stepsJson)
      setParsedSteps(Array.isArray(steps) ? steps : [])
    } catch (e) {
      setParsedSteps([])
    }

    setEditorMode('visual')
    setShowEditor(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      alert('Template name is required')
      return
    }

    if (!formStepsJson.trim()) {
      alert('Workflow steps are required')
      return
    }

    setSubmitting(true)

    try {
      const data = {
        name: formName,
        description: formDescription,
        workflowType: formWorkflowType,
        stepsJson: formStepsJson
      }

      if (isCreating) {
        await apiClient.createWorkflowTemplate(data)
        alert('Template created successfully!')
      } else if (editingTemplate) {
        await apiClient.updateWorkflowTemplate(editingTemplate.id, data)
        alert('Template updated successfully!')
      }

      setShowEditor(false)
      loadTemplates()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save template')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async (templateId: number) => {
    if (!confirm('Publish this template? It cannot be modified after publishing.')) return

    try {
      await apiClient.publishWorkflowTemplate(templateId)
      alert('Template published successfully!')
      loadTemplates()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to publish template')
    }
  }

  const handleArchive = async (templateId: number) => {
    if (!confirm('Archive this template? It will no longer be available for new workflows.')) return

    try {
      await apiClient.archiveWorkflowTemplate(templateId)
      alert('Template archived successfully!')
      loadTemplates()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to archive template')
    }
  }

  const handleDelete = async (templateId: number) => {
    if (!confirm('Delete this template? This action cannot be undone.')) return

    try {
      await apiClient.deleteWorkflowTemplate(templateId)
      alert('Template deleted successfully!')
      loadTemplates()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete template')
    }
  }

  const handleValidate = async () => {
    try {
      // Sync visual editor to JSON before validation
      if (editorMode === 'visual') {
        setFormStepsJson(JSON.stringify(parsedSteps, null, 2))
      }

      const data = {
        name: formName,
        description: formDescription,
        workflowType: formWorkflowType,
        stepsJson: editorMode === 'visual' ? JSON.stringify(parsedSteps) : formStepsJson
      }

      const response = await apiClient.validateWorkflowTemplate(data)
      setValidationResult(response.data)
      setShowValidation(true)
    } catch (err: any) {
      alert('Validation failed: ' + (err.response?.data?.message || 'Unknown error'))
    }
  }

  const handleStepsChange = (steps: WorkflowStep[]) => {
    setParsedSteps(steps)
    setFormStepsJson(JSON.stringify(steps, null, 2))
  }

  const handleEditorModeChange = (mode: 'visual' | 'json') => {
    if (mode === 'json' && editorMode === 'visual') {
      // Switching from visual to JSON: update JSON from visual
      setFormStepsJson(JSON.stringify(parsedSteps, null, 2))
    } else if (mode === 'visual' && editorMode === 'json') {
      // Switching from JSON to visual: parse JSON
      try {
        const steps = JSON.parse(formStepsJson)
        setParsedSteps(Array.isArray(steps) ? steps : [])
      } catch (e) {
        alert('Invalid JSON format. Please fix JSON syntax before switching to visual editor.')
        return
      }
    }
    setEditorMode(mode)
  }

  const filteredTemplates = templates.filter(template => {
    // Status filter
    if (statusFilter !== 'ALL' && template.status !== statusFilter) {
      return false
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return template.name.toLowerCase().includes(query) ||
             template.description?.toLowerCase().includes(query) ||
             template.workflowType.toLowerCase().includes(query)
    }

    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return '#ff9800'
      case 'PUBLISHED': return '#4caf50'
      case 'ARCHIVED': return '#9e9e9e'
      default: return '#666'
    }
  }

  const getStatusBadge = (status: string) => (
    <span style={{
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
      background: getStatusColor(status),
      color: 'white'
    }}>
      {status}
    </span>
  )

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
          <h1 style={{ fontSize: '28px', margin: 0 }}>Workflow Template Management</h1>
          <button
            onClick={handleCreate}
            style={{
              padding: '12px 24px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            + Create New Template
          </button>
        </div>

        {/* Filters */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            style={{
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <button
            onClick={loadTemplates}
            style={{
              padding: '10px 20px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>

        {/* Templates Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p>Loading templates...</p>
          </div>
        ) : error ? (
          <div style={{
            background: '#ffebee',
            padding: '20px',
            borderRadius: '8px',
            color: '#c62828'
          }}>
            {error}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '60px',
            borderRadius: '8px',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '18px', color: '#666' }}>No templates found</p>
            <button
              onClick={handleCreate}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Create Your First Template
            </button>
          </div>
        ) : (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f5f5f5' }}>
                <tr>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Version</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Created</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map(template => (
                  <tr key={template.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: '500' }}>{template.name}</div>
                      {template.description && (
                        <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                          {template.description.length > 80
                            ? template.description.substring(0, 80) + '...'
                            : template.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>{template.workflowType}</td>
                    <td style={{ padding: '16px' }}>{getStatusBadge(template.status)}</td>
                    <td style={{ padding: '16px' }}>v{template.version || 1}.0</td>
                    <td style={{ padding: '16px', fontSize: '13px' }}>
                      {new Date(template.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {template.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleEdit(template)}
                              style={{
                                padding: '6px 12px',
                                background: '#2196f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handlePublish(template.id)}
                              style={{
                                padding: '6px 12px',
                                background: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              Publish
                            </button>
                            <button
                              onClick={() => handleDelete(template.id)}
                              style={{
                                padding: '6px 12px',
                                background: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {template.status === 'PUBLISHED' && (
                          <button
                            onClick={() => handleArchive(template.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#ff9800',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '13px'
                            }}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/workflows/${template.id}`)}
                          style={{
                            padding: '6px 12px',
                            background: '#9e9e9e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Editor Modal */}
        {showEditor && (
          <div className="modal-overlay" onClick={() => setShowEditor(false)}>
            <div
              className="modal-content"
              style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{isCreating ? 'Create New Template' : 'Edit Template'}</h2>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Document Approval Workflow"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the purpose of this workflow template..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Workflow Type *
                </label>
                <select
                  value={formWorkflowType}
                  onChange={(e) => setFormWorkflowType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px'
                  }}
                >
                  <option value="APPROVAL">Approval</option>
                  <option value="REVIEW">Review</option>
                  <option value="SIGNATURE">Signature</option>
                  <option value="CONDITIONAL">Conditional</option>
                  <option value="PARALLEL">Parallel</option>
                </select>
              </div>

              {/* Editor Mode Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Workflow Steps *
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => handleEditorModeChange('visual')}
                    style={{
                      padding: '8px 16px',
                      background: editorMode === 'visual' ? '#2196f3' : '#e0e0e0',
                      color: editorMode === 'visual' ? 'white' : '#666',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: editorMode === 'visual' ? 'bold' : 'normal'
                    }}
                  >
                    Visual Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditorModeChange('json')}
                    style={{
                      padding: '8px 16px',
                      background: editorMode === 'json' ? '#2196f3' : '#e0e0e0',
                      color: editorMode === 'json' ? 'white' : '#666',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: editorMode === 'json' ? 'bold' : 'normal'
                    }}
                  >
                    JSON Editor
                  </button>
                </div>

                {/* Visual Builder */}
                {editorMode === 'visual' ? (
                  <div style={{
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    padding: '16px',
                    background: '#fafafa',
                    minHeight: '300px'
                  }}>
                    <WorkflowBuilder
                      steps={parsedSteps}
                      onStepsChange={handleStepsChange}
                      onValidate={handleValidate}
                    />
                  </div>
                ) : (
                  <textarea
                    value={formStepsJson}
                    onChange={(e) => setFormStepsJson(e.target.value)}
                    placeholder='[{"id":"step-1","type":"APPROVAL","name":"Supervisor Approval","approverRule":{"type":"ROLE","value":"ROLE_SUPERVISOR"},"timeoutDays":3,"required":true}]'
                    rows={10}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      resize: 'vertical',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  onClick={handleValidate}
                  style={{
                    padding: '10px 20px',
                    background: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Validate
                </button>
                <button
                  onClick={() => setShowEditor(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#9e9e9e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    background: submitting ? '#ccc' : '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Saving...' : isCreating ? 'Create' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Modal */}
        {showValidation && validationResult && (
          <div className="modal-overlay" onClick={() => setShowValidation(false)}>
            <div
              className="modal-content"
              style={{ maxWidth: '600px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Template Validation Result</h2>

              {validationResult.valid ? (
                <div style={{
                  background: '#e8f5e9',
                  padding: '16px',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}>
                  <p style={{ color: '#2e7d32', fontWeight: 'bold', margin: 0 }}>
                    ✓ Template is valid!
                  </p>
                </div>
              ) : (
                <div style={{
                  background: '#ffebee',
                  padding: '16px',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}>
                  <p style={{ color: '#c62828', fontWeight: 'bold', margin: 0 }}>
                    ✗ Template has errors
                  </p>
                </div>
              )}

              {validationResult.errors && validationResult.errors.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', color: '#c62828' }}>Errors:</h3>
                  <ul style={{ color: '#c62828' }}>
                    {validationResult.errors.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', color: '#ff9800' }}>Warnings:</h3>
                  <ul style={{ color: '#ff9800' }}>
                    {validationResult.warnings.map((warning: string, index: number) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ textAlign: 'right', marginTop: '24px' }}>
                <button
                  onClick={() => setShowValidation(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
