"use strict";
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.SECURITY_CATEGORIES = exports.SECURITY_ACTIONS = void 0;
exports.useSecurityMonitor = useSecurityMonitor;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var electron_1 = require("../utils/electron");
var useScreenCaptureMonitor_1 = require("./useScreenCaptureMonitor");
var authStore_1 = require("../store/authStore");
// ============== Security Event Reporter ==============
var SecurityEventReporter = /** @class */ (function () {
    function SecurityEventReporter(debounceMs) {
        if (debounceMs === void 0) { debounceMs = 1000; }
        this.queue = [];
        this.debounceTimer = null;
        this.debounceMs = debounceMs;
        this.apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
    }
    /**
     * Report a security event to the backend
     */
    SecurityEventReporter.prototype.report = function (event, accountId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.queue.push({ event: event, accountId: accountId });
                this.scheduleFlush();
                return [2 /*return*/];
            });
        });
    };
    /**
     * Immediately report a high-severity event (Tier 2/3)
     */
    SecurityEventReporter.prototype.reportImmediate = function (event, accountId) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        payload = __assign({}, event);
                        if (accountId) {
                            payload.accountId = accountId;
                        }
                        return [4 /*yield*/, fetch("".concat(this.apiBase, "/security/events"), {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(this.getToken())
                                },
                                body: JSON.stringify(payload)
                            })];
                    case 1:
                        _a.sent();
                        console.debug('[SecurityMonitor] Immediate event reported:', event.action);
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error('[SecurityMonitor] Failed to report event:', error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SecurityEventReporter.prototype.scheduleFlush = function () {
        var _this = this;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(function () { return _this.flush(); }, this.debounceMs);
    };
    SecurityEventReporter.prototype.flush = function () {
        return __awaiter(this, void 0, void 0, function () {
            var items, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.queue.length === 0)
                            return [2 /*return*/];
                        items = __spreadArray([], this.queue, true);
                        this.queue = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Send all events in batch
                        return [4 /*yield*/, Promise.all(items.map(function (_a) {
                                var event = _a.event, accountId = _a.accountId;
                                var payload = __assign({}, event);
                                if (accountId) {
                                    payload.accountId = accountId;
                                }
                                return fetch("".concat(_this.apiBase, "/security/events"), {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': "Bearer ".concat(_this.getToken())
                                    },
                                    body: JSON.stringify(payload)
                                }).catch(function (err) { return console.error('[SecurityMonitor] Failed to report:', err); });
                            }))];
                    case 2:
                        // Send all events in batch
                        _a.sent();
                        console.debug('[SecurityMonitor] Batch reported:', items.length, 'events');
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error('[SecurityMonitor] Batch report failed:', error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SecurityEventReporter.prototype.getToken = function () {
        // Try Zustand store first, then fallback to localStorage
        var state = authStore_1.useAuthStore.getState();
        return state.accessToken || localStorage.getItem('token') || '';
    };
    return SecurityEventReporter;
}());
// Singleton reporter instance
var reporter = new SecurityEventReporter(1000);
// ============== Action Constants ==============
exports.SECURITY_ACTIONS = {
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
    // Clipboard
    CLIPBOARD_IMAGE_COPY: 'CLIPBOARD_IMAGE_COPY',
    CLIPBOARD_IMAGE_DETECTED: 'CLIPBOARD_IMAGE_DETECTED',
    LARGE_CLIPBOARD_COPY: 'LARGE_CLIPBOARD_COPY',
    // Browser
    DEV_TOOLS_OPEN: 'DEV_TOOLS_OPEN',
    // Bulk view (reported by app)
    BULK_VIEW_THRESHOLD: 'BULK_VIEW_THRESHOLD'
};
exports.SECURITY_CATEGORIES = {
    DRM: 'DRM',
    DOCUMENT: 'DOCUMENT',
    WINDOW_MANAGEMENT: 'WINDOW_MANAGEMENT',
    CLIPBOARD: 'CLIPBOARD',
    BROWSER: 'BROWSER',
    UEBA: 'UEBA'
};
// ============== Screenshot Detection ==============
function detectScreenshotAttempts(accountId) {
    var handlers = [];
    // Electron: listen for screenshot blocked ONLY in browser (non-Electron) mode
    // In Electron mode, DRMViewer handles screenshot detection directly for immediate response
    if (!(0, electron_1.isElectron)()) {
        var electronCleanup = (0, electron_1.setupScreenshotBlockedListener)(function (data) {
            console.warn('[SecurityMonitor] Screenshot blocked:', data);
            reporter.reportImmediate({
                action: exports.SECURITY_ACTIONS.SCREENSHOT_ATTEMPT,
                category: exports.SECURITY_CATEGORIES.DRM,
                result: 'WARNING',
                details: "Screenshot blocked: ".concat(data.eventType, " - ").concat(data.details)
            }, accountId);
            showBlockingAlert(data.eventType, data.details);
        });
        handlers.push(electronCleanup);
    }
    // Web: Detect copy events with image data
    var handleCopy = function (e) {
        var _a;
        var items = (_a = e.clipboardData) === null || _a === void 0 ? void 0 : _a.items;
        if (!items)
            return;
        for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
            var item = items_1[_i];
            if (item.type.startsWith('image/')) {
                console.warn('[SecurityMonitor] Image copy detected');
                reporter.report({
                    action: exports.SECURITY_ACTIONS.CLIPBOARD_IMAGE_COPY,
                    category: exports.SECURITY_CATEGORIES.CLIPBOARD,
                    result: 'WARNING',
                    details: 'User attempted to copy image to clipboard'
                }, accountId);
                break;
            }
        }
    };
    // Detect large clipboard copies (potential data exfiltration)
    var handlePaste = function (e) {
        var _a;
        var items = (_a = e.clipboardData) === null || _a === void 0 ? void 0 : _a.items;
        if (!items)
            return;
        var totalSize = 0;
        for (var _i = 0, items_2 = items; _i < items_2.length; _i++) {
            var item = items_2[_i];
            if (item.type.startsWith('image/') && item.kind === 'file') {
                var blob = item.getAsFile();
                if (blob) {
                    totalSize += blob.size;
                }
            }
        }
        // Report if clipboard contains large image (> 1MB)
        if (totalSize > 1024 * 1024) {
            reporter.report({
                action: exports.SECURITY_ACTIONS.LARGE_CLIPBOARD_COPY,
                category: exports.SECURITY_CATEGORIES.CLIPBOARD,
                result: 'WARNING',
                details: "Large clipboard copy detected: ".concat((totalSize / 1024 / 1024).toFixed(2), "MB")
            }, accountId);
        }
    };
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    handlers.push(function () {
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('paste', handlePaste);
    });
    // Note: DevTools detection removed to avoid false positives in Electron/app mode
    // Return combined cleanup
    return function () { return handlers.forEach(function (h) { return h(); }); };
}
// ============== Alert Display ==============
function showBlockingAlert(eventType, details) {
    // Remove existing alert if any
    var existing = document.getElementById('dlp-security-alert');
    if (existing)
        existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'dlp-security-alert';
    overlay.style.cssText = "\n    position: fixed;\n    top: 20px;\n    right: 20px;\n    background: linear-gradient(135deg, #dc2626, #b91c1c);\n    color: white;\n    padding: 16px 24px;\n    border-radius: 12px;\n    box-shadow: 0 10px 40px rgba(220, 38, 38, 0.5);\n    z-index: 10000;\n    font-family: system-ui, -apple-system, sans-serif;\n    max-width: 400px;\n    animation: slideIn 0.3s ease-out;\n  ";
    overlay.innerHTML = "\n    <div style=\"font-size: 18px; font-weight: bold; margin-bottom: 8px;\">\n      \uD83D\uDEAB Security Alert\n    </div>\n    <div style=\"font-size: 14px; margin-bottom: 4px;\">\n      <strong>".concat(eventType, "</strong>\n    </div>\n    <div style=\"font-size: 12px; opacity: 0.9;\">\n      ").concat(details, "\n    </div>\n    <div style=\"font-size: 11px; opacity: 0.7; margin-top: 8px;\">\n      ").concat(new Date().toLocaleTimeString(), "\n    </div>\n  ");
    var style = document.createElement('style');
    style.textContent = "\n    @keyframes slideIn {\n      from { opacity: 0; transform: translateX(100px); }\n      to { opacity: 1; transform: translateX(0); }\n    }\n    @keyframes slideOut {\n      from { opacity: 1; transform: translateX(0); }\n      to { opacity: 0; transform: translateX(100px); }\n    }\n  ";
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    setTimeout(function () {
        overlay.style.animation = 'slideOut 0.5s ease-out forwards';
        setTimeout(function () {
            overlay.remove();
            style.remove();
        }, 500);
    }, 5000);
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
 *     reportScreenshot: true,
 *     reportClipboard: true
 *   })
 *   // ...
 * }
 * ```
 */
function useSecurityMonitor(options) {
    if (options === void 0) { options = {}; }
    var _a = options.enabled, enabled = _a === void 0 ? true : _a, _b = options.reportScreenshot, reportScreenshot = _b === void 0 ? true : _b, _c = options.reportClipboard, reportClipboard = _c === void 0 ? true : _c, onCaptureDetected = options.onCaptureDetected;
    // Get accountId from Zustand store (works for both Docker and Electron modes)
    var accountId = (0, authStore_1.useAuthStore)(function (state) { var _a; return (_a = state.user) === null || _a === void 0 ? void 0 : _a.accountId; });
    var navigate = (0, react_router_dom_1.useNavigate)();
    var cleanupRef = (0, react_1.useRef)(null);
    // Web screen capture detection - called at top level (React rules)
    var stopScreenCapture = (0, useScreenCaptureMonitor_1.useScreenCaptureMonitor)({
        enabled: enabled && (reportScreenshot || reportClipboard),
        checkIntervalMs: 500,
        onCaptureChange: function (event) {
            console.warn('[SecurityMonitor] Web screen capture detected:', event.type);
            // IMMEDIATELY trigger lock callback for web capture detection
            onCaptureDetected === null || onCaptureDetected === void 0 ? void 0 : onCaptureDetected(event);
            // Also dispatch custom event for DRMViewer to listen
            window.dispatchEvent(new CustomEvent('dlp-capture-detected', { detail: event }));
            reporter.reportImmediate({
                action: 'WEB_SCREEN_CAPTURE_DETECTED',
                category: 'DRM',
                result: 'FAILURE', // HIGH RISK
                details: "Web browser screen capture ".concat(event.type, ": ").concat(event.sourceName || 'Unknown', " (").concat(event.captureType || 'unknown', ")")
            }, accountId);
        },
        onWindowFocusChange: function (event) {
            // Window blur is normal browser behavior - log as INFO only
            if (event.type === 'blur') {
                // Only log if needed for debugging, not as security alert
                console.debug('[SecurityMonitor] Window blur (normal behavior):', event.reason);
            }
        }
    }).stopScreenCapture;
    (0, react_1.useEffect)(function () {
        var _a;
        if (!enabled) {
            (_a = cleanupRef.current) === null || _a === void 0 ? void 0 : _a.call(cleanupRef);
            cleanupRef.current = null;
            return;
        }
        var cleanups = [];
        // Screenshot detection
        if (reportScreenshot || reportClipboard) {
            var screenshotCleanup = detectScreenshotAttempts(accountId);
            cleanups.push(screenshotCleanup);
        }
        // Electron suspicious activity listener - ONLY in non-Electron mode
        // In Electron mode, main.ts sends audit logs, DRMViewer handles UI
        // This avoids duplicate audit entries
        // IMPORTANT: Only audit CRITICAL events to minimize backend load
        if (!(0, electron_1.isElectron)()) {
            var electronActivityCleanup = (0, electron_1.setupSuspiciousActivityListener)(function (activity) {
                // Only log actual screenshot/recording attempts, not just tool running
                // Filter: only screenshot attempts and recording starts are critical
                var isCritical = activity.includes('screenshot') ||
                    activity.includes('SCREENSHOT') ||
                    activity.includes('PrintScreen') ||
                    activity.includes('snipping');
                if (isCritical) {
                    console.warn('[SecurityMonitor] Critical activity:', activity);
                    reporter.reportImmediate({
                        action: activity.toUpperCase().replace(/ /g, '_').substring(0, 50),
                        category: exports.SECURITY_CATEGORIES.DRM,
                        result: 'FAILURE',
                        details: activity
                    }, accountId);
                }
            });
            cleanups.push(electronActivityCleanup);
        }
        // Electron recording start listener - send to backend audit AND dispatch event to lock preview
        // ONLY in browser (non-Electron) mode - DRMViewer handles this directly in Electron mode
        // IMPORTANT: Only log when recording ACTUALLY starts (high risk event)
        if (!(0, electron_1.isElectron)()) {
            var recordingStartCleanup = (0, electron_1.setupRecordingStartListener)(function (data) {
                console.warn('[SecurityMonitor] Recording started (HIGH RISK):', data.toolName);
                // IMMEDIATELY dispatch event for preview lock (same as web capture detection)
                window.dispatchEvent(new CustomEvent('dlp-recording-detected', { detail: data }));
                reporter.reportImmediate({
                    action: 'SCREEN_RECORDING_START',
                    category: exports.SECURITY_CATEGORIES.DRM,
                    result: 'FAILURE',
                    details: "Screen recording started: ".concat(data.toolName)
                }, accountId);
            });
            cleanups.push(recordingStartCleanup);
            // Recording stop - log only if recording was active (duration tracking)
            var recordingStopCleanup = (0, electron_1.setupRecordingStopListener)(function (data) {
                console.warn('[SecurityMonitor] Recording stopped:', data.toolName, data.duration);
                reporter.report({
                    action: 'SCREEN_RECORDING_STOP',
                    category: exports.SECURITY_CATEGORIES.DRM,
                    result: 'WARNING',
                    details: "Screen recording stopped: ".concat(data.toolName).concat(data.duration ? " (duration: ".concat(data.duration, ")") : '')
                }, accountId);
            });
            cleanups.push(recordingStopCleanup);
        }
        // Cleanup
        cleanupRef.current = function () { return cleanups.forEach(function (c) { return c(); }); };
        return function () {
            cleanups.forEach(function (c) { return c(); });
        };
    }, [enabled, reportScreenshot, reportClipboard, navigate, accountId]);
    // Manual report function
    var reportEvent = (0, react_1.useCallback)(function (event) {
        reporter.report(event, accountId);
    }, [accountId]);
    // Report bulk view threshold reached
    var reportBulkView = (0, react_1.useCallback)(function (documentCount, timeWindowMinutes) {
        reporter.reportImmediate({
            action: exports.SECURITY_ACTIONS.BULK_VIEW_THRESHOLD,
            category: exports.SECURITY_CATEGORIES.DOCUMENT,
            result: 'WARNING',
            details: "User viewed ".concat(documentCount, " documents in ").concat(timeWindowMinutes, " minutes (threshold exceeded)")
        }, accountId);
    }, [accountId]);
    return {
        reportEvent: reportEvent,
        reportBulkView: reportBulkView,
        stopScreenCapture: stopScreenCapture
    };
}
exports.default = useSecurityMonitor;
