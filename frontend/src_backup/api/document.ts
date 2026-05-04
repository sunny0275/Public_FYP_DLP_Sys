import { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export function createDocumentApi(client: AxiosInstance) {
  return {
    async searchDocuments(params: {
      startDate?: string
      endDate?: string
      query?: string
      department?: string
      classificationLevel?: string
      status?: string
      tags?: string[]
      sortBy?: string
      sortOrder?: string
      page?: number
      pageSize?: number
    }): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>('/docs', { params })
      return response.data
    },
    async getDocumentVersions(id: number): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>(`/docs/${id}/versions`)
      return response.data
    },
    async restoreDocumentVersion(documentId: number, versionId: number): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>(`/docs/${documentId}/versions/${versionId}/restore`)
      return response.data
    },
    async compareDocumentVersions(documentId: number, versionId1: number, versionId2: number): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/docs/${documentId}/versions/compare`, { params: { version1: versionId1, version2: versionId2 } })
      return response.data
    },
    async downloadDocumentVersion(documentId: number, versionId: number): Promise<Blob> {
      const response = await client.get(`/docs/${documentId}/versions/${versionId}/download`, { responseType: 'blob' })
      return response.data
    },
    async batchExportDocuments(documentIds: number[]): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/docs/batch/export', { documentIds })
      return response.data
    },
    async downloadBatchExport(downloadUrl: string): Promise<Blob> {
      const response = await client.get(downloadUrl, { responseType: 'blob' })
      return response.data
    },
    async batchShareDocuments(params: {
      documentIds: number[]
      shareType: 'INTERNAL' | 'EXTERNAL'
      recipients?: string[]
      permissions?: string
      expireAt?: string
    }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/docs/batch/share', params)
      return response.data
    },
    async getDocumentActivity(id: number): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>(`/docs/${id}/activity`)
      return response.data
    },
    async uploadDocument(
      formData: FormData,
      onProgress?: (percent: number) => void
    ): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/docs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (!onProgress || !evt.total) return
          const percent = Math.max(0, Math.min(100, Math.round((evt.loaded * 100) / evt.total)))
          onProgress(percent)
        }
      })
      return response.data
    },
    async getUploadJobStatus(jobId: number): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/docs/jobs/${jobId}`)
      return response.data
    },
    async resolveUploadClassification(jobId: number, data: {
      finalClassificationLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'
      reportLlmMistake?: boolean
      comment?: string
    }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>(`/docs/jobs/${jobId}/resolve-classification`, data)
      return response.data
    },
    async getActiveJobs(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/docs/jobs/active')
      return response.data
    },
    async getDocument(id: number): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/docs/${id}`)
      return response.data
    },
    async getRecentDocuments(limit: number = 10): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>(`/docs/recent?limit=${limit}`)
      return response.data
    },
    async updateDocument(id: number, data: any): Promise<ApiResponse<any>> {
      const response = await client.put<ApiResponse<any>>(`/docs/${id}`, data)
      return response.data
    },
    async deleteDocument(id: number): Promise<ApiResponse<void>> {
      const response = await client.delete<ApiResponse<void>>(`/docs/${id}`)
      return response.data
    },
    async downloadDocument(id: number): Promise<Blob> {
      const response = await client.get(`/docs/${id}/download`, { responseType: 'blob' })
      return response.data
    },
    async getDocumentHash(id: number): Promise<ApiResponse<{ documentId: number; algorithm: string; hash: string; source: string }>> {
      const response = await client.get<ApiResponse<{ documentId: number; algorithm: string; hash: string; source: string }>>(`/docs/${id}/hash`)
      return response.data
    },
    async getDocumentContent(id: number): Promise<{ blob: Blob; contentType: string; watermarkCode?: string; viewerIp?: string }> {
      try {
        const response = await client.get(`/docs/${id}/content`, { responseType: 'blob' })
        const contentType = response.headers['content-type'] || 'application/pdf'
        return {
          blob: response.data,
          contentType,
          watermarkCode: response.headers['x-watermark-code'] || undefined,
          viewerIp: response.headers['x-viewer-ip'] || undefined,
        }
      } catch (error: any) {
        if (error.response && error.response.data instanceof Blob) {
          const contentType = error.response.headers['content-type'] || ''
          if (contentType.includes('application/json')) {
            try {
              const text = await error.response.data.text()
              const errorData = JSON.parse(text)
              throw new Error(errorData.error || errorData.message || 'Failed to load document')
            } catch (parseError) {
              if (error.response.status === 404) throw new Error('Document file not found. It may have been deleted or moved.')
              throw new Error(`Failed to load document (${error.response.status})`)
            }
          }
          if (error.response.status === 404) throw new Error('Document file not found. It may have been deleted or moved.')
          throw new Error(`Failed to load document (${error.response.status})`)
        }
        throw error
      }
    },
    async getAllTags(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/docs/tags')
      return response.data
    },
    async getDocumentsRequiringReview(page: number = 0, pageSize: number = 20): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/docs/review?page=${page}&pageSize=${pageSize}`)
      return response.data
    },
    async getDepartments(): Promise<ApiResponse<string[]>> {
      const response = await client.get<ApiResponse<string[]>>('/departments')
      return response.data
    },
    // Record explicit VIEW when user clicks Preview tab
    async recordDocumentView(id: number): Promise<ApiResponse<void>> {
      const response = await client.post<ApiResponse<void>>(`/docs/${id}/view`)
      return response.data
    },
  }
}
