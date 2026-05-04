/// <reference types="vite/client" />

declare module 'pako' {
  export function deflate(data: Uint8Array | number[]): Uint8Array;
  export function inflate(data: Uint8Array | number[]): Uint8Array;
  export function deflateRaw(data: Uint8Array | number[]): Uint8Array;
  export function inflateRaw(data: Uint8Array | number[]): Uint8Array;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Electron API type definitions (global)
interface ElectronAPI {
  getAppVersion: () => Promise<string>
  getUserDataPath: () => Promise<string>
  readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
  setAccountId: (accountId: string, accessToken?: string) => void
  getAccountId: () => Promise<string | null>
  setAccessToken: (accessToken: string) => void
  getAccessToken: () => Promise<string | null>
  getLocalIpAddress: () => Promise<string>
  onSuspiciousActivity: (callback: (activity: string) => void) => void
  removeSuspiciousActivityListener: () => void
  onScreenshotBlocked: (callback: (data: { eventType: string; details: string; timestamp: string }) => void) => void
  removeScreenshotBlockedListener: () => void
  onRecordingStart: (callback: (data: { toolName: string; timestamp: string }) => void) => void
  onRecordingStop: (callback: (data: { toolName: string; duration?: string; timestamp: string }) => void) => void
  removeRecordingStartListener: () => void
  removeRecordingStopListener: () => void
  onSecurityAlert: (callback: (event: { type: string; severity: string; details: string; timestamp: string }) => void) => void
  removeSecurityAlertListener: () => void
  onResizePreview: (callback: () => void) => void
  removeResizePreviewListener: () => void
  onAuthInitRequest: (callback: () => void) => void
  sendAuthInitResponse: (accountId: string | null, accessToken: string | null) => void
  isContentProtected: () => Promise<boolean>
  setContentProtection: (enabled: boolean) => Promise<boolean>
  setDocumentViewing: (active: boolean) => void
  isDocumentViewing: () => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
