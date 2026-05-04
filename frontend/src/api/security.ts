import { AxiosInstance } from 'axios'
import { ApiResponse, SecurityEventPayload } from '../types'

export function createSecurityApi(client: AxiosInstance) {
  return {
    async reportSecurityEvent(payload: SecurityEventPayload): Promise<ApiResponse<void>> {
      const response = await client.post<ApiResponse<void>>('/security/events', payload)
      return response.data
    },
  }
}
