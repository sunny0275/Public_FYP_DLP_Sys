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
exports.default = MfaVerifyPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
function MfaVerifyPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var location = (0, react_router_dom_1.useLocation)();
    var setAuth = (0, authStore_1.useAuthStore)(function (state) { return state.setAuth; });
    var MAX_ATTEMPTS = 5;
    // Get credentials from sessionStorage (set by LoginPage) or navigation state
    var _a = (0, react_1.useState)(null), credentials = _a[0], setCredentials = _a[1];
    var _b = (0, react_1.useState)(''), mfaCode = _b[0], setMfaCode = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(false), loading = _d[0], setLoading = _d[1];
    var _e = (0, react_1.useState)(MAX_ATTEMPTS), attemptsLeft = _e[0], setAttemptsLeft = _e[1];
    (0, react_1.useEffect)(function () {
        // Try to get credentials from sessionStorage first, then location.state
        var pendingLogin = sessionStorage.getItem('pending-login');
        if (pendingLogin) {
            try {
                var parsed = JSON.parse(pendingLogin);
                setCredentials(parsed);
            }
            catch (e) {
                console.error('Failed to parse pending-login from sessionStorage:', e);
            }
        }
        else if (location.state) {
            var _a = location.state, accountId = _a.accountId, password = _a.password;
            if (accountId && password) {
                setCredentials({ accountId: accountId, password: password });
            }
        }
        // Redirect to login if no credentials found
        if (!credentials && !pendingLogin && !location.state) {
            navigate('/login');
        }
    }, [navigate, location.state]);
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var response, loginData, roles, isAdmin, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    e.preventDefault();
                    if (attemptsLeft <= 0)
                        return [2 /*return*/];
                    setLoading(true);
                    setError('');
                    // Validate MFA code format
                    if (!/^\d{6}$/.test(mfaCode)) {
                        setError('Please enter a valid 6-digit code');
                        setLoading(false);
                        return [2 /*return*/];
                    }
                    if (!credentials) {
                        setError('Unable to retrieve login details. Please log in again.');
                        setLoading(false);
                        navigate('/login');
                        return [2 /*return*/];
                    }
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.login({
                            accountId: credentials.accountId,
                            password: credentials.password,
                            mfaCode: mfaCode
                        })];
                case 2:
                    response = _e.sent();
                    loginData = response.data;
                    // Check if we got tokens (successful MFA verification)
                    if (loginData.accessToken && loginData.refreshToken) {
                        // Store authentication
                        setAuth({
                            userId: loginData.userId,
                            accountId: loginData.accountId,
                            email: loginData.email,
                            fullName: loginData.fullName,
                            department: loginData.department,
                            position: loginData.position,
                            roles: loginData.roles || [],
                            availableDashboards: loginData.availableDashboards || [],
                            firstLogin: loginData.firstLogin,
                            passwordChangeRequired: loginData.passwordChangeRequired,
                            mfaEnabled: loginData.mfaEnabled,
                            mfaRequired: loginData.mfaRequired
                        }, loginData.accessToken, loginData.refreshToken);
                        // Clear pending login from sessionStorage
                        sessionStorage.removeItem('pending-login');
                        // Set accountId in Electron preload for security event reporting
                        if (typeof window !== 'undefined' && ((_a = window.electronAPI) === null || _a === void 0 ? void 0 : _a.setAccountId)) {
                            window.electronAPI.setAccountId(loginData.accountId);
                        }
                        roles = loginData.roles || [];
                        console.log('MFA verification successful - User roles:', roles);
                        isAdmin = roles.includes('ADMIN');
                        console.log('Is admin?', isAdmin);
                        if (isAdmin) {
                            console.log('Redirecting ADMIN to /dashboard/admin');
                            navigate('/dashboard/admin', { replace: true });
                        }
                        else {
                            console.log('Redirecting non-admin user to /home');
                            navigate('/home', { replace: true });
                        }
                    }
                    else {
                        setAttemptsLeft(function (prev) {
                            var next = prev - 1;
                            if (next <= 0) {
                                setError('Too many failed attempts. Please go back to login and try again later.');
                            }
                            else {
                                setError("Invalid verification code. Attempts left: ".concat(next));
                            }
                            return next;
                        });
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _e.sent();
                    console.error('MFA verification error:', err_1);
                    // If backend locked the account, stop further attempts on this page.
                    if (((_b = err_1.response) === null || _b === void 0 ? void 0 : _b.status) === 403) {
                        setAttemptsLeft(0);
                        setError(((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Account locked. Please try again later.');
                    }
                    else {
                        setAttemptsLeft(function (prev) {
                            var _a, _b, _c, _d;
                            var next = prev - 1;
                            var msg = ((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || 'Invalid verification code';
                            if (next <= 0) {
                                setError('Too many failed attempts. Please go back to login and try again later.');
                            }
                            else {
                                setError("".concat(msg, " (Attempts left: ").concat(next, ")"));
                            }
                            return next;
                        });
                    }
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleBack = function () {
        sessionStorage.removeItem('pending-login');
        authStore_1.useAuthStore.getState().clearAuth();
        navigate('/login', { replace: true });
    };
    if (!credentials) {
        return null; // Will redirect in useEffect
    }
    return (<div className="container">
      <div className="form-container">
        <h2>Two-Factor Authentication</h2>
        <p style={{ marginBottom: '20px', color: '#888' }}>
          Enter the 6-digit code from your authenticator app
        </p>

        <div style={{
            padding: '15px',
            background: '#f0f7ff',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #d0e7ff'
        }}>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#0066cc' }}>
            <strong>Account:</strong> {credentials.accountId}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="mfaCode">Verification Code</label>
            <input id="mfaCode" name="mfaCode" type="text" value={mfaCode} onChange={function (e) {
            // Only allow digits
            var value = e.target.value.replace(/\D/g, '');
            if (value.length <= 6) {
                setMfaCode(value);
                setError('');
            }
        }} required autoFocus placeholder="000000" maxLength={6} pattern="\d{6}" disabled={attemptsLeft <= 0 || loading} style={{
            fontSize: '1.5em',
            letterSpacing: '0.5em',
            textAlign: 'center',
            fontFamily: 'monospace'
        }}/>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="primary" disabled={loading || mfaCode.length !== 6 || attemptsLeft <= 0}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <button type="button" onClick={handleBack} style={{
            marginTop: '10px',
            background: 'transparent',
            color: '#666',
            border: '1px solid #ddd'
        }}>
            Back to Login
          </button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '0.85em', color: '#888', textAlign: 'center' }}>
          <p>Can't access your authenticator app?</p>
          <p style={{ marginTop: '8px' }}>
            Contact your system administrator for assistance.
          </p>
        </div>
      </div>
    </div>);
}
