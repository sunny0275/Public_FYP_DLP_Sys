import { useEffect, useRef, useCallback } from 'react'
import { isElectron } from '../utils/electron'
import { useAuthStore } from '../store/authStore'

// Debounce: skip duplicate events of the same type + tool within this window (ms)
const DEBOUNCE_MS = 2000

// Screenshot event grouping: these event types are part of the same screenshot attempt
const SCREENSHOT_EVENT_TYPES = [
  'SCREENSHOT_KEY_PRESSED',
  'SCCREENSHOT_CLIPBOARD_IMAGE',
  'SCREENSHOT_CLIPBOARD_TEXT',
  'SCREENSHOT_BLOCKED',
]

interface SecurityEvent {
  type?: string
  eventType?: string
  severity?: string
  details?: string
  timestamp?: string
}

// Map event type to audit action name
function mapEventTypeToAction(eventType: string): string {
  const upper = eventType.toUpperCase()
  if (upper.includes('SCREENSHOT') || upper.includes('CAPTURE')) {
    return 'SCREENSHOT_ATTEMPT'
  }
  if (upper.includes('RECORD')) {
    return 'SCREEN_RECORDING'
  }
  if (upper.includes('USB') || upper.includes('STORAGE') || upper.includes('DEVICE')) {
    return 'usb_driver'
  }
  if (upper.includes('CLIPBOARD')) {
    return 'CLIPBOARD_ACCESS'
  }
  return eventType
}

// Get API base URL
function getApiBase(): string {
  if (isElectron()) {
    return '/api'
  }
  return import.meta.env.VITE_API_BASE_URL || '/api'
}

/**
 * Extract tool/process name from details for debounce grouping.
 * e.g. "SnippingTool (PID: 12345)" -> "SnippingTool"
 * e.g. "USB Mass Storage device inserted: xxx" -> unique per device
 * 
 * Screenshot events: group all SCREENSHOT_* events from the same attempt into one key
 */
function extractToolKey(eventType: string, details: string): string {
  // SCREENSHOT grouping: All screenshot-related events (KEY_PRESSED, CLIPBOARD_IMAGE, etc.)
  // from the same user action within DEBOUNCE_MS window should be treated as ONE event
  if (SCREENSHOT_EVENT_TYPES.some(t => eventType.includes(t))) {
    // Group by first 80 chars of details (captures window name + process info)
    // This ensures KEY_PRESSED + CLIPBOARD_IMAGE from same PrintScreen = 1 audit entry
    const windowMatch = details.match(/window:\s*'([^']+)'/i) || details.match(/window:\s*"([^"]+)"/i)
    const windowName = windowMatch ? windowMatch[1] : ''
    return `SCREENSHOT:${windowName.substring(0, 50)}:${details.substring(0, 30)}`
  }

  // For RECORDING_TOOL_BLOCKED: extract tool name + PID
  // Each process instance (different PID) should be logged separately
  const recordMatch = details.match(/'([^']+)'\s*\(PID:\s*(\d+)\)/)
  if (recordMatch) {
    return `${eventType}:${recordMatch[1]}:${recordMatch[2]}`
  }

  // For USB events: Each USB device insertion/removal should be logged separately
  // USB events come as USB_INSERTED or USB_REMOVED
  if (eventType.includes('USB_INSERTED') || eventType.includes('USB_REMOVED')) {
    // Include full details to differentiate between different USB drives
    // Each unique device instance should be logged
    return `USB_${details.substring(0, 100)}`
  }

  // For USB_STORAGE_DETECTED (from Sidecar):
  // - Use the full details as key (each device instance is unique)
  // - Include both "inserted" and "removed" events
  // - Different USB drives (different device paths/instances) should all be logged
  if (eventType === 'USB_STORAGE_DETECTED') {
    // Include full details to differentiate between different USB drives
    // Truncate only to avoid extremely long keys (max 120 chars)
    return `USB_STOR_${details.substring(0, 120)}`
  }

  // Default: type + first 50 chars of details
  return `${eventType}:${details.substring(0, 50)}`
}

/**
 * Hook: useSecurityEventForwarder
 * 
 * Forwards security events from Electron main process/Sidecar to backend audit log.
 * Uses JWT authentication for proper user identification.
 * 
 * This replaces the previous approach where main process sent events directly
 * to backend (which lacked proper JWT authentication).
 * 
 * Events handled:
 * - security-alert: All Sidecar events (RECORDING_TOOL_BLOCKED, SCREENSHOT_*, USB_*, etc.)
 * - screenshot-blocked: Electron clipboard monitoring events
 */
export function useSecurityEventForwarder() {
  const lastEventRef = useRef<{ key: string; time: number } | null>(null)
  const sentCountRef = useRef(0)
  const failedCountRef = useRef(0)

  const sendToAudit = useCallback(async (
    eventType: string,
    category: string,
    result: 'SUCCESS' | 'WARNING' | 'FAILURE' | 'BLOCKED',
    details: string
  ) => {
    // Smart debounce: deduplicate based on event type + tool identity
    // Different tools (different PIDs, different VID/PID) should NOT be debounced
    const eventKey = extractToolKey(eventType, details)
    const now = Date.now()
    if (
      lastEventRef.current?.key === eventKey &&
      now - lastEventRef.current.time < DEBOUNCE_MS
    ) {
      return
    }
    lastEventRef.current = { key: eventKey, time: now }

    // Get fresh user state from store (ensures we have latest accessToken after refresh)
    const { user, accessToken } = useAuthStore.getState()
    
    // Get user info - skip audit log if user is not authenticated (unknown)
    const userAccountId = user?.accountId
    if (!userAccountId) {
      return
    }

    try {
      // Build headers with JWT auth
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const apiBase = getApiBase()
      
      // Build action name - USB events use 'usb_driver'
      const action = mapEventTypeToAction(eventType)

      // Send directly using fetch (apiClient doesn't have a direct post method)
      // All Sidecar events use severity=HIGH and result=WARNING
      const response = await fetch(`${apiBase}/agent/endpoint/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          category,
          result,
          severity: 'HIGH', // All Sidecar events are HIGH severity
          details,
          accountId: userAccountId,
          hostName: userAccountId
        })
      })

      if (response.ok) {
        sentCountRef.current++
      } else {
        failedCountRef.current++
      }
    } catch (error) {
      failedCountRef.current++
    }
  }, []) // No dependencies - always reads fresh from store

  useEffect(() => {
    if (!isElectron()) {
      return () => {}
    }

    const electronApi = (window as any)?.electronAPI
    if (!electronApi) {
      return () => {}
    }

    // Handle security alerts from Sidecar (all security events)
    const handleSecurityAlert = (event: SecurityEvent) => {
      const eventType = event.type || event.eventType || 'UNKNOWN'
      
      // All Sidecar events use WARNING result
      // The event type itself indicates the severity (e.g., RECORDING_TOOL_BLOCKED, USB_INSERTED)
      const result: 'SUCCESS' | 'WARNING' | 'FAILURE' | 'BLOCKED' = 'WARNING'

      void sendToAudit(eventType, 'DRM', result, event.details || eventType)
    }

    // Handle screenshot blocked events (from Electron clipboard monitoring)
    const handleScreenshotBlocked = (data: { eventType: string; details: string; timestamp: string }) => {
      // Use BLOCKED for screenshot attempts - more explicit than FAILURE
      void sendToAudit(data.eventType, 'DRM', 'BLOCKED', data.details)
    }

    // Listen for security alerts from main process (Sidecar events)
    if (electronApi.onSecurityAlert) {
      electronApi.onSecurityAlert(handleSecurityAlert)
    }

    // Listen for screenshot blocked (clipboard monitoring)
    if (electronApi.onScreenshotBlocked) {
      electronApi.onScreenshotBlocked(handleScreenshotBlocked)
    }

    // Listen for suspicious activity (USB events, clipboard events, etc.)
    // This event channel is used by main.ts for events that don't have full event structure
    const handleSuspiciousActivity = (activity: string) => {
      // Check if this is a USB event
      if (activity.includes('USB') || activity.includes('Removable')) {
        // USB events from main.ts are in format: "[USB_INSERTED] USB inserted: ..."
        const match = activity.match(/\[(USB_\w+)\]\s*(.*)/)
        if (match) {
          const eventType = match[1] // e.g., "USB_INSERTED"
          const details = match[2]
          // USB events are WARNING severity (not blocked, just detected)
          void sendToAudit(eventType, 'DRM', 'WARNING', details)
        }
      }

      // For other suspicious activities, only update UI state - do NOT send to audit log
      // Most events through this channel are benign (window focus, clipboard, etc.)
      // Real security events (screenshot, recording) are handled via handleSecurityAlert (security-alert IPC)
    }

    if (electronApi.onSuspiciousActivity) {
      electronApi.onSuspiciousActivity(handleSuspiciousActivity)
    }

    return () => {
      if (electronApi.removeSecurityAlertListener) {
        electronApi.removeSecurityAlertListener()
      }
      if (electronApi.removeScreenshotBlockedListener) {
        electronApi.removeScreenshotBlockedListener()
      }
      if (electronApi.removeSuspiciousActivityListener) {
        electronApi.removeSuspiciousActivityListener()
      }
    }
  }, [sendToAudit])

  // Detect login and trigger USB re-check
  useEffect(() => {
    if (!isElectron()) {
      return () => {}
    }

    const electronApi = (window as any)?.electronAPI
    if (!electronApi?.getUsbDevices) {
      return () => {}
    }

    // Subscribe to auth store changes
    let previousAuth = useAuthStore.getState().isAuthenticated

    const unsubscribe = useAuthStore.subscribe((state, _prevState) => {
      const currentAuth = state.isAuthenticated

      // Detect login transition (was not authenticated, now is)
      if (!previousAuth && currentAuth) {
        // Small delay to ensure JWT is ready
        setTimeout(async () => {
          try {
            const devices = await electronApi.getUsbDevices()

            if (devices && devices.length > 0) {
              // Send audit log for each USB device
              for (const device of devices) {
                const details = `USB Mass Storage device detected (post-login scan): ${device}`
                await sendToAudit('USB_STORAGE_DETECTED', 'DRM', 'WARNING', details)
              }
            }
          } catch (error) {
            // Silent fail - USB check is non-critical
          }
        }, 1000)
      }

      previousAuth = currentAuth
    })

    return () => {
      unsubscribe()
    }
  }, [sendToAudit])
}
