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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useScreenshotBlockedAlert = useScreenshotBlockedAlert;
var react_1 = require("react");
var electron_1 = require("../utils/electron");
var api_1 = require("../api");
var authStore_1 = require("../store/authStore");
/**
 * Map Electron event types to audit log action names
 */
function mapEventTypeToAction(eventType) {
    var upperEvent = eventType.toUpperCase();
    if (upperEvent.includes('SCREENSHOT') || upperEvent.includes('CAPTURE')) {
        return 'SCREENSHOT_ATTEMPT';
    }
    if (upperEvent.includes('RECORD')) {
        return 'SCREEN_RECORDING';
    }
    if (upperEvent.includes('USB') || upperEvent.includes('DEVICE')) {
        return 'USB_DEVICE_DETECTED';
    }
    if (upperEvent.includes('CLIPBOARD')) {
        return 'CLIPBOARD_ACCESS';
    }
    if (upperEvent.includes('WINDOW') || upperEvent.includes('FOCUS')) {
        return 'WINDOW_FOCUS_LOST';
    }
    // Default fallback
    return 'SYSTEM_ALERT';
}
/**
 * Map Electron event types to result severity
 */
function mapEventTypeToResult(eventType) {
    var upperEvent = eventType.toUpperCase();
    if (upperEvent.includes('SCREENSHOT') || upperEvent.includes('CAPTURE')) {
        return 'FAILURE'; // Screen capture blocked = FAILURE
    }
    if (upperEvent.includes('RECORD')) {
        return 'FAILURE'; // Screen recording = FAILURE (blocked/denied)
    }
    if (upperEvent.includes('USB')) {
        return 'WARNING'; // USB device = WARNING (will trigger UEBA scoring)
    }
    return 'WARNING';
}
/**
 * Report security event to backend
 */
function reportSecurityEvent(action, result, details, accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var payload, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    payload = {
                        action: action,
                        category: 'DRM',
                        result: result,
                        details: details
                    };
                    if (accountId) {
                        payload.accountId = accountId;
                    }
                    return [4 /*yield*/, api_1.apiClient.reportSecurityEvent(payload)];
                case 1:
                    _a.sent();
                    console.log('[DLP] Security event logged to audit:', action, details);
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    console.error('[DLP] Failed to log security event:', err_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Show blocking alert
 */
function showBlockingAlert(data) {
    // Remove existing alert if any
    var existing = document.getElementById('screenshot-blocked-alert');
    if (existing)
        existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'screenshot-blocked-alert';
    overlay.style.cssText = "\n    position: fixed;\n    top: 20px;\n    left: 50%;\n    transform: translateX(-50%);\n    background: linear-gradient(135deg, #dc2626, #b91c1c);\n    color: white;\n    padding: 20px 30px;\n    border-radius: 12px;\n    box-shadow: 0 10px 40px rgba(220, 38, 38, 0.5);\n    z-index: 10000;\n    font-family: system-ui, -apple-system, sans-serif;\n    text-align: center;\n    max-width: 500px;\n    animation: slideDown 0.3s ease-out;\n  ";
    overlay.innerHTML = "\n    <div style=\"font-size: 24px; margin-bottom: 10px;\">\uD83D\uDEAB SECURITY ALERT</div>\n    <div style=\"font-size: 14px; opacity: 0.9; margin-bottom: 8px;\">\n      Action: <strong>".concat(data.eventType, "</strong>\n    </div>\n    <div style=\"font-size: 12px; opacity: 0.8;\">\n      ").concat(data.details, "\n    </div>\n    <div style=\"font-size: 11px; opacity: 0.7; margin-top: 10px;\">\n      ").concat(new Date(data.timestamp).toLocaleTimeString(), "\n    </div>\n  ");
    // Add animation styles
    if (!document.getElementById('screenshot-alert-styles')) {
        var style = document.createElement('style');
        style.id = 'screenshot-alert-styles';
        style.textContent = "\n      @keyframes slideDown {\n        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }\n        to { opacity: 1; transform: translateX(-50%) translateY(0); }\n      }\n      @keyframes fadeOut {\n        from { opacity: 1; }\n        to { opacity: 0; }\n      }\n    ";
        document.head.appendChild(style);
    }
    document.body.appendChild(overlay);
    // Auto-dismiss after 4 seconds
    setTimeout(function () {
        overlay.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(function () {
            if (overlay.parentNode)
                overlay.parentNode.removeChild(overlay);
        }, 500);
    }, 4000);
}
function useScreenshotBlockedAlert() {
    var _this = this;
    var user = (0, authStore_1.useAuthStore)(function (state) { return state.user; });
    var userAccountId = (user === null || user === void 0 ? void 0 : user.accountId) || 'UNKNOWN';
    // Refs for cleanup
    var screenRecordingDetectedRef = (0, react_1.useRef)(false);
    var displayMediaStreamRef = (0, react_1.useRef)(null);
    // Report security event to backend
    var reportEvent = (0, react_1.useCallback)(function (eventType, details) {
        var action = mapEventTypeToAction(eventType);
        var result = mapEventTypeToResult(eventType);
        var fullDetails = "[".concat(userAccountId, "] ").concat(eventType, ": ").concat(details, " | timestamp: ").concat(new Date().toISOString());
        reportSecurityEvent(action, result, fullDetails, userAccountId);
        showBlockingAlert({ eventType: eventType, details: details, timestamp: new Date().toISOString() });
    }, [userAccountId]);
    // Browser-native screen recording detection using getDisplayMedia
    // DISABLED in Electron mode - main.ts handles this
    (0, react_1.useEffect)(function () {
        var _a;
        // Skip in Electron mode to avoid duplicate audit logs
        var electronApi = window === null || window === void 0 ? void 0 : window.electronAPI;
        if (electronApi) {
            return function () { };
        }
        // Intercept getDisplayMedia to detect when user tries to screen share/record
        var originalGetDisplayMedia = (_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getDisplayMedia.bind(navigator.mediaDevices);
        if (originalGetDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia = function (constraints) {
                return __awaiter(this, void 0, void 0, function () {
                    var stream, displaySurface, isScreen;
                    var _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, originalGetDisplayMedia(constraints)
                                // Detect if this is a screen capture
                            ];
                            case 1:
                                stream = _b.sent();
                                // Detect if this is a screen capture
                                if (stream && !screenRecordingDetectedRef.current) {
                                    screenRecordingDetectedRef.current = true;
                                    displayMediaStreamRef.current = stream;
                                    displaySurface = (_a = stream.getVideoTracks()[0]) === null || _a === void 0 ? void 0 : _a.getSettings().displaySurface;
                                    isScreen = displaySurface === 'monitor' || displaySurface === 'window';
                                    reportEvent('SCREEN_RECORDING', "User initiated screen capture/recording. Display surface: ".concat(displaySurface || 'unknown', ". Type: ").concat(isScreen ? 'Full screen' : 'Window/App'));
                                    // Monitor when recording stops
                                    stream.getVideoTracks()[0].onended = function () {
                                        console.log('[DLP] Screen recording stopped');
                                        screenRecordingDetectedRef.current = false;
                                        displayMediaStreamRef.current = null;
                                    };
                                }
                                return [2 /*return*/, stream];
                        }
                    });
                });
            };
        }
        return function () {
            // Restore original getDisplayMedia
            if (originalGetDisplayMedia && navigator.mediaDevices) {
                navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
            }
            // Stop any active streams
            if (displayMediaStreamRef.current) {
                displayMediaStreamRef.current.getTracks().forEach(function (track) { return track.stop(); });
                displayMediaStreamRef.current = null;
            }
        };
    }, [reportEvent]);
    // Detect when screen capture APIs are used (alternative detection)
    (0, react_1.useEffect)(function () {
        // Check for WebRTC screen sharing indicators
        var checkForScreenShare = function () {
            // Check if any peer connection is using screen sharing
            var peerConnections = window.peerConnections || [];
            peerConnections.forEach(function (pc) {
                var _a;
                var senders = ((_a = pc.getSenders) === null || _a === void 0 ? void 0 : _a.call(pc)) || [];
                senders.forEach(function (sender) {
                    var _a, _b, _c;
                    if (((_a = sender.track) === null || _a === void 0 ? void 0 : _a.kind) === 'video') {
                        var settings = (_c = (_b = sender.track).getSettings) === null || _c === void 0 ? void 0 : _c.call(_b);
                        if (settings === null || settings === void 0 ? void 0 : settings.displaySurface) {
                            console.log('[DLP] Detected screen sharing via WebRTC');
                        }
                    }
                });
            });
        };
        var interval = setInterval(checkForScreenShare, 5000);
        return function () { return clearInterval(interval); };
    }, []);
    // Detect rapid visibility changes (potential screenshot during switch)
    // DISABLED in Electron mode - main.ts handles this with FOCUS_CHANGE_THRESHOLD
    (0, react_1.useEffect)(function () {
        // Skip in Electron mode to avoid duplicate audit logs
        var electronApi = window === null || window === void 0 ? void 0 : window.electronAPI;
        if (electronApi) {
            return function () { };
        }
        var lastHiddenTime = 0;
        var blurCount = 0;
        var lastReportTime = 0;
        var RAPID_BLUR_THRESHOLD = 3;
        var RAPID_BLUR_WINDOW_MS = 2000;
        var DEBOUNCE_MS = 5000; // Prevent duplicate events within 5 seconds
        var handleVisibilityChange = function () {
            var now = Date.now();
            // Debounce: prevent rapid successive reports
            if (now - lastReportTime < DEBOUNCE_MS) {
                return;
            }
            if (document.hidden) {
                lastHiddenTime = now;
            }
            else if (lastHiddenTime > 0) {
                var hiddenDuration = now - lastHiddenTime;
                // Very brief hidden (< 200ms) suggests screenshot attempt
                if (hiddenDuration < 200) {
                    blurCount++;
                    if (blurCount >= RAPID_BLUR_THRESHOLD) {
                        lastReportTime = now;
                        reportEvent('RAPID_WINDOW_SWITCHING', "Rapid window switching detected (".concat(blurCount, " times within ").concat(RAPID_BLUR_WINDOW_MS, "ms). Possible automated capture attempt."));
                        blurCount = 0;
                    }
                }
                else {
                    blurCount = 0;
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return function () {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [reportEvent]);
    // Hook into Electron's screenshot blocked listener (for desktop app)
    // ONLY in browser mode - DRMViewer handles this directly in Electron mode
    (0, react_1.useEffect)(function () {
        // Skip in Electron mode to avoid duplicate audit logs
        var electronApi = window === null || window === void 0 ? void 0 : window.electronAPI;
        if (electronApi) {
            // In Electron mode, DRMViewer handles everything
            return function () { };
        }
        var cleanup = (0, electron_1.setupScreenshotBlockedListener)(function (data) { return __awaiter(_this, void 0, void 0, function () {
            var action, result, fullDetails;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.warn('[DLP] Security event detected from Electron:', data);
                        action = mapEventTypeToAction(data.eventType);
                        result = mapEventTypeToResult(data.eventType);
                        fullDetails = "[".concat(userAccountId, "] ").concat(data.eventType, ": ").concat(data.details, " | timestamp: ").concat(data.timestamp);
                        return [4 /*yield*/, reportSecurityEvent(action, result, fullDetails, userAccountId)];
                    case 1:
                        _a.sent();
                        showBlockingAlert(data);
                        return [2 /*return*/];
                }
            });
        }); });
        return cleanup;
    }, [userAccountId]);
    return null;
}
exports.default = useScreenshotBlockedAlert;
