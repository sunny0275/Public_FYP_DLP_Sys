import { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export function createAdminApi(client: AxiosInstance) {
  return {
    getClassificationTuningStatus: () =>
      client.get<ApiResponse<any>>('/admin/classification-tuning/status').then((r) => r.data),
    triggerClassificationAutoTuning: () =>
      client.post<ApiResponse<any>>('/admin/classification-tuning/auto-trigger').then((r) => r.data),
    getClassificationTuningSamples: (limit = 50) =>
      client.get<ApiResponse<any>>('/admin/classification-tuning/samples', { params: { limit } }).then((r) => r.data),
    clearClassificationTuningSamples: () =>
      client.delete<ApiResponse<any>>('/admin/classification-tuning/samples', { params: { confirm: true } }).then((r) => r.data),
    importClassificationTuningExamples: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return client.post<ApiResponse<any>>('/admin/classification-tuning/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data)
    },

    // UEBA Tuning API
    getUebaTuningStatus: () =>
      client.get<ApiResponse<any>>('/admin/ueba-tuning/status').then((r) => r.data),
    getUebaTuningVersion: () =>
      client.get<ApiResponse<any>>('/admin/ueba-tuning/version').then((r) => r.data),
    triggerUebaAutoTuning: () =>
      client.post<ApiResponse<any>>('/admin/ueba-tuning/auto-trigger').then((r) => r.data),
    getUebaTuningAutoToggle: () =>
      client.get<ApiResponse<{ enabled: boolean }>>('/admin/ueba-tuning/auto-toggle').then((r) => r.data),
    setUebaTuningAutoToggle: (enabled: boolean) =>
      client.post<ApiResponse<{ enabled: boolean; message: string }>>('/admin/ueba-tuning/auto-toggle', null, {
        params: { enabled },
      }).then((r) => r.data),
    setUebaMinExamples: (value: number) =>
      client.put<ApiResponse<{ minExamples: number; message: string }>>('/admin/ueba-tuning/min-examples', null, {
        params: { value },
      }).then((r) => r.data),
    getUebaTuningExamples: (limit = 50) =>
      client.get<ApiResponse<any>>('/admin/ueba-tuning/examples', { params: { limit } }).then((r) => r.data),
    deleteUebaTuningExample: (id: number) =>
      client.delete<ApiResponse<void>>(`/admin/ueba-tuning/examples/${id}`).then((r) => r.data),
    clearUebaTuningExamples: () =>
      client.delete<ApiResponse<any>>('/admin/ueba-tuning/examples', { params: { confirm: true } }).then((r) => r.data),
    importUebaTuningExamples: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return client.post<ApiResponse<any>>('/admin/ueba-tuning/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data)
    },

    // Classification Tuning API
    getClassificationTuningAutoToggle: () =>
      client.get<ApiResponse<{ enabled: boolean }>>('/admin/classification-tuning/auto-toggle').then((r) => r.data),
    setClassificationTuningAutoToggle: (enabled: boolean) =>
      client.post<ApiResponse<{ enabled: boolean; message: string }>>('/admin/classification-tuning/auto-toggle', null, {
        params: { enabled },
      }).then((r) => r.data),
    setClassificationMinExamples: (value: number) =>
      client.put<ApiResponse<{ minExamples: number; message: string }>>('/admin/classification-tuning/min-examples', null, {
        params: { value },
      }).then((r) => r.data),

    getSystemHealth: () => client.get<ApiResponse<any>>('/system/health').then((r) => r.data),
    getBlockchainHealth: () => client.get<ApiResponse<any>>('/system/blockchain/health').then((r) => r.data),
    getLlmHealth: () => client.get<ApiResponse<any>>('/system/llm/health').then((r) => r.data),
    getBlockchainTransaction: (txHash: string) =>
      client.get<ApiResponse<any>>(`/system/blockchain/tx/${encodeURIComponent(txHash)}`).then((r) => r.data),
    resetUebaScores: (enableAccounts = false) =>
      client.post<ApiResponse<any>>('/admin/ueba/reset-scores', null, { params: { enableAccounts } }).then((r) => r.data),
    resetUserUebaScore: (userId: number, enableAccount = false) =>
      client.post<ApiResponse<any>>(`/admin/users/${userId}/ueba/reset-score`, null, { params: { enableAccount } }).then((r) => r.data),
    getJobQueue: () => client.get<ApiResponse<any[]>>('/jobs/queue').then((r) => r.data),
    getUserSummary2: () => client.get<ApiResponse<any>>('/admin/users/summary').then((r) => r.data),
    getSystemLogs: () => client.get<ApiResponse<any[]>>('/logs/recent').then((r) => r.data),
    exportLogs: (range: string = '24h') => client.get<ApiResponse<any>>('/logs/export', { params: { range } }).then((r) => r.data),
    wipeDocumentLibrary: (confirm: string, deleteFiles = true) =>
      client.post<ApiResponse<any>>('/admin/system/wipe-documents', null, { params: { confirm, deleteFiles } }).then((r) => r.data),
    createUser: (data: { accountId: string; email: string; fullName: string; department: string; roles: string[] }) =>
      client.post<ApiResponse<any>>('/admin/users', data).then((r) => r.data),
    getAllUsers: () => client.get<ApiResponse<any[]>>('/admin/users').then((r) => r.data),
    getNextAccountId: (department?: string, role?: string) => {
      const params: Record<string, string> = {}
      if (department) params.department = department
      if (role) params.role = role
      return client.get<ApiResponse<{ accountId: string }>>('/admin/users/next-account-id', { params }).then((r) => r.data)
    },
    searchUsers: (q: string, limit = 10) => client.get<ApiResponse<any[]>>('/users/search', { params: { q, limit } }).then((r) => r.data),
    restoreUser: (userId: number) => client.post<ApiResponse<void>>(`/admin/users/${userId}/restore`).then((r) => r.data),
    purgeUser: (userId: number) => client.delete<ApiResponse<void>>(`/admin/users/${userId}/purge`).then((r) => r.data),
    getUserById: (userId: number) => client.get<ApiResponse<any>>(`/admin/users/${userId}`).then((r) => r.data),
    updateUser: (userId: number, data: { email: string; fullName: string; department: string; roles: string[]; accountEnabled?: boolean }) =>
      client.put<ApiResponse<any>>(`/admin/users/${userId}`, data).then((r) => r.data),
    unlockUser: (userId: number) => client.put<ApiResponse<void>>(`/admin/users/${userId}/unlock`).then((r) => r.data),
    disableUser: (userId: number) => client.put<ApiResponse<void>>(`/admin/users/${userId}/disable`).then((r) => r.data),
    enableUser: (userId: number) => client.put<ApiResponse<void>>(`/admin/users/${userId}/enable`).then((r) => r.data),
    resetUserPassword: (userId: number) => client.put<ApiResponse<any>>(`/admin/users/${userId}/reset`).then((r) => r.data),
    deleteUser: (userId: number) => client.delete<ApiResponse<void>>(`/admin/users/${userId}`).then((r) => r.data),
    getDlpPolicies: () => client.get<ApiResponse<any>>('/admin/policies/dlp').then((r) => r.data),
    updateDlpPolicies: (config: any, reason?: string) =>
      client.put<ApiResponse<any>>('/admin/policies/dlp', config, { params: reason ? { reason } : undefined }).then((r) => r.data),
    getPolicyHistory: (policyKey: string) => client.get<ApiResponse<any[]>>('/admin/policies/history', { params: { policyKey } }).then((r) => r.data),
    rollbackPolicy: (policyKey: string, version: number, reason?: string) =>
      client.post<ApiResponse<any>>('/admin/policies/rollback', { policyKey, version, reason: reason || 'Policy rollback' }).then((r) => r.data),
    getWatermarkSettings: () => client.get<ApiResponse<any>>('/admin/watermark').then((r) => r.data),
    updateWatermarkSettings: (settings: any, reason?: string) =>
      client.put<ApiResponse<any>>('/admin/watermark', settings, { params: reason ? { reason } : undefined }).then((r) => r.data),
    checkBlindWatermark: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return client
        .post<ApiResponse<any>>('/admin/watermark/check', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data)
    },
    adminRevokeForceResetAndAlert: (userId: number, reason?: string) =>
      client.post<ApiResponse<void>>('/keys/admin/revoke-force-reset', { userId, reason: reason || 'Security incident response' }).then((r) => r.data),
    adminRewrapOperationalKeys: () =>
      client.post<ApiResponse<any>>('/keys/admin/rewrap-operational-keys').then((r) => r.data),

    // Watermark Traceback API
    watermarkTracebackSearch: (params: {
      userAccountId?: string
      documentId?: number
      documentName?: string
      ipAddress?: string
      shortCode?: string
      payloadHash?: string
      startTime?: string
      endTime?: string
      page?: number
      size?: number
    }) =>
      client.post<ApiResponse<any>>('/admin/watermark-traceback/search', null, { params }).then((r) => r.data),
    watermarkTracebackByShortCode: (shortCode: string, page = 0, size = 20) =>
      client.post<ApiResponse<any>>('/admin/watermark-traceback/shortcode', null, { params: { shortCode, page, size } }).then((r) => r.data),

    // IP Management API
    getBlockedIps: () =>
      client.get<ApiResponse<{ blockedIps: Record<string, { ipAddress: string; blockedAt: string; attemptCount: number }>; totalCount: number }>>('/admin/ip/blocked').then((r) => r.data),
    unblockIp: (ipAddress: string) =>
      client.post<ApiResponse<void>>('/admin/ip/unblock', { ipAddress }).then((r) => r.data),
    blockIp: (ipAddress: string, reason?: string) =>
      client.post<ApiResponse<void>>('/admin/ip/block', { ipAddress, reason }).then((r) => r.data),
    unblockAllIps: () =>
      client.post<ApiResponse<{ unblockedCount: number; message: string }>>('/admin/ip/unblock-all').then((r) => r.data),
  }
}
