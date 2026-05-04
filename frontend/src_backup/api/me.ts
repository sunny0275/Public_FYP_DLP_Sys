import { AxiosInstance } from 'axios'
import { ApiResponse, UserSummary } from '../types'

export function createMeApi(client: AxiosInstance) {
  return {
    async getMyProfile(): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>('/me')
      return response.data
    },
    async updateMyProfile(data: { email: string; fullName: string }): Promise<ApiResponse<any>> {
      const response = await client.put<ApiResponse<any>>('/me', data)
      return response.data
    },
    async getUserSummary(): Promise<ApiResponse<UserSummary>> {
      const response = await client.get<ApiResponse<UserSummary>>('/me/summary')
      return response.data
    },
    async getActivityReport(): Promise<Blob> {
      const response = await client.get('/me/activity', { responseType: 'blob' })
      return response.data
    },
    async mfaBindInitiate(): Promise<ApiResponse<{ secret?: string; qrCodeUrl?: string; qrCodeImage?: string; setupCompleted?: boolean }>> {
      const response = await client.post<ApiResponse<any>>('/me/mfa/bind')
      return response.data
    },
    async mfaBindVerify(code: string): Promise<ApiResponse<{ setupCompleted?: boolean }>> {
      const response = await client.post<ApiResponse<any>>('/me/mfa/bind/verify', { code })
      return response.data
    },
  }
}
