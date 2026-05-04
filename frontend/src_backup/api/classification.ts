import { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export function createClassificationApi(client: AxiosInstance) {
  return {
    async getPendingReviewDocuments(page: number = 0, size: number = 20, sortBy: string = 'createdAt', sortDir: string = 'DESC'): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/classification/review?page=${page}&size=${size}&sortBy=${sortBy}&sortDir=${sortDir}`)
      return response.data
    },
    async getPendingReviewCount(): Promise<ApiResponse<number>> {
      const response = await client.get<ApiResponse<number>>('/classification/review/count')
      return response.data
    },
    async approveClassification(documentId: number, data: {
      approvedClassificationLevel?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'
      approveCurrentLevel: boolean
      comment?: string
    }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>(`/classification/${documentId}/approve`, data)
      return response.data
    },
    async getApprovedDocuments(page: number = 0, size: number = 20, sortBy: string = 'updatedAt', sortDir: string = 'DESC'): Promise<ApiResponse<any>> {
      const response = await client.get<ApiResponse<any>>(`/classification/approved?page=${page}&size=${size}&sortBy=${sortBy}&sortDir=${sortDir}`)
      return response.data
    },
    async getApprovedDocumentsCount(): Promise<ApiResponse<number>> {
      const response = await client.get<ApiResponse<number>>('/classification/approved/count')
      return response.data
    },
  }
}
