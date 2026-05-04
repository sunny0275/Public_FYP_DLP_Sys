import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiClient } from '../../api'
import DashboardLayout from '../../components/DashboardLayout'

interface UploadJob {
  id: number
  documentId?: number | null
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVIEW_REQUIRED'
  createdAt?: string | null
  updatedAt?: string | null
  completedAt?: string | null
  progress?: number | null
  errorMessage?: string | null
  filePath?: string | null
  suggestedClassification?: string | null
  classificationConfidence?: number | null
  classificationReason?: string | null
  userSelectedClassification?: string | null
  documentRequiresReview?: boolean | null
}

export default function UploadResultPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<UploadJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [finalLevel, setFinalLevel] = useState<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'>('INTERNAL')
  const [comment, setComment] = useState('')
  const [resolving, setResolving] = useState(false)

  const resolveUpdatedTime = (job: UploadJob) => {
    return job.updatedAt || job.completedAt || job.createdAt || null
  }

  useEffect(() => {
    const load = async () => {
      if (!jobId) return
      setLoading(true)
      setError('')
      try {
        const res = await apiClient.getUploadJobStatus(Number(jobId))
        setJob(res.data)
        if (res.data?.userSelectedClassification) {
          setFinalLevel(res.data.userSelectedClassification)
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load upload job status')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [jobId])

  const isMismatch = (job: UploadJob) => {
    if (!job.userSelectedClassification || !job.suggestedClassification) return false
    return job.userSelectedClassification !== job.suggestedClassification
  }

  const canResolveMismatch = (job: UploadJob) =>
    isMismatch(job) &&
    !job.documentRequiresReview &&
    (job.status === 'COMPLETED' || job.status === 'REVIEW_REQUIRED')

  const handleResolve = async (mode: 'accept_llm' | 'keep_user_report') => {
    if (!jobId) return
    setResolving(true)
    try {
      const payload: any = {
        finalClassificationLevel: mode === 'accept_llm'
          ? (job?.suggestedClassification as any)
          : finalLevel,
        reportLlmMistake: mode === 'keep_user_report',
        comment: comment || undefined
      }
      const res = await apiClient.resolveUploadClassification(Number(jobId), payload)
      setJob(res.data)
      alert('Your classification decision has been submitted.')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to resolve classification')
    } finally {
      setResolving(false)
    }
  }

  const renderStatus = () => {
    if (!job) return null
    const status = job.status
    if (status === 'COMPLETED') {
      const mismatch = isMismatch(job)
      return (
        <div style={{ marginBottom: '16px' }}>
          <div className="info-message" style={{ marginBottom: (job.documentRequiresReview || mismatch) ? '12px' : 0 }}>
            Upload completed. Document processing succeeded.
          </div>
          {mismatch && !job.documentRequiresReview && (
            <div className="info-message" style={{ marginBottom: '12px', padding: '16px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404' }}>
                Classification differs from your selection
              </div>
              <div style={{ color: '#856404', fontSize: '0.95em', lineHeight: '1.6' }}>
                The document was uploaded, but the automatic classification differs from your selected level.
                <br />
                <br />
                Please choose below: <strong>Accept suggested level</strong> to use the AI suggestion, or <strong>Keep my level and report (send for review)</strong> to keep your selection and send the document for reviewer approval.
              </div>
            </div>
          )}
          {job.documentRequiresReview && (
            <div className="info-message" style={{ padding: '16px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404' }}>
                ⚠️ Pending Review
              </div>
              <div style={{ color: '#856404', fontSize: '0.95em', lineHeight: '1.6' }}>
                The document is now in PENDING status and requires reviewer approval.
                <br />
                <strong>Current Status:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Only you (uploader) and reviewers can view this document</li>
                  <li>Other users cannot access it until a reviewer approves the classification level</li>
                  <li>A reviewer will review and confirm the classification level</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )
    }
    if (status === 'FAILED') {
      return (
        <div className="error-message" style={{ marginBottom: '16px' }}>
          Upload or processing failed: {job.errorMessage || 'Unknown error'}
        </div>
      )
    }
    if (status === 'REVIEW_REQUIRED') {
      const mismatch = isMismatch(job)
      return (
        <div style={{ marginBottom: '16px' }}>
          <div className="info-message" style={{ marginBottom: '12px', padding: '16px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404' }}>
              {mismatch ? 'Classification differs from your selection' : 'Manual review required'}
            </div>
            <div style={{ color: '#856404', fontSize: '0.95em', lineHeight: '1.6' }}>
              {mismatch ? (
                <>
                  The document was uploaded, but the automatic classification differs from your selected level.
                  <br />
                  <br />
                  Please choose below: <strong>Accept suggested level</strong> to use the AI suggestion, or <strong>Keep my level and report (send for review)</strong> to keep your selection and send the document for reviewer approval.
                </>
              ) : (
                <>
                  Automatic classification is currently unavailable. The document is routed to manual review for reviewer decision.
                </>
              )}
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="info-message" style={{ marginBottom: '16px' }}>
        Processing upload… Current status: {status}, progress {job.progress ?? 0}%.
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="dashboard">
        <h1>Upload Result</h1>

        {loading && <div>Loading upload status...</div>}
        {error && !loading && <div className="error-message">{error}</div>}

        {!loading && !error && job && (
          <div className="dashboard-card">
            {renderStatus()}

            <div style={{ marginBottom: '12px' }}>
              <strong>Job ID:</strong> {job.id}
            </div>
            {resolveUpdatedTime(job) && (
              <div style={{ marginBottom: '12px' }}>
                <strong>Updated time:</strong> {new Date(resolveUpdatedTime(job) as string).toLocaleString()}
              </div>
            )}
            {job.documentId && (
              <div style={{ marginBottom: '12px' }}>
                <strong>Document ID:</strong> {job.documentId}
              </div>
            )}

            {(job.userSelectedClassification || job.suggestedClassification) && (
              <div style={{ marginTop: '12px', padding: '12px', border: '1px solid #eee', borderRadius: '8px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Your selection:</strong> {job.userSelectedClassification || '—'}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Suggested level:</strong> {job.suggestedClassification || '—'}
                  {job.classificationConfidence !== null && job.classificationConfidence !== undefined ? (
                    <>（confidence: {job.classificationConfidence}）</>
                  ) : null}
                </div>
                {job.classificationReason && (
                  <div style={{ fontSize: '13px', color: '#555' }}>
                    <strong>Reason:</strong> {job.classificationReason}
                  </div>
                )}
              </div>
            )}

            {canResolveMismatch(job) && (
              <div style={{ marginTop: '16px', padding: '14px', border: '1px solid #ffc107', borderRadius: '8px', background: '#fff8e1' }}>
                <div style={{ fontWeight: 700, marginBottom: '10px' }}>
                  Please choose the final label (required)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  <select
                    value={finalLevel}
                    onChange={(e) => setFinalLevel(e.target.value as any)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                  >
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                    <option value="STRICTLY_CONFIDENTIAL">STRICTLY_CONFIDENTIAL</option>
                  </select>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional: add a reason / report (e.g., why the suggested level is incorrect)"
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minHeight: '80px' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      className="primary"
                      disabled={resolving || !job.suggestedClassification}
                      onClick={() => handleResolve('accept_llm')}
                      type="button"
                    >
                      {resolving ? 'Submitting...' : 'Accept suggested level'}
                    </button>
                    <button
                      disabled={resolving}
                      onClick={() => handleResolve('keep_user_report')}
                      type="button"
                    >
                      {resolving ? 'Submitting...' : 'Keep my level and report (send for review)'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {job.documentId && job.status === 'COMPLETED' && (
                <button
                  className="primary"
                  onClick={() => navigate(`/documents/${job.documentId}`)}
                >
                  View document details
                </button>
              )}
              <button onClick={() => navigate('/documents')}>
                Back to documents
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}


