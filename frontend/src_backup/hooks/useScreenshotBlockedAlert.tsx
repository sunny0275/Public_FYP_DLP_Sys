import { useEffect, useRef, useCallback } from 'react'
import { setupScreenshotBlockedListener } from '../utils/electron'
import { apiClient } from '../api'
import { useAuthStore } from '../store/authStore'

/**
 * Map Electron event types to audit log action names
 */
function mapEventTypeToAction(eventType: string): string {
  const upperEvent = eventType.toUpperCase()
  if (upperEvent.includes('SCREENSHOT') || upperEvent.includes('CAPTURE')) {
    return 'SCREENSHOT_ATTEMPT'
  }
  if (upperEvent.includes('RECORD')) {
    return 'SCREEN_RECORDING'
  }
  if (upperEvent.includes('USB') || upperEvent.includes('DEVICE')) {
    return 'USB_DEVICE_DETECTED'
  }
  if (upperEvent.includes('CLIPBOARD')) {
    return 'CLIPBOARD_ACCESS'
  }
  if (upperEvent.includes('WINDOW') || upperEvent.includes('FOCUS')) {
    return 'WINDOW_FOCUS_LOST'
  }
  // Default fallback
  return 'SYSTEM_ALERT'
}

/**
 * Map Electron event types to result severity
 */
function mapEventTypeToResult(eventType: string): 'WARNING' | 'FAILURE' {
  const upperEvent = eventType.toUpperCase()
  if (upperEvent.includes('SCREENSHOT') || upperEvent.includes('CAPTURE')) {
    return 'FAILURE' // Screen capture blocked = FAILURE
  }
  if (upperEvent.includes('RECORD')) {
    return 'FAILURE' // Screen recording = FAILURE (blocked/denied)
  }
  if (upperEvent.includes('USB')) {
    return 'WARNING' // USB device = WARNING (will trigger UEBA scoring)
  }
  return 'WARNING'
}

/**
 * Report security event to backend
 */
async function reportSecurityEvent(
  action: string,
  result: 'WARNING' | 'FAILURE',
  details: string,
  accountId?: string
) {
  try {
    const payload: {
      action: string
      category: string
      result: 'WARNING' | 'FAILURE'
      details: string
      accountId?: string
    } = {
      action,
      category: 'DRM',
      result,
      details
    }
    if (accountId) {
      payload.accountId = accountId
    }
    await apiClient.reportSecurityEvent(payload as any)
    console.log('[DLP] Security event logged to audit:', action, details)
  } catch (err) {
    console.error('[DLP] Failed to log security event:', err)
  }
}

/**
 * Show blocking alert
 */
function showBlockingAlert(data: { eventType: string; details: string; timestamp: string }) {
  // Remove existing alert if any
  const existing = document.getElementById('screenshot-blocked-alert')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'screenshot-blocked-alert'
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: white;
    padding: 20px 30px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(220, 38, 38, 0.5);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    text-align: center;
    max-width: 500px;
    animation: slideDown 0.3s ease-out;
  `

  overlay.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 10px;">🚫 SECURITY ALERT</div>
    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">
      Action: <strong>${data.eventType}</strong>
    </div>
    <div style="font-size: 12px; opacity: 0.8;">
      ${data.details}
    </div>
    <div style="font-size: 11px; opacity: 0.7; margin-top: 10px;">
      ${new Date(data.timestamp).toLocaleTimeString()}
    </div>
  `

  // Add animation styles
  if (!document.getElementById('screenshot-alert-styles')) {
    const style = document.createElement('style')
    style.id = 'screenshot-alert-styles'
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }
  document.body.appendChild(overlay)

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    overlay.style.animation = 'fadeOut 0.5s ease-out forwards'
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    }, 500)
  }, 4000)
}

export function useScreenshotBlockedAlert() {
  const user = useAuthStore((state) => state.user)
  const userAccountId = user?.accountId || 'UNKNOWN'
  
  // Refs for cleanup
  const screenRecordingDetectedRef = useRef(false)
  const displayMediaStreamRef = useRef<MediaStream | null>(null)

  // Report security event to backend
  const reportEvent = useCallback((eventType: string, details: string) => {
    const action = mapEventTypeToAction(eventType)
    const result = mapEventTypeToResult(eventType)
    const fullDetails = `[${userAccountId}] ${eventType}: ${details} | timestamp: ${new Date().toISOString()}`
    
    reportSecurityEvent(action, result, fullDetails, userAccountId)
    showBlockingAlert({ eventType, details, timestamp: new Date().toISOString() })
  }, [userAccountId])

  // Browser-native screen recording detection using getDisplayMedia
  // DISABLED in Electron mode - main.ts handles this
  useEffect(() => {
    // Skip in Electron mode to avoid duplicate audit logs
    const electronApi = (window as any)?.electronAPI
    if (electronApi) {
      return () => {}
    }

    // Intercept getDisplayMedia to detect when user tries to screen share/record
    const originalGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia.bind(navigator.mediaDevices)
    
    if (originalGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async function(constraints?: DisplayMediaStreamOptions) {
        const stream = await originalGetDisplayMedia(constraints)
        
        // Detect if this is a screen capture
        if (stream && !screenRecordingDetectedRef.current) {
          screenRecordingDetectedRef.current = true
          displayMediaStreamRef.current = stream
          
          const displaySurface = stream.getVideoTracks()[0]?.getSettings().displaySurface
          const isScreen = displaySurface === 'monitor' || displaySurface === 'window'
          
          reportEvent(
            'SCREEN_RECORDING',
            `User initiated screen capture/recording. Display surface: ${displaySurface || 'unknown'}. Type: ${isScreen ? 'Full screen' : 'Window/App'}`
          )
          
          // Monitor when recording stops
          stream.getVideoTracks()[0].onended = () => {
            console.log('[DLP] Screen recording stopped')
            screenRecordingDetectedRef.current = false
            displayMediaStreamRef.current = null
          }
        }
        
        return stream
      }
    }

    return () => {
      // Restore original getDisplayMedia
      if (originalGetDisplayMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia
      }
      
      // Stop any active streams
      if (displayMediaStreamRef.current) {
        displayMediaStreamRef.current.getTracks().forEach(track => track.stop())
        displayMediaStreamRef.current = null
      }
    }
  }, [reportEvent])

  // Detect when screen capture APIs are used (alternative detection)
  useEffect(() => {
    // Check for WebRTC screen sharing indicators
    const checkForScreenShare = () => {
      // Check if any peer connection is using screen sharing
      const peerConnections = (window as any).peerConnections || []
      peerConnections.forEach((pc: RTCPeerConnection) => {
        const senders = pc.getSenders?.() || []
        senders.forEach((sender: RTCRtpSender) => {
          if (sender.track?.kind === 'video') {
            const settings = sender.track.getSettings?.()
            if (settings?.displaySurface) {
              console.log('[DLP] Detected screen sharing via WebRTC')
            }
          }
        })
      })
    }

    const interval = setInterval(checkForScreenShare, 5000)
    return () => clearInterval(interval)
  }, [])

  // Detect rapid visibility changes (potential screenshot during switch)
  // DISABLED in Electron mode - main.ts handles this with FOCUS_CHANGE_THRESHOLD
  useEffect(() => {
    // Skip in Electron mode to avoid duplicate audit logs
    const electronApi = (window as any)?.electronAPI
    if (electronApi) {
      return () => {}
    }

    let lastHiddenTime = 0
    let blurCount = 0
    let lastReportTime = 0
    const RAPID_BLUR_THRESHOLD = 3
    const RAPID_BLUR_WINDOW_MS = 2000
    const DEBOUNCE_MS = 5000 // Prevent duplicate events within 5 seconds

    const handleVisibilityChange = () => {
      const now = Date.now()
      
      // Debounce: prevent rapid successive reports
      if (now - lastReportTime < DEBOUNCE_MS) {
        return
      }
      
      if (document.hidden) {
        lastHiddenTime = now
      } else if (lastHiddenTime > 0) {
        const hiddenDuration = now - lastHiddenTime
        // Very brief hidden (< 200ms) suggests screenshot attempt
        if (hiddenDuration < 200) {
          blurCount++
          if (blurCount >= RAPID_BLUR_THRESHOLD) {
            lastReportTime = now
            reportEvent(
              'RAPID_WINDOW_SWITCHING',
              `Rapid window switching detected (${blurCount} times within ${RAPID_BLUR_WINDOW_MS}ms). Possible automated capture attempt.`
            )
            blurCount = 0
          }
        } else {
          blurCount = 0
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [reportEvent])

  // Hook into Electron's screenshot blocked listener (for desktop app)
  // ONLY in browser mode - DRMViewer handles this directly in Electron mode
  useEffect(() => {
    // Skip in Electron mode to avoid duplicate audit logs
    const electronApi = (window as any)?.electronAPI
    if (electronApi) {
      // In Electron mode, DRMViewer handles everything
      return () => {}
    }

    const cleanup = setupScreenshotBlockedListener(async (data) => {
      console.warn('[DLP] Security event detected from Electron:', data)

      const action = mapEventTypeToAction(data.eventType)
      const result = mapEventTypeToResult(data.eventType)
      const fullDetails = `[${userAccountId}] ${data.eventType}: ${data.details} | timestamp: ${data.timestamp}`

      await reportSecurityEvent(action, result, fullDetails, userAccountId)
      showBlockingAlert(data)
    })

    return cleanup
  }, [userAccountId])

  return null
}

export default useScreenshotBlockedAlert
