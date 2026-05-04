import { AxiosInstance } from 'axios'
import { ApiResponse, UebaRuleDto } from '../types'

export function createUebaApi(client: AxiosInstance) {
  return {
    async getUebaRiskScore(params?: { userId?: number; sessionId?: string; documentId?: number }): Promise<ApiResponse<Record<string, unknown>>> {
      const response = await client.get<ApiResponse<Record<string, unknown>>>('/ueba/risk-score', { params })
      return response.data
    },
    async evaluateUebaRisk(body: { userId?: number; sessionId?: string; documentId?: number }): Promise<ApiResponse<Record<string, unknown>>> {
      const response = await client.post<ApiResponse<Record<string, unknown>>>('/ueba/risk-evaluation', body)
      return response.data
    },
    async getUebaIncidents(params?: { severity?: string; status?: string; page?: number; size?: number }): Promise<ApiResponse<{ content: any[]; totalElements: number; totalPages: number }>> {
      const response = await client.get<ApiResponse<{ content: any[]; totalElements: number; totalPages: number }>>('/ueba/incidents', { params })
      return response.data
    },
    async getUebaBaseline(userId: number): Promise<ApiResponse<Record<string, unknown>>> {
      const response = await client.get<ApiResponse<Record<string, unknown>>>('/ueba/baseline', { params: { userId } })
      return response.data
    },
    async getUebaUserScores(params?: {
      department?: string
      query?: string
      includeAll?: boolean
      sortBy?: 'score' | 'createdAt'
      sortOrder?: 'asc' | 'desc'
      page?: number
      size?: number
    }): Promise<ApiResponse<{ content: any[]; totalElements: number; totalPages: number }>> {
      const response = await client.get<ApiResponse<{ content: any[]; totalElements: number; totalPages: number }>>('/ueba/users-scores', { params })
      return response.data
    },
    async getUebaRules(params?: { ruleType?: string; page?: number; size?: number }): Promise<ApiResponse<{ content: UebaRuleDto[]; totalElements: number; totalPages: number }>> {
      const response = await client.get<ApiResponse<{ content: UebaRuleDto[]; totalElements: number; totalPages: number }>>('/ueba/rules', { params })
      return response.data
    },
    async getUebaRule(id: number): Promise<ApiResponse<UebaRuleDto>> {
      const response = await client.get<ApiResponse<UebaRuleDto>>(`/ueba/rules/${id}`)
      return response.data
    },
    async createUebaRule(rule: UebaRuleDto): Promise<ApiResponse<UebaRuleDto>> {
      const response = await client.post<ApiResponse<UebaRuleDto>>('/ueba/rules', rule)
      return response.data
    },
    async updateUebaRule(id: number, rule: UebaRuleDto): Promise<ApiResponse<UebaRuleDto>> {
      const response = await client.put<ApiResponse<UebaRuleDto>>(`/ueba/rules/${id}`, rule)
      return response.data
    },
    async deleteUebaRule(id: number): Promise<ApiResponse<void>> {
      const response = await client.delete<ApiResponse<void>>(`/ueba/rules/${id}`)
      return response.data
    },
    async setUebaRuleEnabled(id: number, enabled: boolean): Promise<ApiResponse<UebaRuleDto>> {
      const response = await client.patch<ApiResponse<UebaRuleDto>>(`/ueba/rules/${id}/enabled`, { enabled })
      return response.data
    },
    async getUebaRiskAdaptivePolicy(): Promise<ApiResponse<Record<string, unknown>>> {
      const response = await client.get<ApiResponse<Record<string, unknown>>>('/ueba/policies/risk-adaptive')
      return response.data
    },
    async setUebaRiskAdaptivePolicy(thresholds: { min: number; max: number; action: string }[]): Promise<ApiResponse<Record<string, unknown>>> {
      const response = await client.put<ApiResponse<Record<string, unknown>>>('/ueba/policies/risk-adaptive', { thresholds })
      return response.data
    },
  }
}
