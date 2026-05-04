import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'

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
  description?: string
}

interface WorkflowBuilderProps {
  steps: WorkflowStep[]
  onStepsChange: (steps: WorkflowStep[]) => void
  onValidate?: () => void
}

export default function WorkflowBuilder({ steps, onStepsChange, onValidate }: WorkflowBuilderProps) {
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [showStepEditor, setShowStepEditor] = useState(false)

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(steps)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    onStepsChange(items)
  }

  const handleAddStep = () => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type: 'APPROVAL',
      name: 'New Approval Step',
      approverRule: {
        type: 'ROLE',
        value: ''
      },
      timeoutDays: 3,
      required: true,
      description: ''
    }

    setEditingStep(newStep)
    setShowStepEditor(true)
  }

  const handleEditStep = (step: WorkflowStep) => {
    setEditingStep({ ...step })
    setShowStepEditor(true)
  }

  const handleSaveStep = (step: WorkflowStep) => {
    const existingIndex = steps.findIndex(s => s.id === step.id)

    if (existingIndex >= 0) {
      // Update existing step
      const updatedSteps = [...steps]
      updatedSteps[existingIndex] = step
      onStepsChange(updatedSteps)
    } else {
      // Add new step
      onStepsChange([...steps, step])
    }

    setShowStepEditor(false)
    setEditingStep(null)
  }

  const handleDeleteStep = (stepId: string) => {
    if (confirm('Delete this workflow step?')) {
      onStepsChange(steps.filter(s => s.id !== stepId))
    }
  }

  const getStepTypeIcon = (type: string) => {
    switch (type) {
      case 'APPROVAL': return '✓'
      case 'PARALLEL': return '⋮'
      case 'CONDITIONAL': return '?'
      case 'SERVICE': return '⚙'
      case 'SIGNATURE': return '✍'
      default: return '•'
    }
  }

  const getStepTypeColor = (type: string) => {
    switch (type) {
      case 'APPROVAL': return '#4caf50'
      case 'PARALLEL': return '#2196f3'
      case 'CONDITIONAL': return '#ff9800'
      case 'SERVICE': return '#9c27b0'
      case 'SIGNATURE': return '#f44336'
      default: return '#666'
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: 0 }}>Workflow Steps</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          {onValidate && (
            <button
              onClick={onValidate}
              style={{
                padding: '8px 16px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Validate Flow
            </button>
          )}
          <button
            onClick={handleAddStep}
            style={{
              padding: '8px 16px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + Add Step
          </button>
        </div>
      </div>

      {/* Drag and Drop Area */}
      {steps.length === 0 ? (
        <div style={{
          background: '#f5f5f5',
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '60px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>
            No workflow steps defined yet
          </p>
          <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
            Click "Add Step" to start building your workflow
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="workflow-steps">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                style={{
                  background: snapshot.isDraggingOver ? '#f0f7ff' : 'transparent',
                  borderRadius: '8px',
                  padding: '8px',
                  minHeight: '200px',
                  transition: 'background 0.2s ease'
                }}
              >
                {steps.map((step, index) => (
                  <Draggable key={step.id} draggableId={step.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          ...provided.draggableProps.style,
                          marginBottom: '12px'
                        }}
                      >
                        <StepCard
                          step={step}
                          index={index}
                          isDragging={snapshot.isDragging}
                          onEdit={() => handleEditStep(step)}
                          onDelete={() => handleDeleteStep(step.id)}
                          getStepTypeIcon={getStepTypeIcon}
                          getStepTypeColor={getStepTypeColor}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Step Editor Modal */}
      {showStepEditor && editingStep && (
        <StepEditorModal
          step={editingStep}
          onSave={handleSaveStep}
          onClose={() => {
            setShowStepEditor(false)
            setEditingStep(null)
          }}
        />
      )}
    </div>
  )
}

// Step Card Component
interface StepCardProps {
  step: WorkflowStep
  index: number
  isDragging: boolean
  onEdit: () => void
  onDelete: () => void
  getStepTypeIcon: (type: string) => string
  getStepTypeColor: (type: string) => string
}

function StepCard({ step, index, isDragging, onEdit, onDelete, getStepTypeIcon, getStepTypeColor }: StepCardProps) {
  return (
    <div style={{
      background: isDragging ? '#e3f2fd' : 'white',
      border: `2px solid ${isDragging ? '#2196f3' : '#e0e0e0'}`,
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      cursor: 'grab',
      transition: 'all 0.2s ease',
      boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {/* Step Number */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: getStepTypeColor(step.type),
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: 'bold',
        flexShrink: 0
      }}>
        {index + 1}
      </div>

      {/* Step Icon & Type */}
      <div style={{
        width: '50px',
        height: '50px',
        borderRadius: '8px',
        background: `${getStepTypeColor(step.type)}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        flexShrink: 0
      }}>
        {getStepTypeIcon(step.type)}
      </div>

      {/* Step Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px'
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: getStepTypeColor(step.type)
          }}>
            {step.type}
          </span>
          {step.required && (
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              background: '#f44336',
              color: 'white',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}>
              REQUIRED
            </span>
          )}
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '500',
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {step.name}
        </div>
        <div style={{ fontSize: '13px', color: '#666' }}>
          Approver: <strong>{step.approverRule.type}</strong>
          {step.approverRule.value && ` - ${step.approverRule.value}`}
          {step.timeoutDays && ` | Timeout: ${step.timeoutDays} days`}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
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
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
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
      </div>
    </div>
  )
}

// Step Editor Modal Component
interface StepEditorModalProps {
  step: WorkflowStep
  onSave: (step: WorkflowStep) => void
  onClose: () => void
}

function StepEditorModal({ step, onSave, onClose }: StepEditorModalProps) {
  const [formData, setFormData] = useState<WorkflowStep>(step)

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('Step name is required')
      return
    }

    if (!formData.approverRule.value.trim()) {
      alert('Approver rule value is required')
      return
    }

    onSave(formData)
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}
      >
        <h2 style={{ marginTop: 0 }}>Configure Workflow Step</h2>

        {/* Step Type */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Step Type *
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="APPROVAL">Approval</option>
            <option value="PARALLEL">Parallel</option>
            <option value="CONDITIONAL">Conditional</option>
            <option value="SERVICE">Service Task</option>
            <option value="SIGNATURE">Signature</option>
          </select>
        </div>

        {/* Step Name */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Step Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Supervisor Approval"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe this step..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Approver Rule Type */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Approver Rule Type *
          </label>
          <select
            value={formData.approverRule.type}
            onChange={(e) => setFormData({
              ...formData,
              approverRule: { ...formData.approverRule, type: e.target.value as any }
            })}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="ROLE">Based on Role</option>
            <option value="DEPARTMENT">Department Hierarchy</option>
            <option value="SPECIFIC_USER">Specific Person</option>
            <option value="MIXED">Mixed Mode</option>
          </select>
        </div>

        {/* Approver Rule Value */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Approver Rule Value *
          </label>
          <input
            type="text"
            value={formData.approverRule.value}
            onChange={(e) => setFormData({
              ...formData,
              approverRule: { ...formData.approverRule, value: e.target.value }
            })}
            placeholder={
              formData.approverRule.type === 'ROLE' ? 'e.g., ROLE_MANAGER' :
              formData.approverRule.type === 'DEPARTMENT' ? 'e.g., Finance' :
              formData.approverRule.type === 'SPECIFIC_USER' ? 'e.g., john.doe@company.com' :
              'Enter approver criteria'
            }
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            {formData.approverRule.type === 'ROLE' && 'Enter role name (e.g., ROLE_MANAGER, ROLE_ADMIN)'}
            {formData.approverRule.type === 'DEPARTMENT' && 'Enter department name'}
            {formData.approverRule.type === 'SPECIFIC_USER' && 'Enter user email or account ID'}
            {formData.approverRule.type === 'MIXED' && 'Enter comma-separated rules'}
          </p>
        </div>

        {/* Timeout Days */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Timeout (Days)
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value={formData.timeoutDays || 3}
            onChange={(e) => setFormData({ ...formData, timeoutDays: parseInt(e.target.value) || 3 })}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Number of days before this step times out
          </p>
        </div>

        {/* Required Checkbox */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 'bold' }}>Required Step</span>
          </label>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginLeft: '26px' }}>
            If unchecked, this step can be skipped in certain conditions
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '10px 20px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Save Step
          </button>
        </div>
      </div>
    </div>
  )
}
