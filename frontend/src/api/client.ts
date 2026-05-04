import axios, { AxiosInstance, AxiosError } from 'axios'
import { ApiResponse, LoginResponse } from '../types'
import { useAuthStore } from '../store/authStore'

// Check if running in Electron (non-browser environment)
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI !== undefined

// Use relative path in Electron mode so requests go through Vite proxy
// Use absolute URL otherwise (for browser with direct backend access)
let baseURL: string
if (isElectron) {
  // Electron mode: use relative path, Vite proxy handles the rest
  baseURL = '/api'
} else {
  baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:18080/api')
}

let refreshPromise: Promise<ApiResponse<LoginResponse>> | null = null
let permissionDeniedAlertShown = false
let permissionDeniedAlertTimer: ReturnType<typeof setTimeout> | null = null

export function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
  })

  client.interceptors.request.use(
    (config) => {
      const token = useAuthStore.getState().accessToken
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    },
    (error) => Promise.reject(error)
  )

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as any
      const requestUrl = (originalRequest?.url || '') as string
      const isAuthEndpointRequest =
        typeof requestUrl === 'string' &&
        (requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/refresh') ||
          requestUrl.includes('/auth/mfa/verify') ||
          requestUrl.includes('/auth/change-password') ||
          requestUrl.includes('/auth/forgot-password') ||
          requestUrl.includes('/auth/logout') ||
          requestUrl.includes('/auth/me'))

      // Check response message to distinguish between account disabled vs permission denied.
      // Account disabled: triggered by UEBA security policy (score <= 70).
      // Permission denied: triggered by document/resource access restrictions (403).
      const responseData = error.response?.data as any
      const errorMessage = responseData?.message || ''
      const isAccountDisabled =
        (errorMessage.toLowerCase().includes('account is disabled') ||
          errorMessage.toLowerCase().includes('account has been disabled')) &&
        errorMessage.toLowerCase().includes('ueba')

      const isPermissionDenied =
        error.response?.status === 403 &&
        !isAccountDisabled

      if (error.response?.status === 403 && isAccountDisabled && !isAuthEndpointRequest) {
        useAuthStore.getState().clearAuth()
        alert('Your account has been disabled (UEBA policy violation). You are being signed out.')
        window.location.href = '/login?reason=account_disabled'
        return Promise.reject(error)
      }

      // Permission denied (e.g., document access) — show warning alert, redirect to document library.
      // This does NOT sign the user out, but triggers a UEBA score deduction on the server side.
      // Use debounce to prevent multiple alerts from rapid parallel requests.
      if (isPermissionDenied && !isAuthEndpointRequest) {
        // Clear any pending alert timer
        if (permissionDeniedAlertTimer) {
          clearTimeout(permissionDeniedAlertTimer)
        }
        // Only show alert once per navigation context
        if (!permissionDeniedAlertShown) {
          permissionDeniedAlertShown = true
          alert('You do not have permission to access this document. This attempt has been logged for security review.')
          window.location.href = '/documents'
        }
        return Promise.reject(error)
      }

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isAuthEndpointRequest) return Promise.reject(error)
        originalRequest._retry = true
        try {
          const refreshToken = useAuthStore.getState().refreshToken
          if (refreshToken) {
            if (!refreshPromise) {
              refreshPromise = client
                .post<ApiResponse<LoginResponse>>('/auth/refresh', { refreshToken })
                .then((r) => r.data)
                .finally(() => { refreshPromise = null })
            }
            const response = await refreshPromise
            useAuthStore.getState().setAuth(
              {
                userId: response.data.userId,
                accountId: response.data.accountId,
                email: response.data.email,
                fullName: response.data.fullName,
                department: response.data.department,
                position: response.data.position,
                roles: response.data.roles || [],
                availableDashboards: response.data.availableDashboards || [],
                firstLogin: response.data.firstLogin,
                passwordChangeRequired: response.data.passwordChangeRequired,
                mfaEnabled: response.data.mfaEnabled,
                mfaRequired: response.data.mfaRequired
              },
              response.data.accessToken!,
              response.data.refreshToken!
            )
            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`
            return client(originalRequest)
          }
          const currentPath = window.location?.pathname || ''
          const isOnLoginFlow = currentPath.startsWith('/login') || currentPath.startsWith('/mfa-verify')
          if (isOnLoginFlow || isAuthEndpointRequest) return Promise.reject(error)
          useAuthStore.getState().clearAuth()
          window.location.href = '/login'
        } catch (refreshError) {
          refreshPromise = null
          const currentPath = window.location?.pathname || ''
          const isOnLoginFlow = currentPath.startsWith('/login') || currentPath.startsWith('/mfa-verify')
          if (isOnLoginFlow || isAuthEndpointRequest) return Promise.reject(error)
          useAuthStore.getState().clearAuth()
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }
  )

  return client
}
