/// <reference types="vite/client" />

import { app, BrowserWindow, ipcMain, globalShortcut, clipboard } from 'electron'
import { join, dirname } from 'path'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import { exec, spawn, ChildProcess } from 'child_process'
import * as net from 'net'
import os from 'os'

// Disable GPU acceleration to prevent blank window on some systems
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-dev-shm-usage')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-accelerated-2d-canvas')
app.commandLine.appendSwitch('disable-back-forward-cache')
app.commandLine.appendSwitch('load-extension-opacity-chance=0')
app.commandLine.appendSwitch('enable-webgl')
app.commandLine.appendSwitch('enable-webgl2')

// Get __dirname in a way that works with both ESM and CommonJS
const getDirname = (fileUrl: string): string => {
  try {
    // ESM: import.meta.url
    return dirname(fileURLToPath(fileUrl))
  } catch {
    // CommonJS fallback: use __dirname directly
    return __dirname
  }
}
const __dirname: string = getDirname(import.meta.url as unknown as string)

// ============================================================
// DLP Platform - Electron Main Process with Sidecar Integration
// ============================================================
// 
// Architecture: Hybrid mode
// - Electron (Frontend): UI, Zustand state management, user interaction
// - C# Sidecar (SecurityMonitor.exe): Deep system monitoring
//
// Communication: Named Pipes with Token authentication
// ============================================================

// Security Monitor Sidecar - Communication Protocol
const SIDECAR_AUTH_TOKEN = 'dlp_secure_token_2024'
const SIDECAR_PIPE_NAME = 'DLP_SecurityMonitor_Pipe_v4'
const VITE_DEV_PORT = parseInt(import.meta.env.VITE_DEV_PORT || '5173', 10)

// Sidecar process handle
let sidecarProcess: ChildProcess | null = null
let sidecarConnected = false
let sidecarSocket: net.Socket | null = null  // Named pipe socket for bidirectional communication
let sidecarAuthComplete = false  // Flag to track if auth handshake is fully complete

// Connection retry state
let isConnectionAttemptInProgress = false
let hasLoggedDebuggerWarning = false
const INITIAL_RETRY_DELAY_MS = 5000  // Start with 5 seconds (give Sidecar time to create pipe)
const CONNECTION_RETRY_INTERVAL_MS = 3000  // Then 3 seconds between retries

// System-level protection service (simplified - relies on Sidecar)
class SystemProtectionService {
  private screenshotBlocked = false
  private printBlocked = false
  private clipboardMonitorInterval: NodeJS.Timeout | null = null
  private screenshotMonitorInterval: NodeJS.Timeout | null = null
  private recordingMonitorInterval: NodeJS.Timeout | null = null
  
  // Recording state - track if any recording tool is actively recording
  private isRecordingActive = false
  private recordingStartTime: number | null = null
  private lastKnownRecordingTool: string | null = null
  
  // Window focus tracking (for UI display)
  private lastFocusChangeTime = 0
  private focusChangeCount = 0
  private readonly FOCUS_CHANGE_THRESHOLD = 10
  
  // Removable drive snapshot for USB monitoring
  private removableDriveSnapshot = new Map<string, { volumeLabel?: string; sizeBytes?: number }>()
  private usbMonitorInterval: NodeJS.Timeout | null = null
  
  // Store access token for JWT-authenticated endpoint requests
  private currentAccessToken: string | null = null

  // Current logged-in user's accountId (set via setCurrentAccountId from renderer)
  private currentAccountId: string | null = null

  // Public getter for access token (used by IPC handlers)
  getAccessToken(): string | null {
    return this.currentAccessToken
  }

  // Document viewing state - only log warning events when user is viewing documents
  private documentViewingActive = false

  // Screenshot debounce: prevent duplicate audit logs for same event within 2 seconds
  private lastScreenshotEventTime = 0
  private lastScreenshotEventType = ''
  private readonly SCREENSHOT_DEBOUNCE_MS = 2000

  // USB debounce: prevent duplicate audit logs for USB events within 2 seconds
  private lastUsbEventTime = 0
  private lastUsbEventType = ''
  private readonly USB_DEBOUNCE_MS = 2000

  // Cache for local IP address
  private cachedIpAddress: string | null = null

  // ============================================================
  // SIDE CAR MANAGEMENT
  // ============================================================
  
  // Kill all running pipe servers and .NET host processes related to SecurityMonitor
  private killExistingSidecarProcesses(): void {
    console.log('[DLP] Killing existing sidecar processes...')
    
    try {
      // Kill all processes listening on the DLP pipe
      exec(`powershell -Command "Get-NetTCPConnection -LocalPipeName '\\\\.\\pipe\\${SIDECAR_PIPE_NAME}' -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, (error) => {
        if (error) {
          console.warn('[DLP] Failed to kill pipe listeners:', error.message)
        } else {
          console.log('[DLP] Killed existing pipe listeners')
        }
      })

      // Kill any running SecurityMonitor.exe / dotnet processes with SecurityMonitor
      exec(`powershell -Command "Get-Process -Name 'SecurityMonitor' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Get-Process -Name 'dotnet' -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*SecurityMonitor*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`, (error) => {
        if (error) {
          console.warn('[DLP] Failed to kill sidecar processes:', error.message)
        } else {
          console.log('[DLP] Killed existing sidecar processes')
        }
      })
    } catch (error) {
      console.warn('[DLP] Error killing sidecar processes:', error)
    }
  }

  // Start the Security Monitor Sidecar process
  startSidecar(): boolean {
    if (sidecarProcess) {
      console.log('[DLP] Sidecar already running')
      return true
    }
    
    // First, kill any existing sidecar processes and pipe listeners
    this.killExistingSidecarProcesses()
    
    // Find the sidecar executable - check both electron/bin and Release folder
    const possiblePaths = [
      // Self-contained publish (current)
      'D:\\Code\\Test\\FYP\\sidecar\\SecurityMonitor\\bin\\Release\\net8.0-windows\\win-x64\\publish\\SecurityMonitor.dll',
      // Electron bin folder (relative to dist-electron)
      join(__dirname, '..', 'electron', 'bin', 'SecurityMonitor.dll'),
      // Legacy root bin
      'D:\\Code\\Test\\FYP\\sidecar\\SecurityMonitor\\bin\\SecurityMonitor.dll',
      // Frontend electron bin folder
      'D:\\Code\\Test\\FYP\\frontend\\electron\\bin\\SecurityMonitor.dll',
    ]
    
    let sidecarPath = ''
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        sidecarPath = p
        break
      }
    }
    
    // Check if file exists
    if (!sidecarPath) {
      console.warn('[DLP] Sidecar not found, searched in:', possiblePaths)
      console.warn('[DLP] Deep monitoring disabled. Run build to compile SecurityMonitor.exe')
      return false
    }
    
    try {
      console.log('[DLP] Starting Security Monitor Sidecar...')
      
      // Start sidecar using dotnet (runs in limited mode without admin)
      // For full admin mode, run: dotnet SecurityMonitor.dll (as Administrator)
      const dllPath = sidecarPath.replace('.exe', '.dll')
      sidecarProcess = spawn('dotnet', [dllPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true
      })
      
      sidecarProcess.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        if (line.startsWith('[DLP') || line.startsWith('[')) {
          console.log(line)
        }
      })
      
      sidecarProcess.stderr?.on('data', (data: Buffer) => {
        console.error('[DLP Sidecar Error]', data.toString())
      })
      
      sidecarProcess.on('error', (err) => {
        console.error('[DLP] Sidecar error:', err)
        sidecarConnected = false
      })
      
      sidecarProcess.on('exit', (code) => {
        console.log('[DLP] Sidecar exited with code:', code)
        sidecarConnected = false
        sidecarProcess = null
      })
      
      // Connect to named pipe (with delay to wait for sidecar to start)
      setTimeout(() => this.connectToSidecar(), 3000)
      
      console.log('[DLP] Sidecar started successfully')
      return true
    } catch (error) {
      console.error('[DLP] Failed to start sidecar:', error)
      return false
    }
  }

  // Connect to an already-running Sidecar (don't start new one)
  // Call this when SecurityMonitor is running manually in separate window
  // Keeps trying to reconnect up to MAX_CONNECTION_ATTEMPTS (10 times, 5 seconds apart = 50 seconds total)
  // If all attempts fail, Electron will quit
  connectToExistingSidecar(): void {
    console.log('[DLP] Connecting to existing Sidecar...')
    this.startConnectionAttempts()
  }

  // Start connection attempts - retries indefinitely until sidecar connects
  private startConnectionAttempts(): void {
    if (isConnectionAttemptInProgress) return  // Prevent concurrent attempts
    isConnectionAttemptInProgress = true
    let attempts = 0

    const tryConnect = () => {
      attempts++
      console.log(`[DLP] Connection attempt ${attempts}...`)

      this.connectToSidecar().then((success) => {
        if (success) {
          console.log('[DLP] Successfully connected to Sidecar')
          isConnectionAttemptInProgress = false
        } else {
          // Retry indefinitely
          console.log(`[DLP] Connection attempt ${attempts} failed, retrying in ${CONNECTION_RETRY_INTERVAL_MS}ms...`)
          setTimeout(tryConnect, CONNECTION_RETRY_INTERVAL_MS)
        }
      })
    }

    // Start first attempt after initial delay (give Sidecar time to create pipe)
    setTimeout(tryConnect, INITIAL_RETRY_DELAY_MS)
  }

  // Check if sidecar is still connected, attempt reconnect if not
  checkAndReconnectSidecar(): void {
    if (sidecarConnected || isConnectionAttemptInProgress) {
      return
    }
    
    console.log('[DLP] Sidecar disconnected, attempting reconnection...')
    this.startConnectionAttempts()
  }

  // Connect to Sidecar via Named Pipe
  private async connectToSidecar(): Promise<boolean> {
    return new Promise((resolve) => {
      const pipePath = `\\\\.\\pipe\\${SIDECAR_PIPE_NAME}`
      
      const client = net.createConnection(pipePath, () => {
        console.log('[DLP Pipe] Connected to Sidecar')

        // Disable idle timeout - we don't want the connection to close after inactivity
        client.setTimeout(0)

        // Register auth handler BEFORE sending token to avoid race condition
        // This ensures we catch the AUTH_OK response correctly
        let authResolved = false
        const authHandler = (data: Buffer) => {
          if (authResolved) return  // Ignore data after auth is complete
          
          const response = data.toString().trim()
          if (response === 'AUTH_OK') {
            console.log('[DLP Pipe] Authentication successful')
            sidecarConnected = true
            sidecarAuthComplete = true
            sidecarSocket = client
            client.removeListener('data', authHandler)
            this.startReadingEvents(client)
            authResolved = true
            resolve(true) // Success
          } else if (response === 'AUTH_FAILED') {
            console.error('[DLP Pipe] Authentication failed!')
            client.end()
            authResolved = true
            resolve(true) // Success
          }
        }
        client.on('data', authHandler)
        
        // Send auth token AFTER handler is registered
        client.write(`${SIDECAR_AUTH_TOKEN}\n`)
        console.log('[DLP Pipe] Sent authentication token')
      })
      
      client.on('error', (err) => {
        console.warn('[DLP Pipe] Connection failed:', err.message)
        resolve(false) // Failed
      })

      // Don't set idle timeout - named pipes stay open and we only close on error or explicitly
      // The previous setTimeout(10000) caused issues because destroy() in the timeout callback
      // would close connections prematurely
    })
  }
  
  // Start reading events from Sidecar
  private startReadingEvents(client: net.Socket): void {
    let buffer = ''
    
    client.on('data', (data: Buffer) => {
      buffer += data.toString()
      
      // Process complete JSON lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.trim()) {
          this.handleSidecarEvent(line)
        }
      }
    })
    
    client.on('close', () => {
      console.log('[DLP Pipe] Connection closed')
      sidecarConnected = false
      sidecarSocket = null
      
      // Auto-reconnect with delay (give Sidecar time to recreate the pipe)
      console.log('[DLP Pipe] Scheduling reconnect (max 10 attempts, 5s apart)...')
      this.startConnectionAttempts()
    })
    
    client.on('error', (err) => {
      console.warn('[DLP Pipe] Connection error:', err.message)
    })
  }
  
  // Handle events from Sidecar
  private handleSidecarEvent(eventData: string): void {
    try {
      // Parse event - Sidecar sends as "EVENT:{json}" or just "{json}"
      let eventJson = eventData
      if (eventData.startsWith('EVENT:')) {
        eventJson = eventData.substring(6)
      }
      
      const rawEvent = JSON.parse(eventJson)
      // Normalize: Sidecar uses PascalCase (Type, Severity), Electron expects camelCase
      const event = {
        type: rawEvent.Type || rawEvent.type,
        severity: rawEvent.Severity || rawEvent.severity,
        details: rawEvent.Details || rawEvent.details,
        timestamp: rawEvent.Timestamp || rawEvent.timestamp
      }

      // Only log HIGH severity events to console in production
      if (event.severity === 'HIGH') {
        console.warn('[DLP Event]', event.type, '[' + event.severity + ']', event.details)
      }
      
      // Forward to renderer for real-time UI update and audit logging
      // Renderer (via useSecurityEventForwarder) will send to backend with JWT auth
      const userContext = `[${this.currentAccountId || os.userInfo().username}]`
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          // Add user context to details for audit logging
          const eventWithUserContext = {
            ...event,
            details: `${userContext} ${event.details || event.type}`
          }
          win.webContents.send('security-alert', eventWithUserContext)

          // Also forward critical events as screenshot-blocked to lock DRMViewer UI
          const isCriticalEvent =
            event.type?.startsWith('SCREENSHOT_') ||
            event.type?.startsWith('RECORDING_TOOL_') ||
            event.type?.startsWith('RECORDING_') ||
            event.type?.startsWith('CAPTURE_TOOL_')

          if (isCriticalEvent) {
            win.webContents.send('screenshot-blocked', {
              eventType: event.type,
              details: event.details,
              timestamp: event.timestamp || new Date().toISOString()
            })
          }
        }
      })
      
      // NOTE: Audit logging is now handled by renderer (useSecurityEventForwarder hook)
      // This ensures JWT authentication is properly included for user identification
      // Do NOT send events directly from main process - they lack proper JWT auth
    } catch {
      // Not JSON, ignore silently
    }
  }
  
  // Send command to Sidecar via named pipe
  private async sendCommandToSidecar(command: string): Promise<string> {
    const socket = sidecarSocket
    if (!sidecarConnected || !socket) {
      console.warn('[DLP Pipe] Sidecar not connected')
      return 'NOT_CONNECTED'
    }
    
    return new Promise((resolve) => {
      try {
        // If auth is not complete, wait for it before sending commands
        if (!sidecarAuthComplete) {
          console.log('[DLP Pipe] Waiting for auth to complete before sending command:', command)
          const checkAuthInterval = setInterval(() => {
            if (sidecarAuthComplete) {
              clearInterval(checkAuthInterval)
              this.sendCommandToSidecar(command).then(resolve)
            }
          }, 100)
          return
        }
        
        let responseHandler: (data: Buffer) => void = null!
        
        const timeoutId = setTimeout(() => {
          socket.removeListener('data', responseHandler)
          resolve('TIMEOUT')
        }, 5000)
        
        responseHandler = (data: Buffer) => {
          const response = data.toString().trim()
          // Skip event messages, only process command responses
          if (!response.startsWith('EVENT:')) {
            clearTimeout(timeoutId)
            socket.removeListener('data', responseHandler)
            console.log('[DLP Pipe] Command response:', response)
            resolve(response)
          }
        }
        
        socket.on('data', responseHandler)
        socket.write(command + '\n')
        
        console.log('[DLP Pipe] Sent command:', command)
      } catch (error) {
        console.error('[DLP Pipe] Command failed:', error)
        resolve('ERROR')
      }
    })
  }
  
  // Enable content protection on DLP windows
  async enableContentProtection(): Promise<boolean> {
    const response = await this.sendCommandToSidecar('ENABLE_PROTECTION')
    return response.includes('ENABLED')
  }
  
  // Disable content protection on DLP windows
  async disableContentProtection(): Promise<boolean> {
    const response = await this.sendCommandToSidecar('DISABLE_PROTECTION')
    return response.includes('DISABLED')
  }
  
  // Get content protection status
  async getProtectionStatus(): Promise<string> {
    return await this.sendCommandToSidecar('GET_PROTECTION_STATUS')
  }

  // Get current USB mass storage devices (for post-login check)
  async getUsbDevices(): Promise<string[]> {
    console.log('[DLP Pipe] getUsbDevices called')
    const response = await this.sendCommandToSidecar('GET_USB_DEVICES')
    console.log('[DLP Pipe] getUsbDevices raw response:', response)
    if (response.startsWith('USB_DEVICES:')) {
      try {
        const json = response.substring('USB_DEVICES:'.length)
        const devices = JSON.parse(json) as string[]
        console.log('[DLP Pipe] getUsbDevices parsed:', devices.length, 'devices')
        return devices
      } catch {
        console.warn('[DLP Pipe] Failed to parse USB devices response:', response)
      }
    }
    return []
  }

  // Stop Sidecar
  stopSidecar(): void {
    if (sidecarSocket) {
      sidecarSocket.end()
      sidecarSocket = null
    }
    if (sidecarProcess) {
      sidecarProcess.kill()
      sidecarProcess = null
    }
    sidecarConnected = false
    console.log('[DLP] Sidecar stopped')
  }

  // Get local IP address (non-loopback, non-docker) - public method for IPC
  // IMPORTANT: Filter by adapter NAME, not IP range (192.168.x.x can be real LAN)
  getLocalIpAddress(): string {
    if (this.cachedIpAddress) {
      return this.cachedIpAddress
    }

    try {
      const interfaces = os.networkInterfaces()
      
      // Virtual adapter name patterns to EXCLUDE
      // These indicate Docker, WSL, Hyper-V, VirtualBox, VMware internal networks
      const virtualAdapterPatterns = [
        'docker', 'wsl', 'hyper-v', 'virtual', 'vEthernet', 'VMware', 'vbox',
        'container', 'nat', 'loopback', 'loop-back'
      ]
      
      // Real adapter name patterns to PREFER
      // These indicate real physical/virtual LAN adapters
      const realAdapterPatterns = [
        'ethernet', 'wifi', 'wi-fi', 'wlan', 'lan', 'realtek', 'intel', 'broadcom',
        ' atheros', 'media', 'cisco', 'usb', 'local area connection'
      ]
      
      let bestMatch: { addr: string; name: string; isReal: boolean } | null = null
      
      for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase()
        
        // Check if this is a virtual adapter
        const isVirtual = virtualAdapterPatterns.some(pattern => lowerName.includes(pattern))
        
        // Check if this is a real adapter
        const isReal = realAdapterPatterns.some(pattern => lowerName.includes(pattern))
        
        const iface = interfaces[name]
        if (!iface) continue

        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            const addr = alias.address
            
            // SKIP vEthernet adapters (these are Docker/Hyper-V internal networks)
            // Even if they have IP like 172.x.x.x or 192.168.x.x
            if (lowerName.includes('vethernet')) {
              console.log('[DLP] Skipping vEthernet adapter:', name, addr)
              continue
            }
            
            // Prefer real adapters with any IP (even 192.168.x.x)
            if (isReal) {
              if (!bestMatch || !bestMatch.isReal) {
                bestMatch = { addr, name, isReal: true }
              }
            }
            
            // Also consider non-virtual adapters without strong "real" signal
            // But only if we haven't found a real adapter yet
            if (!isVirtual && !bestMatch?.isReal) {
              if (!bestMatch) {
                bestMatch = { addr, name, isReal: false }
              }
            }
          }
        }
      }
      
      if (bestMatch) {
        this.cachedIpAddress = bestMatch.addr
        console.log('[DLP] Found local IP:', bestMatch.addr, 'via adapter:', bestMatch.name, '(real:', bestMatch.isReal, ')')
      } else {
        this.cachedIpAddress = '127.0.0.1'
        console.warn('[DLP] No valid local IP found, using localhost')
      }
    } catch (error) {
      console.warn('[DLP] Failed to get local IP:', error)
      this.cachedIpAddress = '127.0.0.1'
    }
    return this.cachedIpAddress
  }

  // Block screenshot shortcuts/tools
  blockScreenshotTools() {
    if (this.screenshotBlocked) return
    this.screenshotBlocked = true

    // Windows: register global shortcuts to intercept and BLOCK
    try {
      // === PRIMARY SCREENSHOT KEYS ===
      
      // Block PrintScreen key - most common screenshot method
      globalShortcut.register('PrintScreen', () => {
        this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'PrintScreen pressed - SCREENSHOT BLOCKED')
      })
      
      // Block PrintScreen with modifiers
      globalShortcut.register('Alt+PrintScreen', () => {
        this.handleBlockedScreenshot('SCREENSHOT_ALT_PRESSED', 'Alt+PrintScreen pressed - SCREENSHOT BLOCKED')
      })
      
      globalShortcut.register('Shift+PrintScreen', () => {
        this.handleBlockedScreenshot('SCREENSHOT_SHIFT_PRESSED', 'Shift+PrintScreen pressed - SCREENSHOT BLOCKED')
      })

      // === WINDOWS BUILT-IN SCREENSHOT SHORTCUTS ===
      
      // Win+Shift+S - Windows 10/11 built-in screenshot (Screen Sketch)
      globalShortcut.register('Super+Shift+S', () => {
        this.handleBlockedScreenshot('SCREENSHOT_WIN_SHARP_S', 'Win+Shift+S pressed - SCREENSHOT BLOCKED')
      })
      
      // Win+PrintScreen - capture entire screen to file
      globalShortcut.register('Super+PrintScreen', () => {
        this.handleBlockedScreenshot('SCREENSHOT_WIN_PRTSC', 'Win+PrintScreen pressed - SCREENSHOT BLOCKED')
      })
      
      // Win+Alt+PrintScreen - capture current window
      globalShortcut.register('Super+Alt+PrintScreen', () => {
        this.handleBlockedScreenshot('SCREENSHOT_WIN_ALT_PRTSC', 'Win+Alt+PrintScreen pressed - SCREENSHOT BLOCKED')
      })
      
      // Win+Ctrl+Shift+S - Alternative Screen Sketch shortcut
      globalShortcut.register('Super+CommandOrControl+Shift+S', () => {
        this.handleBlockedScreenshot('SCREENSHOT_WIN_CTRL_SHIFT_S', 'Win+Ctrl+Shift+S pressed - SCREENSHOT BLOCKED')
      })

      // === THIRD-PARTY TOOL SHORTCUTS ===
      
      // Ctrl+Shift+S - common in many screenshot tools
      globalShortcut.register('CommandOrControl+Shift+S', () => {
        this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Shift+S pressed - SCREENSHOT BLOCKED')
      })
      
      // Ctrl+Shift+C - Lightshot default
      globalShortcut.register('CommandOrControl+Shift+C', () => {
        this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Shift+C pressed - SCREENSHOT BLOCKED')
      })
      
      // Ctrl+Alt+A - QQ Screenshot (common in Chinese keyboards)
      globalShortcut.register('CommandOrControl+Alt+A', () => {
        this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Alt+A pressed - SCREENSHOT BLOCKED')
      })
      
      // Ctrl+Alt+X - Windows Snipping Tool
      globalShortcut.register('CommandOrControl+Alt+X', () => {
        this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Alt+X pressed - SCREENSHOT BLOCKED')
      })
      
      // Ctrl+Alt+S - Another common screenshot shortcut
      globalShortcut.register('CommandOrControl+Alt+S', () => {
        this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Alt+S pressed - SCREENSHOT BLOCKED')
      })
      
      // Fn+PrintScreen for laptops
      globalShortcut.register('Fn+PrintScreen', () => {
        this.handleBlockedScreenshot('SCREENSHOT_FN_PRTSC', 'Fn+PrintScreen pressed - SCREENSHOT BLOCKED')
      })

    } catch (error) {
      console.error('Failed to register screenshot shortcuts:', error)
    }
  }

  // Forward screenshot blocked events to renderer (useSecurityEventForwarder will send to backend with JWT auth)
  private handleBlockedScreenshot(eventType: string, details: string) {
    try {
      const now = Date.now()
      
      // Debounce: skip if same event type within debounce window
      if (eventType.startsWith('SCREENSHOT_') || eventType.startsWith('CAPTURE_')) {
        if (now - this.lastScreenshotEventTime < this.SCREENSHOT_DEBOUNCE_MS && 
            this.lastScreenshotEventType === eventType) {
          console.log('[DLP] Screenshot event debounced (duplicate):', eventType)
          return
        }
        this.lastScreenshotEventTime = now
        this.lastScreenshotEventType = eventType
      }
      
      const timestamp = new Date().toISOString()
      console.log('[DLP] handleBlockedScreenshot called:', eventType, details)
      const userContext = `[${this.currentAccountId || os.userInfo().username}]`

      // Forward to renderer - useSecurityEventForwarder will send to backend with JWT auth
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          // Send as security-alert for audit logging (with JWT auth)
          win.webContents.send('security-alert', {
            type: eventType,
            severity: 'HIGH',
            details: `${userContext} ${eventType}: ${details}`,
            timestamp
          })
          
          // Also send as screenshot-blocked for UI lock in DRMViewer
          win.webContents.send('screenshot-blocked', {
            eventType,
            details,
            timestamp
          })
        }
      })

      console.warn(`[DLP BLOCKED] ${eventType}: ${details}`)
    } catch (error) {
      console.error('Failed to handle blocked screenshot:', error)
    }
  }

  // Forward screenshot tool detection to renderer (useSecurityEventForwarder will send to backend with JWT auth)
  private handleScreenshotToolDetected(toolName: string) {
    try {
      const timestamp = new Date().toISOString()
      const userContext = `[${this.currentAccountId || os.userInfo().username}]`

      // Forward to renderer - useSecurityEventForwarder will send to backend with JWT auth
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          // Send as security-alert for audit logging (with JWT auth)
          win.webContents.send('security-alert', {
            type: 'SCREENSHOT_TOOL_DETECTED',
            severity: 'HIGH',
            details: `${userContext} Screenshot tool detected: ${toolName}`,
            timestamp
          })
          
          // Also send as screenshot-blocked for UI lock in DRMViewer
          win.webContents.send('screenshot-blocked', {
            eventType: 'SCREENSHOT_TOOL_DETECTED',
            details: `Screenshot tool detected running: ${toolName}`,
            timestamp
          })
        }
      })

      console.log(`[DLP Screenshot Tool] Detected: ${toolName} - Forwarded to renderer for audit`)
    } catch (error) {
      console.error('Failed to handle screenshot tool detection:', error)
    }
  }

  // Handle recording start detected
  // Forward to renderer - useSecurityEventForwarder will send to backend with JWT auth
  private handleRecordingStart(toolName: string) {
    try {
      if (this.isRecordingActive) {
        // Already recording, ignore duplicate detection
        return
      }

      this.isRecordingActive = true
      this.recordingStartTime = Date.now()
      const timestamp = new Date().toISOString()
      const userContext = `[${this.currentAccountId || os.userInfo().username}]`

      // Forward to renderer - useSecurityEventForwarder will send to backend with JWT auth
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          // Send as security-alert for audit logging (with JWT auth)
          win.webContents.send('security-alert', {
            type: 'SCREEN_RECORDING_START',
            severity: 'HIGH',
            details: `${userContext} Recording started: ${toolName}`,
            timestamp
          })
          
          // Also send recording-start for UI feedback
          win.webContents.send('recording-start', {
            toolName,
            timestamp
          })
        }
      })

      console.warn(`[DLP RECORDING] Started: ${toolName}`)
    } catch (error) {
      console.error('Failed to handle recording start:', error)
    }
  }

  // Handle recording stop detected
  // Forward to renderer - useSecurityEventForwarder will send to backend with JWT auth
  private handleRecordingStop(toolName: string) {
    try {
      if (!this.isRecordingActive) {
        return
      }

      this.isRecordingActive = false
      const duration = this.getRecordingDuration()
      const timestamp = new Date().toISOString()
      const userContext = `[${this.currentAccountId || os.userInfo().username}]`

      // Forward to renderer - useSecurityEventForwarder will send to backend with JWT auth
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          // Send as security-alert for audit logging (with JWT auth)
          win.webContents.send('security-alert', {
            type: 'SCREEN_RECORDING_STOP',
            severity: 'MEDIUM',
            details: `${userContext} Recording stopped: ${toolName} (duration: ${duration})`,
            timestamp
          })
          
          // Also send recording-stop for UI feedback
          win.webContents.send('recording-stop', {
            toolName,
            duration,
            timestamp
          })
        }
      })

      console.warn(`[DLP RECORDING] Stopped: ${toolName} (${duration})`)
      this.recordingStartTime = null
    } catch (error) {
      console.error('Failed to handle recording stop:', error)
    }
  }

  // Log screen recording activity with specific event type
  // Only sends events to backend when user is actively viewing documents
  // Severity: HIGH for screenshot attempts, WARNING for other suspicious activities
  private logScreenRecordingActivity(eventType: string, details: string) {
    try {
      const logPath = join(app.getPath('userData'), 'security.log')
      const logEntry = `[${new Date().toISOString()}] [${eventType}] ${details}\n`
      fs.appendFileSync(logPath, logEntry)

      // Send to renderer process - it will send to backend audit log
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('suspicious-activity', `[${eventType}] ${details}`)
        }
      })
    } catch (error) {
      console.error('Failed to log screen recording activity:', error)
    }
  }

  // Log screen recording tool detection activity (for internal monitoring only)
  // This is called when screenshot/recording tools are detected running
  // It does NOT send to backend audit log - just internal logging for debugging
  logToolDetection(eventType: string, details: string) {
    try {
      // Only log to console for debugging (optional)
      // NOT sent to backend to avoid flooding audit logs with tool detection
      console.log('[DLP Tool Detection]', eventType, details)
    } catch (error) {
      console.error('Failed to log tool detection:', error)
    }
  }

  // Monitor clipboard for image content (screenshot detection) - KEEP THIS
  // This doesn't require admin privileges, so it's handled by Electron
  monitorClipboard() {
    if (this.clipboardMonitorInterval) return

    let lastClipboardHash = 0
    let lastClipboardImageHash = 0

    // Simple hash function for clipboard content
    const simpleHash = (text: string): number => {
      let hash = 0
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      return hash
    }

    lastClipboardHash = simpleHash(clipboard.readText())

    // Poll clipboard every 500ms for faster detection
    this.clipboardMonitorInterval = setInterval(() => {
      try {
        // Check for text changes
        const currentText = clipboard.readText()
        const currentHash = simpleHash(currentText)

        if (currentHash !== lastClipboardHash) {
          lastClipboardHash = currentHash

          if (currentText.length > 100) {
            this.logScreenRecordingActivity('LARGE_CLIPBOARD_COPY', `Large text copied to clipboard (${currentText.length} chars)`)
          }
        }

        // Check for image in clipboard (screenshot detection)
        const image = clipboard.readImage()
        if (!image.isEmpty()) {
          const imageHash = simpleHash(image.toDataURL().substring(0, 1000))
          if (imageHash !== lastClipboardImageHash) {
            lastClipboardImageHash = imageHash
            this.handleBlockedScreenshot('SCREENSHOT_CLIPBOARD_IMAGE', 'Screenshot detected in clipboard - IMAGE BLOCKED')
          }
        }
      } catch (error) {
        // Ignore clipboard read errors
      }
    }, 2000)
  }

  // Monitor window focus changes - for tracking switching behavior
  monitorWindowFocus(window: BrowserWindow) {
    if (!window) return

    let wasFocused = window.isFocused()

    // Also log initial focus state
    if (wasFocused) {
      this.logWindowFocusChange(false, 'Window is focused (initial state)')
    }

    // Track focus loss (user switching away)
    window.on('blur', () => {
      if (wasFocused) {
        wasFocused = false
        const now = Date.now()
        this.focusChangeCount++
        this.lastFocusChangeTime = now

        // Reset counter every minute
        if (now - this.lastFocusChangeTime > 60000) {
          this.focusChangeCount = 1
        }

        this.logWindowFocusChange(true, `Window lost focus (change #${this.focusChangeCount}/min)`)

        // Only alert if too many focus changes in short time
        if (this.focusChangeCount > this.FOCUS_CHANGE_THRESHOLD) {
          this.logScreenRecordingActivity('RAPID_WINDOW_SWITCHING',
            `Unusual rapid window switching detected: ${this.focusChangeCount} switches in less than a minute`)
        }
      }
    })

    // Track focus gain
    window.on('focus', () => {
      if (!wasFocused) {
        wasFocused = true
        this.logWindowFocusChange(false, 'Window gained focus')
      }
    })
  }

  // Record suspicious activity - send to renderer for UI display
  // NOTE: Audit logging is handled by main process ONLY for significant events
  // Window focus changes are NOT sent to audit (too frequent, not real security threats)
  // Only real screenshot/recording attempts are logged to audit (via handleBlockedScreenshot, handleScreenshotToolDetected, handleRecordingStart)
  private logSuspiciousActivity(activity: string) {
    try {
      // Send event to renderer process - for UI display only, NOT for audit logging
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('suspicious-activity', activity)
        }
      })

      // DO NOT send focus/window events to audit - they're too frequent and not real security threats
      // Real screenshot/recording attempts are already logged via handleBlockedScreenshot, handleScreenshotToolDetected, handleRecordingStart
      console.debug(`[DLP Suspicious] ${activity}`)
    } catch (error) {
      console.error('Failed to log suspicious activity:', error)
    }
  }

  // Log window focus changes - informational only (NOT sent to backend audit log)
  // Normal window focus changes are benign and should not be recorded
  private logWindowFocusChange(isBlur: boolean, details: string) {
    try {
      // Only log to console for debugging - NOT sent to backend
      const eventType = isBlur ? 'WINDOW_BLUR' : 'WINDOW_FOCUS'
      console.debug(`[DLP Focus] ${eventType}: ${details}`)
    } catch (error) {
      // Non-critical, ignore
    }
  }

  // Log USB insertion/removal - send to renderer
  private logUsbEvent(eventType: 'INSERTED' | 'REMOVED', deviceId: string, volumeLabel?: string) {
    try {
      const details = `USB ${eventType.toLowerCase()}: ${deviceId} (${volumeLabel || 'NO_LABEL'})`

      // Send to renderer - it will send to backend audit log
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('suspicious-activity', `[USB_${eventType}] ${details}`)
        }
      })

      console.warn(`[DLP USB] ${eventType}: ${deviceId} (${volumeLabel || 'NO_LABEL'})`)
    } catch (error) {
      console.error('Failed to log USB event:', error)
    }
  }

  // Get recording duration string
  private getRecordingDuration(): string {
    if (!this.recordingStartTime) return 'unknown'
    const seconds = Math.floor((Date.now() - this.recordingStartTime) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  private monitorRecordingStatus() {
    if (this.recordingMonitorInterval) return

    this.recordingMonitorInterval = setInterval(async () => {
      const isRecording = await this.checkRecordingStatus()

      if (isRecording && !this.isRecordingActive) {
        // Recording just started
        this.handleRecordingStart(this.lastKnownRecordingTool || 'Unknown Tool')
      } else if (!isRecording && this.isRecordingActive) {
        // Recording just stopped
        this.handleRecordingStop(this.lastKnownRecordingTool || 'Unknown Tool')
      }
    }, 1500) // Check every 1.5 seconds for faster recording detection
  }

  // Check if recording is active by looking for recording-specific processes and window capture (Windows only)
  private checkRecordingStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      let foundRecording = false

      const checkComplete = () => resolve(foundRecording)

      // Extended window title indicators for various recording tools
      // Each tool has specific window title patterns when recording
      const RECORDING_WINDOW_INDICATORS: Record<string, string[]> = {
        'obs64.exe': ['recording', 'replay buffer', 'streaming', 'obs'],
        'obs32.exe': ['recording', 'replay buffer', 'streaming', 'obs'],
        'bandicam.exe': ['recording', 'capture', 'bandicam'],
        'camtasia.exe': ['recording', 'rec', 'camtasia'],
        'streamlabs obs': ['recording', 'live', 'streamlabs'],
        'xsplit': ['recording', 'broadcasting', 'xsplit'],
        'game bar': ['capturing', 'game bar', 'xbox'],
        'loom': ['recording', 'loom'],
        'screencastify': ['recording', 'screencastify'],
        'discord.exe': ['screenshare', 'go live'],
        'teams.exe': ['sharing', 'presenting', 'teams'],
        'zoom.exe': ['sharing', 'zoom'],
        'vlc.exe': ['recording', 'vlc'],
        'nvidia share': ['recording', 'nvidia', 'shadowplay'],
      }

      // Check window titles for all recording tools
      const toolsToCheck = Object.keys(RECORDING_WINDOW_INDICATORS).join(',')

      exec(`powershell -Command "Get-Process | Where-Object { $_.ProcessName -match '${toolsToCheck.replace(/\s+/g, '|')}' } | Select-Object ProcessName,MainWindowTitle"`, (error, stdout) => {
        if (!error && stdout && stdout.trim()) {
          const lines = stdout.split(/\r?\n/).filter(l => l.trim() && !l.includes('ProcessName'))
          
          for (const line of lines) {
            const parts = line.trim().split(/\s{2,}/)
            if (parts.length < 2) continue
            
            const processName = parts[0]?.toLowerCase() || ''
            const windowTitle = parts[1]?.toLowerCase() || ''
            
            // Find matching tool
            for (const [tool, indicators] of Object.entries(RECORDING_WINDOW_INDICATORS)) {
              if (processName.includes(tool.replace('.exe', ''))) {
                // Check if window title contains any recording indicator
                const hasIndicator = indicators.some(ind => windowTitle.includes(ind))
                if (hasIndicator) {
                  this.lastKnownRecordingTool = tool
                  foundRecording = true
                  break
                }
              }
            }
            if (foundRecording) break
          }
        }
        
        checkComplete()
      })
    })
  }

  // Check OBS stats file for active capture status
  // OBS writes stats to a JSON file when recording/capturing
  private async checkObsStatsFile(): Promise<boolean> {
    return new Promise((resolve) => {
      // OBS stats file location varies by version
      const possiblePaths = [
        path.join(os.homedir(), 'AppData', 'Roaming', 'obs-studio', 'logs'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'obs-studio', 'basic', 'logs'),
      ]

      // Try to find most recent OBS log with recording stats
      const logPath = possiblePaths[1]
      exec(`powershell -Command "Get-ChildItem -Path '${logPath.replace(/'/g, "''")}' -Filter '*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Select-Object FullName"`, (error, stdout) => {
        if (!error && stdout && stdout.trim()) {
          const logFile = stdout.trim()
          // Check last few lines of log for recording activity
          exec(`powershell -Command "Get-Content '${logFile.replace(/'/g, "''")}' -Tail 50 | Select-String -Pattern 'recording|streaming|output active|capture' | Select-Object -Last 1"`, (e, out) => {
            if (!e && out && out.toLowerCase().includes('recording') && !out.toLowerCase().includes('stopped')) {
              resolve(true)
              return
            }
            resolve(false)
          })
        } else {
          resolve(false)
        }
      })
    })
  }

  // Send endpoint event to backend (for audit log)
  // IMPORTANT: Include JWT token for user authentication
  // This ensures audit logs are correctly associated with the logged-in user
  async sendEndpointEventToBackend(
    action: string,
    category: string,
    result: 'SUCCESS' | 'WARNING' | 'FAILURE',
    details: string,
    accessToken?: string | null
  ): Promise<void> {
    // Backend is at port 18080 inside Docker, accessible from host as localhost:18080
    const candidates = [
      'http://localhost:18080',
      'http://host.docker.internal:18080'
    ]
    
    let baseUrl = ''
    
    // First try: direct fetch (fastest for local Docker)
    for (const url of candidates) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        const resp = await fetch(`${url}/api/agent/endpoint/health`, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (resp.ok) {
          baseUrl = url
          console.log('[DLP] Backend found via fetch:', baseUrl)
          break
        }
      } catch { /* try next */ }
    }
    
    // Second try: PowerShell (reliable fallback)
    if (!baseUrl) {
      const detected = await this.detectBackendUrlViaPowerShell()
      baseUrl = detected || ''
    }
    
    if (!baseUrl) {
      console.error('[DLP] Backend not reachable, event SKIPPED:', action)
      console.error('[DLP] Tried:', candidates.map(u => `${u}/api/agent/endpoint/health`))
      return
    }
    
    console.log('[DLP] Backend URL:', baseUrl)

    // Try different URL patterns for the events endpoint
    const baseUrls = [
      `${baseUrl}/api/agent/endpoint/events`,
      `${baseUrl}/agent/endpoint/events`
    ]
    const validUrls = [...new Set(baseUrls)]
    console.log('[DLP] Will try endpoint URLs:', validUrls)

    // Build request headers - include JWT if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
      console.log('[DLP] Including JWT in endpoint event (user auth via token)')
    } else {
      console.log('[DLP] No JWT available for endpoint event (accountId fallback only)')
    }

    let lastError: Error | null = null
    for (const url of validUrls) {
      try {
        console.log('[DLP] Sending endpoint event to:', url)
        console.log('[DLP] Event details:', { action, category, result, accountId: this.currentAccountId })

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action,
            category,
            result,
            details,
            username: os.userInfo().username,
            hostName: os.hostname(),
            ipAddress: this.getLocalIpAddress(),
            accountId: this.currentAccountId || null
          })
        })

        console.log('[DLP] Endpoint event response:', response.status, '| action:', action, '| accountId:', this.currentAccountId)

        if (response.ok) {
          console.log('[DLP] Endpoint event sent successfully, status:', response.status, 'action:', action)
          return
        } else {
          console.warn('[DLP] Endpoint event response not OK:', response.status, response.statusText)
        }
      } catch (error) {
        lastError = error as Error
        console.warn('[DLP] Failed to send endpoint event to', url, ':', error)
      }
    }

    console.error('[DLP] ALL endpoint URLs failed. Last error:', lastError)
  }

  // Detect backend URL using PowerShell (more reliable in Electron context)
  private async detectBackendUrlViaPowerShell(): Promise<string | null> {
    return new Promise((resolve) => {
      // Backend is at port 18080, health check endpoint is at /api/agent/endpoint/health
      const dockerUrls = [
        'http://host.docker.internal:18080',
        'http://localhost:18080'
      ]

      // Use PowerShell to test URLs (bypasses Electron's network restrictions)
      const testUrls = dockerUrls.map(url => 
        `try { $r = Invoke-WebRequest -Uri '${url}/api/agent/endpoint/health' -Method GET -TimeoutSec 2 -ErrorAction Stop; Write-Output $r.StatusCode } catch { Write-Output 'FAIL' }`
      ).join('; ')

      const psScript = testUrls

      exec(`powershell -Command "${psScript}"`, (error, stdout) => {
        if (error) {
          console.warn('[DLP] PowerShell detection failed:', error.message)
          resolve(null)
          return
        }

        const lines = stdout.trim().split('\n').map(s => s.trim())
        const validUrls = dockerUrls.filter((url, i) => {
          const code = lines[i] || ''
          return code === '200'
        })

        if (validUrls.length > 0) {
          console.log('[DLP] Backend detected via PowerShell:', validUrls[0])
          resolve(validUrls[0])
        } else {
          console.warn('[DLP] PowerShell detection found no valid backend')
          resolve(null)
        }
      })
    })
  }

  // Set the current logged-in user's accountId and access token (called from renderer via IPC)
  setCurrentAccountId(accountId: string | null, accessToken: string | null = null) {
    this.currentAccountId = accountId
    this.currentAccessToken = accessToken
    console.log('[DLP] Account ID set:', accountId, '| JWT available:', !!accessToken)
  }

  // Initialize from Zustand persist storage (called after window loads)
  // This handles the case where user is already logged in (persisted state restored)
  initializeFromPersistStorage() {
    console.log('[DLP] Initializing from persist storage...')
    
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn('[DLP] Cannot initialize: main window not ready')
      return
    }

    // Execute JavaScript in the renderer to read Zustand persist storage
    // Zustand persist stores data in localStorage under the storage key
    const script = `
      (function() {
        try {
          // Zustand persist uses the storage key 'auth-storage'
          const stored = localStorage.getItem('auth-storage');
          if (stored) {
            const data = JSON.parse(stored);
            if (data.state) {
              // Zustand persist structure: { state: { user, accessToken, ... }, version: n }
              const accountId = data.state.user?.accountId || null;
              const accessToken = data.state.accessToken || null;
              const isAuthenticated = data.state.isAuthenticated === true;
              
              if (isAuthenticated && (accountId || accessToken)) {
                console.log('[DLP Renderer] Found persisted auth:', accountId, accessToken ? '(has token)' : '(no token)');
                // Use the electronAPI exposed by preload to send response back
                if (window.electronAPI?.sendAuthInitResponse) {
                  window.electronAPI.sendAuthInitResponse(accountId, accessToken);
                } else {
                  // Fallback: send via ipcRenderer directly
                  console.log('[DLP Renderer] Calling sendAuthInitResponse directly');
                }
              } else {
                console.log('[DLP Renderer] No persisted auth found');
                if (window.electronAPI?.sendAuthInitResponse) {
                  window.electronAPI.sendAuthInitResponse(null, null);
                }
              }
            }
          } else {
            console.log('[DLP Renderer] No persisted auth storage found');
            if (window.electronAPI?.sendAuthInitResponse) {
              window.electronAPI.sendAuthInitResponse(null, null);
            }
          }
        } catch (e) {
          console.error('[DLP Renderer] Failed to read persist storage:', e);
          if (window.electronAPI?.sendAuthInitResponse) {
            window.electronAPI.sendAuthInitResponse(null, null);
          }
        }
      })();
    `
    
    mainWindow.webContents.executeJavaScript(script).catch(err => {
      console.warn('[DLP] Failed to execute script for persist init:', err)
    })
  }

  // Update access token (called from renderer when token is refreshed)
  updateAccessToken(accessToken: string | null) {
    this.currentAccessToken = accessToken
    console.log('[DLP] Access token updated:', accessToken ? 'yes' : 'no')
  }

  // Get the current logged-in user's accountId
  getCurrentAccountId(): string | null {
    console.log('[DLP] getCurrentAccountId() called, returning:', this.currentAccountId)
    return this.currentAccountId
  }

  // Document viewing state management - only log warning events when actively viewing documents
  setDocumentViewingActive(active: boolean) {
    this.documentViewingActive = active
    console.log('[DLP] Document viewing active:', active)
  }

  isDocumentViewingActive(): boolean {
    return this.documentViewingActive
  }

  private async reportUsbEventToBackend(eventType: 'INSERTED' | 'REMOVED', deviceId: string, volumeLabel?: string, sizeBytes?: number) {
    const baseUrl = (process.env.ELECTRON_API_BASE_URL || process.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
    if (!baseUrl) {
      // No backend URL configured, skip silently
      return
    }
    const url = `${baseUrl}/agent/usb/events`

    // Get current logged-in user's accountId from preload
    const currentAccountId = (global as any).electronAPI?.getAccountId?.() || undefined

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: os.userInfo().username,
          hostName: os.hostname(),
          deviceId,
          volumeLabel: volumeLabel || null,
          capacityBytes: typeof sizeBytes === 'number' ? sizeBytes : null,
          eventType,
          accountId: currentAccountId
        })
      })
      if (response.ok && eventType === 'INSERTED') {
        const data = await response.json() as any
        const decided = data?.data?.action
        if (decided === 'BLOCK_MOUNT') {
          this.logSuspiciousActivity(`USB block policy returned by backend: device=${deviceId}, volume=${volumeLabel || 'UNKNOWN'}`)
        }
      }
    } catch (error) {
      console.warn('Failed to report USB event to backend:', error)
    }
  }

  // ============================================================
  // DEPRECATED METHODS - Now handled by C# Sidecar
  // These are stubs for backwards compatibility
  // ============================================================
  
  monitorScreenshotProcesses() {
    console.log('[DLP] monitorScreenshotProcesses() - Now handled by C# Sidecar')
  }
  
  monitorBrowserScreenCapture() {
    console.log('[DLP] monitorBrowserScreenCapture() - Now handled by C# Sidecar')
  }
  
  monitorUsbDevices() {
    console.log('[DLP] monitorUsbDevices() - Now handled by C# Sidecar')
  }
  
  monitorWindowsEventLog() {
    console.log('[DLP] monitorWindowsEventLog() - Now handled by C# Sidecar')
  }
  
  startProcessCpuMonitoring() {
    console.log('[DLP] startProcessCpuMonitoring() - Now handled by C# Sidecar')
  }
  
  blockPrinting() {
    console.log('[DLP] blockPrinting() - Feature not yet implemented in Sidecar')
  }

  parseWindowsRemovableDrives(raw: string): Map<string, { volumeLabel?: string; sizeBytes?: number }> {
    return new Map()
  }
  
  getProcessPath(processName: string): Promise<string | null> {
    return Promise.resolve(null)
  }
  
  calculateFileHash(filePath: string): Promise<string | null> {
    return Promise.resolve(null)
  }
  
  verifyProcessByHash(processName: string): Promise<{ verified: boolean; hash: string | null; path: string | null }> {
    return Promise.resolve({ verified: false, hash: null, path: null })
  }
  
  // Cleanup - simplified for Sidecar model
  cleanup() {
    console.log('[DLP] cleanup() - Now handled by stopSidecar()')
    globalShortcut.unregisterAll()
  }
}

let mainWindow: BrowserWindow | null = null
const protectionService = new SystemProtectionService()

// Listen for auth init response from renderer (when we query persist storage)
function setupAuthInitListener() {
  ipcMain.on('DLP_AUTH_INIT_RESPONSE', (_event, accountId: string | null, accessToken: string | null) => {
    console.log('[DLP] Received auth init response:', accountId, '| JWT:', accessToken ? 'yes' : 'no')
    protectionService.setCurrentAccountId(accountId, accessToken)
  })
}

// Initialize auth init listener
setupAuthInitListener()

function createWindow() {
  // Create browser window with software rendering
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  console.log('[DLP] Creating main window, preload path:', join(__dirname, 'preload.mjs'))
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: false,
      webgl: false,
      enableWebSQL: false
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e'
  })
  
  // Setup message listener for DLP_AUTH_INIT responses from renderer
  mainWindow.webContents.on('crashed', () => {
    console.error('[DLP] Renderer process crashed!')
  })

  // Single did-finish-load handler to avoid duplicate listeners
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[DLP] Page finished loading')
    protectionService.initializeFromPersistStorage()
  })

  // Also try to initialize after a short delay (in case did-finish-load doesn't fire)
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      protectionService.initializeFromPersistStorage()
    }
  }, 3000)
  
  // Development: load Vite dev server
  if (isDev) {
    // Dev mode: load Vite dev server (HMR)
    console.log(`[DLP] Loading Vite dev server: http://127.0.0.1:${VITE_DEV_PORT}`)
    
    mainWindow.loadURL(`http://127.0.0.1:${VITE_DEV_PORT}`)
    .then(() => {
      console.log('[DLP] Vite dev server loaded successfully')
    })
    .catch((error) => {
      console.error('[DLP] Failed to load Vite dev server:', error)
    })
    
    // Handle Vite server not started yet
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDescription) => {
      console.error(`[DLP] Failed to load with error code: ${errorCode}`)
      if (errorCode === -106) {
        console.log('Waiting for Vite dev server to start...')
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(`http://127.0.0.1:${VITE_DEV_PORT}`)
          }
        }, 2000)
      }
    })
  } else {
    // Production: load built HTML
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Notify renderer when window is maximized/restored so preview can re-scale
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('resize-preview')
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('resize-preview')
  })

  // Handle unresponsive window (window switching issues)
  mainWindow.on('unresponsive', () => {
    console.warn('[DLP] Window became unresponsive - possible heavy rendering or CPU spike')
  })
  
  mainWindow.on('responsive', () => {
    console.log('[DLP] Window became responsive again')
  })

  // Window close event
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Prevent new window creation (security hardening)
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  // ============================================================
  // START SECURITY MONITOR SIDECAR
  // ============================================================
  // The C# Sidecar handles:
  // - Deep process monitoring with digital signature verification
  // - USB storage device control (enable/disable)
  // - Windows Event Log monitoring
  // - Process kill capabilities
  //
  // NOTE: Commented out to prevent Electron from starting its own sidecar
  // This allows you to run SecurityMonitor manually in a separate window
  // Run manually: cd D:\Code\Test\FYP\sidecar\SecurityMonitor\bin && dotnet SecurityMonitor.dll
  
  // const sidecarStarted = protectionService.startSidecar()
  // if (!sidecarStarted) {
  //   console.warn('[DLP] Warning: Sidecar not running. Some monitoring features disabled.')
  // }

  // Connect to existing Sidecar (don't start new one)
  protectionService.connectToExistingSidecar()

  // ============================================================
  // REMAINING ELECTRON-ONLY PROTECTIONS
  // ============================================================
  
  // Screenshot shortcut blocking (handled by Electron globalShortcut)
  protectionService.blockScreenshotTools()
  
  // Clipboard monitoring for screenshot images
  protectionService.monitorClipboard()
  
  // Window focus monitoring (for UI display only)
  protectionService.monitorWindowFocus(mainWindow)
  
  // Enable content protection on DLP windows (black screen in screenshots)
  // This runs after Sidecar is connected and ready
  setTimeout(async () => {
    const enabled = await protectionService.enableContentProtection()
    console.log('[DLP] Content protection:', enabled ? 'ENABLED' : 'DISABLED (Sidecar not connected)')
  }, 2000)

  // Fourth Layer: Anti-Tampering - Process Protection
  // Prevent users from forcibly terminating the DLP rendering program
  // If DLP service malfunctions, sensitive files are forcibly closed
  setupAntiTampering(mainWindow)
}

// App ready
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed (Windows only - Electron runs on Windows)
app.on('window-all-closed', () => {
  protectionService.stopSidecar()
  app.quit()
})

// Fourth Layer: Anti-Tampering Mechanism
function setupAntiTampering(window: BrowserWindow | null) {
  if (!window) return

  // Monitor window close attempts - prevent unauthorized closure
  window.on('close', (_event) => {
    // In production, check if sensitive documents are open
    // For now, allow normal closure but log it
    console.log('Window close attempted - checking for open sensitive documents')
    // If sensitive documents are open, prevent closure:
    // event.preventDefault()
    // window.webContents.send('prevent-close-warning')
  })

  // Monitor process termination attempts
  process.on('SIGTERM', () => {
    console.log('SIGTERM received - DLP service termination attempt detected')
    // Send warning to renderer
    window?.webContents.send('suspicious-activity', 'Process termination attempt detected')
  })

  process.on('SIGINT', () => {
    console.log('SIGINT received - DLP service interruption attempt detected')
    window?.webContents.send('suspicious-activity', 'Process interruption attempt detected')
  })

  // Monitor for debugger attachment (potential tampering)
  if (process.platform === 'win32') {
    // Windows: Check for debugger attachment
    setInterval(() => {
      try {
        const isDebuggerPresent = process.debugPort !== undefined && process.debugPort !== 0
        if (isDebuggerPresent && !hasLoggedDebuggerWarning) {
          console.warn('Debugger attachment detected - potential tampering')
          window?.webContents.send('suspicious-activity', 'Debugger attachment detected')
          hasLoggedDebuggerWarning = true
        }
      } catch (e) {
        // Ignore errors
      }
    }, 5000)
  }

  // Prevent new window creation (security hardening) - already set above
  // window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Monitor for unauthorized process injection (async, non-blocking)
  if (process.platform === 'win32') {
    const suspiciousProcesses = ['ollydbg', 'x64dbg', 'ida', 'ghidra', 'cheatengine']
    setInterval(() => {
      exec('wmic process where "ParentProcessId=' + process.pid + '" get ProcessId,Name', { timeout: 3000 }, (error: Error | null, stdout: string) => {
        if (!error && stdout) {
          const lowerStdout = stdout.toLowerCase()
          suspiciousProcesses.forEach(proc => {
            if (lowerStdout.includes(proc)) {
              console.warn(`Suspicious process detected: ${proc}`)
              window?.webContents.send('suspicious-activity', `Suspicious process detected: ${proc}`)
            }
          })
        }
      })
    }, 10000)
  }
}

// Cleanup before app quits
app.on('will-quit', () => {
  protectionService.stopSidecar()
  globalShortcut.unregisterAll()
})

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData')
})

// File system operation (if needed)
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8')
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('is-content-protected', () => {
  if (!mainWindow) return false
  const windowApi = mainWindow as BrowserWindow & { isContentProtected?: () => boolean }
  return windowApi.isContentProtected ? windowApi.isContentProtected() : false
})

ipcMain.handle('set-content-protection', (_event, enabled: boolean) => {
  if (!mainWindow) return false
  mainWindow.setContentProtection(enabled)
  const windowApi = mainWindow as BrowserWindow & { isContentProtected?: () => boolean }
  return windowApi.isContentProtected ? windowApi.isContentProtected() : false
})

// Account ID and access token management for endpoint events
ipcMain.on('set-account-id', (_event, accountId: string, accessToken?: string) => {
  console.log('[DLP] IPC set-account-id received:', accountId, '| JWT:', accessToken ? 'yes' : 'none')
  protectionService.setCurrentAccountId(accountId, accessToken)
  console.log('[DLP] protectionService.currentAccountId is now:', protectionService.getCurrentAccountId())
})

ipcMain.handle('get-account-id', () => {
  const accountId = protectionService.getCurrentAccountId()
  console.log('[DLP] IPC get-account-id returning:', accountId)
  return accountId
})

// Update access token (called from renderer when token is refreshed)
ipcMain.on('set-access-token', (_event, accessToken: string) => {
  console.log('[DLP] IPC set-access-token received:', accessToken ? 'yes' : 'no')
  protectionService.updateAccessToken(accessToken)
})

ipcMain.handle('get-access-token', () => {
  return protectionService.getAccessToken()
})

// Get local IP address for audit logging (non-loopback)
ipcMain.handle('get-local-ip-address', () => {
  return protectionService.getLocalIpAddress()
})

// Document viewing state management for conditional security logging
ipcMain.on('set-document-viewing', (_event, active: boolean) => {
  console.log('[DLP] IPC set-document-viewing received:', active)
  protectionService.setDocumentViewingActive(active)
})

ipcMain.handle('is-document-viewing', () => {
  const isActive = protectionService.isDocumentViewingActive()
  console.log('[DLP] IPC is-document-viewing returning:', isActive)
  return isActive
})

// Get USB mass storage devices for post-login check
ipcMain.handle('get-usb-devices', async () => {
  console.log('[DLP] IPC get-usb-devices called')
  const devices = await protectionService.getUsbDevices()
  console.log('[DLP] Returning USB devices:', devices.length)
  return devices
})

