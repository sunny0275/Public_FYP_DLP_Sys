import { AxiosInstance } from 'axios'
import { ApiResponse, LoginRequest, LoginResponse, ChangePasswordRequest, MfaSetupResponse } from '../types'

export function createAuthApi(client: AxiosInstance) {
  return {
    async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
      const response = await client.post<ApiResponse<LoginResponse>>('/auth/login', data)
      return response.data
    },
    async refreshToken(refreshToken: string): Promise<ApiResponse<LoginResponse>> {
      const response = await client.post<ApiResponse<LoginResponse>>('/auth/refresh', { refreshToken })
      return response.data
    },
    async forgotPassword(accountId: string, email: string): Promise<ApiResponse<void>> {
      const response = await client.post<ApiResponse<void>>('/auth/forgot-password', { accountId, email })
      return response.data
    },
    async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<void>> {
      const response = await client.post<ApiResponse<void>>('/auth/change-password', data)
      return response.data
    },
    async setupMfa(): Promise<ApiResponse<MfaSetupResponse>> {
      const response = await client.post<ApiResponse<MfaSetupResponse>>('/auth/mfa/setup')
      return response.data
    },
    async verifyMfa(code: string): Promise<ApiResponse<MfaSetupResponse>> {
      const response = await client.post<ApiResponse<MfaSetupResponse>>('/auth/mfa/verify', { code })
      return response.data
    },
    async logout(): Promise<ApiResponse<void>> {
      const response = await client.post<ApiResponse<void>>('/auth/logout')
      return response.data
    },
    async getCurrentUser(): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>('/auth/me')
      return response.data
    },
  }
}
