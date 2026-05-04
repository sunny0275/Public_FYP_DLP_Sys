import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '../api'
import PDFViewer from './PDFViewer'
import { setupSuspiciousActivityListener, setupScreenshotBlockedListener, setupRecordingStartListener, setupRecordingStopListener, isElectron } from '../utils/electron'
import { useAuthStore } from '../store/authStore'
import axios from 'axios'

interface DRMViewerProps {
  documentUrl: string
  documentName: string
  allowCopy: boolean
  allowPrint: boolean
  allowDownload: boolean
  requiresWatermark: boolean
  /** Optional; reserved for future overlays. Diagonal/footer use UID line matching the server. */
  watermarkText?: string
}

/**
 * DRM-protected document viewer component
 *
 * Features:
 * - Disable copy/paste when allowCopy = false
 * - Disable printing when allowPrint = false
 * - Intercept keyboard shortcuts (Ctrl+C, Ctrl+P, Ctrl+S, PrintScreen)
 * - Disable right-click context menu
 * - Display watermark overlay
 * - Canvas-based rendering for additional protection
 */
export default function DRMViewer({
  documentUrl,
  documentName,
  allowCopy,
  allowPrint,
  allowDownload,
  requiresWatermark,
  watermarkText
}: DRMViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const visibilityCheckRef = useRef<number>(0)
  const lastVisibilityChangeRef = useRef<number>(Date.now())
  const focusIgnoreUntilRef = useRef<number>(0)
  const captureResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [securityAlertMessage, setSecurityAlertMessage] = useState<string | null>(null)
  const [sessionBlocked, setSessionBlocked] = useState(false)
  const [isAppFocused, setIsAppFocused] = useState(true)
  const focusLostTimeRef = useRef<number>(0)
  /** Short code + server IP from the preview API response — used in footer for consistency. */
  const watermarkCodeRef = useRef<string | undefined>(undefined)
  const serverIpRef = useRef<string | undefined>(undefined)
  // Minimum mask duration after focus lost (milliseconds)
  const MIN_MASK_DURATION_MS = 5000

  // Helper to check if should still show mask based on minimum duration
  const shouldShowMask = useCallback(() => {
    if (sessionBlocked) return true
    if (!isAppFocused) {
      const elapsed = Date.now() - focusLostTimeRef.current
      return elapsed < MIN_MASK_DURATION_MS
    }
    return false
  }, [sessionBlocked, isAppFocused])
  // Use authStore selector with equality function to ensure re-render on user change
  // This ensures fingerprint updates when different users view the document
  const userAccountId = useAuthStore(
    (state) => state.user?.accountId ?? 'UNKNOWN',
    (prev, next) => prev === next
  )
  const userEmail = useAuthStore((state) => state.user?.email)
  const userName = useAuthStore((state) => state.user?.name)

  const logSecurityEvent = useCallback((
    action: string,
    result: 'SUCCESS' | 'WARNING' | 'FAILURE',
    activity: string,
    reason?: string
  ) => {
    const details = `[${userAccountId}] ${activity}${reason ? ` | reason: ${reason}` : ''}`

    // For Electron mode, send to /agent/endpoint/events with local IP and accountId
    if (isElectron()) {
      // Use relative path in Electron mode so requests go through Vite proxy
      // This avoids CORS preflight delays
      const endpointUrl = '/api/agent/endpoint/events'

      // Get local IP address for audit logging (non-loopback)
      const getLocalIp = async (): Promise<string> => {
        try {
          if ((window as any).electronAPI?.getLocalIpAddress) {
            return await (window as any).electronAPI.getLocalIpAddress()
          }
        } catch {
          // Fallback
        }
        return window.location.hostname || 'unknown'
      }

      // Send event with local IP (non-blocking)
      getLocalIp().then(ipAddress => {
        const eventPayload = {
          action,
          category: 'DRM',
          result,
          details,
          username: userAccountId,
          hostName: window.location.hostname || 'unknown',
          ipAddress,  // Use actual local IP instead of Docker container IP
          accountId: userAccountId
        }

        console.log('[DRMViewer] Sending endpoint event:', endpointUrl, eventPayload)

        axios.post(endpointUrl, eventPayload, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }).then(response => {
          console.log('[DRMViewer] Endpoint event sent successfully:', action, response.status)
        }).catch(err => {
          console.error('[DRMViewer] Failed to send endpoint event:', err.message, 'URL:', endpointUrl)
        })
      })
    } else {
      // Browser mode: Only send via web API (no direct endpoint events)
      // In Electron mode, we already sent to /agent/endpoint/events above
      apiClient.reportSecurityEvent({
        action,
        category: 'DRM',
        result,
        details,
        accountId: userAccountId
      }).catch(err => {
        console.warn('[DRMViewer] Failed to report security event via web API:', err.message)
      })
    }
  }, [userAccountId])

  useEffect(() => {
    // Enhanced keyboard shortcuts interception - apply to entire document
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent copy (Ctrl+C, Cmd+C, Ctrl+Insert)
      if (!allowCopy && ((e.ctrlKey || e.metaKey) && e.key === 'c' || (e.ctrlKey && e.key === 'Insert'))) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Prevent print (Ctrl+P, Cmd+P) - ALWAYS disabled in preview
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Prevent save (Ctrl+S, Cmd+S)
      if (!allowDownload && (e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      const isSwitchTab = e.key === 'Tab' && (e.ctrlKey || e.metaKey)
      if (isSwitchTab) {
        focusIgnoreUntilRef.current = Date.now() + 100
        return
      }

      // Prevent PrintScreen, Alt+PrintScreen, and Win+Shift+S/R shortcuts
      // Note: Actual screenshot attempts are detected by Electron IPC (setupScreenshotBlockedListener)
      if (
        e.key === 'PrintScreen' ||
        (e.altKey && e.key === 'PrintScreen') ||
        (e.metaKey && e.shiftKey && ['s', 'S', 'r', 'R'].includes(e.key)) ||
        (e.metaKey && e.key === 'r' && e.shiftKey)
      ) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        // Try to clear clipboard
        navigator.clipboard.writeText('').catch(() => {})
        return false
      }

      // Prevent F11 and F12 (DevTools shortcuts)
      if (e.key === 'F11' || e.key === 'F12') {
        e.preventDefault()
        return false
      }

      // Prevent Ctrl+Shift+I / Cmd+Option+I (Developer Tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Prevent Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }

    // Context menu handler - simple and efficient
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    // Copy handler
    const handleCopy = (e: ClipboardEvent) => {
      if (!allowCopy) {
        e.preventDefault()
        e.clipboardData?.setData('text/plain', '')
      }
    }

    // Cut handler
    const handleCut = (e: ClipboardEvent) => {
      if (!allowCopy) {
        e.preventDefault()
        e.clipboardData?.setData('text/plain', '')
      }
    }

    // Paste handler
    const handlePaste = (e: ClipboardEvent) => {
      if (!allowCopy) {
        e.preventDefault()
      }
    }

    // Select handler
    const handleSelectStart = (e: Event) => {
      if (!allowCopy) {
        e.preventDefault()
      }
    }

    // Drag handler
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault()
    }

    // Window blur - informational only, no penalty. This tracks when user switches apps
    // Normal focus changes are NOT recorded to audit log
    const handleBlur = () => {
      // Record the time when focus was lost - minimum mask duration applies
      focusLostTimeRef.current = Date.now()
      setIsAppFocused(false)
      focusIgnoreUntilRef.current = Date.now() + 100
    }

    const handleFocus = () => {
      if (Date.now() < focusIgnoreUntilRef.current) {
        return
      }
      setIsAppFocused(true)
      lastVisibilityChangeRef.current = Date.now()
    }

    // Monitor page visibility changes: split "focus lost" and "app switch".
    // App switch is informational only (not suspicious, no penalty).
    // Normal visibility changes are NOT recorded to audit log
    const handleVisibilityChange = () => {
      visibilityCheckRef.current++
      const now = Date.now()
      
      if (document.hidden) {
        // Record the time when visibility was lost - minimum mask duration applies
        focusLostTimeRef.current = now
        setIsAppFocused(false)
      } else {
        setIsAppFocused(true)
      }
      
      lastVisibilityChangeRef.current = now
    }

    // Monitor fullscreen changes - do NOT trigger mask on fullscreen enter/exit
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
      setIsAppFocused(true)
      focusIgnoreUntilRef.current = Date.now() + 100
    }

    // Detect multiple monitor setup (common for screenshot tools)
    const detectMultipleMonitors = () => {
      // This is limited, but we can try to detect screen dimensions
      // Screen dimensions larger than typical single monitor might indicate multiple monitors
      if (screen.width > 2560 || screen.height > 1440) {
        // Possibly multiple monitors - log if needed
      }
    }

    // Check for rapid focus changes (screenshot tool indicator).
    // Disabled as anomaly signal to avoid false positives during app switch.
    const checkForScreenshotTools = () => {
      return
    }

    // Add event listeners - use non-capture phase for better performance
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCut)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('selectstart', handleSelectStart)
    document.addEventListener('dragstart', handleDragStart)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    // Periodically check for suspicious activity
    const suspiciousActivityCheck = setInterval(() => {
      checkForScreenshotTools()
      detectMultipleMonitors()
    }, 5000) // Reduced from 2s to 5s for better performance

    // Setup Electron screenshot blocked listener - IMMEDIATE lock on capture attempt
    let screenshotBlockedCleanup: (() => void) | null = null
    let recordingStartCleanup: (() => void) | null = null
    let recordingStopCleanup: (() => void) | null = null
    let electronCleanup: (() => void) | null = null
    if (isElectron()) {
      // Notify Electron that document viewing is now active
      const electronApi = (window as any).electronAPI
      if (electronApi?.setDocumentViewing) {
        electronApi.setDocumentViewing(true)
      }

      // Listen for screenshot blocked events and IMMEDIATELY lock preview
      // NOTE: Audit log is sent from main process (handleBlockedScreenshot) to avoid duplicates
      // DRMViewer only handles UI lock, not audit logging
      screenshotBlockedCleanup = setupScreenshotBlockedListener((data) => {
        console.warn('[DRMViewer] Screenshot blocked detected:', data)
        // Immediately lock the preview without delay
        setSecurityAlertMessage(`${data.eventType}: ${data.details}`)
        setSessionBlocked(true) // Block user session immediately
        setIsAppFocused(false)
        focusIgnoreUntilRef.current = Date.now() + 100

        // Clear any existing reset timer
        if (captureResetTimerRef.current) {
          clearTimeout(captureResetTimerRef.current)
          captureResetTimerRef.current = null
        }

        // NOTE: Audit log is sent from main process (handleBlockedScreenshot in main.ts)
        // DRMViewer only locks UI to avoid duplicate audit entries
      })

      // DIRECT Electron recording start listener - IMMEDIATELY lock preview
      // Only log to audit if it's a REAL recording (user selected to record the window)
      // NOT for tool detection (like website mode - only detect actual recording starts)
      recordingStartCleanup = setupRecordingStartListener((data) => {
        console.warn('[DRMViewer] Electron recording detected (direct):', data)
        // Immediately lock the preview without delay - direct from Electron IPC
        const toolName = data.toolName || 'Unknown tool'
        setSecurityAlertMessage(`🔴 RECORDING_DETECTED: ${toolName} - Recording started`)
        setSessionBlocked(true) // Block user session immediately
        setIsAppFocused(false)
        focusIgnoreUntilRef.current = Date.now() + 100

        // Clear any existing reset timer
        if (captureResetTimerRef.current) {
          clearTimeout(captureResetTimerRef.current)
          captureResetTimerRef.current = null
        }

        // NOTE: Audit log is sent from main process (handleRecordingStart)
        // DRMViewer only locks UI, does NOT send duplicate audit log
        // This avoids duplicate SCREEN_RECORDING_START entries in audit trail
      })

      // DIRECT Electron recording stop listener - UI lock and audit
      recordingStopCleanup = setupRecordingStopListener((data) => {
        console.warn('[DRMViewer] Electron recording stopped:', data)
        const toolName = data.toolName || 'Unknown tool'
        const duration = data.duration || 'unknown'
        setSecurityAlertMessage(`⏹️ RECORDING_STOPPED: ${toolName} (duration: ${duration})`)
        setSessionBlocked(true) // Block user session after recording
        setIsAppFocused(false)
        focusIgnoreUntilRef.current = Date.now() + 100

        // Clear any existing reset timer
        if (captureResetTimerRef.current) {
          clearTimeout(captureResetTimerRef.current)
          captureResetTimerRef.current = null
        }

      // NOTE: Audit log is sent from main process (handleRecordingStop in main.ts)
      // DRMViewer only locks UI, does NOT send duplicate audit log
      // This avoids duplicate SCREEN_RECORDING_STOP entries in audit trail
    })

      // Setup Electron system-level protection listener for other suspicious activities
      electronCleanup = setupSuspiciousActivityListener((activity) => {
        // DO NOT update any state here - this callback receives benign system events
        // (USB, window focus, process injection checks) that should not appear in UI
        // Real security events are already handled via handleSecurityAlert and screenshotBlocked IPC
        console.debug('[DRMViewer] System activity received:', activity)
      })
    }

    // Listen for web screen capture detection (from useSecurityMonitor)
    // This handles non-Electron web browsers
    const handleWebCaptureDetected = (event: Event) => {
      const customEvent = event as CustomEvent
      console.warn('[DRMViewer] Web screen capture detected:', customEvent.detail)
      // Immediately lock the preview without delay
      setSecurityAlertMessage(`WEB_SCREEN_CAPTURE: ${customEvent.detail.sourceName || 'Unknown source'} - ${customEvent.detail.captureType || 'unknown type'}`)
      setSessionBlocked(true)
      setIsAppFocused(false)
      focusIgnoreUntilRef.current = Date.now() + 100

      // Clear any existing reset timer
      if (captureResetTimerRef.current) {
        clearTimeout(captureResetTimerRef.current)
        captureResetTimerRef.current = null
      }
    }
    window.addEventListener('dlp-capture-detected', handleWebCaptureDetected)

    // NOTE: Electron recording detection is now handled directly via setupRecordingStartListener above
    // The dlp-recording-detected custom event from useSecurityMonitor is no longer needed here
    // to avoid duplicate lock operations. Both paths would call setSessionBlocked(true) anyway.

    // Auto-request fullscreen on load (optional - can be made configurable)
    // requestFullscreen()

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('dragstart', handleDragStart)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('dlp-capture-detected', handleWebCaptureDetected)
      // NOTE: dlp-recording-detected is no longer listened here (moved to direct Electron IPC)
      if (suspiciousActivityCheck) {
        clearInterval(suspiciousActivityCheck)
      }
      if (electronCleanup) {
        electronCleanup()
      }
      if (screenshotBlockedCleanup) {
        screenshotBlockedCleanup()
      }
      if (recordingStartCleanup) {
        recordingStartCleanup()
      }
      if (recordingStopCleanup) {
        recordingStopCleanup()
      }
      if (captureResetTimerRef.current) {
        clearTimeout(captureResetTimerRef.current)
        captureResetTimerRef.current = null
      }

      // Notify Electron that document viewing is no longer active
      const electronApi = (window as any).electronAPI
      if (electronApi?.setDocumentViewing) {
        electronApi.setDocumentViewing(false)
      }
    }
  }, [allowCopy, allowPrint, allowDownload, isFullscreen, logSecurityEvent])

  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [contentType, setContentType] = useState<string>('application/pdf')
  const blobUrlRef = useRef<string | null>(null)
  const [previewBlurred, setPreviewBlurred] = useState(false)
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const footerCanvasRef = useRef<HTMLCanvasElement>(null)
  const diagonalWatermarkRef = useRef<HTMLCanvasElement>(null)
  const antiCaptureCanvasRef = useRef<HTMLCanvasElement>(null)
  const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const RESIZE_DEBOUNCE_MS = 200
  const FOOTER_HEIGHT_PX = 60 // Space reserved for footer markings
  const ANTI_CAPTURE_NOISE_INTENSITY = 0.02 // 2% pixel noise (invisible to human eye)
  const WATERMARK_TEXT = 'DLP Platform' // Diagonal watermark text
  const WATERMARK_FONT_SIZE = 48
  const WATERMARK_ROTATION = -30 // degrees

  const handleRenderComplete = useCallback(() => {
    setPreviewBlurred(false)
  }, [])

  // Fetch client IP address
  useEffect(() => {
    const redrawFooter = () => {
      const canvas = footerCanvasRef.current
      const wrapper = previewWrapperRef.current
      if (!canvas || !wrapper || !requiresWatermark) return
      const w = wrapper.clientWidth
      if (w <= 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = FOOTER_HEIGHT_PX * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${FOOTER_HEIGHT_PX}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(0, 0, w, FOOTER_HEIGHT_PX)
      
      ctx.fillStyle = '#ffffff'
      ctx.font = '11px monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      
      const padding = 12

      // IP and short code come from the server so they match the PDF watermark exactly
      const displayIp = serverIpRef.current ?? 'N/A'
      const displayCode = watermarkCodeRef.current ?? 'N/A'

      // Format: UID: {accountId} | {startTime} | {serverIp} | {shortCode}
      const accessTimeISO = new Date().toISOString().slice(0, 19).replace('T', ' ')
      const footerLine = `UID: ${userAccountId} | ${accessTimeISO} | ${displayIp} | ${displayCode}`

      ctx.fillText(footerLine, padding, padding)
    }

    const redrawDiagonalWatermark = () => {
      const canvas = diagonalWatermarkRef.current
      const wrapper = previewWrapperRef.current
      if (!canvas || !wrapper || !requiresWatermark) return
      const w = wrapper.clientWidth
      const h = wrapper.clientHeight
      if (w <= 0 || h <= 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Save the context state
      ctx.save()

      // Move to center and rotate
      const centerX = w / 2
      const centerY = h / 2
      ctx.translate(centerX, centerY)
      ctx.rotate((WATERMARK_ROTATION * Math.PI) / 180)

      // Set watermark style
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)' // Very subtle gray
      ctx.font = `bold ${WATERMARK_FONT_SIZE}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Calculate spacing based on text size
      const textWidth = ctx.measureText(WATERMARK_TEXT).width
      const spacingX = textWidth + 100
      const spacingY = WATERMARK_FONT_SIZE + 80

      // Calculate grid of watermarks
      const diagonal = Math.sqrt(w * w + h * h)
      const cols = Math.ceil(diagonal / spacingX) + 2
      const rows = Math.ceil(diagonal / spacingY) + 2

      // Draw watermark grid
      for (let row = -rows; row <= rows; row++) {
        for (let col = -cols; col <= cols; col++) {
          const x = col * spacingX
          const y = row * spacingY
          ctx.fillText(WATERMARK_TEXT, x, y)
        }
      }

      // Restore the context state
      ctx.restore()
    }


    const redrawAntiCapture = () => {
      const canvas = antiCaptureCanvasRef.current
      const wrapper = previewWrapperRef.current
      if (!canvas || !wrapper || !requiresWatermark) return
      const w = wrapper.clientWidth
      const h = wrapper.clientHeight
      if (w <= 0 || h <= 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      // Inject weak pixel noise (invisible to human eye, detectable after filtering)
      // This creates a unique fingerprint per viewing session
      const imageData = ctx.createImageData(w * dpr, h * dpr)
      const data = imageData.data
      // Generate unique fingerprint per user session using multiple user identifiers
      // This ensures different users get different fingerprints for forensic tracing
      const sessionId = `${userAccountId}_${userEmail || ''}_${userName || ''}_${Date.now()}`
      const userFingerprint = sessionId.split('').map(c => c.charCodeAt(0))
      
      // Generate deterministic but subtle noise pattern based on user info
      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % (w * dpr)
        const y = Math.floor((i / 4) / (w * dpr))
        const seed = (x * 7919 + y * 104729 + userFingerprint[i % userFingerprint.length]) % 2147483647
        
        // Very subtle noise (2% intensity) - invisible but detectable
        const noise = (seed % 51 - 25) * ANTI_CAPTURE_NOISE_INTENSITY
        data[i] = Math.max(0, Math.min(255, 128 + noise))     // R
        data[i + 1] = Math.max(0, Math.min(255, 128 + noise)) // G
        data[i + 2] = Math.max(0, Math.min(255, 128 + noise)) // B
        data[i + 3] = Math.floor(255 * ANTI_CAPTURE_NOISE_INTENSITY * 2) // Alpha (very low)
      }
      
      ctx.putImageData(imageData, 0, 0)
    }

    const scheduleResize = () => {
      if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current)
      resizeDebounceRef.current = setTimeout(() => {
        resizeDebounceRef.current = null
        redrawFooter()
        redrawDiagonalWatermark()
        redrawAntiCapture()
      }, RESIZE_DEBOUNCE_MS)
    }

    const wrapper = previewWrapperRef.current
    if (!wrapper) return
    const ro = new ResizeObserver(scheduleResize)
    ro.observe(wrapper)
    if (requiresWatermark) {
      redrawFooter()
      redrawDiagonalWatermark()
      redrawAntiCapture()
    }
    return () => {
      ro.disconnect()
      if (resizeDebounceRef.current) {
        clearTimeout(resizeDebounceRef.current)
        resizeDebounceRef.current = null
      }
    }
  }, [requiresWatermark, watermarkText, blobUrl, contentType, documentUrl, userAccountId])


  useEffect(() => {
    if (!isElectron() || typeof window.electronAPI === 'undefined') return
    const api = window.electronAPI as { onResizePreview?: (cb: () => void) => void }
    if (typeof api.onResizePreview !== 'function') return
    api.onResizePreview(() => {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    })
    return () => {
      const remove = (window.electronAPI as { removeResizePreviewListener?: () => void })?.removeResizePreviewListener
      if (typeof remove === 'function') remove()
    }
  }, [])

  useEffect(() => {
    // Load document content with authentication
    const loadDocument = async () => {
      setLoading(true)
      setError(null)

      // Revoke previous blob URL if exists
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }

      try {
        // Extract document ID from URL
        const match = documentUrl.match(/\/docs\/(\d+)\/content/)
        if (!match) {
          throw new Error('Invalid document URL format')
        }
        const documentId = parseInt(match[1], 10)

        // Fetch document content as blob with authentication
        // watermarkCode + viewerIp come from server headers and must be set before footer redraws
        const { blob: fetchedBlob, contentType: fetchedContentType, watermarkCode, viewerIp } =
          await apiClient.getDocumentContent(documentId)

        watermarkCodeRef.current = watermarkCode
        serverIpRef.current = viewerIp

        // Create blob URL
        const url = URL.createObjectURL(fetchedBlob)
        blobUrlRef.current = url
        setBlobUrl(url)
        setBlob(fetchedBlob)
        setContentType(fetchedContentType)
        setLoading(false)
      } catch (err: any) {
        console.error('Error loading document:', err)
        // Extract error message from API response
        let errorMessage = 'Failed to load document'
        if (err.response?.data) {
          // Try to get error message from ApiResponse structure
          if (err.response.data.error) {
            errorMessage = err.response.data.error
          } else if (err.response.data.message) {
            errorMessage = err.response.data.message
          }
        } else if (err.message) {
          errorMessage = err.message
        }
        
        // Handle 404 specifically
        if (err.response?.status === 404) {
          errorMessage = 'Document file not found. It may have been deleted or moved.'
        }
        
        setError(errorMessage)
        setLoading(false)
      }
    }

    loadDocument()

    // Cleanup blob URL on unmount or when documentUrl changes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [documentUrl])

  if (loading) {
    return (
      <div style={{
        padding: '60px',
        textAlign: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        <div style={{ marginBottom: '16px' }}>⏳</div>
        Loading document...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: '60px',
        textAlign: 'center',
        fontSize: '16px',
        color: '#f44336'
      }}>
        <div style={{ marginBottom: '16px' }}>⚠️</div>
        Error: {error}
      </div>
    )
  }

  return (
    <div
      ref={viewerRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '600px',
        display: 'flex',
        flexDirection: 'column',
        background: '#f5f5f5',
        userSelect: allowCopy ? 'auto' : 'none',
        WebkitUserSelect: allowCopy ? 'auto' : 'none',
        MozUserSelect: allowCopy ? 'auto' : 'none',
      msUserSelect: (allowCopy ? 'auto' : 'none') as React.CSSProperties['msUserSelect'],
      WebkitTouchCallout: 'none',
      touchAction: 'none',
      pointerEvents: 'auto',
    }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }}
      onDragStart={(e) => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }}
    >

      {/* Screen Mask - shows when shouldShowMask() returns true or session is blocked */}
      {(shouldShowMask() || sessionBlocked) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.95)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          textAlign: 'center',
          padding: '24px',
          zIndex: sessionBlocked ? 2500 : 1600
        }}>
          {sessionBlocked ? (
            <>
              <div style={{ fontSize: '1.3em', fontWeight: 600, marginBottom: '10px' }}>
                🔒 Content blocked
              </div>
              <div style={{ fontSize: '0.95em', maxWidth: '640px' }}>
                {securityAlertMessage || 'Suspicious activity detected. The event has been recorded.'}
              </div>
              <button
                onClick={() => {
                  setSecurityAlertMessage(null)
                  setSessionBlocked(false)
                  setSuspiciousActivity([])
                  window.location.reload()
                }}
                style={{
                  marginTop: '20px',
                  padding: '8px 18px',
                  borderRadius: '999px',
                  border: '1px solid #fff',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Reload and reopen viewer
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '1.5em', fontWeight: 600, marginBottom: '8px' }}>Screen masked</div>
              <div style={{ fontSize: '0.95em', maxWidth: '420px', lineHeight: 1.4 }}>
                The app lost focus. To reduce capture risk, the preview is temporarily covered.
                Please wait {Math.ceil((MIN_MASK_DURATION_MS - (Date.now() - focusLostTimeRef.current)) / 1000)} seconds or click below to unmask.
              </div>
              <button
                onClick={() => {
                  focusLostTimeRef.current = 0
                  setIsAppFocused(true)
                }}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  background: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Unmask Now
              </button>
            </>
          )}
        </div>
      )}

      {/* Security Alert Warning Banner - shows when there's suspicious activity but session not blocked */}
      {securityAlertMessage && !sessionBlocked && !shouldShowMask() && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10%',
          right: '10%',
          padding: '16px',
          background: 'linear-gradient(90deg, rgba(255,69,58,0.98), rgba(255,152,0,0.95))',
          borderRadius: '12px',
          color: '#fff',
          fontWeight: 600,
          textAlign: 'center',
          zIndex: 2200,
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '1.1em' }}>⛔ Security warning: suspicious activity</div>
          <div style={{ marginTop: '6px', fontSize: '0.95em' }}>
            {securityAlertMessage}
          </div>
        </div>
      )}

      {/* Fullscreen Toggle Button */}
      <button
        onClick={async () => {
          if (isFullscreen) {
            // Exit fullscreen
            if (document.exitFullscreen) {
              await document.exitFullscreen()
            } else if ((document as any).webkitExitFullscreen) {
              await (document as any).webkitExitFullscreen()
            } else if ((document as any).mozCancelFullScreen) {
              await (document as any).mozCancelFullScreen()
            } else if ((document as any).msExitFullscreen) {
              await (document as any).msExitFullscreen()
            }
            setIsFullscreen(false)
          } else {
            // Enter fullscreen
            const element = viewerRef.current
            if (element) {
              if (element.requestFullscreen) {
                await element.requestFullscreen()
              } else if ((element as any).webkitRequestFullscreen) {
                await (element as any).webkitRequestFullscreen()
              } else if ((element as any).mozRequestFullScreen) {
                await (element as any).mozRequestFullScreen()
              } else if ((element as any).msRequestFullscreen) {
                await (element as any).msRequestFullscreen()
              }
            }
          }
        }}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          padding: '8px 12px',
          background: isFullscreen ? '#ff6b6b' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85em',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen (enhanced protection)'}
      >
        {isFullscreen ? '⛶ Exit fullscreen' : '⛶ Fullscreen'}
      </button>

      {/* Preview wrapper: blur during resize to prevent brief un-watermarked capture */}
      <div
        ref={previewWrapperRef}
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          paddingBottom: requiresWatermark ? `${FOOTER_HEIGHT_PX}px` : '0',
          transition: 'filter 0.15s ease-out',
          filter: previewBlurred ? 'blur(8px)' : 'none'
        }}
      >
        {/* Document viewer - render based on content type */}
        {blobUrl && (() => {
          const isImage = contentType.startsWith('image/')
          const isPDF = contentType === 'application/pdf'

          if (isImage) {
            return (
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%',
                  minHeight: '400px',
                  background: '#f5f5f5'
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <img
                  src={blobUrl}
                  alt={documentName}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    position: 'relative',
                    zIndex: 1,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    pointerEvents: 'auto'
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  draggable={false}
                />
              </div>
            )
          } else if (isPDF && blob) {
            return (
              <div
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: isFullscreen ? '100vw' : 'min(860px, 100%)',
                  height: isFullscreen ? '100vh' : '78vh',
                  maxHeight: isFullscreen ? '100vh' : '1000px',
                  minHeight: '560px',
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#525252',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
                }}
              >
                <PDFViewer
                  blob={blob}
                  documentName={documentName}
                  allowPrint={allowPrint}
                  allowDownload={allowDownload}
                  onRenderComplete={handleRenderComplete}
                  footerHeight={requiresWatermark ? FOOTER_HEIGHT_PX : 0}
                />
              </div>
            )
          } else {
            return (
              <iframe
                src={blobUrl}
                title={documentName}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '400px',
                  border: 'none',
                  position: 'relative',
                  zIndex: 1
                }}
                sandbox="allow-same-origin"
                onContextMenu={(e) => e.preventDefault()}
              />
            )
          }
        })()}

        {/* Footer watermark (Canvas) - fixed footer with uploader and reader info */}
        {requiresWatermark && (
          <canvas
            ref={footerCanvasRef}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: `${FOOTER_HEIGHT_PX}px`,
              pointerEvents: 'none',
              zIndex: 11
            }}
            aria-hidden
          />
        )}

        {/* Diagonal canvas: short "DLP Platform" grid (full UID in footer + baked in PDF on preview). */}
        {requiresWatermark && (
          <canvas
            ref={diagonalWatermarkRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 10
            }}
            aria-hidden
          />
        )}

        {/* Screen Anti-Capture - Invisible pixel noise for forensic tracing */}
        {requiresWatermark && (
          <canvas
            ref={antiCaptureCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 12,
              mixBlendMode: 'overlay',
              opacity: 0.01 // Nearly invisible but detectable after filtering
            }}
            aria-hidden
          />
        )}
      </div>

      {/* DRM protection notice */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 11,
        pointerEvents: 'none'
      }}>
        🔒 DRM Protected Document
        {!allowCopy && ' | Copy Disabled'}
        {!allowPrint && ' | Print Disabled'}
        {!allowDownload && ' | Download Disabled'}
      </div>
    </div>
  )
}
