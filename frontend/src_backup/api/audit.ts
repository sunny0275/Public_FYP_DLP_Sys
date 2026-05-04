import { AxiosInstance } from 'axios'
import { ApiResponse, AuditLogPage, AuditLogSearchParams, TracebackRequest, TracebackResult } from '../types'

export function createAuditApi(client: AxiosInstance) {
  return {
    async searchAuditLogs(params: AuditLogSearchParams): Promise<ApiResponse<AuditLogPage>> {
      const response = await client.get<ApiResponse<AuditLogPage>>('/audit/logs', { params })
      return response.data
    },
    async clearAuditLogs(): Promise<ApiResponse<void>> {
      const response = await client.delete<ApiResponse<void>>('/audit/clear')
      return response.data
    },
    async exportAuditLogs(params: AuditLogSearchParams & { format?: string }): Promise<Blob> {
      const response = await client.get('/audit/exports', {
        params: { format: 'csv', ...params },
        responseType: 'blob'
      })
      return response.data
    },
    async tracebackAudit(request: TracebackRequest): Promise<ApiResponse<TracebackResult>> {
      const response = await client.post<ApiResponse<TracebackResult>>('/audit/traceback', request)
      return response.data
    },
    async getLegacyAuditCount(): Promise<ApiResponse<{ legacyCount: number }>> {
      const response = await client.get<ApiResponse<{ legacyCount: number }>>('/audit/legacy-count')
      return response.data
    },
    async markLegacyAsNotChained(): Promise<ApiResponse<{ markedCount: number }>> {
      const response = await client.post<ApiResponse<{ markedCount: number }>>('/audit/mark-legacy-not-chained')
      return response.data
    },
    async clearLegacyAuditLogs(): Promise<ApiResponse<{ deletedCount: number }>> {
      const response = await client.delete<ApiResponse<{ deletedCount: number }>>('/audit/clear-legacy')
      return response.data
    },
  }
}
