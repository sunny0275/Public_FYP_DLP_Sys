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
exports.default = DRMViewer;
var react_1 = require("react");
var api_1 = require("../api");
var PDFViewer_1 = require("./PDFViewer");
var electron_1 = require("../utils/electron");
var authStore_1 = require("../store/authStore");
var axios_1 = require("axios");
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
function DRMViewer(_a) {
    var _this = this;
    var _b;
    var documentUrl = _a.documentUrl, documentName = _a.documentName, allowCopy = _a.allowCopy, allowPrint = _a.allowPrint, allowDownload = _a.allowDownload, requiresWatermark = _a.requiresWatermark, watermarkText = _a.watermarkText;
    var viewerRef = (0, react_1.useRef)(null);
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(null), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(false), isFullscreen = _e[0], setIsFullscreen = _e[1];
    var visibilityCheckRef = (0, react_1.useRef)(0);
    var lastVisibilityChangeRef = (0, react_1.useRef)(Date.now());
    var focusIgnoreUntilRef = (0, react_1.useRef)(0);
    var captureResetTimerRef = (0, react_1.useRef)(null);
    var _g = (0, react_1.useState)(null), securityAlertMessage = _g[0], setSecurityAlertMessage = _g[1];
    var _h = (0, react_1.useState)(false), sessionBlocked = _h[0], setSessionBlocked = _h[1];
    var _j = (0, react_1.useState)(true), isAppFocused = _j[0], setIsAppFocused = _j[1];
    var focusLostTimeRef = (0, react_1.useRef)(0);
    /** Short code + server IP from the preview API response — used in footer for consistency. */
    var watermarkCodeRef = (0, react_1.useRef)(undefined);
    var serverIpRef = (0, react_1.useRef)(undefined);
    // Minimum mask duration after focus lost (milliseconds)
    var MIN_MASK_DURATION_MS = 5000;
    // Helper to check if should still show mask based on minimum duration
    var shouldShowMask = (0, react_1.useCallback)(function () {
        if (sessionBlocked)
            return true;
        if (!isAppFocused) {
            var elapsed = Date.now() - focusLostTimeRef.current;
            return elapsed < MIN_MASK_DURATION_MS;
        }
        return false;
    }, [sessionBlocked, isAppFocused]);
    var userAccountId = (_b = (0, authStore_1.useAuthStore)(function (state) { var _a; return (_a = state.user) === null || _a === void 0 ? void 0 : _a.accountId; })) !== null && _b !== void 0 ? _b : 'UNKNOWN';
    var logSecurityEvent = (0, react_1.useCallback)(function (action, result, activity, reason) {
        var details = "[".concat(userAccountId, "] ").concat(activity).concat(reason ? " | reason: ".concat(reason) : '');
        // For Electron mode, send to /agent/endpoint/events with local IP and accountId
        if ((0, electron_1.isElectron)()) {
            var baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:18080/api').replace(/\/$/, '');
            // Determine the correct endpoint URL
            var endpointUrl_1 = baseUrl.includes('/api') ? "".concat(baseUrl, "/agent/endpoint/events") : "".concat(baseUrl, "/api/agent/endpoint/events");
            // Get local IP address for audit logging (non-loopback)
            var getLocalIp = function () { return __awaiter(_this, void 0, void 0, function () {
                var _a;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 3, , 4]);
                            if (!((_b = window.electronAPI) === null || _b === void 0 ? void 0 : _b.getLocalIpAddress)) return [3 /*break*/, 2];
                            return [4 /*yield*/, window.electronAPI.getLocalIpAddress()];
                        case 1: return [2 /*return*/, _c.sent()];
                        case 2: return [3 /*break*/, 4];
                        case 3:
                            _a = _c.sent();
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/, window.location.hostname || 'unknown'];
                    }
                });
            }); };
            // Send event with local IP (non-blocking)
            getLocalIp().then(function (ipAddress) {
                var eventPayload = {
                    action: action,
                    category: 'DRM',
                    result: result,
                    details: details,
                    username: userAccountId,
                    hostName: window.location.hostname || 'unknown',
                    ipAddress: ipAddress, // Use actual local IP instead of Docker container IP
                    accountId: userAccountId
                };
                console.log('[DRMViewer] Sending endpoint event:', endpointUrl_1, eventPayload);
                axios_1.default.post(endpointUrl_1, eventPayload, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }).then(function (response) {
                    console.log('[DRMViewer] Endpoint event sent successfully:', action, response.status);
                }).catch(function (err) {
                    console.error('[DRMViewer] Failed to send endpoint event:', err.message, 'URL:', endpointUrl_1);
                });
            });
        }
        else {
            // Browser mode: Only send via web API (no direct endpoint events)
            // In Electron mode, we already sent to /agent/endpoint/events above
            api_1.apiClient.reportSecurityEvent({
                action: action,
                category: 'DRM',
                result: result,
                details: details,
                accountId: userAccountId
            }).catch(function (err) {
                console.warn('[DRMViewer] Failed to report security event via web API:', err.message);
            });
        }
    }, [userAccountId]);
    (0, react_1.useEffect)(function () {
        // Enhanced keyboard shortcuts interception - apply to entire document
        var handleKeyDown = function (e) {
            // Prevent copy (Ctrl+C, Cmd+C, Ctrl+Insert)
            if (!allowCopy && ((e.ctrlKey || e.metaKey) && e.key === 'c' || (e.ctrlKey && e.key === 'Insert'))) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            // Prevent print (Ctrl+P, Cmd+P) - ALWAYS disabled in preview
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            // Prevent save (Ctrl+S, Cmd+S)
            if (!allowDownload && (e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            var isSwitchTab = e.key === 'Tab' && (e.ctrlKey || e.metaKey);
            if (isSwitchTab) {
                focusIgnoreUntilRef.current = Date.now() + 100;
                return;
            }
            // Prevent PrintScreen, Alt+PrintScreen, and Win+Shift+S/R shortcuts
            if (e.key === 'PrintScreen' ||
                (e.altKey && e.key === 'PrintScreen') ||
                (e.metaKey && e.shiftKey && ['s', 'S', 'r', 'R'].includes(e.key)) ||
                (e.metaKey && e.key === 'r' && e.shiftKey)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                // Try to clear clipboard
                navigator.clipboard.writeText('').catch(function () { });
                return false;
            }
            // Prevent F11 and F12 (DevTools shortcuts)
            if (e.key === 'F11' || e.key === 'F12') {
                e.preventDefault();
                return false;
            }
            // Prevent Ctrl+Shift+I / Cmd+Option+I (Developer Tools)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            // Prevent Ctrl+U (View Source)
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        };
        // Context menu handler - simple and efficient
        var handleContextMenu = function (e) {
            e.preventDefault();
        };
        // Copy handler
        var handleCopy = function (e) {
            var _a;
            if (!allowCopy) {
                e.preventDefault();
                (_a = e.clipboardData) === null || _a === void 0 ? void 0 : _a.setData('text/plain', '');
            }
        };
        // Cut handler
        var handleCut = function (e) {
            var _a;
            if (!allowCopy) {
                e.preventDefault();
                (_a = e.clipboardData) === null || _a === void 0 ? void 0 : _a.setData('text/plain', '');
            }
        };
        // Paste handler
        var handlePaste = function (e) {
            if (!allowCopy) {
                e.preventDefault();
            }
        };
        // Select handler
        var handleSelectStart = function (e) {
            if (!allowCopy) {
                e.preventDefault();
            }
        };
        // Drag handler
        var handleDragStart = function (e) {
            e.preventDefault();
        };
        // Monitor clipboard changes (for screenshot detection)
        var clipboardCheckInterval = null;
        var monitorClipboard = function () {
            // Check clipboard periodically (limited effectiveness)
            clipboardCheckInterval = setInterval(function () {
                if (navigator.clipboard && navigator.clipboard.read) {
                    navigator.clipboard.read().then(function (clipboardItems) {
                        // If clipboard contains image, try to clear it
                        var hasImage = Array.from(clipboardItems).some(function (item) { return item.types.includes('image/png') || item.types.includes('image/jpeg'); });
                        if (hasImage) {
                            // Try to clear clipboard - actual screenshot detection is handled by Electron system-level monitoring
                            navigator.clipboard.writeText('').catch(function () { });
                        }
                    }).catch(function () {
                        // Ignore clipboard read errors
                    });
                }
            }, 3000); // Reduced from 1s to 3s for better performance
        };
        // Window blur - informational only, no penalty. This tracks when user switches apps
        // Normal focus changes are NOT recorded to audit log
        var handleBlur = function () {
            // Record the time when focus was lost - minimum mask duration applies
            focusLostTimeRef.current = Date.now();
            setIsAppFocused(false);
            focusIgnoreUntilRef.current = Date.now() + 100;
        };
        var handleFocus = function () {
            if (Date.now() < focusIgnoreUntilRef.current) {
                return;
            }
            setIsAppFocused(true);
            lastVisibilityChangeRef.current = Date.now();
        };
        // Monitor page visibility changes: split "focus lost" and "app switch".
        // App switch is informational only (not suspicious, no penalty).
        // Normal visibility changes are NOT recorded to audit log
        var handleVisibilityChange = function () {
            visibilityCheckRef.current++;
            var now = Date.now();
            if (document.hidden) {
                // Record the time when visibility was lost - minimum mask duration applies
                focusLostTimeRef.current = now;
                setIsAppFocused(false);
            }
            else {
                setIsAppFocused(true);
            }
            lastVisibilityChangeRef.current = now;
        };
        // Monitor fullscreen changes - do NOT trigger mask on fullscreen enter/exit
        var handleFullscreenChange = function () {
            var isCurrentlyFullscreen = !!(document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement);
            setIsFullscreen(isCurrentlyFullscreen);
            setIsAppFocused(true);
            focusIgnoreUntilRef.current = Date.now() + 100;
        };
        // Detect multiple monitor setup (common for screenshot tools)
        var detectMultipleMonitors = function () {
            // This is limited, but we can try to detect screen dimensions
            // Screen dimensions larger than typical single monitor might indicate multiple monitors
            if (screen.width > 2560 || screen.height > 1440) {
                // Possibly multiple monitors - log if needed
            }
        };
        // Check for rapid focus changes (screenshot tool indicator).
        // Disabled as anomaly signal to avoid false positives during app switch.
        var checkForScreenshotTools = function () {
            return;
        };
        // Add event listeners - use non-capture phase for better performance
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('cut', handleCut);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('selectstart', handleSelectStart);
        document.addEventListener('dragstart', handleDragStart);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        // Start clipboard monitoring
        monitorClipboard();
        // Periodically check for suspicious activity
        var suspiciousActivityCheck = setInterval(function () {
            checkForScreenshotTools();
            detectMultipleMonitors();
        }, 5000); // Reduced from 2s to 5s for better performance
        // Setup Electron screenshot blocked listener - IMMEDIATE lock on capture attempt
        var screenshotBlockedCleanup = null;
        var recordingStartCleanup = null;
        var recordingStopCleanup = null;
        var electronCleanup = null;
        if ((0, electron_1.isElectron)()) {
            // Notify Electron that document viewing is now active
            var electronApi = window.electronAPI;
            if (electronApi === null || electronApi === void 0 ? void 0 : electronApi.setDocumentViewing) {
                electronApi.setDocumentViewing(true);
            }
            // Listen for screenshot blocked events and IMMEDIATELY lock preview
            // NOTE: Audit log is sent from main process (handleBlockedScreenshot) to avoid duplicates
            // DRMViewer only handles UI lock, not audit logging
            screenshotBlockedCleanup = (0, electron_1.setupScreenshotBlockedListener)(function (data) {
                console.warn('[DRMViewer] Screenshot blocked detected:', data);
                // Immediately lock the preview without delay
                setSecurityAlertMessage("".concat(data.eventType, ": ").concat(data.details));
                setSessionBlocked(true); // Block user session immediately
                setIsAppFocused(false);
                focusIgnoreUntilRef.current = Date.now() + 100;
                // Clear any existing reset timer
                if (captureResetTimerRef.current) {
                    clearTimeout(captureResetTimerRef.current);
                    captureResetTimerRef.current = null;
                }
                // NOTE: Audit log is sent from main process (handleBlockedScreenshot in main.ts)
                // DRMViewer only locks UI to avoid duplicate audit entries
            });
            // DIRECT Electron recording start listener - IMMEDIATELY lock preview
            // Only log to audit if it's a REAL recording (user selected to record the window)
            // NOT for tool detection (like website mode - only detect actual recording starts)
            recordingStartCleanup = (0, electron_1.setupRecordingStartListener)(function (data) {
                console.warn('[DRMViewer] Electron recording detected (direct):', data);
                // Immediately lock the preview without delay - direct from Electron IPC
                var toolName = data.toolName || 'Unknown tool';
                setSecurityAlertMessage("\uD83D\uDD34 RECORDING_DETECTED: ".concat(toolName, " - Recording started"));
                setSessionBlocked(true); // Block user session immediately
                setIsAppFocused(false);
                focusIgnoreUntilRef.current = Date.now() + 100;
                // Clear any existing reset timer
                if (captureResetTimerRef.current) {
                    clearTimeout(captureResetTimerRef.current);
                    captureResetTimerRef.current = null;
                }
                // NOTE: Audit log is sent from main process (handleRecordingStart)
                // DRMViewer only locks UI, does NOT send duplicate audit log
                // This avoids duplicate SCREEN_RECORDING_START entries in audit trail
            });
            // DIRECT Electron recording stop listener - UI lock and audit
            recordingStopCleanup = (0, electron_1.setupRecordingStopListener)(function (data) {
                console.warn('[DRMViewer] Electron recording stopped:', data);
                var toolName = data.toolName || 'Unknown tool';
                var duration = data.duration || 'unknown';
                setSecurityAlertMessage("\u23F9\uFE0F RECORDING_STOPPED: ".concat(toolName, " (duration: ").concat(duration, ")"));
                setSessionBlocked(true); // Block user session after recording
                setIsAppFocused(false);
                focusIgnoreUntilRef.current = Date.now() + 100;
                // Clear any existing reset timer
                if (captureResetTimerRef.current) {
                    clearTimeout(captureResetTimerRef.current);
                    captureResetTimerRef.current = null;
                }
                // Send to backend for UEBA analysis and score deduction
                logSecurityEvent('SCREEN_RECORDING_STOP', 'WARNING', "Recording stopped: ".concat(toolName, " (duration: ").concat(duration, ")"), 'Recording session ended');
            });
            // Setup Electron system-level protection listener for other suspicious activities
            electronCleanup = (0, electron_1.setupSuspiciousActivityListener)(function (activity) {
                // Only update local UI state - do NOT send to audit log
                // Window focus changes are informational only, not security threats
                // Real screenshot/recording attempts are logged via handleBlockedScreenshot, handleScreenshotToolDetected
                if (typeof activity === 'string') {
                    setSuspiciousActivity(function (prev) { return __spreadArray(__spreadArray([], prev, true), ["[System] ".concat(activity)], false); });
                }
            });
        }
        // Listen for web screen capture detection (from useSecurityMonitor)
        // This handles non-Electron web browsers
        var handleWebCaptureDetected = function (event) {
            var customEvent = event;
            console.warn('[DRMViewer] Web screen capture detected:', customEvent.detail);
            // Immediately lock the preview without delay
            setSecurityAlertMessage("WEB_SCREEN_CAPTURE: ".concat(customEvent.detail.sourceName || 'Unknown source', " - ").concat(customEvent.detail.captureType || 'unknown type'));
            setSessionBlocked(true);
            setIsAppFocused(false);
            focusIgnoreUntilRef.current = Date.now() + 100;
            // Clear any existing reset timer
            if (captureResetTimerRef.current) {
                clearTimeout(captureResetTimerRef.current);
                captureResetTimerRef.current = null;
            }
        };
        window.addEventListener('dlp-capture-detected', handleWebCaptureDetected);
        // NOTE: Electron recording detection is now handled directly via setupRecordingStartListener above
        // The dlp-recording-detected custom event from useSecurityMonitor is no longer needed here
        // to avoid duplicate lock operations. Both paths would call setSessionBlocked(true) anyway.
        // Auto-request fullscreen on load (optional - can be made configurable)
        // requestFullscreen()
        // Cleanup
        return function () {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('cut', handleCut);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('selectstart', handleSelectStart);
            document.removeEventListener('dragstart', handleDragStart);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('dlp-capture-detected', handleWebCaptureDetected);
            // NOTE: dlp-recording-detected is no longer listened here (moved to direct Electron IPC)
            if (clipboardCheckInterval) {
                clearInterval(clipboardCheckInterval);
            }
            if (suspiciousActivityCheck) {
                clearInterval(suspiciousActivityCheck);
            }
            if (electronCleanup) {
                electronCleanup();
            }
            if (screenshotBlockedCleanup) {
                screenshotBlockedCleanup();
            }
            if (recordingStartCleanup) {
                recordingStartCleanup();
            }
            if (recordingStopCleanup) {
                recordingStopCleanup();
            }
            if (captureResetTimerRef.current) {
                clearTimeout(captureResetTimerRef.current);
                captureResetTimerRef.current = null;
            }
            // Notify Electron that document viewing is no longer active
            var electronApi = window.electronAPI;
            if (electronApi === null || electronApi === void 0 ? void 0 : electronApi.setDocumentViewing) {
                electronApi.setDocumentViewing(false);
            }
        };
    }, [allowCopy, allowPrint, allowDownload, isFullscreen, logSecurityEvent]);
    var _k = (0, react_1.useState)(null), blobUrl = _k[0], setBlobUrl = _k[1];
    var _l = (0, react_1.useState)(null), blob = _l[0], setBlob = _l[1];
    var _m = (0, react_1.useState)('application/pdf'), contentType = _m[0], setContentType = _m[1];
    var blobUrlRef = (0, react_1.useRef)(null);
    var _o = (0, react_1.useState)(false), previewBlurred = _o[0], setPreviewBlurred = _o[1];
    var previewWrapperRef = (0, react_1.useRef)(null);
    var footerCanvasRef = (0, react_1.useRef)(null);
    var diagonalWatermarkRef = (0, react_1.useRef)(null);
    var antiCaptureCanvasRef = (0, react_1.useRef)(null);
    var resizeDebounceRef = (0, react_1.useRef)(null);
    var RESIZE_DEBOUNCE_MS = 200;
    var FOOTER_HEIGHT_PX = 60; // Space reserved for footer markings
    var ANTI_CAPTURE_NOISE_INTENSITY = 0.02; // 2% pixel noise (invisible to human eye)
    var WATERMARK_TEXT = 'DLP Platform'; // Diagonal watermark text
    var WATERMARK_FONT_SIZE = 48;
    var WATERMARK_ROTATION = -30; // degrees
    var handleRenderComplete = (0, react_1.useCallback)(function () {
        setPreviewBlurred(false);
    }, []);
    // Fetch client IP address
    (0, react_1.useEffect)(function () {
        var redrawFooter = function () {
            var _a, _b;
            var canvas = footerCanvasRef.current;
            var wrapper = previewWrapperRef.current;
            if (!canvas || !wrapper || !requiresWatermark)
                return;
            var w = wrapper.clientWidth;
            if (w <= 0)
                return;
            var dpr = window.devicePixelRatio || 1;
            canvas.width = w * dpr;
            canvas.height = FOOTER_HEIGHT_PX * dpr;
            canvas.style.width = "".concat(w, "px");
            canvas.style.height = "".concat(FOOTER_HEIGHT_PX, "px");
            var ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            ctx.scale(dpr, dpr);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, w, FOOTER_HEIGHT_PX);
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            var padding = 12;
            // IP and short code come from the server so they match the PDF watermark exactly
            var displayIp = (_a = serverIpRef.current) !== null && _a !== void 0 ? _a : 'N/A';
            var displayCode = (_b = watermarkCodeRef.current) !== null && _b !== void 0 ? _b : 'N/A';
            // Format: UID: {accountId} | {startTime} | {serverIp} | {shortCode}
            var accessTimeISO = new Date().toISOString().slice(0, 19).replace('T', ' ');
            var footerLine = "UID: ".concat(userAccountId, " | ").concat(accessTimeISO, " | ").concat(displayIp, " | ").concat(displayCode);
            ctx.fillText(footerLine, padding, padding);
        };
        var redrawDiagonalWatermark = function () {
            var canvas = diagonalWatermarkRef.current;
            var wrapper = previewWrapperRef.current;
            if (!canvas || !wrapper || !requiresWatermark)
                return;
            var w = wrapper.clientWidth;
            var h = wrapper.clientHeight;
            if (w <= 0 || h <= 0)
                return;
            var dpr = window.devicePixelRatio || 1;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = "".concat(w, "px");
            canvas.style.height = "".concat(h, "px");
            var ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            // Save the context state
            ctx.save();
            // Move to center and rotate
            var centerX = w / 2;
            var centerY = h / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((WATERMARK_ROTATION * Math.PI) / 180);
            // Set watermark style
            ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'; // Very subtle gray
            ctx.font = "bold ".concat(WATERMARK_FONT_SIZE, "px Arial");
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Calculate spacing based on text size
            var textWidth = ctx.measureText(WATERMARK_TEXT).width;
            var spacingX = textWidth + 100;
            var spacingY = WATERMARK_FONT_SIZE + 80;
            // Calculate grid of watermarks
            var diagonal = Math.sqrt(w * w + h * h);
            var cols = Math.ceil(diagonal / spacingX) + 2;
            var rows = Math.ceil(diagonal / spacingY) + 2;
            // Draw watermark grid
            for (var row = -rows; row <= rows; row++) {
                for (var col = -cols; col <= cols; col++) {
                    var x = col * spacingX;
                    var y = row * spacingY;
                    ctx.fillText(WATERMARK_TEXT, x, y);
                }
            }
            // Restore the context state
            ctx.restore();
        };
        var redrawAntiCapture = function () {
            var canvas = antiCaptureCanvasRef.current;
            var wrapper = previewWrapperRef.current;
            if (!canvas || !wrapper || !requiresWatermark)
                return;
            var w = wrapper.clientWidth;
            var h = wrapper.clientHeight;
            if (w <= 0 || h <= 0)
                return;
            var dpr = window.devicePixelRatio || 1;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = "".concat(w, "px");
            canvas.style.height = "".concat(h, "px");
            var ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            // Inject weak pixel noise (invisible to human eye, detectable after filtering)
            // This creates a unique fingerprint per viewing session
            var imageData = ctx.createImageData(w * dpr, h * dpr);
            var data = imageData.data;
            var userFingerprint = "".concat(userAccountId, "_").concat(Date.now()).split('').map(function (c) { return c.charCodeAt(0); });
            // Generate deterministic but subtle noise pattern based on user info
            for (var i = 0; i < data.length; i += 4) {
                var x = (i / 4) % (w * dpr);
                var y = Math.floor((i / 4) / (w * dpr));
                var seed = (x * 7919 + y * 104729 + userFingerprint[i % userFingerprint.length]) % 2147483647;
                // Very subtle noise (2% intensity) - invisible but detectable
                var noise = (seed % 51 - 25) * ANTI_CAPTURE_NOISE_INTENSITY;
                data[i] = Math.max(0, Math.min(255, 128 + noise)); // R
                data[i + 1] = Math.max(0, Math.min(255, 128 + noise)); // G
                data[i + 2] = Math.max(0, Math.min(255, 128 + noise)); // B
                data[i + 3] = Math.floor(255 * ANTI_CAPTURE_NOISE_INTENSITY * 2); // Alpha (very low)
            }
            ctx.putImageData(imageData, 0, 0);
        };
        var scheduleResize = function () {
            if (resizeDebounceRef.current)
                clearTimeout(resizeDebounceRef.current);
            resizeDebounceRef.current = setTimeout(function () {
                resizeDebounceRef.current = null;
                redrawFooter();
                redrawDiagonalWatermark();
                redrawAntiCapture();
            }, RESIZE_DEBOUNCE_MS);
        };
        var wrapper = previewWrapperRef.current;
        if (!wrapper)
            return;
        var ro = new ResizeObserver(scheduleResize);
        ro.observe(wrapper);
        if (requiresWatermark) {
            redrawFooter();
            redrawDiagonalWatermark();
            redrawAntiCapture();
        }
        return function () {
            ro.disconnect();
            if (resizeDebounceRef.current) {
                clearTimeout(resizeDebounceRef.current);
                resizeDebounceRef.current = null;
            }
        };
    }, [requiresWatermark, watermarkText, blobUrl, contentType, documentUrl, userAccountId]);
    (0, react_1.useEffect)(function () {
        if (!(0, electron_1.isElectron)() || typeof window.electronAPI === 'undefined')
            return;
        var api = window.electronAPI;
        if (typeof api.onResizePreview !== 'function')
            return;
        api.onResizePreview(function () {
            setTimeout(function () { return window.dispatchEvent(new Event('resize')); }, 50);
        });
        return function () {
            var _a;
            var remove = (_a = window.electronAPI) === null || _a === void 0 ? void 0 : _a.removeResizePreviewListener;
            if (typeof remove === 'function')
                remove();
        };
    }, []);
    (0, react_1.useEffect)(function () {
        // Load document content with authentication
        var loadDocument = function () { return __awaiter(_this, void 0, void 0, function () {
            var match, documentId, _a, fetchedBlob, fetchedContentType, watermarkCode, viewerIp, url, err_1, errorMessage;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        setLoading(true);
                        setError(null);
                        // Revoke previous blob URL if exists
                        if (blobUrlRef.current) {
                            URL.revokeObjectURL(blobUrlRef.current);
                            blobUrlRef.current = null;
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        match = documentUrl.match(/\/docs\/(\d+)\/content/);
                        if (!match) {
                            throw new Error('Invalid document URL format');
                        }
                        documentId = parseInt(match[1], 10);
                        return [4 /*yield*/, api_1.apiClient.getDocumentContent(documentId)];
                    case 2:
                        _a = _d.sent(), fetchedBlob = _a.blob, fetchedContentType = _a.contentType, watermarkCode = _a.watermarkCode, viewerIp = _a.viewerIp;
                        watermarkCodeRef.current = watermarkCode;
                        serverIpRef.current = viewerIp;
                        url = URL.createObjectURL(fetchedBlob);
                        blobUrlRef.current = url;
                        setBlobUrl(url);
                        setBlob(fetchedBlob);
                        setContentType(fetchedContentType);
                        setLoading(false);
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _d.sent();
                        console.error('Error loading document:', err_1);
                        errorMessage = 'Failed to load document';
                        if ((_b = err_1.response) === null || _b === void 0 ? void 0 : _b.data) {
                            // Try to get error message from ApiResponse structure
                            if (err_1.response.data.error) {
                                errorMessage = err_1.response.data.error;
                            }
                            else if (err_1.response.data.message) {
                                errorMessage = err_1.response.data.message;
                            }
                        }
                        else if (err_1.message) {
                            errorMessage = err_1.message;
                        }
                        // Handle 404 specifically
                        if (((_c = err_1.response) === null || _c === void 0 ? void 0 : _c.status) === 404) {
                            errorMessage = 'Document file not found. It may have been deleted or moved.';
                        }
                        setError(errorMessage);
                        setLoading(false);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        loadDocument();
        // Cleanup blob URL on unmount or when documentUrl changes
        return function () {
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, [documentUrl]);
    if (loading) {
        return (<div style={{
                padding: '60px',
                textAlign: 'center',
                fontSize: '18px',
                color: '#666'
            }}>
        <div style={{ marginBottom: '16px' }}>⏳</div>
        Loading document...
      </div>);
    }
    if (error) {
        return (<div style={{
                padding: '60px',
                textAlign: 'center',
                fontSize: '16px',
                color: '#f44336'
            }}>
        <div style={{ marginBottom: '16px' }}>⚠️</div>
        Error: {error}
      </div>);
    }
    return (<div ref={viewerRef} style={{
            position: 'relative',
            width: '100%',
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            background: '#f5f5f5',
            userSelect: allowCopy ? 'auto' : 'none',
            WebkitUserSelect: allowCopy ? 'auto' : 'none',
            MozUserSelect: allowCopy ? 'auto' : 'none',
            msUserSelect: (allowCopy ? 'auto' : 'none'),
            WebkitTouchCallout: 'none',
            touchAction: 'none',
            pointerEvents: 'auto',
        }} onContextMenu={function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }} onDragStart={function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }}>
      {/* Screen Mask - shows when shouldShowMask() returns true or session is blocked */}
      {(shouldShowMask() || sessionBlocked) && (<div style={{
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
          {sessionBlocked ? (<>
              <div style={{ fontSize: '1.3em', fontWeight: 600, marginBottom: '10px' }}>
                🔒 Content blocked
              </div>
              <div style={{ fontSize: '0.95em', maxWidth: '640px' }}>
                {securityAlertMessage || 'Suspicious activity detected. The event has been recorded.'}
              </div>
              <button onClick={function () {
                    setSecurityAlertMessage(null);
                    setSessionBlocked(false);
                    setSuspiciousActivity([]);
                    window.location.reload();
                }} style={{
                    marginTop: '20px',
                    padding: '8px 18px',
                    borderRadius: '999px',
                    border: '1px solid #fff',
                    background: 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600
                }}>
                Reload and reopen viewer
              </button>
            </>) : (<>
              <div style={{ fontSize: '1.5em', fontWeight: 600, marginBottom: '8px' }}>Screen masked</div>
              <div style={{ fontSize: '0.95em', maxWidth: '420px', lineHeight: 1.4 }}>
                The app lost focus. To reduce capture risk, the preview is temporarily covered.
                Please wait {Math.ceil((MIN_MASK_DURATION_MS - (Date.now() - focusLostTimeRef.current)) / 1000)} seconds or click below to unmask.
              </div>
              <button onClick={function () {
                    focusLostTimeRef.current = 0;
                    setIsAppFocused(true);
                }} style={{
                    marginTop: '16px',
                    padding: '8px 16px',
                    background: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}>
                Unmask Now
              </button>
            </>)}
        </div>)}

      {/* Security Alert Warning Banner - shows when there's suspicious activity but session not blocked */}
      {securityAlertMessage && !sessionBlocked && !shouldShowMask() && (<div style={{
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
        </div>)}

      {/* Fullscreen Toggle Button */}
      <button onClick={function () { return __awaiter(_this, void 0, void 0, function () {
            var element;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!isFullscreen) return [3 /*break*/, 9];
                        if (!document.exitFullscreen) return [3 /*break*/, 2];
                        return [4 /*yield*/, document.exitFullscreen()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 2:
                        if (!document.webkitExitFullscreen) return [3 /*break*/, 4];
                        return [4 /*yield*/, document.webkitExitFullscreen()];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 4:
                        if (!document.mozCancelFullScreen) return [3 /*break*/, 6];
                        return [4 /*yield*/, document.mozCancelFullScreen()];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 6:
                        if (!document.msExitFullscreen) return [3 /*break*/, 8];
                        return [4 /*yield*/, document.msExitFullscreen()];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8:
                        setIsFullscreen(false);
                        return [3 /*break*/, 17];
                    case 9:
                        element = viewerRef.current;
                        if (!element) return [3 /*break*/, 17];
                        if (!element.requestFullscreen) return [3 /*break*/, 11];
                        return [4 /*yield*/, element.requestFullscreen()];
                    case 10:
                        _a.sent();
                        return [3 /*break*/, 17];
                    case 11:
                        if (!element.webkitRequestFullscreen) return [3 /*break*/, 13];
                        return [4 /*yield*/, element.webkitRequestFullscreen()];
                    case 12:
                        _a.sent();
                        return [3 /*break*/, 17];
                    case 13:
                        if (!element.mozRequestFullScreen) return [3 /*break*/, 15];
                        return [4 /*yield*/, element.mozRequestFullScreen()];
                    case 14:
                        _a.sent();
                        return [3 /*break*/, 17];
                    case 15:
                        if (!element.msRequestFullscreen) return [3 /*break*/, 17];
                        return [4 /*yield*/, element.msRequestFullscreen()];
                    case 16:
                        _a.sent();
                        _a.label = 17;
                    case 17: return [2 /*return*/];
                }
            });
        }); }} style={{
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
        }} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen (enhanced protection)'}>
        {isFullscreen ? '⛶ Exit fullscreen' : '⛶ Fullscreen'}
      </button>

      {/* Preview wrapper: blur during resize to prevent brief un-watermarked capture */}
      <div ref={previewWrapperRef} style={{
            position: 'relative',
            width: '100%',
            flex: 1,
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            paddingBottom: requiresWatermark ? "".concat(FOOTER_HEIGHT_PX, "px") : '0',
            transition: 'filter 0.15s ease-out',
            filter: previewBlurred ? 'blur(8px)' : 'none'
        }}>
        {/* Document viewer - render based on content type */}
        {blobUrl && (function () {
            var isImage = contentType.startsWith('image/');
            var isPDF = contentType === 'application/pdf';
            if (isImage) {
                return (<div style={{
                        position: 'relative',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                        minHeight: '400px',
                        background: '#f5f5f5'
                    }} onContextMenu={function (e) { return e.preventDefault(); }}>
                <img src={blobUrl} alt={documentName} style={{
                        maxWidth: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        position: 'relative',
                        zIndex: 1,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        pointerEvents: 'auto'
                    }} onContextMenu={function (e) { return e.preventDefault(); }} draggable={false}/>
              </div>);
            }
            else if (isPDF && blob) {
                return (<div onContextMenu={function (e) { return e.preventDefault(); }} style={{
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
                    }}>
                <PDFViewer_1.default blob={blob} documentName={documentName} allowPrint={allowPrint} allowDownload={allowDownload} onRenderComplete={handleRenderComplete} footerHeight={requiresWatermark ? FOOTER_HEIGHT_PX : 0}/>
              </div>);
            }
            else {
                return (<iframe src={blobUrl} title={documentName} style={{
                        width: '100%',
                        height: '100%',
                        minHeight: '400px',
                        border: 'none',
                        position: 'relative',
                        zIndex: 1
                    }} sandbox="allow-same-origin" onContextMenu={function (e) { return e.preventDefault(); }}/>);
            }
        })()}

        {/* Footer watermark (Canvas) - fixed footer with uploader and reader info */}
        {requiresWatermark && (<canvas ref={footerCanvasRef} style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: "".concat(FOOTER_HEIGHT_PX, "px"),
                pointerEvents: 'none',
                zIndex: 11
            }} aria-hidden/>)}

        {/* Diagonal canvas: short "DLP Platform" grid (full UID in footer + baked in PDF on preview). */}
        {requiresWatermark && (<canvas ref={diagonalWatermarkRef} style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 10
            }} aria-hidden/>)}

        {/* Screen Anti-Capture - Invisible pixel noise for forensic tracing */}
        {requiresWatermark && (<canvas ref={antiCaptureCanvasRef} style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 12,
                mixBlendMode: 'overlay',
                opacity: 0.01 // Nearly invisible but detectable after filtering
            }} aria-hidden/>)}
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
    </div>);
}
