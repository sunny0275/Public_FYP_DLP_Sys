import { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export function createSignatureApi(client: AxiosInstance) {
  return {
    async signDocument(data: { documentId: number; documentHash: string; privateKeyHex?: string; mfaCode?: string }): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/sign', data)
      return response.data
    },
    async getSignatureChain(documentId: number): Promise<ApiResponse<any[]>> {
      const response = await client.get<ApiResponse<any[]>>(`/sign/${documentId}/chain`)
      return response.data
    },
    async verifySignature(signatureId: number): Promise<ApiResponse<any>> {
      const response = await client.post<ApiResponse<any>>('/sign/verify', { signatureId })
      return response.data
    },
  }
}
