import { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export function createWorkflowApi(client: AxiosInstance) {
  return {
    async getWorkflowTemplates(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/workflows/templates')
      return response.data
    },
    async startWorkflow(data: { templateId: number; documentId?: number; shareId?: number; reason?: string; contextJson?: string }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/workflows/instances', data)
      return response.data
    },
    async getWorkflowInstance(id: number): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/workflows/instances/${id}`)
      return response.data
    },
    async getUserWorkflows(page: number = 0, size: number = 20): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/workflows/my?page=${page}&size=${size}`)
      return response.data
    },
    async cancelWorkflow(id: number, reason?: string): Promise<ApiResponse<void>> {
      const params = reason ? { reason } : {}
      const response = await client.delete<ApiResponse<void>>(`/workflows/instances/${id}`, { params })
      return response.data
    },
    async getAllWorkflowTemplates(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/workflows/templates/all')
      return response.data
    },
    async getWorkflowTemplate(id: number): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/workflows/templates/${id}`)
      return response.data
    },
    async createWorkflowTemplate(data: { name: string; description: string; workflowType: string; stepsJson: string }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/workflows/templates', data)
      return response.data
    },
    async updateWorkflowTemplate(id: number, data: { name: string; description: string; workflowType: string; stepsJson: string }): Promise<ApiResponse<any>> {
      const response = await client.put<ApiResponse<any>>(`/workflows/templates/${id}`, data)
      return response.data
    },
    async deleteWorkflowTemplate(id: number): Promise<ApiResponse<void>> {
      const response = await client.delete<ApiResponse<void>>(`/workflows/templates/${id}`)
      return response.data
    },
    async publishWorkflowTemplate(id: number): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>(`/workflows/templates/${id}/publish`)
      return response.data
    },
    async archiveWorkflowTemplate(id: number): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>(`/workflows/templates/${id}/archive`)
      return response.data
    },
    async validateWorkflowTemplate(data: { name: string; description: string; workflowType: string; stepsJson: string }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/workflows/templates/validate', data)
      return response.data
    },
    async getWorkflowStatistics(templateId?: number | null, days?: number | null): Promise<ApiResponse<any>> {
      const params: Record<string, number> = {}
      if (templateId != null) params.templateId = templateId
      if (days != null) params.days = days
      const response = await client.get<ApiResponse<any>>('/workflows/statistics', { params })
      return response.data
    },
    async simulateWorkflow(data: { templateId: number; userId: number; documentId?: number; classificationLevel?: string }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/workflows/simulate', data)
      return response.data
    },
  }
}
