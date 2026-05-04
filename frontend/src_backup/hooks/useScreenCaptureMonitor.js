"use strict";
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
exports.useScreenCaptureMonitor = useScreenCaptureMonitor;
var react_1 = require("react");
var authStore_1 = require("../store/authStore");
// ============== Event Reporter ==============
var ScreenCaptureEventReporter = /** @class */ (function () {
    function ScreenCaptureEventReporter() {
        this.apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
    }
    /**
     * Report screen capture event (HIGH RISK)
     */
    ScreenCaptureEventReporter.prototype.report = function (event, accountId) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        payload = {
                            action: 'WEB_SCREEN_CAPTURE_DETECTED',
                            category: 'DRM',
                            result: 'FAILURE', // HIGH RISK
                            details: "Screen capture ".concat(event.type, ": ").concat(event.sourceName || 'Unknown source', " (").concat(event.captureType || 'unknown', ")")
                        };
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
                        console.warn('[ScreenCaptureMonitor] HIGH RISK: Screen capture detected:', event.type, event.sourceName);
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error('[ScreenCaptureMonitor] Failed to report screen capture event:', error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ScreenCaptureEventReporter.prototype.getToken = function () {
        return localStorage.getItem('token') || '';
    };
    return ScreenCaptureEventReporter;
}());
var reporter = new ScreenCaptureEventReporter();
// ============== Helper Functions ==============
/**
 * Determine the type of display surface being captured
 */
function getCaptureType(displaySurface) {
    switch (displaySurface) {
        case 'monitor':
            return 'monitor';
        case 'window':
            return 'window';
        case 'browser':
            return 'browser';
        default:
            return 'unknown';
    }
}
/**
 * Create hidden video element to monitor capture state
 */
function createHiddenVideo() {
    var video = document.createElement('video');
    video.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px;top:-9999px;';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    return video;
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
function useScreenCaptureMonitor(options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    var onCaptureChange = options.onCaptureChange, onVisibilityChange = options.onVisibilityChange, onWindowFocusChange = options.onWindowFocusChange, _a = options.checkIntervalMs, checkIntervalMs = _a === void 0 ? 500 : _a, _b = options.enabled, enabled = _b === void 0 ? true : _b;
    // Get accountId from Zustand store (works for both Docker and Electron modes)
    var accountId = (0, authStore_1.useAuthStore)(function (state) { var _a; return (_a = state.user) === null || _a === void 0 ? void 0 : _a.accountId; });
    // Refs for cleanup
    var videoRef = (0, react_1.useRef)(null);
    var streamRef = (0, react_1.useRef)(null);
    var checkIntervalRef = (0, react_1.useRef)(null);
    var isCapturingRef = (0, react_1.useRef)(false);
    var lastHiddenTimeRef = (0, react_1.useRef)(0);
    var blurCountRef = (0, react_1.useRef)(0);
    // Cleanup function
    var cleanup = (0, react_1.useCallback)(function () {
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
        }
        if (videoRef.current && videoRef.current.parentNode) {
            videoRef.current.parentNode.removeChild(videoRef.current);
            videoRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(function (track) { return track.stop(); });
            streamRef.current = null;
        }
        isCapturingRef.current = false;
    }, []);
    (0, react_1.useEffect)(function () {
        if (!enabled) {
            cleanup();
            return;
        }
        // Create hidden video element
        var video = createHiddenVideo();
        videoRef.current = video;
        document.body.appendChild(video);
        // Handle visibility change via Page Visibility API
        // Only detect RAPID changes as suspicious (potential screenshot)
        var handleVisibilityChange = function () {
            var isVisible = document.visibilityState === 'visible';
            if (isVisible && lastHiddenTimeRef.current > 0) {
                var hiddenDuration = Date.now() - lastHiddenTimeRef.current;
                // Very brief hidden (< 200ms) suggests screenshot attempt
                if (hiddenDuration < 200) {
                    blurCountRef.current++;
                    if (blurCountRef.current >= 3) {
                        // Rapid switching detected - report as suspicious
                        console.warn('[ScreenCaptureMonitor] Rapid window switching detected, possible screenshot attempt');
                        blurCountRef.current = 0;
                    }
                }
            }
            if (!isVisible) {
                lastHiddenTimeRef.current = Date.now();
            }
            onVisibilityChange === null || onVisibilityChange === void 0 ? void 0 : onVisibilityChange({ visible: isVisible, timestamp: new Date() });
            // DO NOT report PAGE_HIDDEN/PAGE_VISIBLE to audit logs - it's just normal browser behavior
        };
        // Periodic check for capture state
        var checkCaptureState = function () {
            if (!videoRef.current)
                return;
            var stream = videoRef.current.srcObject;
            if (!stream) {
                if (isCapturingRef.current) {
                    // Capture was active but now stopped
                    isCapturingRef.current = false;
                    var event_1 = {
                        type: 'stopped',
                        timestamp: new Date()
                    };
                    onCaptureChange === null || onCaptureChange === void 0 ? void 0 : onCaptureChange(event_1);
                }
                return;
            }
            var videoTrack = stream.getVideoTracks()[0];
            if (!videoTrack) {
                if (isCapturingRef.current) {
                    isCapturingRef.current = false;
                    var event_2 = {
                        type: 'stopped',
                        timestamp: new Date()
                    };
                    onCaptureChange === null || onCaptureChange === void 0 ? void 0 : onCaptureChange(event_2);
                }
                return;
            }
            // Check if track is live (actively capturing)
            if (videoTrack.readyState === 'live' && !isCapturingRef.current) {
                // Capture started → HIGH RISK
                isCapturingRef.current = true;
                var settings = videoTrack.getSettings();
                var sourceId = settings.sourceId;
                var event_3 = {
                    type: 'started',
                    timestamp: new Date(),
                    sourceId: settings.displaySurface || sourceId,
                    sourceName: videoTrack.label,
                    captureType: getCaptureType(settings.displaySurface)
                };
                onCaptureChange === null || onCaptureChange === void 0 ? void 0 : onCaptureChange(event_3);
                reporter.report(event_3, accountId);
            }
            else if (videoTrack.readyState !== 'live' && isCapturingRef.current) {
                // Capture stopped
                isCapturingRef.current = false;
                var event_4 = {
                    type: 'stopped',
                    timestamp: new Date()
                };
                onCaptureChange === null || onCaptureChange === void 0 ? void 0 : onCaptureChange(event_4);
            }
        };
        // Start periodic check
        checkIntervalRef.current = setInterval(checkCaptureState, checkIntervalMs);
        // Add event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        // Cleanup on unmount
        return function () {
            cleanup();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, checkIntervalMs, onCaptureChange, onVisibilityChange, cleanup, accountId]);
    // ============== Window Focus/Blur Handler ==============
    (0, react_1.useEffect)(function () {
        if (!enabled || !onWindowFocusChange)
            return;
        // Track focus states for detecting suspicious behavior
        var handleWindowBlur = function () {
            // Normal window blur (switching apps) - NOT suspicious
            // Only mark as suspicious if we detect rapid switching pattern
            onWindowFocusChange({
                type: 'blur',
                suspicious: false, // Normal browser behavior
                reason: 'Window lost focus (normal browser behavior)'
            });
        };
        var handleWindowFocus = function () {
            onWindowFocusChange({ type: 'focus' });
        };
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);
        return function () {
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [enabled, onWindowFocusChange]);
    // ============== Public API ==============
    /**
     * Request screen capture (for app's own screenshot feature)
     * Returns the MediaStream if successful, null otherwise
     */
    var requestScreenCapture = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var stream, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, navigator.mediaDevices.getDisplayMedia({
                            video: {
                                displaySurface: 'monitor',
                                width: { ideal: 1920 },
                                height: { ideal: 1080 }
                            },
                            audio: false
                        })];
                case 1:
                    stream = _a.sent();
                    streamRef.current = stream;
                    // Listen for user stopping the share
                    stream.getVideoTracks()[0].onended = function () {
                        var event = {
                            type: 'stopped',
                            timestamp: new Date()
                        };
                        onCaptureChange === null || onCaptureChange === void 0 ? void 0 : onCaptureChange(event);
                        streamRef.current = null;
                    };
                    return [2 /*return*/, stream];
                case 2:
                    error_2 = _a.sent();
                    console.error('[ScreenCaptureMonitor] Screen capture failed:', error_2);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    }); }, [onCaptureChange]);
    /**
     * Stop screen capture
     */
    var stopScreenCapture = (0, react_1.useCallback)(function () {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(function (track) { return track.stop(); });
            streamRef.current = null;
        }
    }, []);
    /**
     * Check if currently capturing
     */
    var isCapturing = (0, react_1.useCallback)(function () {
        return isCapturingRef.current;
    }, []);
    return {
        requestScreenCapture: requestScreenCapture,
        stopScreenCapture: stopScreenCapture,
        isCapturing: isCapturing
    };
}
exports.default = useScreenCaptureMonitor;
