import { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export function createComplianceApi(client: AxiosInstance) {
  return {
    async getPolicyViolations(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/policies/violations')
      return response.data
    },
    async getClassificationDrift(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/classification/drift')
      return response.data
    },
    async getSignatureExpirations(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/signatures/expiring')
      return response.data
    },
    async resolveViolation(violationId: number): Promise<ApiResponse<void>> {
      const response = await client.patch<ApiResponse<void>>(`/policies/violations/${violationId}/resolve`)
      return response.data
    },
    async approveDrift(driftId: number): Promise<ApiResponse<void>> {
      const response = await client.patch<ApiResponse<void>>(`/classification/drift/${driftId}/approve`)
      return response.data
    },
  }
}
