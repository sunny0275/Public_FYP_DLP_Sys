import { AxiosInstance } from 'axios'
import { ApiResponse, Alert } from '../types'

export function createDashboardApi(client: AxiosInstance) {
  return {
    async getRecentAlerts(): Promise<ApiResponse<Alert[]>> {
      const response = await client.get<ApiResponse<Alert[]>>('/alerts/recent')
      return response.data
    },
    async getTeamWorkload(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/team/workload')
      return response.data
    },
    async getSLABreaches(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/slas/breaches')
      return response.data
    },
    async getDLPAlerts(severity?: string): Promise<ApiResponse<any[]>> {
      const url = severity ? `/alerts/recent?severity=${severity}` : '/alerts/recent'
      const response = await client.get<ApiResponse<any[]>>(url)
      return response.data
    },
    async getInvestigations(): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>('/investigations')
      return response.data
    },
  }
}
