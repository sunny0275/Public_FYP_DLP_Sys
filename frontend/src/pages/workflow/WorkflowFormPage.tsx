import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'
import SimulateFlowDialog from '../../components/SimulateFlowDialog'
import '../../modal.css'

interface WorkflowTemplate {
  id: number
  name: string
  description: string
  workflowType: string
  stepsJson: string
  version: number
  status: string
  createdBy: number
  publishedBy: number | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

interface WorkflowInstance {
  id: number
  templateId: number
  templateName: string
  documentId: number | null
  documentName: string | null
  shareId: number | null
  applicantId: number
  applicantName: string
  status: string
  decision: string | null
  currentStep: number
  totalSteps: number
  reason: string
  startedAt: string
  completedAt: string | null
}

type Tab = 'start' | 'my-workflows'

export default function WorkflowFormPage() {
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>('start')
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [myWorkflows, setMyWorkflows] = useState<WorkflowInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Start workflow form
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [documentId, setDocumentId] = useState('')
  const [shareId, setShareId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [createdWorkflowId, setCreatedWorkflowId] = useState<number | null>(null)

  // Workflow list pagination
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Workflow details modal
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowInstance | null>(null)
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false)

  // Simulate workflow dialog
  const [showSimulateDialog, setShowSimulateDialog] = useState(false)

  useEffect(() => {
    if (activeTab === 'start') {
      loadTemplates()
    } else {
      loadMyWorkflows()
    }
  }, [activeTab, page])

  const loadTemplates = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getWorkflowTemplates()
      setTemplates(response.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load workflow templates')
    } finally {
      setLoading(false)
    }
  }

  const loadMyWorkflows = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getUserWorkflows(page, 20)
      setMyWorkflows(response.data?.content || [])
      setTotalPages(response.data?.totalPages || 1)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }

  const handleStartWorkflow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) {
      alert('Please select a workflow template')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess(false)

    try {
      const workflowData: any = {
        templateId: selectedTemplate.id,
        reason: reason.trim() || undefined
      }

      if (documentId.trim()) {
        workflowData.documentId = Number(documentId)
      }
      if (shareId.trim()) {
        workflowData.shareId = Number(shareId)
      }

      const response = await apiClient.startWorkflow(workflowData)
      setSuccess(true)
      setCreatedWorkflowId(response.data?.id || null)

      // Reset form
      setSelectedTemplate(null)
      setDocumentId('')
      setShareId('')
      setReason('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start workflow')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewWorkflow = async (workflow: WorkflowInstance) => {
    try {
      const response = await apiClient.getWorkflowInstance(workflow.id)
      setSelectedWorkflow(response.data)
      setShowWorkflowDetails(true)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load workflow details')
    }
  }

  const handleCancelWorkflow = async (workflowId: number) => {
    const reason = prompt('Enter reason for cancellation:')
    if (!reason) return

    try {
      await apiClient.cancelWorkflow(workflowId, reason)
      loadMyWorkflows()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel workflow')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#2196f3'
      case 'IN_PROGRESS': return '#ff9800'
      case 'COMPLETED': return '#4caf50'
      case 'CANCELLED': return '#f44336'
      case 'REJECTED': return '#f44336'
      default: return '#888'
    }
  }

  const getDecisionColor = (decision: string | null) => {
    if (!decision) return '#888'
    switch (decision) {
      case 'APPROVED': return '#4caf50'
      case 'REJECTED': return '#f44336'
      default: return '#888'
    }
  }

  if (loading && (templates.length === 0 && myWorkflows.length === 0)) {
    return (
      <DashboardLayout>
        <div className="dashboard">
          <h2>Workflow Management</h2>
          <p>Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="dashboard">
        <div style={{ marginBottom: '24px' }}>
          <h1>Workflow Management</h1>
          <p style={{ color: '#666', marginTop: '8px' }}>Start new workflows and track existing ones</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '2px solid #e0e0e0' }}>
          <button
            onClick={() => setActiveTab('start')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: activeTab === 'start' ? '3px solid #007bff' : 'none',
              fontWeight: activeTab === 'start' ? 'bold' : 'normal',
              fontSize: '1em'
            }}
          >
            Start Workflow
          </button>
          <button
            onClick={() => setActiveTab('my-workflows')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: activeTab === 'my-workflows' ? '3px solid #007bff' : 'none',
              fontWeight: activeTab === 'my-workflows' ? 'bold' : 'normal',
              fontSize: '1em'
            }}
          >
            My Workflows
          </button>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>
        )}

        {success && (
          <div className="success-message" style={{ marginBottom: '20px' }}>
            Workflow started successfully!
            {createdWorkflowId && (
              <button
                onClick={() => {
                  setActiveTab('my-workflows')
                  setSuccess(false)
                }}
                style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '0.9em' }}
              >
                View My Workflows
              </button>
            )}
          </div>
        )}

        {/* Start Workflow Tab */}
        {activeTab === 'start' && (
          <div>
            <div className="dashboard-card" style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '16px' }}>Select a Workflow Template</h3>

              {templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <p>No workflow templates available</p>
                  <p style={{ fontSize: '0.9em', marginTop: '8px' }}>Contact an administrator to create workflow templates</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {templates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      style={{
                        padding: '16px',
                        border: selectedTemplate?.id === template.id ? '2px solid #007bff' : '1px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: selectedTemplate?.id === template.id ? '#f0f8ff' : undefined
                      }}
                    >
                      <h4 style={{ marginBottom: '8px' }}>{template.name}</h4>
                      <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '12px' }}>
                        {template.description}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.8em' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          background: '#007bff22',
                          color: '#007bff'
                        }}>
                          {template.workflowType}
                        </span>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          background: '#4caf5022',
                          color: '#4caf50'
                        }}>
                          v{template.version}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedTemplate && (
              <div className="dashboard-card">
                <h3 style={{ marginBottom: '16px' }}>Start Workflow: {selectedTemplate.name}</h3>

                <form onSubmit={handleStartWorkflow}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Workflow Type
                    </label>
                    <input
                      type="text"
                      value={selectedTemplate.workflowType}
                      readOnly
                      style={{ width: '100%', padding: '8px', background: '#f0f0f0' }}
                    />
                  </div>

                  {selectedTemplate.workflowType === 'DOCUMENT_APPROVAL' && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                        Document ID (Optional)
                      </label>
                      <input
                        type="number"
                        value={documentId}
                        onChange={(e) => setDocumentId(e.target.value)}
                        placeholder="Enter document ID if applicable"
                        style={{ width: '100%', padding: '8px' }}
                      />
                      <small style={{ color: '#666' }}>Leave empty if not related to a specific document</small>
                    </div>
                  )}

                  {selectedTemplate.workflowType === 'SHARE_APPROVAL' && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                        Share ID (Optional)
                      </label>
                      <input
                        type="number"
                        value={shareId}
                        onChange={(e) => setShareId(e.target.value)}
                        placeholder="Enter share link ID if applicable"
                        style={{ width: '100%', padding: '8px' }}
                      />
                      <small style={{ color: '#666' }}>Leave empty if not related to a specific share</small>
                    </div>
                  )}

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Reason / Description
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why you are starting this workflow..."
                      style={{ width: '100%', padding: '10px', minHeight: '100px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(null)
                        setDocumentId('')
                        setShareId('')
                        setReason('')
                      }}
                      style={{ padding: '10px 20px', background: '#6c757d' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSimulateDialog(true)}
                      style={{ padding: '10px 20px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Preview Approval Chain
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{ padding: '10px 20px', background: '#007bff' }}
                    >
                      {submitting ? 'Starting...' : 'Start Workflow'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* My Workflows Tab */}
        {activeTab === 'my-workflows' && (
          <div>
            {myWorkflows.length === 0 ? (
              <div className="dashboard-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
                <h3>No workflows found</h3>
                <p>You haven't started any workflows yet.</p>
                <button
                  onClick={() => setActiveTab('start')}
                  style={{ marginTop: '16px', padding: '10px 20px', background: '#007bff' }}
                >
                  Start a Workflow
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {myWorkflows.map(workflow => (
                  <div
                    key={workflow.id}
                    className="dashboard-card"
                    style={{ padding: '20px', cursor: 'pointer' }}
                    onClick={() => handleViewWorkflow(workflow)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ marginBottom: '8px' }}>{workflow.templateName}</h3>
                        <p style={{ color: '#666', fontSize: '0.9em', marginBottom: '12px' }}>
                          {workflow.reason || 'No reason provided'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8em',
                          fontWeight: '600',
                          background: getStatusColor(workflow.status) + '22',
                          color: getStatusColor(workflow.status)
                        }}>
                          {workflow.status}
                        </span>
                        {workflow.decision && (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.8em',
                            fontWeight: '600',
                            background: getDecisionColor(workflow.decision) + '22',
                            color: getDecisionColor(workflow.decision)
                          }}>
                            {workflow.decision}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', fontSize: '0.85em', color: '#666', marginBottom: '16px' }}>
                      <div>
                        <strong>Progress:</strong> Step {workflow.currentStep} of {workflow.totalSteps}
                      </div>
                      {workflow.documentName && (
                        <div>
                          <strong>Document:</strong> {workflow.documentName}
                        </div>
                      )}
                      <div>
                        <strong>Started:</strong> {new Date(workflow.startedAt).toLocaleDateString()}
                      </div>
                    </div>

                    {workflow.status === 'PENDING' || workflow.status === 'IN_PROGRESS' && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleCancelWorkflow(workflow.id)}
                          style={{ padding: '6px 12px', background: '#f44336', fontSize: '0.9em' }}
                        >
                          Cancel Workflow
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{ padding: '8px 16px' }}
                >
                  Previous
                </button>
                <span style={{ padding: '8px 16px', background: '#f0f0f0', borderRadius: '4px' }}>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{ padding: '8px 16px' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflow Details Modal */}
      {showWorkflowDetails && selectedWorkflow && (
        <div className="modal-overlay" onClick={() => setShowWorkflowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Workflow Details</h2>
              <button className="modal-close" onClick={() => setShowWorkflowDetails(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '8px' }}>{selectedWorkflow.templateName}</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.85em',
                    fontWeight: '600',
                    background: getStatusColor(selectedWorkflow.status) + '22',
                    color: getStatusColor(selectedWorkflow.status)
                  }}>
                    {selectedWorkflow.status}
                  </span>
                  {selectedWorkflow.decision && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.85em',
                      fontWeight: '600',
                      background: getDecisionColor(selectedWorkflow.decision) + '22',
                      color: getDecisionColor(selectedWorkflow.decision)
                    }}>
                      {selectedWorkflow.decision}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Reason</div>
                  <div>{selectedWorkflow.reason || 'No reason provided'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Progress</div>
                  <div>
                    Step {selectedWorkflow.currentStep} of {selectedWorkflow.totalSteps}
                    <div style={{
                      marginTop: '8px',
                      height: '8px',
                      background: '#e0e0e0',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${(selectedWorkflow.currentStep / selectedWorkflow.totalSteps) * 100}%`,
                        background: '#007bff',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Applicant</div>
                  <div>{selectedWorkflow.applicantName}</div>
                </div>

                {selectedWorkflow.documentName && (
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Related Document</div>
                    <div>
                      {selectedWorkflow.documentName}
                      {selectedWorkflow.documentId && (
                        <button
                          onClick={() => navigate(`/documents/${selectedWorkflow.documentId}`)}
                          style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '0.85em' }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Started At</div>
                  <div>{new Date(selectedWorkflow.startedAt).toLocaleString()}</div>
                </div>

                {selectedWorkflow.completedAt && (
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Completed At</div>
                    <div>{new Date(selectedWorkflow.completedAt).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowWorkflowDetails(false)}
                style={{ padding: '10px 20px', background: '#6c757d' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate Workflow Dialog */}
      {selectedTemplate && (
        <SimulateFlowDialog
          isOpen={showSimulateDialog}
          onClose={() => setShowSimulateDialog(false)}
          preselectedTemplateId={selectedTemplate.id}
          documentId={documentId ? parseInt(documentId) : undefined}
          onWorkflowStarted={(workflowId: number) => {
            setShowSimulateDialog(false)
            setSuccess(true)
            setCreatedWorkflowId(workflowId)
            setSelectedTemplate(null)
            setDocumentId('')
            setShareId('')
            setReason('')
          }}
        />
      )}
    </DashboardLayout>
  )
}
