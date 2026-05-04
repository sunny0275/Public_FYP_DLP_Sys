import { useState, useEffect } from 'react'
import { apiClient } from '../api'
import { useAuthStore } from '../store/authStore'

interface WorkflowTemplate {
  id: number
  name: string
  description: string
  workflowType: string
  status: string
}

interface SimulatedStep {
  stepNumber: number
  stepType: string
  stepName: string
  description: string
  approverType: string
  approverValue: string
  approverNames: string[]
  approverIds: number[]
  timeoutDays: number
  required: boolean
  parallel: boolean
  stepWarnings: string[]
}

interface SimulationResponse {
  templateId: number
  templateName: string
  workflowType: string
  steps: SimulatedStep[]
  totalSteps: number
  estimatedDurationDays: number
  valid: boolean
  warnings: string[]
  errors: string[]
}

interface SimulateFlowDialogProps {
  isOpen: boolean
  onClose: () => void
  documentId?: number
  classificationLevel?: string
  preselectedTemplateId?: number
  onWorkflowStarted?: (workflowId: number) => void
}

export default function SimulateFlowDialog({
  isOpen,
  onClose,
  documentId,
  classificationLevel,
  preselectedTemplateId,
  onWorkflowStarted
}: SimulateFlowDialogProps) {
  const user = useAuthStore((state) => state.user)
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(preselectedTemplateId || null)
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [contextJson, setContextJson] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
      if (preselectedTemplateId) {
        setSelectedTemplateId(preselectedTemplateId)
        runSimulation(preselectedTemplateId)
      }
    }
  }, [isOpen, preselectedTemplateId])

  const loadTemplates = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.getWorkflowTemplates()
      setTemplates(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load workflow templates')
    } finally {
      setLoading(false)
    }
  }

  const runSimulation = async (templateId: number) => {
    if (!user) return

    setSimulating(true)
    setError('')
    setSimulation(null)

    try {
      const response = await apiClient.simulateWorkflow({
        templateId,
        userId: user.userId,
        documentId,
        classificationLevel
      })
      setSimulation(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to simulate workflow')
    } finally {
      setSimulating(false)
    }
  }

  const handleTemplateSelect = (templateId: number) => {
    setSelectedTemplateId(templateId)
    runSimulation(templateId)
  }

  const handleStartWorkflow = async () => {
    if (!selectedTemplateId) return

    setStarting(true)
    setError('')

    try {
      const response = await apiClient.startWorkflow({
        templateId: selectedTemplateId,
        documentId,
        contextJson: contextJson || undefined
      })

      if (onWorkflowStarted) {
        onWorkflowStarted(response.data.id)
      }

      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start workflow')
    } finally {
      setStarting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '24px', margin: 0 }}>Preview Workflow Approval Chain</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#666',
              padding: 0,
              width: '32px',
              height: '32px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              background: '#ffebee',
              padding: '16px',
              borderRadius: '8px',
              color: '#c62828',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          {/* Template Selection */}
          {!preselectedTemplateId && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Select Workflow Template
              </label>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => handleTemplateSelect(parseInt(e.target.value))}
                disabled={loading || simulating}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">-- Select a template --</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.workflowType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Context JSON (Optional) */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Additional Context (Optional JSON)
            </label>
            <textarea
              value={contextJson}
              onChange={(e) => setContextJson(e.target.value)}
              placeholder='{"reason": "Urgent approval needed", "priority": "HIGH"}'
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'monospace',
                minHeight: '60px'
              }}
            />
          </div>

          {/* Loading State */}
          {simulating && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '18px', marginBottom: '12px' }}>Simulating workflow...</div>
              <div style={{ fontSize: '14px' }}>Resolving approvers and calculating timeline</div>
            </div>
          )}

          {/* Simulation Results */}
          {simulation && !simulating && (
            <div>
              {/* Summary */}
              <div style={{
                background: '#f5f5f5',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <h3 style={{ fontSize: '18px', marginTop: 0, marginBottom: '12px' }}>
                  {simulation.templateName}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Workflow Type</div>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>{simulation.workflowType}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Total Steps</div>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>{simulation.totalSteps}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Estimated Duration</div>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>
                      {simulation.estimatedDurationDays} days
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {simulation.errors.length > 0 && (
                <div style={{
                  background: '#ffebee',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontWeight: '600', color: '#c62828', marginBottom: '8px' }}>
                    ⚠️ Validation Errors
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#c62828' }}>
                    {simulation.errors.map((err, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {simulation.warnings.length > 0 && (
                <div style={{
                  background: '#fff3cd',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontWeight: '600', color: '#856404', marginBottom: '8px' }}>
                    ⚠️ Warnings
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404' }}>
                    {simulation.warnings.map((warn, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Approval Chain Steps */}
              {simulation.steps.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '16px', marginBottom: '16px' }}>Approval Chain Preview</h4>

                  {simulation.steps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '12px',
                        position: 'relative'
                      }}
                    >
                      {/* Step Number Badge */}
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '16px',
                        background: '#2196f3',
                        color: 'white',
                        borderRadius: '12px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        Step {step.stepNumber}
                      </div>

                      {/* Step Header */}
                      <div style={{ marginTop: '8px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '600' }}>{step.stepName}</span>
                          {step.required && (
                            <span style={{
                              background: '#f44336',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              REQUIRED
                            </span>
                          )}
                          {step.parallel && (
                            <span style={{
                              background: '#ff9800',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              PARALLEL
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>{step.description}</div>
                      </div>

                      {/* Approver Info */}
                      <div style={{
                        background: '#f9f9f9',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                          Approver Rule: <strong>{step.approverType}</strong> ({step.approverValue})
                        </div>

                        {step.approverNames.length > 0 ? (
                          <div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                              Resolved Approvers:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {step.approverNames.map((name, nameIdx) => (
                                <span
                                  key={nameIdx}
                                  style={{
                                    background: '#4caf50',
                                    color: 'white',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '12px'
                                  }}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: '#f44336', fontSize: '13px' }}>
                            ⚠️ No approvers found for this rule
                          </div>
                        )}
                      </div>

                      {/* Timeout */}
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        ⏱️ Timeout: <strong>{step.timeoutDays} days</strong>
                      </div>

                      {/* Step Warnings */}
                      {step.stepWarnings.length > 0 && (
                        <div style={{
                          marginTop: '12px',
                          padding: '10px',
                          background: '#fff3cd',
                          borderRadius: '6px'
                        }}>
                          <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                            Step Warnings:
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#856404' }}>
                            {step.stepWarnings.map((warn, warnIdx) => (
                              <li key={warnIdx}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Connector Arrow */}
                      {idx < simulation.steps.length - 1 && (
                        <div style={{
                          textAlign: 'center',
                          color: '#2196f3',
                          fontSize: '24px',
                          margin: '8px 0 -20px 0'
                        }}>
                          {step.parallel ? '⇊' : '↓'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {simulation.steps.length === 0 && simulation.errors.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#666',
                  background: '#f5f5f5',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '18px', marginBottom: '8px' }}>No workflow steps configured</div>
                  <div style={{ fontSize: '14px' }}>This template needs to be configured before use.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={starting}
            style={{
              padding: '10px 24px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: 'white',
              cursor: starting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>

          {simulation && (
            <button
              onClick={handleStartWorkflow}
              disabled={!simulation.valid || simulation.errors.length > 0 || starting || !selectedTemplateId}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                background: simulation.valid && simulation.errors.length === 0 && !starting
                  ? '#4caf50'
                  : '#ccc',
                color: 'white',
                cursor: simulation.valid && simulation.errors.length === 0 && !starting
                  ? 'pointer'
                  : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {starting ? 'Starting Workflow...' : 'Start Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
