/**
 * Screen Capture Monitor Hook - Frontend SDK for DLP Platform
 * 
 * Monitors browser-based screen capture/recording attempts:
 * - Screen Capture API detection (getDisplayMedia, share browser tab)
 * - Page Visibility API (detect page visibility changes)
 * - Browser tab capture detection via video track state
 * 
 * Risk Levels:
 * - Screen Capture (getDisplayMedia) = HIGH RISK → result: 'FAILURE'
 * 
 * Events are sent to POST /security/events
 */

import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { isElectron } from '../utils/electron'

// ============== Types ==============

export interface ScreenCaptureEvent {
  type: 'started' | 'stopped'
  timestamp: Date
  sourceId?: string
  sourceName?: string
  captureType?: 'monitor' | 'window' | 'browser' | 'unknown'
}

export interface VisibilityChangeEvent {
  visible: boolean
  timestamp: Date
}

export interface WindowFocusEvent {
  type: 'blur' | 'focus'
  suspicious?: boolean
  reason?: string
}

export interface ScreenCaptureMonitorOptions {
  onCaptureChange?: (event: ScreenCaptureEvent) => void
  onVisibilityChange?: (event: VisibilityChangeEvent) => void
  onWindowFocusChange?: (event: WindowFocusEvent) => void
  checkIntervalMs?: number
  enabled?: boolean
}

// ============== Event Reporter ==============

class ScreenCaptureEventReporter {
  private readonly apiBase: string

  constructor() {
    // Use relative path so requests go through Vite proxy in Electron mode
    // This avoids CORS preflight delays
    this.apiBase = isElectron() ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api')
  }

  /**
   * Report screen capture event (HIGH RISK)
   */
  async report(event: ScreenCaptureEvent, accountId?: string): Promise<void> {
    try {
      const payload: Record<string, unknown> = {
        action: 'WEB_SCREEN_CAPTURE_DETECTED',
        category: 'DRM',
        result: 'FAILURE', // HIGH RISK
        details: `Screen capture ${event.type}: ${event.sourceName || 'Unknown source'} (${event.captureType || 'unknown'})`
      }
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
      console.warn('[ScreenCaptureMonitor] HIGH RISK: Screen capture detected:', event.type, event.sourceName)
    } catch (error) {
      console.error('[ScreenCaptureMonitor] Failed to report screen capture event:', error)
    }
  }

  private getToken(): string {
    return localStorage.getItem('token') || ''
  }
}

const reporter = new ScreenCaptureEventReporter()

// ============== Helper Functions ==============

/**
 * Determine the type of display surface being captured
 */
function getCaptureType(displaySurface: string | undefined): ScreenCaptureEvent['captureType'] {
  switch (displaySurface) {
    case 'monitor':
      return 'monitor'
    case 'window':
      return 'window'
    case 'browser':
      return 'browser'
    default:
      return 'unknown'
  }
}

/**
 * Create hidden video element to monitor capture state
 */
function createHiddenVideo(): HTMLVideoElement {
  const video = document.createElement('video')
  video.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px;top:-9999px;'
  video.autoplay = true
  video.muted = true
  video.playsInline = true
  video.setAttribute('aria-hidden', 'true')
  return video
}

// ============== Main Hook ==============

/**
 * Screen Capture Monitor Hook
 * 
 * Monitors for:
 * 1. Browser tab/window/screen capture via Screen Capture API → HIGH RISK
 * 2. Page visibility changes via Page Visibility API (only rapid changes = suspicious)
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useScreenCaptureMonitor({
 *     onCaptureChange: (event) => {
 *       console.log('Screen capture', event.type) // HIGH RISK
 *     },
 *     checkIntervalMs: 500,
 *     enabled: true
 *   })
 *   // ...
 * }
 * ```
 */
export function useScreenCaptureMonitor(options: ScreenCaptureMonitorOptions = {}) {
  const {
    onCaptureChange,
    onVisibilityChange,
    onWindowFocusChange,
    checkIntervalMs = 500,
    enabled = true
  } = options

  // Get accountId from Zustand store (works for both Docker and Electron modes)
  const accountId = useAuthStore((state) => state.user?.accountId)

  // Refs for cleanup
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isCapturingRef = useRef(false)
  const lastHiddenTimeRef = useRef<number>(0)
  const blurCountRef = useRef<number>(0)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }
    if (videoRef.current && videoRef.current.parentNode) {
      videoRef.current.parentNode.removeChild(videoRef.current)
      videoRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    isCapturingRef.current = false
  }, [])

  useEffect(() => {
    if (!enabled) {
      cleanup()
      return
    }

    // Create hidden video element
    const video = createHiddenVideo()
    videoRef.current = video
    document.body.appendChild(video)

    // Handle visibility change via Page Visibility API
    // Only detect RAPID changes as suspicious (potential screenshot)
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      if (isVisible && lastHiddenTimeRef.current > 0) {
        const hiddenDuration = Date.now() - lastHiddenTimeRef.current
        // Very brief hidden (< 200ms) suggests screenshot attempt
        if (hiddenDuration < 200) {
          blurCountRef.current++
          if (blurCountRef.current >= 3) {
            // Rapid switching detected - report as suspicious
            console.warn('[ScreenCaptureMonitor] Rapid window switching detected, possible screenshot attempt')
            blurCountRef.current = 0
          }
        }
      }
      if (!isVisible) {
        lastHiddenTimeRef.current = Date.now()
      }
      onVisibilityChange?.({ visible: isVisible, timestamp: new Date() })
      // DO NOT report PAGE_HIDDEN/PAGE_VISIBLE to audit logs - it's just normal browser behavior
    }

    // Periodic check for capture state
    const checkCaptureState = () => {
      if (!videoRef.current) return

      const stream = videoRef.current.srcObject as MediaStream | null
      if (!stream) {
        if (isCapturingRef.current) {
          // Capture was active but now stopped
          isCapturingRef.current = false
          const event: ScreenCaptureEvent = {
            type: 'stopped',
            timestamp: new Date()
          }
          onCaptureChange?.(event)
        }
        return
      }

      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack) {
        if (isCapturingRef.current) {
          isCapturingRef.current = false
          const event: ScreenCaptureEvent = {
            type: 'stopped',
            timestamp: new Date()
          }
          onCaptureChange?.(event)
        }
        return
      }

      // Check if track is live (actively capturing)
      if (videoTrack.readyState === 'live' && !isCapturingRef.current) {
        // Capture started → HIGH RISK
        isCapturingRef.current = true
        const settings = videoTrack.getSettings()
        const sourceId = (settings as Record<string, unknown>).sourceId as string | undefined
        const event: ScreenCaptureEvent = {
          type: 'started',
          timestamp: new Date(),
          sourceId: settings.displaySurface || sourceId,
          sourceName: videoTrack.label,
          captureType: getCaptureType(settings.displaySurface)
        }
        onCaptureChange?.(event)
        reporter.report(event, accountId)
      } else if (videoTrack.readyState !== 'live' && isCapturingRef.current) {
        // Capture stopped
        isCapturingRef.current = false
        const event: ScreenCaptureEvent = {
          type: 'stopped',
          timestamp: new Date()
        }
        onCaptureChange?.(event)
      }
    }

    // Start periodic check
    checkIntervalRef.current = setInterval(checkCaptureState, checkIntervalMs)

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup on unmount
    return () => {
      cleanup()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, checkIntervalMs, onCaptureChange, onVisibilityChange, cleanup, accountId])

  // ============== Window Focus/Blur Handler ==============
  useEffect(() => {
    if (!enabled || !onWindowFocusChange) return

    // Track focus states for detecting suspicious behavior
    const handleWindowBlur = () => {
      // Normal window blur (switching apps) - NOT suspicious
      // Only mark as suspicious if we detect rapid switching pattern
      onWindowFocusChange({ 
        type: 'blur', 
        suspicious: false, // Normal browser behavior
        reason: 'Window lost focus (normal browser behavior)'
      })
    }

    const handleWindowFocus = () => {
      onWindowFocusChange({ type: 'focus' })
    }

    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [enabled, onWindowFocusChange])

  // ============== Public API ==============

  /**
   * Request screen capture (for app's own screenshot feature)
   * Returns the MediaStream if successful, null otherwise
   */
  const requestScreenCapture = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })

      streamRef.current = stream

      // Listen for user stopping the share
      stream.getVideoTracks()[0].onended = () => {
        const event: ScreenCaptureEvent = {
          type: 'stopped',
          timestamp: new Date()
        }
        onCaptureChange?.(event)
        streamRef.current = null
      }

      return stream
    } catch (error) {
      console.error('[ScreenCaptureMonitor] Screen capture failed:', error)
      return null
    }
  }, [onCaptureChange])

  /**
   * Stop screen capture
   */
  const stopScreenCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  /**
   * Check if currently capturing
   */
  const isCapturing = useCallback((): boolean => {
    return isCapturingRef.current
  }, [])

  return {
    requestScreenCapture,
    stopScreenCapture,
    isCapturing
  }
}

export default useScreenCaptureMonitor
