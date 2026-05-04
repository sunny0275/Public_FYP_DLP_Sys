import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PDFDocument } from 'pdf-lib'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'
import DashboardLayout from '../../components/DashboardLayout'
import { compressFileForUpload, shouldCompress, formatBytes } from '../../utils/compression'

export default function UploadPage() {
  const navigate = useNavigate()
  const { user, theme } = useAuthStore()

  const [file, setFile] = useState<File | null>(null)
  const [department, setDepartment] = useState('')
  const [classificationLevel, setClassificationLevel] = useState('')
  const [description, setDescription] = useState('')

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [jobId, setJobId] = useState<number | null>(null)
  const [jobStatus, setJobStatus] = useState<string>('')
  const [currentStep, setCurrentStep] = useState<string>('')
  const [uploadMessage, setUploadMessage] = useState('')
  const lastPolledStatusRef = useRef<string>('')

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    if (jobId) {
      const interval = setInterval(pollJobStatus, 2000)
      return () => clearInterval(interval)
    }
  }, [jobId])

  const loadOptions = async () => {
    try {
      // Set default department to user's department
      if (user?.department) {
        setDepartment(user.department)
      }
    } catch (err) {
      console.error('Failed to load options:', err)
    }
  }

  const pollJobStatus = async () => {
    if (!jobId) return

    try {
      const response = await apiClient.getUploadJobStatus(jobId)
      const job = response.data

      if (lastPolledStatusRef.current !== job.status) {
        console.log('[Upload] Job status transition', {
          jobId: job.id,
          from: lastPolledStatusRef.current || 'N/A',
          to: job.status,
          progress: job.progress,
          currentStep: job.currentStep,
          reason: job.classificationReason,
          errorMessage: job.errorMessage
        })
        lastPolledStatusRef.current = job.status
      }

      setJobStatus(job.status)
      setCurrentStep(job.currentStep || '')
      setUploadProgress(prev => Math.max(prev, job.progress || 0))

      if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'REVIEW_REQUIRED') {
        // Frontend log: upload + backend processing finished (success/failure/review required)
        console.log('[Upload] Job completed', {
          jobId: job.id,
          documentId: job.documentId,
          status: job.status,
          errorMessage: job.errorMessage
        })
        setUploading(false)
        setTimeout(() => {
          navigate(`/upload/result/${job.id}`)
        }, 500)
      }
    } catch (err) {
      console.error('[Upload] Failed to poll job status', { jobId, err })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!file) {
      setError('Please select a file')
      return
    }
    if (!department) {
      setError('Your account has no department assigned. Please contact admin.')
      return
    }
    if (!classificationLevel) {
      setError('Please select a classification level')
      return
    }

    // File size validation (500MB max)
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File size exceeds 500MB limit')
      return
    }

    // File type validation: only PDF
    const allowedTypes = ['application/pdf']

    if (file.type && !allowedTypes.includes(file.type)) {
      setError('File type not allowed. Only PDF files are accepted.')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadMessage('')
    setJobStatus('UPLOADING')
    setCurrentStep('UPLOADING')

    try {
      let uploadFile = file

      // Use pako-based gzip compression for files approaching the 20MB limit
      if (shouldCompress(file)) {
        setJobStatus('COMPRESSING')
        setCurrentStep('COMPRESSING')
        setUploadMessage(`Large file detected (${formatBytes(file.size)}). Compressing with gzip before upload...`)

        try {
          const result = await compressFileForUpload(file)
          uploadFile = result.file

          if (result.compressedSize < file.size) {
            const savedMb = ((file.size - result.compressedSize) / 1024 / 1024).toFixed(2)
            const compressedMb = (result.compressedSize / 1024 / 1024).toFixed(2)
            setUploadMessage(`Compressed to ${compressedMb} MB (saved ${savedMb} MB). Ready to upload...`)
          }
        } catch (compressionError) {
          console.warn('[Upload] Gzip compression failed, trying PDF optimization:', compressionError)
          // Fallback to pdf-lib optimization if pako fails
          setUploadMessage('Optimizing PDF structure before upload...')
          uploadFile = await compressPdfBeforeUpload(file)
        }
      }

      console.log('[Upload] Submitting upload request', {
        fileName: uploadFile.name,
        fileType: uploadFile.type,
        fileSizeBytes: uploadFile.size,
        selectedClassification: classificationLevel,
        department
      })
      const formData = new FormData()
      formData.append('file', uploadFile)
      // Department is derived from current user on backend
      if (description) formData.append('description', description)
      formData.append('classificationLevel', classificationLevel)

      setJobStatus('UPLOADING')
      setCurrentStep('UPLOADING')
      const response = await apiClient.uploadDocument(formData, (percent) => {
        // Reserve higher range for backend async processing progress.
        setUploadProgress(Math.min(percent, 25))
      })
      const job = response.data

      // Backend accepted the upload and created an upload job; log basic info and temporary file path
      console.log('[Upload] Request accepted by backend', {
        jobId: job.id,
        status: job.status,
        storedPath: job.filePath
      })

      setJobId(job.id)
      setJobStatus(job.status)
      setCurrentStep(job.currentStep || 'UPLOADING')
      lastPolledStatusRef.current = job.status
      setUploadProgress((prev) => Math.max(prev, 10))
      if (uploadFile.size < file.size) {
        const savedMb = ((file.size - uploadFile.size) / 1024 / 1024).toFixed(2)
        const compressedMb = (uploadFile.size / 1024 / 1024).toFixed(2)
        setUploadMessage(`Compressed to ${compressedMb} MB (saved ${savedMb} MB). Backend processing started...`)
      } else {
        setUploadMessage('Upload completed. Backend processing started...')
      }

    } catch (err: any) {
      console.error('[Upload] Upload request failed', {
        backendMessage: err.response?.data?.message,
        err
      })
      setError(err.response?.data?.message || 'Failed to upload document')
      setUploading(false)
    }
  }

  const compressPdfBeforeUpload = async (inputFile: File): Promise<File> => {
    try {
      const raw = await inputFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(raw, {
        updateMetadata: false,
        ignoreEncryption: true
      })

      const compressed = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false
      })

      // Keep original file when compression is not beneficial.
      if (compressed.byteLength >= inputFile.size * 0.98) {
        setUploadMessage('Compression finished, but no meaningful size reduction. Uploading original PDF...')
        return inputFile
      }

      const compressedBuffer = new Uint8Array(compressed).buffer

      return new File([compressedBuffer], inputFile.name, {
        type: 'application/pdf',
        lastModified: Date.now()
      })
    } catch (err) {
      console.warn('[Upload] PDF compression failed, fallback to original file', err)
      setUploadMessage('Unable to compress this PDF. Uploading original file...')
      return inputFile
    }
  }

  const handleCancel = () => {
    navigate('/documents')
  }

  const humanize = (value?: string) => {
    if (!value) return '—'
    return value
      .split('_')
      .filter(Boolean)
      .map(s => s.charAt(0) + s.slice(1).toLowerCase())
      .join(' ')
  }

  return (
    <DashboardLayout>
      <div className="dashboard">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1>Upload Document</h1>
          <p style={{ color: '#888', marginBottom: '24px' }}>
            Upload a document to the DLP Platform. AI will re-classify and compare with your selected level.
          </p>

          {!uploading ? (
            <form onSubmit={handleSubmit} className="dashboard-card">
              {error && (
                <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>
              )}

              {/* File Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  File <span style={{ color: '#ff6b6b' }}>*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  style={{
                    padding: '10px',
                    width: '100%',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#999' }}>
                  Acceptable file types: PDF only
                </div>
                {file && (
                  <div style={{ marginTop: '8px', fontSize: '0.9em', color: '#888' }}>
                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>

              {/* Department (auto) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Department (auto)
                </label>
                <input
                  type="text"
                  value={department || ''}
                  readOnly
                  style={{
                    padding: '10px',
                    width: '100%',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
              </div>

              {/* Classification Level (Required) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Classification Level <span style={{ color: '#ff6b6b' }}>*</span>
                </label>
                <select
                  value={classificationLevel}
                  onChange={(e) => setClassificationLevel(e.target.value)}
                  style={{
                    padding: '10px',
                    width: '100%',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                  required
                >
                  <option value="">Select classification level</option>
                  <option value="PUBLIC">Public</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="STRICTLY_CONFIDENTIAL">Strictly Confidential</option>
                </select>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  AI will classify again and compare to your selection. If mismatch, you must re-label.
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter document description"
                  maxLength={2000}
                  rows={4}
                  style={{
                    padding: '10px',
                    width: '100%',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Tags are auto-generated by LLM + rule detection now (no manual tag selection) */}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={handleCancel} style={{ padding: '10px 20px', background: '#6c757d' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  style={{ padding: '10px 20px', background: '#007bff' }}
                >
                  📤 Upload
                </button>
              </div>
            </form>
          ) : (
            <div className="dashboard-card">
              <h3>Upload in Progress</h3>
              <div style={{ marginTop: '20px' }}>
                <div style={{
                  height: '30px',
                  background: theme === 'dark' ? '#333' : '#e0e0e0',
                  borderRadius: '15px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                  position: 'relative'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${uploadProgress}%`,
                    background: 'linear-gradient(90deg, #007bff, #0056b3)',
                    transition: 'width 0.3s ease',
                  }} />
                  <div style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: theme === 'dark' ? '#ddd' : '#555'
                  }}>
                    {uploadProgress}%
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.9em', color: '#888' }}>
                  Status: {humanize(jobStatus)}
                  {currentStep ? ` | Step: ${humanize(currentStep)}` : ''}
                </div>
                {uploadMessage && (
                  <div style={{ textAlign: 'center', fontSize: '0.8em', color: '#888', marginTop: '6px' }}>
                    {uploadMessage}
                  </div>
                )}
                {jobStatus === 'COMPLETED' && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#4caf5033', borderRadius: '6px', color: '#4caf50', textAlign: 'center' }}>
                    ✓ Upload completed! Redirecting to document...
                  </div>
                )}
                {jobStatus === 'REVIEW_REQUIRED' && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#ff980033', borderRadius: '6px', color: '#ff9800', textAlign: 'center' }}>
                    ⚠ Document requires manual review. Redirecting to documents list...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
