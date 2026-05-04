export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface User {
  userId: number
  accountId: string
  email: string
  fullName: string
  mfaRequired: boolean
  department?: string
  position?: string
  roles: string[]
  availableDashboards: string[]
  firstLogin: boolean
  passwordChangeRequired: boolean
  mfaEnabled: boolean
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  error?: string
}

export interface LoginRequest {
  accountId: string
  password: string
  mfaCode?: string
}

export interface LoginResponse {
  accessToken?: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
  userId: number
  accountId: string
  email: string
  fullName: string
  department?: string
  position?: string
  roles?: string[]
  availableDashboards?: string[]
  firstLogin: boolean
  passwordChangeRequired: boolean
  mfaRequired: boolean
  mfaEnabled: boolean
  mfaQrCodeUrl?: string
  mfaSecret?: string
  passwordExpiringSoon?: boolean
  daysUntilPasswordExpiry?: number
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface MfaSetupResponse {
  secret: string
  qrCodeUrl: string
  qrCodeImage?: string
  setupCompleted: boolean
}

export interface UserSummary {
  userId: number
  accountId: string
  fullName: string
  email: string
  department: string
  position: string
  pendingTaskCount: number
  recentDocCount: number
  alertCount: number
  passwordExpiringSoon: boolean
  daysUntilPasswordExpiry: number | null
}

export interface RecentDocument {
  id: number
  documentName: string
  department: string
  classificationLevel: string
  lastAccessTime: string
  fileType: string
  fileSize: number
}

export interface Alert {
  id: number
  alertType: string
  severity: string
  alertTime: string
  description: string
  resourceType: string
  resourceId: string
  acknowledged: boolean
}

export interface AuditLogEntry {
  id: number
  timestamp: string
  userId?: number
  userName?: string
  accountId?: string
  action: string
  category?: string
  details?: string
  resource?: string
  ipAddress?: string
  result: 'SUCCESS' | 'FAILURE' | 'WARNING'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  immutableHash?: string
  blockchainTxHash?: string
  anchorStatus?: 'HASHED' | 'ANCHORED' | 'ANCHOR_FAILED' | string
  anchoredAt?: string
}

export interface AuditLogPage {
  items: AuditLogEntry[]
  totalElements: number
  totalPages: number
  currentPage: number
  pageSize: number
}

export interface AuditLogSearchParams {
  page?: number
  size?: number
  userId?: number
  userName?: string
  accountId?: string
  searchTerm?: string
  severity?: string
  startTime?: string
  endTime?: string
  documentId?: number
  action?: string
  category?: string
  result?: string
}

export interface TracebackRequest {
  type: 'watermark' | 'fingerprint' | 'documentId'
  value: string
}

export interface TracebackResult {
  watermarkPayload?: string
  documentFingerprint?: string
  documentId?: number
  documentName?: string
  found: boolean
  accessChain: AuditLogEntry[]
  totalRecords: number
  firstAccess?: AuditLogEntry
  lastAccess?: AuditLogEntry
}

export interface SecurityEventPayload {
  action: string
  category: string
  result: 'SUCCESS' | 'WARNING' | 'FAILURE'
  details?: string
  accountId?: string  // For Electron events to identify the correct user
}

export interface UebaRuleDto {
  id?: number
  name: string
  description?: string
  ruleType: string
  conditionJson?: string
  actionOrWeight?: string
  weight?: number
  severity?: string
  scopeJson?: string
  priority?: number
  enabled?: boolean
  version?: number
  changedBy?: string
  changeReason?: string
  createdAt?: string
  updatedAt?: string
}