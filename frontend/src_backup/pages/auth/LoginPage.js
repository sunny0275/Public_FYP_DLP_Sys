"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoginPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
var PasswordInput_1 = require("../../components/PasswordInput");
function LoginPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var searchParams = (0, react_router_dom_1.useSearchParams)()[0];
    var setAuth = (0, authStore_1.useAuthStore)(function (state) { return state.setAuth; });
    var updateUser = (0, authStore_1.useAuthStore)(function (state) { return state.updateUser; });
    var clearAuth = (0, authStore_1.useAuthStore)(function (state) { return state.clearAuth; });
    var _a = (0, react_1.useState)({
        accountId: '',
        password: ''
    }), formData = _a[0], setFormData = _a[1];
    var _b = (0, react_1.useState)(''), error = _b[0], setError = _b[1];
    var _c = (0, react_1.useState)(false), loading = _c[0], setLoading = _c[1];
    var accountDisabledReason = searchParams.get('reason') === 'account_disabled';
    var handleChange = function (e) {
        var _a;
        setFormData(__assign(__assign({}, formData), (_a = {}, _a[e.target.name] = e.target.value, _a)));
        setError('');
    };
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var response, loginData, isPeriodicExpiry, targetPath, roles, isAdmin_1, redirectByRole, target, err_1;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    e.preventDefault();
                    setLoading(true);
                    setError('');
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.login({
                            accountId: formData.accountId,
                            password: formData.password
                        })];
                case 2:
                    response = _f.sent();
                    loginData = response.data;
                    if (loginData.passwordChangeRequired || loginData.firstLogin) {
                        isPeriodicExpiry = loginData.passwordChangeRequired && loginData.mfaEnabled;
                        targetPath = isPeriodicExpiry ? '/update-password' : '/change-password';
                        if (loginData.accessToken && loginData.refreshToken) {
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
                        }
                        else {
                            // Fallback: if no tokens, just update user info
                            updateUser({
                                userId: loginData.userId,
                                accountId: loginData.accountId,
                                email: loginData.email,
                                fullName: loginData.fullName,
                                firstLogin: loginData.firstLogin,
                                passwordChangeRequired: loginData.passwordChangeRequired,
                                mfaEnabled: loginData.mfaEnabled,
                                mfaRequired: loginData.mfaRequired
                            });
                        }
                        navigate(targetPath);
                    }
                    else if (loginData.mfaRequired && !loginData.mfaEnabled) {
                        // MFA setup required
                        if (loginData.accessToken && loginData.refreshToken) {
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
                        }
                        else {
                            updateUser({
                                userId: loginData.userId,
                                accountId: loginData.accountId,
                                email: loginData.email,
                                fullName: loginData.fullName,
                                firstLogin: loginData.firstLogin,
                                passwordChangeRequired: loginData.passwordChangeRequired,
                                mfaEnabled: loginData.mfaEnabled,
                                mfaRequired: loginData.mfaRequired
                            });
                        }
                        navigate('/mfa-setup');
                    }
                    else if (loginData.mfaRequired && loginData.mfaEnabled) {
                        clearAuth();
                        sessionStorage.setItem('pending-login', JSON.stringify({
                            accountId: formData.accountId,
                            password: formData.password
                        }));
                        updateUser({
                            userId: loginData.userId,
                            accountId: loginData.accountId,
                            email: loginData.email,
                            fullName: loginData.fullName,
                            firstLogin: loginData.firstLogin,
                            passwordChangeRequired: loginData.passwordChangeRequired,
                            mfaEnabled: loginData.mfaEnabled,
                            mfaRequired: loginData.mfaRequired
                        });
                        navigate('/mfa-verify');
                    }
                    else if (!loginData.mfaEnabled && (loginData.mfaQrCodeUrl || loginData.mfaSecret)) {
                        if (loginData.accessToken && loginData.refreshToken) {
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
                                mfaEnabled: false,
                                mfaRequired: true
                            }, loginData.accessToken, loginData.refreshToken);
                        }
                        navigate('/mfa-setup');
                    }
                    else if (loginData.accessToken && loginData.refreshToken) {
                        // Successful login - only if password change is NOT required
                        console.log('Successful login - navigating to dashboard/home');
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
                        // Set accountId in Electron preload for security event reporting
                        // This allows Electron main process to include the correct user accountId when sending security events
                        // Only call if running in Electron (window.electronAPI is only available in Electron)
                        console.log('[LoginPage] Calling setAccountId:', loginData.accountId);
                        if (typeof window !== 'undefined' && ((_a = window.electronAPI) === null || _a === void 0 ? void 0 : _a.setAccountId)) {
                            window.electronAPI.setAccountId(loginData.accountId);
                            console.log('[LoginPage] setAccountId called with:', loginData.accountId);
                        }
                        else {
                            console.log('[LoginPage] electronAPI.setAccountId not available');
                        }
                        // Show password expiry warning if needed
                        if (loginData.passwordExpiringSoon && loginData.daysUntilPasswordExpiry) {
                            alert("Warning: Your password will expire in ".concat(loginData.daysUntilPasswordExpiry, " days"));
                        }
                        roles = loginData.roles || [];
                        console.log('Login successful - User roles:', roles);
                        isAdmin_1 = roles.includes('ADMIN');
                        console.log('Is admin?', isAdmin_1);
                        redirectByRole = function () {
                            if (isAdmin_1)
                                return '/dashboard/admin';
                            return '/dashboard';
                        };
                        target = redirectByRole();
                        console.log('Redirecting after login to', target);
                        navigate(target, { replace: true });
                        window.history.replaceState(null, '', target);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _f.sent();
                    setError(((_c = (_b = err_1.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || ((_e = (_d = err_1.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.error) || 'Login failed');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="container">
      <div className="form-container">
        <h2>DLP Platform Login</h2>
        <p style={{ marginBottom: '20px', color: '#888' }}>Enterprise-Level Data Protection System</p>

        {accountDisabledReason && (<div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '6px',
                color: '#856404',
                fontSize: '0.9em'
            }}>
            <strong>Signed out:</strong> Your account has been disabled due to a UEBA policy violation. Please contact your administrator.
          </div>)}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="accountId">Account ID</label>
            <input id="accountId" name="accountId" type="text" value={formData.accountId} onChange={handleChange} required autoFocus placeholder="Enter your account ID"/>
          </div>

          <PasswordInput_1.default id="password" name="password" value={formData.password} onChange={handleChange} required placeholder="Enter your password" label="Password"/>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button type="button" onClick={function () { return navigate('/forgot-password'); }} style={{
            background: 'transparent',
            border: 'none',
            color: '#007bff',
            cursor: 'pointer',
            textDecoration: 'underline'
        }}>
              Forgot Password?
            </button>
          </div>
        </form>

        <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#888' }}>

        </div>
      </div>
    </div>);
}
