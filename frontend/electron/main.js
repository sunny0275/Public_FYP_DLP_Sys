"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var path_1 = require("path");
var path = require("path");
var url_1 = require("url");
var fs = require("fs");
var child_process_1 = require("child_process");
var net = require("net");
var os_1 = require("os");
// Disable GPU acceleration to prevent blank window on some systems
electron_1.app.disableHardwareAcceleration();
electron_1.app.commandLine.appendSwitch('disable-gpu');
electron_1.app.commandLine.appendSwitch('disable-gpu-sandbox');
electron_1.app.commandLine.appendSwitch('no-sandbox');
electron_1.app.commandLine.appendSwitch('disable-software-rasterizer');
electron_1.app.commandLine.appendSwitch('disable-dev-shm-usage');
electron_1.app.commandLine.appendSwitch('ignore-gpu-blocklist');
electron_1.app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
electron_1.app.commandLine.appendSwitch('disable-back-forward-cache');
electron_1.app.commandLine.appendSwitch('load-extension-opacity-chance=0');
electron_1.app.commandLine.appendSwitch('enable-webgl');
electron_1.app.commandLine.appendSwitch('enable-webgl2');
// Disable DevTools at Chromium level
electron_1.app.commandLine.appendSwitch('disable-dev-tools');
electron_1.app.commandLine.appendSwitch('disable-devtools');
var __dirname = (0, path_1.dirname)((0, url_1.fileURLToPath)(new URL('.', import.meta.url)));

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
var SIDECAR_AUTH_TOKEN = 'dlp_secure_token_2024';
var SIDECAR_PIPE_NAME = 'DLP_SecurityMonitor_Pipe_v4';
var VITE_DEV_PORT = parseInt(process.env.VITE_DEV_PORT || '5173', 10);
// Sidecar process handle
var sidecarProcess = null;
var sidecarConnected = false;
var sidecarSocket = null; // Named pipe socket for bidirectional communication
// System-level protection service (simplified - relies on Sidecar)
var SystemProtectionService = /** @class */ (function () {
    function SystemProtectionService() {
        this.screenshotBlocked = false;
        this.printBlocked = false;
        this.clipboardMonitorInterval = null;
        this.screenshotMonitorInterval = null;
        this.recordingMonitorInterval = null;
        // Recording state - track if any recording tool is actively recording
        this.isRecordingActive = false;
        this.recordingStartTime = null;
        this.lastKnownRecordingTool = null;
        // Window focus tracking (for UI display)
        this.lastFocusChangeTime = 0;
        this.focusChangeCount = 0;
        this.FOCUS_CHANGE_THRESHOLD = 10;
        // Removable drive snapshot for USB monitoring
        this.removableDriveSnapshot = new Map();
        this.usbMonitorInterval = null;
        // Store current user's accountId (set via IPC from renderer)
        this.currentAccountId = null;
        // Document viewing state - only log warning events when user is viewing documents
        this.documentViewingActive = false;
        // Screenshot debounce: prevent duplicate audit logs for same event within 2 seconds
        this.lastScreenshotEventTime = 0;
        this.lastScreenshotEventType = '';
        this.SCREENSHOT_DEBOUNCE_MS = 2000;
        // Cache for local IP address
        this.cachedIpAddress = null;
    }
    // ============================================================
    // SIDE CAR MANAGEMENT
    // ============================================================
    // Start the Security Monitor Sidecar process
    SystemProtectionService.prototype.startSidecar = function () {
        var _this = this;
        var _a, _b;
        if (sidecarProcess) {
            console.log('[DLP] Sidecar already running');
            return true;
        }
        // Find the sidecar executable - check both electron/bin and Release folder
        var possiblePaths = [
            (0, path_1.join)(__dirname, '..', 'electron', 'bin', 'SecurityMonitor.exe'),
            (0, path_1.join)(__dirname, 'bin', 'SecurityMonitor.exe'),
            // Primary location: Release build folder (updated after each compile)
            'D:\\Code\\Test\\FYP\\sidecar\\SecurityMonitor\\bin\\Release\\net8.0-windows\\SecurityMonitor.dll',
            // Legacy location
            'D:\\Code\\Test\\FYP\\frontend\\electron\\bin\\SecurityMonitor.exe',
        ];
        var sidecarPath = '';
        for (var _i = 0, possiblePaths_1 = possiblePaths; _i < possiblePaths_1.length; _i++) {
            var p = possiblePaths_1[_i];
            if (fs.existsSync(p)) {
                sidecarPath = p;
                break;
            }
        }
        // Check if file exists
        if (!sidecarPath) {
            console.warn('[DLP] Sidecar not found, searched in:', possiblePaths);
            console.warn('[DLP] Deep monitoring disabled. Run build to compile SecurityMonitor.exe');
            return false;
        }
        try {
            console.log('[DLP] Starting Security Monitor Sidecar...');
            // Start sidecar using dotnet (runs in limited mode without admin)
            // For full admin mode, run: dotnet SecurityMonitor.dll (as Administrator)
            var dllPath = sidecarPath.replace('.exe', '.dll');
            sidecarProcess = (0, child_process_1.spawn)('dotnet', [dllPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false,
                windowsHide: true
            });
            (_a = sidecarProcess.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) {
                var line = data.toString().trim();
                if (line.startsWith('[DLP') || line.startsWith('[')) {
                    console.log(line);
                }
            });
            (_b = sidecarProcess.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (data) {
                console.error('[DLP Sidecar Error]', data.toString());
            });
            sidecarProcess.on('error', function (err) {
                console.error('[DLP] Sidecar error:', err);
                sidecarConnected = false;
            });
            sidecarProcess.on('exit', function (code) {
                console.log('[DLP] Sidecar exited with code:', code);
                sidecarConnected = false;
                sidecarProcess = null;
            });
            // Connect to named pipe (with delay to wait for sidecar to start)
            setTimeout(function () { return _this.connectToSidecar(); }, 3000);
            console.log('[DLP] Sidecar started successfully');
            return true;
        }
        catch (error) {
            console.error('[DLP] Failed to start sidecar:', error);
            return false;
        }
    };
    // Connect to an already-running Sidecar (don't start new one)
    // Call this when SecurityMonitor is running manually in separate window
    SystemProtectionService.prototype.connectToExistingSidecar = function () {
        var _this = this;
        console.log('[DLP] Connecting to existing Sidecar...');
        setTimeout(function () { return _this.connectToSidecar(); }, 500);
    };
    // Connect to Sidecar via Named Pipe
    SystemProtectionService.prototype.connectToSidecar = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var pipePath = "\\\\.\\pipe\\".concat(SIDECAR_PIPE_NAME);
                        var client = net.createConnection(pipePath, function () {
                            console.log('[DLP Pipe] Connected to Sidecar');
                            client.write("".concat(SIDECAR_AUTH_TOKEN, "\n"));
                            // Wait for auth response
                            var authHandler = function (data) {
                                var response = data.toString().trim();
                                if (response === 'AUTH_OK') {
                                    console.log('[DLP Pipe] Authentication successful');
                                    sidecarConnected = true;
                                    sidecarSocket = client; // Save socket reference for commands
                                    client.removeListener('data', authHandler);
                                    _this.startReadingEvents(client);
                                    resolve();
                                }
                                else if (response === 'AUTH_FAILED') {
                                    console.error('[DLP Pipe] Authentication failed!');
                                    client.end();
                                    resolve();
                                }
                            };
                            client.on('data', authHandler);
                        });
                        client.on('error', function (err) {
                            console.warn('[DLP Pipe] Connection failed:', err.message);
                            resolve();
                        });
                        client.setTimeout(5000, function () {
                            client.destroy();
                            resolve();
                        });
                    })];
            });
        });
    };
    // Start reading events from Sidecar
    SystemProtectionService.prototype.startReadingEvents = function (client) {
        var _this = this;
        var buffer = '';
        client.on('data', function (data) {
            buffer += data.toString();
            // Process complete JSON lines
            var lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                if (line.trim()) {
                    _this.handleSidecarEvent(line);
                }
            }
        });
        client.on('close', function () {
            console.log('[DLP Pipe] Connection closed');
            sidecarConnected = false;
            sidecarSocket = null;
            // Auto-reconnect after 1 second
            console.log('[DLP Pipe] Scheduling reconnect in 1 second...');
            setTimeout(function () { return _this.connectToSidecar(); }, 1000);
        });
        client.on('error', function (err) {
            console.warn('[DLP Pipe] Connection error:', err.message);
        });
    };
    // Handle events from Sidecar
    SystemProtectionService.prototype.handleSidecarEvent = function (eventData) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        try {
            // Parse event - Sidecar sends as "EVENT:{json}" or just "{json}"
            var eventJson = eventData;
            if (eventData.startsWith('EVENT:')) {
                eventJson = eventData.substring(6);
            }
            var rawEvent = JSON.parse(eventJson);
            // Normalize: Sidecar uses PascalCase (Type, Severity), Electron expects camelCase
            var event_1 = {
                type: rawEvent.Type || rawEvent.type,
                severity: rawEvent.Severity || rawEvent.severity,
                details: rawEvent.Details || rawEvent.details,
                timestamp: rawEvent.Timestamp || rawEvent.timestamp
            };
            console.log('[DLP Sidecar] Parsed event:', JSON.stringify(event_1));
            // Only log to console in debug mode, not for every event to reduce noise
            // Real security events will be logged when sent to backend
            if (event_1.severity === 'HIGH') {
                console.warn('[DLP Event]', event_1.type, '[' + event_1.severity + ']', event_1.details);
            }
            // Forward to renderer for real-time UI update
            electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                var _a, _b, _c, _d;
                if (!win.isDestroyed()) {
                    win.webContents.send('security-alert', event_1);
                    // Also forward critical events as screenshot-blocked to lock DRMViewer UI
                    // This ensures DRMViewer shows "Content blocked" for recording/screenshot events
                    var isCriticalEvent = ((_a = event_1.type) === null || _a === void 0 ? void 0 : _a.startsWith('SCREENSHOT_')) ||
                        ((_b = event_1.type) === null || _b === void 0 ? void 0 : _b.startsWith('RECORDING_TOOL_')) ||
                        ((_c = event_1.type) === null || _c === void 0 ? void 0 : _c.startsWith('RECORDING_')) ||
                        ((_d = event_1.type) === null || _d === void 0 ? void 0 : _d.startsWith('CAPTURE_TOOL_'));
                    if (isCriticalEvent) {
                        win.webContents.send('screenshot-blocked', {
                            eventType: event_1.type,
                            details: event_1.details,
                            timestamp: event_1.timestamp || new Date().toISOString()
                        });
                    }
                }
            });
            // Only audit CRITICAL security events to minimize backend load:
            // 1. SCREENSHOT_* - Actual screenshot attempts blocked by system
            // 2. SCREEN_RECORDING_* - Recording status (start/stop/running)
            // 3. USB_* - Removable storage device insertion/removal/running (data exfiltration risk)
            // 4. WINDOWS_SNIPPING_TOOL - Win+Shift+S screenshot tool
            // 5. WIN_PRTSCN_* - Win+PrintScreen screenshot
            // 6. SNIP_* - Snip & Sketch tools
            // 7. CTRL_SHIFT_S_* - Ctrl+Shift+S screenshot
            // 8. CAPTURE_TOOL_* - Capture tool detected
            // 9. RECORDING_TOOL_* - Recording tool blocked/running
            var shouldAudit = event_1.type === 'SCREENSHOT_BLOCKED' ||
                event_1.type === 'SCREENSHOT_ATTEMPT' ||
                event_1.type === 'SCREEN_CAPTURE_DETECTED' ||
                ((_a = event_1.type) === null || _a === void 0 ? void 0 : _a.startsWith('SCREENSHOT_')) || // All screenshot attempts
                ((_b = event_1.type) === null || _b === void 0 ? void 0 : _b.startsWith('SCREENSHOT_KEY_')) || // PrintScreen key from Sidecar
                ((_c = event_1.type) === null || _c === void 0 ? void 0 : _c.startsWith('SCREEN_RECORDING_')) || // Recording status
                ((_d = event_1.type) === null || _d === void 0 ? void 0 : _d.startsWith('USB_')) || // USB events
                event_1.type === 'WINDOWS_SNIPPING_TOOL' || // Win+Shift+S
                ((_e = event_1.type) === null || _e === void 0 ? void 0 : _e.startsWith('WIN_PRTSCN_')) || // Win+PrintScreen
                ((_f = event_1.type) === null || _f === void 0 ? void 0 : _f.startsWith('SNIP_')) || // Snip & Sketch
                ((_g = event_1.type) === null || _g === void 0 ? void 0 : _g.startsWith('CTRL_SHIFT_S_')) || // Ctrl+Shift+S
                ((_h = event_1.type) === null || _h === void 0 ? void 0 : _h.startsWith('CAPTURE_TOOL_')) || // Capture tool detected
                ((_j = event_1.type) === null || _j === void 0 ? void 0 : _j.startsWith('RECORDING_TOOL_')); // Recording tool blocked/running
            console.log('[DLP Sidecar] Event received:', event_1.type, '| shouldAudit:', shouldAudit, '| severity:', event_1.severity);
            if (shouldAudit) {
                var now = Date.now();
                // Debounce: skip if same event type within debounce window
                // This prevents duplicate logs when both Sidecar AND local detection fire
                if ((event_1.type.startsWith('SCREENSHOT_') || event_1.type.startsWith('CAPTURE_') ||
                    event_1.type.startsWith('RECORDING_')) &&
                    now - this.lastScreenshotEventTime < this.SCREENSHOT_DEBOUNCE_MS &&
                    this.lastScreenshotEventType === event_1.type) {
                    console.log('[DLP] Sidecar event debounced (duplicate):', event_1.type);
                    return;
                }
                // Update debounce tracker
                if (event_1.type.startsWith('SCREENSHOT_') || event_1.type.startsWith('CAPTURE_') ||
                    event_1.type.startsWith('RECORDING_')) {
                    this.lastScreenshotEventTime = now;
                    this.lastScreenshotEventType = event_1.type;
                }
                var result = event_1.severity === 'HIGH' ? 'FAILURE' :
                    event_1.severity === 'MEDIUM' ? 'WARNING' : 'WARNING';
                console.log('[DLP Sidecar] Sending audit event:', event_1.type, '| result:', result);
                void this.sendEndpointEventToBackend(event_1.type, 'DRM', result, event_1.details);
                // IMMEDIATELY block USB storage device on INSERTED event
                // Check both USB_INSERTED and USB_STORAGE_DETECTED (from Sidecar)
                if ((event_1.type === 'USB_INSERTED' || event_1.type === 'USB_STORAGE_DETECTED') && sidecarConnected) {
                    console.log('[DLP] USB storage detected - sending BLOCK command to Sidecar');
                    void this.sendCommandToSidecar('SET_USB_DISABLED');
                }
            }
        }
        catch (_k) {
            // Not JSON, might be a command response or pipe noise - only log if it's important
            if (eventData.includes('AUTH') || eventData.includes('ERROR')) {
                console.log('[DLP Sidecar]', eventData);
            }
        }
    };
    // Send command to Sidecar via named pipe
    SystemProtectionService.prototype.sendCommandToSidecar = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var socket;
            return __generator(this, function (_a) {
                socket = sidecarSocket;
                if (!sidecarConnected || !socket) {
                    console.warn('[DLP Pipe] Sidecar not connected');
                    return [2 /*return*/, 'NOT_CONNECTED'];
                }
                return [2 /*return*/, new Promise(function (resolve) {
                        try {
                            var responseHandler_1 = null;
                            var timeoutId_1 = setTimeout(function () {
                                socket.removeListener('data', responseHandler_1);
                                resolve('TIMEOUT');
                            }, 5000);
                            responseHandler_1 = function (data) {
                                var response = data.toString().trim();
                                // Skip event messages, only process command responses
                                if (!response.startsWith('EVENT:')) {
                                    clearTimeout(timeoutId_1);
                                    socket.removeListener('data', responseHandler_1);
                                    console.log('[DLP Pipe] Command response:', response);
                                    resolve(response);
                                }
                            };
                            socket.on('data', responseHandler_1);
                            socket.write(SIDECAR_AUTH_TOKEN + '\n');
                            socket.write(command + '\n');
                            console.log('[DLP Pipe] Sent command:', command);
                        }
                        catch (error) {
                            console.error('[DLP Pipe] Command failed:', error);
                            resolve('ERROR');
                        }
                    })];
            });
        });
    };
    // Enable content protection on DLP windows
    SystemProtectionService.prototype.enableContentProtection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendCommandToSidecar('ENABLE_PROTECTION')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.includes('ENABLED')];
                }
            });
        });
    };
    // Disable content protection on DLP windows
    SystemProtectionService.prototype.disableContentProtection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendCommandToSidecar('DISABLE_PROTECTION')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.includes('DISABLED')];
                }
            });
        });
    };
    // Get content protection status
    SystemProtectionService.prototype.getProtectionStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendCommandToSidecar('GET_PROTECTION_STATUS')];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // Stop Sidecar
    SystemProtectionService.prototype.stopSidecar = function () {
        if (sidecarSocket) {
            sidecarSocket.end();
            sidecarSocket = null;
        }
        if (sidecarProcess) {
            sidecarProcess.kill();
            sidecarProcess = null;
        }
        sidecarConnected = false;
        console.log('[DLP] Sidecar stopped');
    };
    // Get local IP address (non-loopback, non-docker) - public method for IPC
    // IMPORTANT: Filter by adapter NAME, not IP range (192.168.x.x can be real LAN)
    SystemProtectionService.prototype.getLocalIpAddress = function () {
        if (this.cachedIpAddress) {
            return this.cachedIpAddress;
        }
        try {
            var interfaces = os_1.default.networkInterfaces();
            // Virtual adapter name patterns to EXCLUDE
            // These indicate Docker, WSL, Hyper-V, VirtualBox, VMware internal networks
            var virtualAdapterPatterns = [
                'docker', 'wsl', 'hyper-v', 'virtual', 'vEthernet', 'VMware', 'vbox',
                'container', 'nat', 'loopback', 'loop-back'
            ];
            // Real adapter name patterns to PREFER
            // These indicate real physical/virtual LAN adapters
            var realAdapterPatterns = [
                'ethernet', 'wifi', 'wi-fi', 'wlan', 'lan', 'realtek', 'intel', 'broadcom',
                ' atheros', 'media', 'cisco', 'usb', 'local area connection'
            ];
            var bestMatch = null;
            var _loop_1 = function (name_1) {
                var lowerName = name_1.toLowerCase();
                // Check if this is a virtual adapter
                var isVirtual = virtualAdapterPatterns.some(function (pattern) { return lowerName.includes(pattern); });
                // Check if this is a real adapter
                var isReal = realAdapterPatterns.some(function (pattern) { return lowerName.includes(pattern); });
                var iface = interfaces[name_1];
                if (!iface)
                    return "continue";
                for (var _b = 0, iface_1 = iface; _b < iface_1.length; _b++) {
                    var alias = iface_1[_b];
                    if (alias.family === 'IPv4' && !alias.internal) {
                        var addr = alias.address;
                        // SKIP vEthernet adapters (these are Docker/Hyper-V internal networks)
                        // Even if they have IP like 172.x.x.x or 192.168.x.x
                        if (lowerName.includes('vethernet')) {
                            console.log('[DLP] Skipping vEthernet adapter:', name_1, addr);
                            continue;
                        }
                        // Prefer real adapters with any IP (even 192.168.x.x)
                        if (isReal) {
                            if (!bestMatch || !bestMatch.isReal) {
                                bestMatch = { addr: addr, name: name_1, isReal: true };
                            }
                        }
                        // Also consider non-virtual adapters without strong "real" signal
                        // But only if we haven't found a real adapter yet
                        if (!isVirtual && !(bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.isReal)) {
                            if (!bestMatch) {
                                bestMatch = { addr: addr, name: name_1, isReal: false };
                            }
                        }
                    }
                }
            };
            for (var _i = 0, _a = Object.keys(interfaces); _i < _a.length; _i++) {
                var name_1 = _a[_i];
                _loop_1(name_1);
            }
            if (bestMatch) {
                this.cachedIpAddress = bestMatch.addr;
                console.log('[DLP] Found local IP:', bestMatch.addr, 'via adapter:', bestMatch.name, '(real:', bestMatch.isReal, ')');
            }
            else {
                this.cachedIpAddress = '127.0.0.1';
                console.warn('[DLP] No valid local IP found, using localhost');
            }
        }
        catch (error) {
            console.warn('[DLP] Failed to get local IP:', error);
            this.cachedIpAddress = '127.0.0.1';
        }
        return this.cachedIpAddress;
    };
    // Block screenshot shortcuts/tools
    SystemProtectionService.prototype.blockScreenshotTools = function () {
        var _this = this;
        if (this.screenshotBlocked)
            return;
        this.screenshotBlocked = true;
        // Windows: register global shortcuts to intercept and BLOCK
        try {
            // === PRIMARY SCREENSHOT KEYS ===
            // Block PrintScreen key - most common screenshot method
            electron_1.globalShortcut.register('PrintScreen', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'PrintScreen pressed - SCREENSHOT BLOCKED');
            });
            // Block PrintScreen with modifiers
            electron_1.globalShortcut.register('Alt+PrintScreen', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_ALT_PRESSED', 'Alt+PrintScreen pressed - SCREENSHOT BLOCKED');
            });
            electron_1.globalShortcut.register('Shift+PrintScreen', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_SHIFT_PRESSED', 'Shift+PrintScreen pressed - SCREENSHOT BLOCKED');
            });
            // === WINDOWS BUILT-IN SCREENSHOT SHORTCUTS ===
            // Win+Shift+S - Windows 10/11 built-in screenshot (Screen Sketch)
            electron_1.globalShortcut.register('Super+Shift+S', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_WIN_SHARP_S', 'Win+Shift+S pressed - SCREENSHOT BLOCKED');
            });
            // Win+PrintScreen - capture entire screen to file
            electron_1.globalShortcut.register('Super+PrintScreen', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_WIN_PRTSC', 'Win+PrintScreen pressed - SCREENSHOT BLOCKED');
            });
            // Win+Alt+PrintScreen - capture current window
            electron_1.globalShortcut.register('Super+Alt+PrintScreen', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_WIN_ALT_PRTSC', 'Win+Alt+PrintScreen pressed - SCREENSHOT BLOCKED');
            });
            // Win+Ctrl+Shift+S - Alternative Screen Sketch shortcut
            electron_1.globalShortcut.register('Super+CommandOrControl+Shift+S', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_WIN_CTRL_SHIFT_S', 'Win+Ctrl+Shift+S pressed - SCREENSHOT BLOCKED');
            });
            // === THIRD-PARTY TOOL SHORTCUTS ===
            // Ctrl+Shift+S - common in many screenshot tools
            electron_1.globalShortcut.register('CommandOrControl+Shift+S', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Shift+S pressed - SCREENSHOT BLOCKED');
            });
            // Ctrl+Shift+C - Lightshot default
            electron_1.globalShortcut.register('CommandOrControl+Shift+C', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Shift+C pressed - SCREENSHOT BLOCKED');
            });
            // Ctrl+Alt+A - QQ Screenshot (common in Chinese keyboards)
            electron_1.globalShortcut.register('CommandOrControl+Alt+A', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Alt+A pressed - SCREENSHOT BLOCKED');
            });
            // Ctrl+Alt+X - Windows Snipping Tool
            electron_1.globalShortcut.register('CommandOrControl+Alt+X', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Alt+X pressed - SCREENSHOT BLOCKED');
            });
            // Ctrl+Alt+S - Another common screenshot shortcut
            electron_1.globalShortcut.register('CommandOrControl+Alt+S', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_PRESSED', 'Ctrl+Alt+S pressed - SCREENSHOT BLOCKED');
            });
            // Fn+PrintScreen for laptops
            electron_1.globalShortcut.register('Fn+PrintScreen', function () {
                _this.handleBlockedScreenshot('SCREENSHOT_FN_PRTSC', 'Fn+PrintScreen pressed - SCREENSHOT BLOCKED');
            });
        }
        catch (error) {
            console.error('Failed to register screenshot shortcuts:', error);
        }
    };
    // Handle blocked screenshot attempts - sends IPC to renderer
    // Renderer (useSecurityMonitor hook) will send to backend audit log
    // IMPORTANT: Debounce to prevent duplicate audit logs from multiple sources
    SystemProtectionService.prototype.handleBlockedScreenshot = function (eventType, details) {
        try {
            var now = Date.now();
            // Debounce: skip if same event type within debounce window
            if (eventType.startsWith('SCREENSHOT_') || eventType.startsWith('CAPTURE_')) {
                if (now - this.lastScreenshotEventTime < this.SCREENSHOT_DEBOUNCE_MS &&
                    this.lastScreenshotEventType === eventType) {
                    console.log('[DLP] Screenshot event debounced (duplicate):', eventType);
                    return;
                }
                this.lastScreenshotEventTime = now;
                this.lastScreenshotEventType = eventType;
            }
            var timestamp_1 = new Date().toISOString();
            console.log('[DLP] handleBlockedScreenshot called:', eventType, details);
            // Notify renderer process - it will send to backend audit log (for UI lock)
            electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                if (!win.isDestroyed()) {
                    win.webContents.send('screenshot-blocked', {
                        eventType: eventType,
                        details: details,
                        timestamp: timestamp_1
                    });
                }
            });
            // DIRECT: Also send to backend immediately from main process (for audit log)
            void this.sendEndpointEventToBackend('SCREENSHOT_ATTEMPT', 'DRM', 'FAILURE', "[".concat(this.currentAccountId || os_1.default.userInfo().username, "] ").concat(eventType, ": ").concat(details));
            console.warn("[DLP BLOCKED] ".concat(eventType, ": ").concat(details));
        }
        catch (error) {
            console.error('Failed to handle blocked screenshot:', error);
        }
    };
    // Handle screenshot tool detected (when screenshot tool process is running)
    // This is different from handleBlockedScreenshot which is for actual screenshot attempts
    // Here we detect when tools like SnippingTool are running
    // NOTE: Audit log is sent HERE from main process (sendEndpointEventToBackend)
    // DRMViewer receives IPC and locks UI, but does NOT send duplicate audit log
    SystemProtectionService.prototype.handleScreenshotToolDetected = function (toolName) {
        try {
            var timestamp_2 = new Date().toISOString();
            // Notify renderer process - it will lock preview for UI protection
            electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                if (!win.isDestroyed()) {
                    win.webContents.send('screenshot-blocked', {
                        eventType: 'SCREENSHOT_TOOL_DETECTED',
                        details: "Screenshot tool detected running: ".concat(toolName),
                        timestamp: timestamp_2
                    });
                }
            });
            // Send audit log from main process only (NOT from DRMViewer to avoid duplicates)
            void this.sendEndpointEventToBackend('SCREENSHOT_TOOL_DETECTED', 'DRM', 'FAILURE', "[".concat(this.currentAccountId || os_1.default.userInfo().username, "] Screenshot tool detected: ").concat(toolName));
            console.log("[DLP Screenshot Tool] Detected: ".concat(toolName, " - Audit logged"));
        }
        catch (error) {
            console.error('Failed to handle screenshot tool detection:', error);
        }
    };
    // Handle recording start detected
    // Sends IPC to renderer, which will send to backend audit log
    // NOTE: Only logs to audit when recording is ACTUALLY detected (consistent with website mode)
    // Tool detection alone (running but not recording) is NOT logged
    SystemProtectionService.prototype.handleRecordingStart = function (toolName) {
        try {
            if (this.isRecordingActive) {
                // Already recording, ignore duplicate detection
                return;
            }
            this.isRecordingActive = true;
            this.recordingStartTime = Date.now();
            // Notify renderer process - it will handle sending to backend audit
            electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                if (!win.isDestroyed()) {
                    win.webContents.send('recording-start', {
                        toolName: toolName,
                        timestamp: new Date().toISOString()
                    });
                }
            });
            // Send to backend via renderer (more reliable than direct from main process)
            void this.sendEndpointEventToBackend('SCREEN_RECORDING_START', 'DRM', 'FAILURE', "[".concat(this.currentAccountId || os_1.default.userInfo().username, "] Recording started: ").concat(toolName));
            console.warn("[DLP RECORDING] Started: ".concat(toolName));
        }
        catch (error) {
            console.error('Failed to handle recording start:', error);
        }
    };
    // Handle recording stop detected
    // NOTE: Recording stop alone is NOT logged (only start is logged, like website mode)
    SystemProtectionService.prototype.handleRecordingStop = function (toolName) {
        try {
            if (!this.isRecordingActive) {
                return;
            }
            this.isRecordingActive = false;
            var duration_1 = this.getRecordingDuration();
            // Notify renderer process - for UI display
            electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                if (!win.isDestroyed()) {
                    win.webContents.send('recording-stop', {
                        toolName: toolName,
                        duration: duration_1,
                        timestamp: new Date().toISOString()
                    });
                }
            });
            // Send to backend for audit log and UEBA analysis
            void this.sendEndpointEventToBackend('SCREEN_RECORDING_STOP', 'DRM', 'WARNING', "[".concat(this.currentAccountId || os_1.default.userInfo().username, "] Recording stopped: ").concat(toolName, " (duration: ").concat(duration_1, ")"));
            console.warn("[DLP RECORDING] Stopped: ".concat(toolName, " (").concat(duration_1, ")"));
            this.recordingStartTime = null;
        }
        catch (error) {
            console.error('Failed to handle recording stop:', error);
        }
    };
    // Log screen recording activity with specific event type
    // Only sends events to backend when user is actively viewing documents
    // Severity: HIGH for screenshot attempts, WARNING for other suspicious activities
    SystemProtectionService.prototype.logScreenRecordingActivity = function (eventType, details) {
        try {
            var logPath = (0, path_1.join)(electron_1.app.getPath('userData'), 'security.log');
            var logEntry = "[".concat(new Date().toISOString(), "] [").concat(eventType, "] ").concat(details, "\n");
            fs.appendFileSync(logPath, logEntry);
            // Send to renderer process - it will send to backend audit log
            electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                if (!win.isDestroyed()) {
                    win.webContents.send('suspicious-activity', "[".concat(eventType, "] ").concat(details));
                }
            });
        }
        catch (error) {
            console.error('Failed to log screen recording activity:', error);
        }
    };
    // Log screen recording tool detection activity (for internal monitoring only)
    // This is called when screenshot/recording tools are detected running
    // It does NOT send to backend audit log - just internal logging for debugging
    SystemProtectionService.prototype.logToolDetection = function (eventType, details) {
        try {
            // Only log to console for debugging (optional)
            // NOT sent to backend to avoid flooding audit logs with tool detection
            console.log('[DLP Tool Detection]', eventType, details);
        }
        catch (error) {
            console.error('Failed to log tool detection:', error);
        }
    };
    // Monitor clipboard for image content (screenshot detection) - KEEP THIS
    // This doesn't require admin privileges, so it's handled by Electron
    SystemProtectionService.prototype.monitorClipboard = function () {
        var _this = this;
        if (this.clipboardMonitorInterval)
            return;
        var lastClipboardHash = 0;
        var lastClipboardImageHash = 0;
        // Simple hash function for clipboard content
        var simpleHash = function (text) {
            var hash = 0;
            for (var i = 0; i < text.length; i++) {
                var char = text.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash;
        };
        lastClipboardHash = simpleHash(electron_1.clipboard.readText());
        // Poll clipboard every 500ms for faster detection
        this.clipboardMonitorInterval = setInterval(function () {
            try {
                // Check for text changes
                var currentText = electron_1.clipboard.readText();
                var currentHash = simpleHash(currentText);
                if (currentHash !== lastClipboardHash) {
                    lastClipboardHash = currentHash;
                    if (currentText.length > 100) {
                        _this.logScreenRecordingActivity('LARGE_CLIPBOARD_COPY', "Large text copied to clipboard (".concat(currentText.length, " chars)"));
                    }
                }
                // Check for image in clipboard (screenshot detection)
                var image = electron_1.clipboard.readImage();
                if (!image.isEmpty()) {
                    var imageHash = simpleHash(image.toDataURL().substring(0, 1000));
                    if (imageHash !== lastClipboardImageHash) {
                        lastClipboardImageHash = imageHash;
                        _this.handleBlockedScreenshot('SCREENSHOT_CLIPBOARD_IMAGE', 'Screenshot detected in clipboard - IMAGE BLOCKED');
                    }
                }
            }
            catch (error) {
                // Ignore clipboard read errors
            }
        }, 2000);
    };
    // Monitor window focus changes - for tracking switching behavior
    SystemProtectionService.prototype.monitorWindowFocus = function (window) {
        var _this = this;
        if (!window)
            return;
        // Track focus loss (user switching away)
        window.on('blur', function () {
            var now = Date.now();
            _this.focusChangeCount++;
            _this.lastFocusChangeTime = now;
            // Reset counter every minute
            if (now - _this.lastFocusChangeTime > 60000) {
                _this.focusChangeCount = 1;
            }
            _this.logWindowFocusChange(true, "Window lost focus (change #".concat(_this.focusChangeCount, "/min)"));
            // Only alert if too many focus changes in short time
            if (_this.focusChangeCount > _this.FOCUS_CHANGE_THRESHOLD) {
                _this.logScreenRecordingActivity('RAPID_WINDOW_SWITCHING', "Unusual rapid window switching detected: ".concat(_this.focusChangeCount, " switches in less than a minute"));
            }
        });
        // Track focus gain
        window.on('focus', function () {
            _this.logWindowFocusChange(false, 'Window gained focus');
        });
    };
    // Record suspicious activity - send to renderer for UI display
    // NOTE: Audit logging is handled by main process ONLY for significant events
    // Window focus changes are NOT sent to audit (too frequent, not real security threats)
    // Only real screenshot/recording attempts are logged to audit (via handleBlockedScreenshot, handleScreenshotToolDetected, handleRecordingStart)
    SystemProtectionService.prototype.logSuspiciousActivity = function (activity) {
        try {
            // Send event to renderer process - for UI display only, NOT for audit logging
            electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                if (!win.isDestroyed()) {
                    win.webContents.send('suspicious-activity', activity);
                }
            });
            // DO NOT send focus/window events to audit - they're too frequent and not real security threats
            // Real screenshot/recording attempts are already logged via handleBlockedScreenshot, handleScreenshotToolDetected, handleRecordingStart
            console.debug("[DLP Suspicious] ".concat(activity));
        }
        catch (error) {
            console.error('Failed to log suspicious activity:', error);
        }
    };
    // Log window focus changes - informational only (NOT sent to backend audit log)
    // Normal window focus changes are benign and should not be recorded
    SystemProtectionService.prototype.logWindowFocusChange = function (isBlur, details) {
        try {
            // Only log to console for debugging - NOT sent to backend
            var eventType = isBlur ? 'WINDOW_BLUR' : 'WINDOW_FOCUS';
            console.debug("[DLP Focus] ".concat(eventType, ": ").concat(details));
        }
        catch (error) {
            // Non-critical, ignore
        }
    };
    // Log USB insertion/removal - send to renderer
    SystemProtectionService.prototype.logUsbEvent = function (eventType, deviceId, volumeLabel) {
        try {
            var details_1 = "USB ".concat(eventType.toLowerCase(), ": ").concat(deviceId, " (").concat(volumeLabel || 'NO_LABEL', ")");
            // Send to renderer - it will send to backend audit log
            electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                if (!win.isDestroyed()) {
                    win.webContents.send('suspicious-activity', "[USB_".concat(eventType, "] ").concat(details_1));
                }
            });
            console.warn("[DLP USB] ".concat(eventType, ": ").concat(deviceId, " (").concat(volumeLabel || 'NO_LABEL', ")"));
        }
        catch (error) {
            console.error('Failed to log USB event:', error);
        }
    };
    // Get recording duration string
    SystemProtectionService.prototype.getRecordingDuration = function () {
        if (!this.recordingStartTime)
            return 'unknown';
        var seconds = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        if (seconds < 60)
            return "".concat(seconds, "s");
        var minutes = Math.floor(seconds / 60);
        return "".concat(minutes, "m ").concat(seconds % 60, "s");
    };
    SystemProtectionService.prototype.monitorRecordingStatus = function () {
        var _this = this;
        if (this.recordingMonitorInterval)
            return;
        this.recordingMonitorInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var isRecording;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.checkRecordingStatus()];
                    case 1:
                        isRecording = _a.sent();
                        if (isRecording && !this.isRecordingActive) {
                            // Recording just started
                            this.handleRecordingStart(this.lastKnownRecordingTool || 'Unknown Tool');
                        }
                        else if (!isRecording && this.isRecordingActive) {
                            // Recording just stopped
                            this.handleRecordingStop(this.lastKnownRecordingTool || 'Unknown Tool');
                        }
                        return [2 /*return*/];
                }
            });
        }); }, 1500); // Check every 1.5 seconds for faster recording detection
    };
    // Check if recording is active by looking for recording-specific processes and window capture (Windows only)
    SystemProtectionService.prototype.checkRecordingStatus = function () {
        var _this = this;
        return new Promise(function (resolve) {
            var foundRecording = false;
            var checkComplete = function () { return resolve(foundRecording); };
            // Extended window title indicators for various recording tools
            // Each tool has specific window title patterns when recording
            var RECORDING_WINDOW_INDICATORS = {
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
            };
            // Check window titles for all recording tools
            var toolsToCheck = Object.keys(RECORDING_WINDOW_INDICATORS).join(',');
            (0, child_process_1.exec)("powershell -Command \"Get-Process | Where-Object { $_.ProcessName -match '".concat(toolsToCheck.replace(/\s+/g, '|'), "' } | Select-Object ProcessName,MainWindowTitle\""), function (error, stdout) {
                var _a, _b;
                if (!error && stdout && stdout.trim()) {
                    var lines = stdout.split(/\r?\n/).filter(function (l) { return l.trim() && !l.includes('ProcessName'); });
                    var _loop_2 = function (line) {
                        var parts = line.trim().split(/\s{2,}/);
                        if (parts.length < 2)
                            return "continue";
                        var processName = ((_a = parts[0]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                        var windowTitle = ((_b = parts[1]) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                        // Find matching tool
                        for (var _c = 0, _d = Object.entries(RECORDING_WINDOW_INDICATORS); _c < _d.length; _c++) {
                            var _e = _d[_c], tool = _e[0], indicators = _e[1];
                            if (processName.includes(tool.replace('.exe', ''))) {
                                // Check if window title contains any recording indicator
                                var hasIndicator = indicators.some(function (ind) { return windowTitle.includes(ind); });
                                if (hasIndicator) {
                                    _this.lastKnownRecordingTool = tool;
                                    foundRecording = true;
                                    break;
                                }
                            }
                        }
                        if (foundRecording)
                            return "break";
                    };
                    for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                        var line = lines_2[_i];
                        var state_1 = _loop_2(line);
                        if (state_1 === "break")
                            break;
                    }
                }
                checkComplete();
            });
        });
    };
    // Check OBS stats file for active capture status
    // OBS writes stats to a JSON file when recording/capturing
    SystemProtectionService.prototype.checkObsStatsFile = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        // OBS stats file location varies by version
                        var possiblePaths = [
                            path.join(os_1.default.homedir(), 'AppData', 'Roaming', 'obs-studio', 'logs'),
                            path.join(os_1.default.homedir(), 'AppData', 'Roaming', 'obs-studio', 'basic', 'logs'),
                        ];
                        // Try to find most recent OBS log with recording stats
                        var logPath = possiblePaths[1];
                        (0, child_process_1.exec)("powershell -Command \"Get-ChildItem -Path '".concat(logPath.replace(/'/g, "''"), "' -Filter '*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Select-Object FullName\""), function (error, stdout) {
                            if (!error && stdout && stdout.trim()) {
                                var logFile = stdout.trim();
                                // Check last few lines of log for recording activity
                                (0, child_process_1.exec)("powershell -Command \"Get-Content '".concat(logFile.replace(/'/g, "''"), "' -Tail 50 | Select-String -Pattern 'recording|streaming|output active|capture' | Select-Object -Last 1\""), function (e, out) {
                                    if (!e && out && out.toLowerCase().includes('recording') && !out.toLowerCase().includes('stopped')) {
                                        resolve(true);
                                        return;
                                    }
                                    resolve(false);
                                });
                            }
                            else {
                                resolve(false);
                            }
                        });
                    })];
            });
        });
    };
    // Report endpoint monitor event to backend audit trail (best-effort).
    SystemProtectionService.prototype.sendEndpointEventToBackend = function (action, category, result, details) {
        return __awaiter(this, void 0, void 0, function () {
            var candidates, baseUrl, _loop_3, _i, candidates_1, url, state_2, detected, baseUrls, validUrls, lastError, _a, validUrls_1, url, response, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        candidates = [
                            'http://localhost:18080',
                            'http://host.docker.internal:18080'
                        ];
                        baseUrl = '';
                        _loop_3 = function (url) {
                            var controller_1, timeoutId, resp, _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _d.trys.push([0, 2, , 3]);
                                        controller_1 = new AbortController();
                                        timeoutId = setTimeout(function () { return controller_1.abort(); }, 2000);
                                        return [4 /*yield*/, fetch("".concat(url, "/api/agent/endpoint/health"), { signal: controller_1.signal })];
                                    case 1:
                                        resp = _d.sent();
                                        clearTimeout(timeoutId);
                                        if (resp.ok) {
                                            baseUrl = url;
                                            console.log('[DLP] Backend found via fetch:', baseUrl);
                                            return [2 /*return*/, "break"];
                                        }
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _c = _d.sent();
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, candidates_1 = candidates;
                        _b.label = 1;
                    case 1:
                        if (!(_i < candidates_1.length)) return [3 /*break*/, 4];
                        url = candidates_1[_i];
                        return [5 /*yield**/, _loop_3(url)];
                    case 2:
                        state_2 = _b.sent();
                        if (state_2 === "break")
                            return [3 /*break*/, 4];
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        if (!!baseUrl) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.detectBackendUrlViaPowerShell()];
                    case 5:
                        detected = _b.sent();
                        baseUrl = detected || '';
                        _b.label = 6;
                    case 6:
                        if (!baseUrl) {
                            console.error('[DLP] Backend not reachable, event SKIPPED:', action);
                            console.error('[DLP] Tried:', candidates.map(function (u) { return "".concat(u, "/api/agent/endpoint/health"); }));
                            return [2 /*return*/];
                        }
                        console.log('[DLP] Backend URL:', baseUrl);
                        baseUrls = [
                            "".concat(baseUrl, "/api/agent/endpoint/events"),
                            "".concat(baseUrl, "/agent/endpoint/events")
                        ];
                        validUrls = __spreadArray([], new Set(baseUrls), true);
                        console.log('[DLP] Will try endpoint URLs:', validUrls);
                        lastError = null;
                        _a = 0, validUrls_1 = validUrls;
                        _b.label = 7;
                    case 7:
                        if (!(_a < validUrls_1.length)) return [3 /*break*/, 12];
                        url = validUrls_1[_a];
                        _b.label = 8;
                    case 8:
                        _b.trys.push([8, 10, , 11]);
                        console.log('[DLP] Sending endpoint event to:', url);
                        console.log('[DLP] Event details:', { action: action, category: category, result: result, accountId: this.currentAccountId });
                        console.log('[DLP] Sending endpoint event with accountId:', this.currentAccountId, '| action:', action);
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json'
                                },
                                body: JSON.stringify({
                                    action: action,
                                    category: category,
                                    result: result,
                                    details: details,
                                    username: os_1.default.userInfo().username,
                                    hostName: os_1.default.hostname(),
                                    ipAddress: this.getLocalIpAddress(),
                                    accountId: this.currentAccountId || null
                                })
                            })];
                    case 9:
                        response = _b.sent();
                        console.log('[DLP] Endpoint event response:', response.status, '| action:', action, '| accountId sent:', this.currentAccountId);
                        if (response.ok) {
                            console.log('[DLP] Endpoint event sent successfully, status:', response.status, 'action:', action);
                            return [2 /*return*/];
                        }
                        else {
                            console.warn('[DLP] Endpoint event response not OK:', response.status, response.statusText);
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        error_1 = _b.sent();
                        lastError = error_1;
                        console.warn('[DLP] Failed to send endpoint event to', url, ':', error_1);
                        return [3 /*break*/, 11];
                    case 11:
                        _a++;
                        return [3 /*break*/, 7];
                    case 12:
                        console.error('[DLP] ALL endpoint URLs failed. Last error:', lastError);
                        return [2 /*return*/];
                }
            });
        });
    };
    // Detect backend URL using PowerShell (more reliable in Electron context)
    SystemProtectionService.prototype.detectBackendUrlViaPowerShell = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        // Backend is at port 18080, health check endpoint is at /api/agent/endpoint/health
                        var dockerUrls = [
                            'http://host.docker.internal:18080',
                            'http://localhost:18080'
                        ];
                        // Use PowerShell to test URLs (bypasses Electron's network restrictions)
                        var testUrls = dockerUrls.map(function (url) {
                            return "try { $r = Invoke-WebRequest -Uri '".concat(url, "/api/agent/endpoint/health' -Method GET -TimeoutSec 2 -ErrorAction Stop; Write-Output $r.StatusCode } catch { Write-Output 'FAIL' }");
                        }).join('; ');
                        var psScript = testUrls;
                        (0, child_process_1.exec)("powershell -Command \"".concat(psScript, "\""), function (error, stdout) {
                            if (error) {
                                console.warn('[DLP] PowerShell detection failed:', error.message);
                                resolve(null);
                                return;
                            }
                            var lines = stdout.trim().split('\n').map(function (s) { return s.trim(); });
                            var validUrls = dockerUrls.filter(function (url, i) {
                                var code = lines[i] || '';
                                return code === '200';
                            });
                            if (validUrls.length > 0) {
                                console.log('[DLP] Backend detected via PowerShell:', validUrls[0]);
                                resolve(validUrls[0]);
                            }
                            else {
                                console.warn('[DLP] PowerShell detection found no valid backend');
                                resolve(null);
                            }
                        });
                    })];
            });
        });
    };
    // Set the current logged-in user's accountId (called from renderer via IPC)
    SystemProtectionService.prototype.setCurrentAccountId = function (accountId) {
        this.currentAccountId = accountId;
        console.log('[DLP] Account ID set:', accountId);
    };
    // Get the current logged-in user's accountId
    SystemProtectionService.prototype.getCurrentAccountId = function () {
        console.log('[DLP] getCurrentAccountId() called, returning:', this.currentAccountId);
        return this.currentAccountId;
    };
    // Document viewing state management - only log warning events when actively viewing documents
    SystemProtectionService.prototype.setDocumentViewingActive = function (active) {
        this.documentViewingActive = active;
        console.log('[DLP] Document viewing active:', active);
    };
    SystemProtectionService.prototype.isDocumentViewingActive = function () {
        return this.documentViewingActive;
    };
    SystemProtectionService.prototype.reportUsbEventToBackend = function (eventType, deviceId, volumeLabel, sizeBytes) {
        return __awaiter(this, void 0, void 0, function () {
            var baseUrl, url, currentAccountId, response, data, decided, error_2;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        baseUrl = (process.env.ELECTRON_API_BASE_URL || process.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
                        if (!baseUrl) {
                            // No backend URL configured, skip silently
                            return [2 /*return*/];
                        }
                        url = "".concat(baseUrl, "/agent/usb/events");
                        currentAccountId = ((_b = (_a = global.electronAPI) === null || _a === void 0 ? void 0 : _a.getAccountId) === null || _b === void 0 ? void 0 : _b.call(_a)) || undefined;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    username: os_1.default.userInfo().username,
                                    hostName: os_1.default.hostname(),
                                    deviceId: deviceId,
                                    volumeLabel: volumeLabel || null,
                                    capacityBytes: typeof sizeBytes === 'number' ? sizeBytes : null,
                                    eventType: eventType,
                                    accountId: currentAccountId
                                })
                            })];
                    case 2:
                        response = _d.sent();
                        if (!(response.ok && eventType === 'INSERTED')) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _d.sent();
                        decided = (_c = data === null || data === void 0 ? void 0 : data.data) === null || _c === void 0 ? void 0 : _c.action;
                        if (decided === 'BLOCK_MOUNT') {
                            this.logSuspiciousActivity("USB block policy returned by backend: device=".concat(deviceId, ", volume=").concat(volumeLabel || 'UNKNOWN'));
                        }
                        _d.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_2 = _d.sent();
                        console.warn('Failed to report USB event to backend:', error_2);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    // ============================================================
    // DEPRECATED METHODS - Now handled by C# Sidecar
    // These are stubs for backwards compatibility
    // ============================================================
    SystemProtectionService.prototype.monitorScreenshotProcesses = function () {
        console.log('[DLP] monitorScreenshotProcesses() - Now handled by C# Sidecar');
    };
    SystemProtectionService.prototype.monitorBrowserScreenCapture = function () {
        console.log('[DLP] monitorBrowserScreenCapture() - Now handled by C# Sidecar');
    };
    SystemProtectionService.prototype.monitorUsbDevices = function () {
        console.log('[DLP] monitorUsbDevices() - Now handled by C# Sidecar');
    };
    SystemProtectionService.prototype.monitorWindowsEventLog = function () {
        console.log('[DLP] monitorWindowsEventLog() - Now handled by C# Sidecar');
    };
    SystemProtectionService.prototype.startProcessCpuMonitoring = function () {
        console.log('[DLP] startProcessCpuMonitoring() - Now handled by C# Sidecar');
    };
    SystemProtectionService.prototype.blockPrinting = function () {
        console.log('[DLP] blockPrinting() - Feature not yet implemented in Sidecar');
    };
    SystemProtectionService.prototype.parseWindowsRemovableDrives = function (raw) {
        return new Map();
    };
    SystemProtectionService.prototype.getProcessPath = function (processName) {
        return Promise.resolve(null);
    };
    SystemProtectionService.prototype.calculateFileHash = function (filePath) {
        return Promise.resolve(null);
    };
    SystemProtectionService.prototype.verifyProcessByHash = function (processName) {
        return Promise.resolve({ verified: false, hash: null, path: null });
    };
    // Cleanup - simplified for Sidecar model
    SystemProtectionService.prototype.cleanup = function () {
        console.log('[DLP] cleanup() - Now handled by stopSidecar()');
        electron_1.globalShortcut.unregisterAll();
    };
    return SystemProtectionService;
}());
var mainWindow = null;
var protectionService = new SystemProtectionService();
function createWindow() {
    var _this = this;
    // Create browser window with software rendering
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: (0, path_1.join)(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            devTools: false, // Always block DevTools for security
            webgl: false,
            enableWebSQL: false
        },
        titleBarStyle: 'default',
        autoHideMenuBar: true, // Hide default menu bar
        backgroundColor: '#1a1a2e' // Set background color to prevent white flash
    });
    mainWindow.setContentProtection(true);
    // Block DevTools from opening (security hardening - unconditional)
    // This prevents users from opening DevTools via keyboard shortcuts, menu, or any method
    mainWindow.webContents.on('devtools-opened', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.closeDevTools();
    });
    // Block DevTools focus attempts
    mainWindow.webContents.on('devtools-focused', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.closeDevTools();
    });
    // Block DevTools via session permissions
    mainWindow.webContents.session.setPermissionRequestHandler(function (_webContents, _permission, callback) {
        if (_permission === 'openDevTools') {
            callback(false);
        }
        else {
            callback(true);
        }
    });
    // Development: load Vite dev server
    var isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    if (isDev) {
        // Dev mode: load Vite dev server (HMR)
        console.log(`[DLP] Loading Vite dev server: http://127.0.0.1:${VITE_DEV_PORT}`);
        mainWindow.loadURL(`http://127.0.0.1:${VITE_DEV_PORT}`)
            .then(function () {
            console.log('[DLP] Vite dev server loaded successfully');
        })
            .catch(function (error) {
            console.error('[DLP] Failed to load Vite dev server:', error);
        });
        // NOTE: DevTools is blocked for security - keyboard shortcuts and menu are intercepted
        // For debugging, use backend logs and Electron's external log files instead
        // Add loading progress tracking
        mainWindow.webContents.on('did-finish-load', function () {
            console.log('[DLP] Page finished loading');
        });
        mainWindow.webContents.on('did-fail-load', function (_event, errorCode, _errorDescription) {
            console.error("[DLP] Failed to load with error code: ".concat(errorCode));
            if (errorCode === -106) {
                // Server not started yet
                console.log('Waiting for Vite dev server to start...');
                setTimeout(function () {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.loadURL(`http://127.0.0.1:${VITE_DEV_PORT}`);
                    }
                }, 2000);
            }
        });
        mainWindow.webContents.on('crashed', function () {
            console.error('[DLP] Renderer process crashed!');
        });
    }
    else {
        // Production: load built HTML
        mainWindow.loadFile((0, path_1.join)(__dirname, '../dist/index.html'));
    }
    // Notify renderer when window is maximized/restored so preview can re-scale
    mainWindow.on('maximize', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('resize-preview');
    });
    mainWindow.on('unmaximize', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('resize-preview');
    });
    // Optional: keep preview window at A4 aspect ratio (1.414) - uncomment if desired:
    // mainWindow.setAspectRatio(1.414)
    // Window close event
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
    // Prevent new window creation (security hardening)
    mainWindow.webContents.setWindowOpenHandler(function () {
        return { action: 'deny' };
    });
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
    protectionService.connectToExistingSidecar();
    // ============================================================
    // REMAINING ELECTRON-ONLY PROTECTIONS
    // ============================================================
    // Screenshot shortcut blocking (handled by Electron globalShortcut)
    protectionService.blockScreenshotTools();
    // Clipboard monitoring for screenshot images
    protectionService.monitorClipboard();
    // Window focus monitoring (for UI display only)
    protectionService.monitorWindowFocus(mainWindow);
    // Enable content protection on DLP windows (black screen in screenshots)
    // This runs after Sidecar is connected and ready
    setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
        var enabled;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, protectionService.enableContentProtection()];
                case 1:
                    enabled = _a.sent();
                    console.log('[DLP] Content protection:', enabled ? 'ENABLED' : 'DISABLED (Sidecar not connected)');
                    return [2 /*return*/];
            }
        });
    }); }, 2000);
    // Fourth Layer: Anti-Tampering - Process Protection
    // Prevent users from forcibly terminating the DLP rendering program
    // If DLP service malfunctions, sensitive files are forcibly closed
    setupAntiTampering(mainWindow);
}
// App ready
electron_1.app.whenReady().then(function () {
    // Remove default application menu completely
    electron_1.Menu.setApplicationMenu(null);
    // Block DevTools for all windows immediately
    electron_1.app.on('web-contents-created', function (_event, contents) {
        contents.on('devtools-opened', function () {
            contents.closeDevTools();
        });
    });
    createWindow();
    electron_1.app.on('activate', function () {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// Quit when all windows are closed (Windows only - Electron runs on Windows)
electron_1.app.on('window-all-closed', function () {
    protectionService.stopSidecar();
    electron_1.app.quit();
});
// Fourth Layer: Anti-Tampering Mechanism
function setupAntiTampering(window) {
    if (!window)
        return;
    // Monitor window close attempts - prevent unauthorized closure
    window.on('close', function (_event) {
        // In production, check if sensitive documents are open
        // For now, allow normal closure but log it
        console.log('Window close attempted - checking for open sensitive documents');
        // If sensitive documents are open, prevent closure:
        // event.preventDefault()
        // window.webContents.send('prevent-close-warning')
    });
    // Monitor process termination attempts
    process.on('SIGTERM', function () {
        console.log('SIGTERM received - DLP service termination attempt detected');
        // Send warning to renderer
        window === null || window === void 0 ? void 0 : window.webContents.send('suspicious-activity', 'Process termination attempt detected');
    });
    process.on('SIGINT', function () {
        console.log('SIGINT received - DLP service interruption attempt detected');
        window === null || window === void 0 ? void 0 : window.webContents.send('suspicious-activity', 'Process interruption attempt detected');
    });
    // Monitor for debugger attachment (potential tampering)
    if (process.platform === 'win32') {
        // Windows: Check for debugger attachment
        setInterval(function () {
            try {
                var isDebuggerPresent = process.debugPort !== undefined && process.debugPort !== 0;
                if (isDebuggerPresent) {
                    console.warn('Debugger attachment detected - potential tampering');
                    window === null || window === void 0 ? void 0 : window.webContents.send('suspicious-activity', 'Debugger attachment detected');
                }
            }
            catch (e) {
                // Ignore errors
            }
        }, 5000);
    }
    // Prevent new window creation (security hardening) - already set above
    // window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    // Monitor for unauthorized process injection
    if (process.platform === 'win32') {
        setInterval(function () {
            (0, child_process_1.exec)('wmic process where "ParentProcessId=' + process.pid + '" get ProcessId,Name', function (error, stdout) {
                if (!error && stdout) {
                    // Check for suspicious child processes
                    var suspiciousProcesses = ['ollydbg', 'x64dbg', 'ida', 'ghidra', 'cheatengine'];
                    var lowerStdout_1 = stdout.toLowerCase();
                    suspiciousProcesses.forEach(function (proc) {
                        if (lowerStdout_1.includes(proc)) {
                            console.warn("Suspicious process detected: ".concat(proc));
                            window === null || window === void 0 ? void 0 : window.webContents.send('suspicious-activity', "Suspicious process detected: ".concat(proc));
                        }
                    });
                }
            });
        }, 10000); // Check every 10 seconds
    }
}
// Cleanup before app quits
electron_1.app.on('will-quit', function () {
    protectionService.stopSidecar();
    electron_1.globalShortcut.unregisterAll();
});
// IPC handlers
electron_1.ipcMain.handle('get-app-version', function () {
    return electron_1.app.getVersion();
});
electron_1.ipcMain.handle('get-user-data-path', function () {
    return electron_1.app.getPath('userData');
});
// File system operation (if needed)
electron_1.ipcMain.handle('read-file', function (_event, filePath) { return __awaiter(void 0, void 0, void 0, function () {
    var data, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, fs.promises.readFile(filePath, 'utf-8')];
            case 1:
                data = _a.sent();
                return [2 /*return*/, { success: true, data: data }];
            case 2:
                error_3 = _a.sent();
                return [2 /*return*/, { success: false, error: error_3.message }];
            case 3: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('is-content-protected', function () {
    if (!mainWindow)
        return false;
    var windowApi = mainWindow;
    return windowApi.isContentProtected ? windowApi.isContentProtected() : false;
});
electron_1.ipcMain.handle('set-content-protection', function (_event, enabled) {
    if (!mainWindow)
        return false;
    mainWindow.setContentProtection(enabled);
    var windowApi = mainWindow;
    return windowApi.isContentProtected ? windowApi.isContentProtected() : false;
});
// Account ID management for endpoint events
electron_1.ipcMain.on('set-account-id', function (_event, accountId) {
    console.log('[DLP] IPC set-account-id received:', accountId, '| timestamp:', new Date().toISOString());
    protectionService.setCurrentAccountId(accountId);
    console.log('[DLP] protectionService.currentAccountId is now:', protectionService.getCurrentAccountId());
});
electron_1.ipcMain.handle('get-account-id', function () {
    var accountId = protectionService.getCurrentAccountId();
    console.log('[DLP] IPC get-account-id returning:', accountId);
    return accountId;
});
// Get local IP address for audit logging (non-loopback)
electron_1.ipcMain.handle('get-local-ip-address', function () {
    return protectionService.getLocalIpAddress();
});
// Document viewing state management for conditional security logging
electron_1.ipcMain.on('set-document-viewing', function (_event, active) {
    console.log('[DLP] IPC set-document-viewing received:', active);
    protectionService.setDocumentViewingActive(active);
});
electron_1.ipcMain.handle('is-document-viewing', function () {
    var isActive = protectionService.isDocumentViewingActive();
    console.log('[DLP] IPC is-document-viewing returning:', isActive);
    return isActive;
});
