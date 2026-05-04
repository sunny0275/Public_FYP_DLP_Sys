import { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export function createEdrApi(client: AxiosInstance) {
  return {
    async getEDRIncidents(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/edr/incidents')
      return response.data
    },
    async getEDREvents(params?: { severity?: string; action?: string }): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/edr/events', { params })
      return response.data
    },
    async edrBlock(payload: { hostId?: string; userId?: number; reason?: string }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/edr/actions/block', payload)
      return response.data
    },
    async edrIsolate(payload: { hostId: string; reason?: string }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/edr/actions/isolate', payload)
      return response.data
    },
    async getEDRPolicies(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/edr/policies')
      return response.data
    },
    async saveEDRPolicy(policy: { id?: number; name: string; description?: string; rulesJson?: string; status?: string }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/edr/policies', policy)
      return response.data
    },
    async deleteEDRPolicy(id: number): Promise<ApiResponse<void>> {
      const response = await client.delete<ApiResponse<void>>(`/edr/policies/${id}`)
      return response.data
    },
  }
}
