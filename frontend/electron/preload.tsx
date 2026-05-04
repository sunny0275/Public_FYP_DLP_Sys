import { contextBridge, ipcRenderer } from 'electron'

// Recording event data interface
interface RecordingEventData {
  toolName: string
  timestamp: string
  duration?: string
}

// Expose a restricted API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Get user data path
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),

  // Set current user accountId and access token - notify main process via IPC
  setAccountId: (accountId: string, accessToken?: string) => {
    ipcRenderer.send('set-account-id', accountId, accessToken)
  },

  // Get current user accountId (from main process)
  getAccountId: () => ipcRenderer.invoke('get-account-id'),

  // Set access token for JWT-authenticated endpoint requests
  setAccessToken: (accessToken: string) => {
    ipcRenderer.send('set-access-token', accessToken)
  },

  // Get current access token (from main process)
  getAccessToken: () => ipcRenderer.invoke('get-access-token'),

  // Get local IP address (non-loopback) for audit logging
  getLocalIpAddress: () => ipcRenderer.invoke('get-local-ip-address'),

  // Listen for suspicious activity
  onSuspiciousActivity: (callback: (activity: string) => void) => {
    ipcRenderer.on('suspicious-activity', (_event, activity) => callback(activity))
  },

  // Listen for screenshot blocked events - HIGH SEVERITY
  onScreenshotBlocked: (callback: (data: { eventType: string; details: string; timestamp: string }) => void) => {
    ipcRenderer.on('screenshot-blocked', (_event, data) => callback(data))
  },

  // Listen for recording start events
  onRecordingStart: (callback: (data: RecordingEventData) => void) => {
    ipcRenderer.on('recording-start', (_event, data) => callback(data))
  },

  // Listen for recording stop events
  onRecordingStop: (callback: (data: RecordingEventData) => void) => {
    ipcRenderer.on('recording-stop', (_event, data) => callback(data))
  },

  // Listen for security alerts from main process (Sidecar events forwarded)
  onSecurityAlert: (callback: (event: { type: string; severity: string; details: string; timestamp: string }) => void) => {
    ipcRenderer.on('security-alert', (_event, data) => callback(data))
  },
  removeSecurityAlertListener: () => {
    ipcRenderer.removeAllListeners('security-alert')
  },

  onResizePreview: (callback: () => void) => {
    ipcRenderer.on('resize-preview', () => callback())
  },
  removeResizePreviewListener: () => {
    ipcRenderer.removeAllListeners('resize-preview')
  },

  // Listen for DLP auth init request from main process (when querying persist storage)
  // and send response back
  onAuthInitRequest: (callback: () => void) => {
    ipcRenderer.on('DLP_AUTH_INIT_REQUEST', (_event) => {
      console.log('[DLP Preload] Received auth init request')
      callback()
    })
  },

  isContentProtected: () => ipcRenderer.invoke('is-content-protected'),
  setContentProtection: (enabled: boolean) => ipcRenderer.invoke('set-content-protection', enabled),

  // Get current USB mass storage devices (for post-login check)
  getUsbDevices: () => ipcRenderer.invoke('get-usb-devices'),

  // Document viewing state for conditional security logging
  // Only log screenshot/recording tool warnings when actively viewing documents
  setDocumentViewing: (active: boolean) => {
    ipcRenderer.send('set-document-viewing', active)
  },
  isDocumentViewing: () => ipcRenderer.invoke('is-document-viewing'),

  // Remove listeners
  removeSuspiciousActivityListener: () => {
    ipcRenderer.removeAllListeners('suspicious-activity')
  },
  removeScreenshotBlockedListener: () => {
    ipcRenderer.removeAllListeners('screenshot-blocked')
  },
  removeRecordingStartListener: () => {
    ipcRenderer.removeAllListeners('recording-start')
  },
  removeRecordingStopListener: () => {
    ipcRenderer.removeAllListeners('recording-stop')
  },

  // Helper: Send auth init response to main process
  // This is called from executeJavaScript in main.ts to read Zustand persist storage
  sendAuthInitResponse: (accountId: string | null, accessToken: string | null) => {
    console.log('[DLP Preload] Sending auth init response:', accountId)
    ipcRenderer.send('DLP_AUTH_INIT_RESPONSE', accountId, accessToken)
  }
})

// Type definitions (for TypeScript)
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>
      getUserDataPath: () => Promise<string>
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
      setAccountId: (accountId: string, accessToken?: string) => void
      getAccountId: () => string | null
      setAccessToken: (accessToken: string) => void
      getAccessToken: () => string | null
      getLocalIpAddress: () => Promise<string>  // Returns the machine's local IP (non-loopback)
      onSuspiciousActivity: (callback: (activity: string) => void) => void
      onScreenshotBlocked: (callback: (data: { eventType: string; details: string; timestamp: string }) => void) => void
      onRecordingStart: (callback: (data: { toolName: string; timestamp: string }) => void) => void
      onRecordingStop: (callback: (data: { toolName: string; duration?: string; timestamp: string }) => void) => void
      onSecurityAlert: (callback: (event: { type: string; severity: string; details: string; timestamp: string }) => void) => void
      removeSecurityAlertListener: () => void
      onResizePreview: (callback: () => void) => void
      removeResizePreviewListener: () => void
      removeSuspiciousActivityListener: () => void
      removeScreenshotBlockedListener: () => void
      removeRecordingStartListener: () => void
      removeRecordingStopListener: () => void
      isContentProtected: () => Promise<boolean>
      setContentProtection: (enabled: boolean) => Promise<boolean>
      getUsbDevices: () => Promise<string[]>
      setDocumentViewing: (active: boolean) => void
      isDocumentViewing: () => Promise<boolean>
      sendAuthInitResponse: (accountId: string | null, accessToken: string | null) => void
    }
  }
}

