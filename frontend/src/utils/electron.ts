/**
 * Electron API utilities
 * Wrapper helpers for communicating with the Electron main process (when running as desktop app)
 */

// Detect if running in Electron (works in both dev and production)
// In dev: window.electronAPI exists (preload script loaded in Electron window)
// In production: window.electronAPI exists (preload script)
// Also check userAgent for Electron context
export const isElectron = () => {
  if (typeof window === 'undefined') return false
  // Primary check: window.electronAPI exposed by preload script
  if (window.electronAPI !== undefined) return true
  // Fallback: check if running in Electron browser (userAgent contains Electron)
  // This catches cases where preload might not be loaded yet during dev
  if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron')) return true
  return false
}

export const getAppVersion = async (): Promise<string> => {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.getAppVersion()
  }
  return 'web'
}

export const getUserDataPath = async (): Promise<string> => {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.getUserDataPath()
  }
  return ''
}

// Listen for system-level suspicious activity (desktop app only)
export const setupSuspiciousActivityListener = (callback: (activity: string) => void) => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI.onSuspiciousActivity(callback)

    // Return cleanup function
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeSuspiciousActivityListener()
      }
    }
  }
  return () => {}
}

// Listen for screenshot blocked events - HIGH SEVERITY (desktop app only)
export const setupScreenshotBlockedListener = (callback: (data: { eventType: string; details: string; timestamp: string }) => void) => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI.onScreenshotBlocked(callback)

    // Return cleanup function
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeScreenshotBlockedListener()
      }
    }
  }
  return () => {}
}

// Listen for recording start events (desktop app only)
export const setupRecordingStartListener = (callback: (data: { toolName: string; timestamp: string }) => void) => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI.onRecordingStart(callback)

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeRecordingStartListener()
      }
    }
  }
  return () => {}
}

// Listen for recording stop events (desktop app only)
export const setupRecordingStopListener = (callback: (data: { toolName: string; duration?: string; timestamp: string }) => void) => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI.onRecordingStop(callback)

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeRecordingStopListener()
      }
    }
  }
  return () => {}
}

