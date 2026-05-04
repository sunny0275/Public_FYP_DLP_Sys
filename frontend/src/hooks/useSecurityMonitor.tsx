/**
 * Security Monitor Hook - Frontend SDK for DLP Platform
 * 
 * Detects and reports security events to the backend:
 * - Screenshot attempts
 * - Copy/paste operations
 * - Bulk document viewing
 * - Suspicious browser behavior
 * - Web-based screen capture detection
 * 
 * Events are sent to POST /security/events
 * Backend determines risk level using 4-tier UEBA analysis:
 * - Tier 1: Definite Benign → no action
 * - Tier 2: Definite Critical → DISABLE_ACCOUNT
 * - Tier 2.5: Context-Dependent → rule-based WARNING
 * - Tier 3: Definite High → ALERT_ADMIN
 * - Tier 4: Ambiguous → LLM analysis (gemini-2.5-flash)
 */

import { useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setupScreenshotBlockedListener, setupSuspiciousActivityListener, setupRecordingStartListener, setupRecordingStopListener, isElectron } from '../utils/electron'
import { useScreenCaptureMonitor, ScreenCaptureEvent } from './useScreenCaptureMonitor'
import { useAuthStore } from '../store/authStore'

// ============== Types ==============

export interface SecurityEvent {
  action: string
  category: string
  result: 'SUCCESS' | 'WARNING' | 'FAILURE'
  details?: string
}

export interface SecurityMonitorOptions {
  enabled?: boolean
  reportScreenshot?: boolean
  reportBulkView?: boolean
  debounceMs?: number
  /** Callback to immediately lock preview when screen capture is detected (web only) */
  onCaptureDetected?: (event: ScreenCaptureEvent) => void
}

// ============== Security Event Reporter ==============

class SecurityEventReporter {
  private queue: { event: SecurityEvent; accountId?: string }[] = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly debounceMs: number
  private readonly apiBase: string

  constructor(debounceMs = 1000) {
    this.debounceMs = debounceMs
    // Use relative path so requests go through Vite proxy in Electron mode
    // This avoids CORS preflight delays
    this.apiBase = isElectron() ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api')
  }

  /**
   * Report a security event to the backend
   */
  async report(event: SecurityEvent, accountId?: string): Promise<void> {
    this.queue.push({ event, accountId })
    this.scheduleFlush()
  }

  /**
   * Immediately report a high-severity event (Tier 2/3)
   */
  async reportImmediate(event: SecurityEvent, accountId?: string): Promise<void> {
    try {
      const payload: Record<string, unknown> = { ...event }
      if (accountId) {
        payload.accountId = accountId
      }
      await fetch(`${this.apiBase}/security/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify(payload)
      })
      console.debug('[SecurityMonitor] Immediate event reported:', event.action)
    } catch (error) {
      console.error('[SecurityMonitor] Failed to report event:', error)
    }
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => this.flush(), this.debounceMs)
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return

    const items = [...this.queue]
    this.queue = []

    try {
      // Send all events in batch
      await Promise.all(items.map(({ event, accountId }) => {
        const payload: Record<string, unknown> = { ...event }
        if (accountId) {
          payload.accountId = accountId
        }
        return fetch(`${this.apiBase}/security/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getToken()}`
          },
          body: JSON.stringify(payload)
        }).catch(err => console.error('[SecurityMonitor] Failed to report:', err))
      }))
      console.debug('[SecurityMonitor] Batch reported:', items.length, 'events')
    } catch (error) {
      console.error('[SecurityMonitor] Batch report failed:', error)
    }
  }

  private getToken(): string {
    // Try Zustand store first, then fallback to localStorage
    const state = useAuthStore.getState()
    return state.accessToken || localStorage.getItem('token') || ''
  }
}

// Singleton reporter instance
const reporter = new SecurityEventReporter(1000)

// ============== Action Constants ==============

export const SECURITY_ACTIONS = {
  // Screenshot / Screen Capture (HIGH RISK)
  SCREENSHOT_ATTEMPT: 'SCREENSHOT_ATTEMPT',
  SCREENSHOT_TOOL_DETECTED: 'SCREENSHOT_TOOL_DETECTED',
  SCREENSHOT_PRESSED: 'SCREENSHOT_PRESSED',
  SCREEN_CAPTURE_DETECTED: 'SCREEN_CAPTURE_DETECTED',
  WEB_SCREEN_CAPTURE_DETECTED: 'WEB_SCREEN_CAPTURE_DETECTED',

  // Recording
  SCREEN_RECORDING_START: 'SCREEN_RECORDING_START',
  SCREEN_RECORDING_STOP: 'SCREEN_RECORDING_STOP',

  // Window Focus/Blur (LOW RISK if suspicious)
  WINDOW_BLUR: 'WINDOW_BLUR',
  WINDOW_FOCUS: 'WINDOW_FOCUS',
  WINDOW_BLUR_SUSPICIOUS: 'WINDOW_BLUR_SUSPICIOUS',
  PAGE_HIDDEN: 'PAGE_HIDDEN',
  PAGE_VISIBLE: 'PAGE_VISIBLE',

  // Browser
  DEV_TOOLS_OPEN: 'DEV_TOOLS_OPEN',

  // Bulk view (reported by app)
  BULK_VIEW_THRESHOLD: 'BULK_VIEW_THRESHOLD'
} as const

export const SECURITY_CATEGORIES = {
  DRM: 'DRM',
  DOCUMENT: 'DOCUMENT',
  WINDOW_MANAGEMENT: 'WINDOW_MANAGEMENT',
  BROWSER: 'BROWSER',
  UEBA: 'UEBA'
} as const

// ============== Screenshot Detection ==============

function detectScreenshotAttempts(accountId?: string): () => void {
  const handlers: (() => void)[] = []

  // Electron: listen for screenshot blocked ONLY in browser (non-Electron) mode
  // In Electron mode, DRMViewer handles screenshot detection directly for immediate response
  if (!isElectron()) {
    const electronCleanup = setupScreenshotBlockedListener((data) => {
      console.warn('[SecurityMonitor] Screenshot blocked:', data)
      reporter.reportImmediate({
        action: SECURITY_ACTIONS.SCREENSHOT_ATTEMPT,
        category: SECURITY_CATEGORIES.DRM,
        result: 'WARNING',
        details: `Screenshot blocked: ${data.eventType} - ${data.details}`
      }, accountId)
      showBlockingAlert(data.eventType, data.details)
    })
    handlers.push(electronCleanup)
  }

  // Note: DevTools detection removed to avoid false positives in Electron/app mode

  // Return combined cleanup
  return () => handlers.forEach(h => h())
}

// ============== Alert Display ==============

function showBlockingAlert(eventType: string, details: string): void {
  // Remove existing alert if any
  const existing = document.getElementById('dlp-security-alert')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'dlp-security-alert'
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(220, 38, 38, 0.5);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `

  overlay.innerHTML = `
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
      🚫 Security Alert
    </div>
    <div style="font-size: 14px; margin-bottom: 4px;">
      <strong>${eventType}</strong>
    </div>
    <div style="font-size: 12px; opacity: 0.9;">
      ${details}
    </div>
    <div style="font-size: 11px; opacity: 0.7; margin-top: 8px;">
      ${new Date().toLocaleTimeString()}
    </div>
  `

  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100px); }
    }
  `
  document.head.appendChild(style)
  document.body.appendChild(overlay)

  setTimeout(() => {
    overlay.style.animation = 'slideOut 0.5s ease-out forwards'
    setTimeout(() => {
      overlay.remove()
      style.remove()
    }, 500)
  }, 5000)
}

// ============== Hook ==============

/**
 * Security Monitor Hook
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useSecurityMonitor({
 *     enabled: true,
 *     reportScreenshot: true
 *   })
 *   // ...
 * }
 * ```
 */
export function useSecurityMonitor(options: SecurityMonitorOptions = {}) {
  const {
    enabled = true,
    reportScreenshot = true,
    onCaptureDetected,
  } = options

  // Get accountId from Zustand store (works for both Docker and Electron modes)
  const accountId = useAuthStore((state) => state.user?.accountId)

  const navigate = useNavigate()
  const cleanupRef = useRef<(() => void) | null>(null)

  // Web screen capture detection - called at top level (React rules)
  const { stopScreenCapture } = useScreenCaptureMonitor({
    enabled: enabled && reportScreenshot,
    checkIntervalMs: 500,
    onCaptureChange: (event) => {
      console.warn('[SecurityMonitor] Web screen capture detected:', event.type)
      // IMMEDIATELY trigger lock callback for web capture detection
      onCaptureDetected?.(event)
      // Also dispatch custom event for DRMViewer to listen
      window.dispatchEvent(new CustomEvent('dlp-capture-detected', { detail: event }))
      reporter.reportImmediate({
        action: 'WEB_SCREEN_CAPTURE_DETECTED',
        category: 'DRM',
        result: 'FAILURE', // HIGH RISK
        details: `Web browser screen capture ${event.type}: ${event.sourceName || 'Unknown'} (${event.captureType || 'unknown'})`
      }, accountId)
    },
    onWindowFocusChange: (event) => {
      // Window blur is normal browser behavior - log as INFO only
      if (event.type === 'blur') {
        // Only log if needed for debugging, not as security alert
        console.debug('[SecurityMonitor] Window blur (normal behavior):', event.reason)
      }
    }
  })

  useEffect(() => {
    if (!enabled) {
      cleanupRef.current?.()
      cleanupRef.current = null
      return
    }

    const cleanups: (() => void)[] = []

    // Screenshot detection
    if (reportScreenshot) {
      const screenshotCleanup = detectScreenshotAttempts(accountId)
      cleanups.push(screenshotCleanup)
    }

    // Electron suspicious activity listener - ONLY in non-Electron mode
    // In Electron mode, main.ts sends audit logs, DRMViewer handles UI
    // This avoids duplicate audit entries
    // IMPORTANT: Only audit CRITICAL events to minimize backend load
    if (!isElectron()) {
      const electronActivityCleanup = setupSuspiciousActivityListener((activity) => {
        // Only log actual screenshot/recording attempts, not just tool running
        // Filter: only screenshot attempts and recording starts are critical
        const isCritical = 
          activity.includes('screenshot') || 
          activity.includes('SCREENSHOT') ||
          activity.includes('PrintScreen') ||
          activity.includes('snipping')
        
        if (isCritical) {
          console.warn('[SecurityMonitor] Critical activity:', activity)
          reporter.reportImmediate({
            action: activity.toUpperCase().replace(/ /g, '_').substring(0, 50),
            category: SECURITY_CATEGORIES.DRM,
            result: 'FAILURE',
            details: activity
          }, accountId)
        }
      })
      cleanups.push(electronActivityCleanup)
    }

    // Electron recording start listener - send to backend audit AND dispatch event to lock preview
    // ONLY in browser (non-Electron) mode - DRMViewer handles this directly in Electron mode
    // IMPORTANT: Only log when recording ACTUALLY starts (high risk event)
    if (!isElectron()) {
      const recordingStartCleanup = setupRecordingStartListener((data) => {
        console.warn('[SecurityMonitor] Recording started (HIGH RISK):', data.toolName)
        // IMMEDIATELY dispatch event for preview lock (same as web capture detection)
        window.dispatchEvent(new CustomEvent('dlp-recording-detected', { detail: data }))
        reporter.reportImmediate({
          action: 'SCREEN_RECORDING_START',
          category: SECURITY_CATEGORIES.DRM,
          result: 'FAILURE',
          details: `Screen recording started: ${data.toolName}`
        }, accountId)
      })
      cleanups.push(recordingStartCleanup)

      // Recording stop - log only if recording was active (duration tracking)
      const recordingStopCleanup = setupRecordingStopListener((data) => {
        console.warn('[SecurityMonitor] Recording stopped:', data.toolName, data.duration)
        reporter.report({
          action: 'SCREEN_RECORDING_STOP',
          category: SECURITY_CATEGORIES.DRM,
          result: 'WARNING',
          details: `Screen recording stopped: ${data.toolName}${data.duration ? ` (duration: ${data.duration})` : ''}`
        }, accountId)
      })
      cleanups.push(recordingStopCleanup)
    }

    // Cleanup
    cleanupRef.current = () => cleanups.forEach(c => c())

    return () => {
      cleanups.forEach(c => c())
    }
  }, [enabled, reportScreenshot, navigate, accountId])

  // Manual report function
  const reportEvent = useCallback((event: SecurityEvent) => {
    reporter.report(event, accountId)
  }, [accountId])

  // Report bulk view threshold reached
  const reportBulkView = useCallback((documentCount: number, timeWindowMinutes: number) => {
    reporter.reportImmediate({
      action: SECURITY_ACTIONS.BULK_VIEW_THRESHOLD,
      category: SECURITY_CATEGORIES.DOCUMENT,
      result: 'WARNING',
      details: `User viewed ${documentCount} documents in ${timeWindowMinutes} minutes (threshold exceeded)`
    }, accountId)
  }, [accountId])

  return {
    reportEvent,
    reportBulkView,
    stopScreenCapture
  }
}

export default useSecurityMonitor
