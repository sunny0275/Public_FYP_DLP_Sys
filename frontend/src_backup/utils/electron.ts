/**
 * Electron API utilities
 * Wrapper helpers for communicating with the Electron main process (when running as desktop app)
 */

export const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined
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

