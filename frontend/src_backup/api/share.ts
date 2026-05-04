import { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export function createShareApi(client: AxiosInstance) {
  return {
    async createShareLink(data: {
      documentId: number
      shareType: 'INTERNAL' | 'EXTERNAL'
      permission: 'READ_ONLY' | 'DOWNLOAD' | 'EDIT' | 'FULL'
      recipientIds?: number[]
      expiresAt?: string
      accessLimit?: number
      ipWhitelist?: string[]
      password?: string
      requiresWatermark?: boolean
      allowCopy?: boolean
      allowPrint?: boolean
      allowDownload?: boolean
      allowEdit?: boolean
      description?: string
    }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/shares', data)
      return response.data
    },
    async getShareLink(token: string, password?: string): Promise<ApiResponse<any>> {
      const params = password ? { password } : {}
      const response = await client.get<ApiResponse<any>>(`/shares/${token}`, { params })
      return response.data
    },
    async revokeShareLink(id: number, reason?: string): Promise<ApiResponse<void>> {
      const params = reason ? { reason } : {}
      const response = await client.delete<ApiResponse<void>>(`/shares/${id}`, { params })
      return response.data
    },
    async getSharedDocumentPreview(token: string, password?: string): Promise<Blob> {
      const params = password ? { password } : {}
      const response = await client.get(`/shares/${token}/preview`, { params, responseType: 'blob' })
      return response.data
    },
    async logShareAccess(token: string, data: { viewDuration?: number; pageViews?: number[]; timestamp?: string }): Promise<ApiResponse<void>> {
      const response = await client.post<ApiResponse<void>>(`/shares/${token}/access-log`, data)
      return response.data
    },
    async getMyShares(page: number = 0, size: number = 20): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/shares/my?page=${page}&size=${size}`)
      return response.data
    },
    async getDocumentShares(documentId: number): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>(`/shares/document/${documentId}`)
      return response.data
    },
    async approveShareLink(id: number): Promise<ApiResponse<void>> {
      const response = await client.post<ApiResponse<void>>(`/shares/${id}/approve`)
      return response.data
    },
    async rejectShareLink(id: number, data?: { reason?: string; correctedClassificationLevel?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL' }): Promise<ApiResponse<void>> {
      const response = await client.post<ApiResponse<void>>(`/shares/${id}/reject`, data || {})
      return response.data
    },
    async getPendingShareApprovals(page: number = 0, size: number = 20): Promise<ApiResponse<{ content: any[]; totalElements: number; totalPages: number }>> {
      const response = await client.get<ApiResponse<{ content: any[]; totalElements: number; totalPages: number }>>('/shares/pending-approval', { params: { page, size } })
      return response.data
    },
    async getShareLinkPreview(token: string, password?: string): Promise<Blob> {
      const params = password ? { password } : {}
      const response = await client.get(`/shares/${token}/preview`, { params, responseType: 'blob' })
      return response.data
    },
    async getShareLinkDownload(token: string, password?: string): Promise<Blob> {
      const params = password ? { password } : {}
      const response = await client.get(`/shares/${token}/download`, { params, responseType: 'blob' })
      return response.data
    },
    async updateShareRecipients(id: number, data: { addRecipientIds?: number[]; removeRecipientIds?: number[] }): Promise<ApiResponse<any>> {
      const response = await client.patch<ApiResponse<any>>(`/shares/${id}/recipients`, data)
      return response.data
    },
    async updateShare(id: number, data: {
      expiresAt?: string
      accessLimit?: number
      permission?: 'READ_ONLY' | 'DOWNLOAD' | 'EDIT' | 'FULL'
      allowCopy?: boolean
      allowPrint?: boolean
      allowDownload?: boolean
      allowEdit?: boolean
    }): Promise<ApiResponse<any>> {
      const response = await client.patch<ApiResponse<any>>(`/shares/${id}`, data)
      return response.data
    },
  }
}
