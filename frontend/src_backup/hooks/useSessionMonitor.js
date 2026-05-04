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
exports.useSessionMonitor = useSessionMonitor;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var authStore_1 = require("../store/authStore");
var api_1 = require("../api");
function useSessionMonitor() {
    var _this = this;
    var _a = (0, authStore_1.useAuthStore)(), isAuthenticated = _a.isAuthenticated, accessToken = _a.accessToken, clearAuth = _a.clearAuth;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _b = (0, react_1.useState)({ show: false, message: '', timeRemaining: 0 }), toast = _b[0], setToast = _b[1];
    var intervalRef = (0, react_1.useRef)(null);
    var warningShownRef = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(function () {
        if (!isAuthenticated || !accessToken) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            warningShownRef.current = false;
            return;
        }
        var checkSessionExpiry = function () {
            try {
                var parts = accessToken.split('.');
                if (parts.length !== 3) {
                    return;
                }
                var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                var padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
                var payloadString = atob(padded);
                var payload = JSON.parse(payloadString);
                if (!payload.exp || typeof payload.exp !== 'number') {
                    return;
                }
                var expirationTime = payload.exp * 1000; // ms
                var issuedAtTime = payload.iat && typeof payload.iat === 'number'
                    ? payload.iat * 1000
                    : Date.now();
                var now = Date.now();
                // ---- Working hours / 4-hour rule based on login time ----
                var loginDate = new Date(issuedAtTime);
                var sixPm = new Date(loginDate);
                sixPm.setHours(18, 0, 0, 0); // 18:00
                var sixPmPlusOne = new Date(loginDate);
                sixPmPlusOne.setHours(18, 1, 0, 0); // 18:01
                var ruleEndTime = void 0;
                var ruleType = void 0;
                if (issuedAtTime < sixPm.getTime()) {
                    // 6:00 PM to 6:01 PM 1 minute countdown
                    ruleEndTime = sixPmPlusOne.getTime();
                    ruleType = 'WORKING_HOURS';
                }
                else {
                    // 6:00 PM after login: 4 hours from login time
                    var fourHoursMs = 4 * 60 * 60 * 1000;
                    ruleEndTime = issuedAtTime + fourHoursMs;
                    ruleType = 'FOUR_HOURS';
                }
                // Implementation of the actual session end time = the earlier of the JWT expiration time or the custom rule end time
                var sessionEndTime = Math.min(ruleEndTime, expirationTime);
                var timeRemaining = sessionEndTime - now;
                // Session expired
                if (timeRemaining <= 0) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                    }
                    setToast({
                        show: true,
                        message: ruleType === 'WORKING_HOURS'
                            ? 'Working hours/session ended. Logging out...'
                            : 'Your session has expired. Redirecting to login...',
                        timeRemaining: 0
                    });
                    // Delay logout by 3 seconds to show message
                    setTimeout(function () {
                        clearAuth();
                        navigate('/login', { state: { reason: 'session_expired' } });
                    }, 3000);
                    return;
                }
                var minutes1 = 1 * 60 * 1000;
                var twoMinutes = 2 * 60 * 1000;
                // ---- Special rule: 6:00 PM to 6:01 PM 1 minute countdown ----
                if (ruleType === 'WORKING_HOURS' && timeRemaining <= minutes1) {
                    var secondsLeft = Math.floor(timeRemaining / 1000);
                    var minutesLeft = Math.floor(secondsLeft / 60);
                    var secondsDisplay = secondsLeft % 60;
                    setToast({
                        show: true,
                        message: "Working hours end at 6:00 PM. Auto logout in ".concat(minutesLeft, ":").concat(secondsDisplay
                            .toString()
                            .padStart(2, '0'), " to save your work."),
                        timeRemaining: secondsLeft
                    });
                    warningShownRef.current = true;
                    return;
                }
                // ---- General rule: 2 minutes before session expires ----
                if (timeRemaining <= twoMinutes) {
                    var secondsLeft = Math.floor(timeRemaining / 1000);
                    var minutesLeft = Math.floor(secondsLeft / 60);
                    var secondsDisplay = secondsLeft % 60;
                    setToast({
                        show: true,
                        message: "Session expires in ".concat(minutesLeft, ":").concat(secondsDisplay
                            .toString()
                            .padStart(2, '0')),
                        timeRemaining: secondsLeft
                    });
                    warningShownRef.current = true;
                }
            }
            catch (error) {
                console.error('Error checking session expiry:', error);
            }
        };
        // Check immediately
        checkSessionExpiry();
        // Check every second for smooth countdown
        intervalRef.current = setInterval(checkSessionExpiry, 1000);
        return function () {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            // Reset warning flag on cleanup
            warningShownRef.current = false;
        };
    }, [isAuthenticated, accessToken, clearAuth, navigate]);
    var extendSession = function () { return __awaiter(_this, void 0, void 0, function () {
        var refreshToken, response, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    refreshToken = authStore_1.useAuthStore.getState().refreshToken;
                    if (!refreshToken) return [3 /*break*/, 2];
                    return [4 /*yield*/, api_1.apiClient.refreshToken(refreshToken)];
                case 1:
                    response = _b.sent();
                    authStore_1.useAuthStore.getState().setAuth({
                        userId: response.data.userId,
                        accountId: response.data.accountId,
                        email: response.data.email,
                        fullName: response.data.fullName,
                        department: response.data.department,
                        position: response.data.position,
                        roles: response.data.roles || [],
                        availableDashboards: response.data.availableDashboards || [],
                        firstLogin: response.data.firstLogin,
                        passwordChangeRequired: response.data.passwordChangeRequired,
                        mfaEnabled: response.data.mfaEnabled,
                        mfaRequired: response.data.mfaRequired
                    }, response.data.accessToken, response.data.refreshToken);
                    // Update Electron accountId for security event reporting
                    if (typeof window !== 'undefined' && ((_a = window.electronAPI) === null || _a === void 0 ? void 0 : _a.setAccountId)) {
                        window.electronAPI.setAccountId(response.data.accountId);
                    }
                    setToast({ show: false, message: '', timeRemaining: 0 });
                    warningShownRef.current = false;
                    _b.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    error_1 = _b.sent();
                    console.error('Failed to extend session:', error_1);
                    clearAuth();
                    navigate('/login');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var dismissToast = function () {
        setToast({ show: false, message: '', timeRemaining: 0 });
    };
    return {
        toast: toast,
        extendSession: extendSession,
        dismissToast: dismissToast
    };
}
