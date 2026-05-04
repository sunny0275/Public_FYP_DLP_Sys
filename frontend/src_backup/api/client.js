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
exports.createClient = createClient;
var axios_1 = require("axios");
var types_1 = require("../types");
var authStore_1 = require("../store/authStore");
var refreshPromise = null;
var permissionDeniedAlertShown = false;
var permissionDeniedAlertTimer = null;
function createClient() {
    var _this = this;
    var client = axios_1.default.create({
        baseURL: types_1.API_BASE_URL,
        headers: { 'Content-Type': 'application/json' },
    });
    client.interceptors.request.use(function (config) {
        var token = authStore_1.useAuthStore.getState().accessToken;
        if (token)
            config.headers.Authorization = "Bearer ".concat(token);
        return config;
    }, function (error) { return Promise.reject(error); });
    client.interceptors.response.use(function (response) { return response; }, function (error) { return __awaiter(_this, void 0, void 0, function () {
        var originalRequest, requestUrl, isAuthEndpointRequest, responseData, errorMessage, isAccountDisabled, isPermissionDenied, refreshToken, response, currentPath, isOnLoginFlow, refreshError_1, currentPath, isOnLoginFlow;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    originalRequest = error.config;
                    requestUrl = ((originalRequest === null || originalRequest === void 0 ? void 0 : originalRequest.url) || '');
                    isAuthEndpointRequest = typeof requestUrl === 'string' &&
                        (requestUrl.includes('/auth/login') ||
                            requestUrl.includes('/auth/refresh') ||
                            requestUrl.includes('/auth/mfa/verify') ||
                            requestUrl.includes('/auth/change-password') ||
                            requestUrl.includes('/auth/forgot-password') ||
                            requestUrl.includes('/auth/logout') ||
                            requestUrl.includes('/auth/me'));
                    responseData = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data;
                    errorMessage = (responseData === null || responseData === void 0 ? void 0 : responseData.message) || '';
                    isAccountDisabled = (errorMessage.toLowerCase().includes('account is disabled') ||
                        errorMessage.toLowerCase().includes('account has been disabled')) &&
                        errorMessage.toLowerCase().includes('ueba');
                    isPermissionDenied = ((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 403 &&
                        !isAccountDisabled;
                    if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 403 && isAccountDisabled && !isAuthEndpointRequest) {
                        authStore_1.useAuthStore.getState().clearAuth();
                        alert('Your account has been disabled (UEBA policy violation). You are being signed out.');
                        window.location.href = '/login?reason=account_disabled';
                        return [2 /*return*/, Promise.reject(error)];
                    }
                    // Permission denied (e.g., document access) — show warning alert, redirect to document library.
                    // This does NOT sign the user out, but triggers a UEBA score deduction on the server side.
                    // Use debounce to prevent multiple alerts from rapid parallel requests.
                    if (isPermissionDenied && !isAuthEndpointRequest) {
                        // Clear any pending alert timer
                        if (permissionDeniedAlertTimer) {
                            clearTimeout(permissionDeniedAlertTimer);
                        }
                        // Only show alert once per navigation context
                        if (!permissionDeniedAlertShown) {
                            permissionDeniedAlertShown = true;
                            alert('You do not have permission to access this document. This attempt has been logged for security review.');
                            window.location.href = '/documents';
                        }
                        return [2 /*return*/, Promise.reject(error)];
                    }
                    if (!(((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) === 401 && !originalRequest._retry)) return [3 /*break*/, 5];
                    if (isAuthEndpointRequest)
                        return [2 /*return*/, Promise.reject(error)];
                    originalRequest._retry = true;
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 4, , 5]);
                    refreshToken = authStore_1.useAuthStore.getState().refreshToken;
                    if (!refreshToken) return [3 /*break*/, 3];
                    if (!refreshPromise) {
                        refreshPromise = client
                            .post('/auth/refresh', { refreshToken: refreshToken })
                            .then(function (r) { return r.data; })
                            .finally(function () { refreshPromise = null; });
                    }
                    return [4 /*yield*/, refreshPromise];
                case 2:
                    response = _g.sent();
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
                    originalRequest.headers.Authorization = "Bearer ".concat(response.data.accessToken);
                    return [2 /*return*/, client(originalRequest)];
                case 3:
                    currentPath = ((_e = window.location) === null || _e === void 0 ? void 0 : _e.pathname) || '';
                    isOnLoginFlow = currentPath.startsWith('/login') || currentPath.startsWith('/mfa-verify');
                    if (isOnLoginFlow || isAuthEndpointRequest)
                        return [2 /*return*/, Promise.reject(error)];
                    authStore_1.useAuthStore.getState().clearAuth();
                    window.location.href = '/login';
                    return [3 /*break*/, 5];
                case 4:
                    refreshError_1 = _g.sent();
                    refreshPromise = null;
                    currentPath = ((_f = window.location) === null || _f === void 0 ? void 0 : _f.pathname) || '';
                    isOnLoginFlow = currentPath.startsWith('/login') || currentPath.startsWith('/mfa-verify');
                    if (isOnLoginFlow || isAuthEndpointRequest)
                        return [2 /*return*/, Promise.reject(error)];
                    authStore_1.useAuthStore.getState().clearAuth();
                    window.location.href = '/login';
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, Promise.reject(error)];
            }
        });
    }); });
    return client;
}
