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
exports.default = MfaSetupPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
var qrcode_react_1 = require("qrcode.react");
var MFA_SETUP_SESSION_KEY = 'mfa-setup-session';
var MFA_SETUP_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
function isMfaSetupSessionValid() {
    var timestamp = sessionStorage.getItem(MFA_SETUP_SESSION_KEY);
    if (!timestamp)
        return false;
    var elapsed = Date.now() - parseInt(timestamp, 10);
    return elapsed < MFA_SETUP_TIMEOUT_MS;
}
function startMfaSetupSession() {
    sessionStorage.setItem(MFA_SETUP_SESSION_KEY, Date.now().toString());
}
function clearMfaSetupSession() {
    sessionStorage.removeItem(MFA_SETUP_SESSION_KEY);
}
function MfaSetupPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, authStore_1.useAuthStore)(), user = _a.user, updateUser = _a.updateUser, clearAuth = _a.clearAuth;
    var isRebind = !!(user === null || user === void 0 ? void 0 : user.mfaEnabled);
    var _b = (0, react_1.useState)(null), mfaData = _b[0], setMfaData = _b[1];
    var _c = (0, react_1.useState)(''), verificationCode = _c[0], setVerificationCode = _c[1];
    var _d = (0, react_1.useState)(''), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(''), success = _e[0], setSuccess = _e[1];
    var _f = (0, react_1.useState)(false), loading = _f[0], setLoading = _f[1];
    var _g = (0, react_1.useState)(true), setupLoading = _g[0], setSetupLoading = _g[1];
    var _h = (0, react_1.useState)(null), countdown = _h[0], setCountdown = _h[1];
    // Validate MFA setup session on mount
    (0, react_1.useEffect)(function () {
        // Check if we are in a valid MFA setup flow
        var isSetupRequired = !(user === null || user === void 0 ? void 0 : user.mfaEnabled) && (user === null || user === void 0 ? void 0 : user.mfaRequired);
        var hasValidSession = isMfaSetupSessionValid();
        if (!isSetupRequired && !hasValidSession) {
            console.warn('MFA setup session invalid or not required. Redirecting to login.');
            clearAuth();
            navigate('/login', { replace: true });
            return;
        }
        // If this is a new session (no timestamp), start one
        if (!sessionStorage.getItem(MFA_SETUP_SESSION_KEY)) {
            startMfaSetupSession();
        }
        loadMfaSetup();
    }, []);
    var loadMfaSetup = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, _a, err_1;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    _j.trys.push([0, 5, 6, 7]);
                    if (!isRebind) return [3 /*break*/, 2];
                    return [4 /*yield*/, api_1.apiClient.mfaBindInitiate()];
                case 1:
                    _a = _j.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, api_1.apiClient.setupMfa()];
                case 3:
                    _a = _j.sent();
                    _j.label = 4;
                case 4:
                    response = _a;
                    setMfaData({
                        secret: (_c = (_b = response.data) === null || _b === void 0 ? void 0 : _b.secret) !== null && _c !== void 0 ? _c : '',
                        qrCodeImage: (_d = response.data) === null || _d === void 0 ? void 0 : _d.qrCodeImage,
                        qrCodeUrl: (_f = (_e = response.data) === null || _e === void 0 ? void 0 : _e.qrCodeUrl) !== null && _f !== void 0 ? _f : ''
                    });
                    return [3 /*break*/, 7];
                case 5:
                    err_1 = _j.sent();
                    setError(((_h = (_g = err_1.response) === null || _g === void 0 ? void 0 : _g.data) === null || _h === void 0 ? void 0 : _h.message) || (isRebind ? 'Failed to start MFA re-bind' : 'Failed to setup MFA'));
                    return [3 /*break*/, 7];
                case 6:
                    setSetupLoading(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleVerify = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    e.preventDefault();
                    setLoading(true);
                    setError('');
                    setSuccess('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, 7, 8]);
                    if (!isRebind) return [3 /*break*/, 3];
                    return [4 /*yield*/, api_1.apiClient.mfaBindVerify(verificationCode)];
                case 2:
                    _c.sent();
                    setSuccess('MFA re-bound successfully. Redirecting...');
                    updateUser({ mfaEnabled: true, mfaRequired: false });
                    clearMfaSetupSession();
                    setCountdown(2);
                    setTimeout(function () { return navigate('/profile', { replace: true }); }, 2000);
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, api_1.apiClient.verifyMfa(verificationCode)];
                case 4:
                    _c.sent();
                    setSuccess('Finish setup complete! Redirecting to login shortly...');
                    updateUser({
                        mfaEnabled: true,
                        mfaRequired: false,
                        firstLogin: false,
                        passwordChangeRequired: false
                    });
                    clearMfaSetupSession();
                    setCountdown(3);
                    setTimeout(function () {
                        clearAuth();
                        navigate('/login', { replace: true });
                    }, 3000);
                    _c.label = 5;
                case 5: return [3 /*break*/, 8];
                case 6:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'MFA verification failed');
                    return [3 /*break*/, 8];
                case 7:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        if (countdown === null || isRebind)
            return;
        if (countdown <= 0) {
            clearMfaSetupSession();
            clearAuth();
            navigate('/login', { replace: true });
            return;
        }
        var timer = setTimeout(function () { return setCountdown(function (prev) { return (prev !== null ? prev - 1 : null); }); }, 1000);
        return function () { return clearTimeout(timer); };
    }, [countdown, isRebind, clearAuth, navigate]);
    if (setupLoading) {
        return (<div className="container">
        <div className="form-container">
          <h2>Setting up MFA...</h2>
        </div>
      </div>);
    }
    return (<div className="container">
      <div className="form-container">
        <h2>{isRebind ? 'Re-bind MFA (New Device)' : 'Setup Multi-Factor Authentication'}</h2>
        <p style={{ marginBottom: '20px', color: '#888' }}>
          {isRebind ? 'Scan the new QR code with your authenticator app on the new device.' : 'Scan the QR code with your authenticator app'}
        </p>

        {mfaData && (<div className="qr-code-container">
            {mfaData.qrCodeUrl && (<div style={{
                    padding: '20px',
                    background: 'white',
                    borderRadius: '8px',
                    display: 'inline-block'
                }}>
                <qrcode_react_1.QRCodeSVG value={mfaData.qrCodeUrl} size={260} includeMargin/>
              </div>)}

            <div>
              <p style={{ marginBottom: '8px', fontWeight: '500' }}>Manual Entry Code:</p>
              <div className="secret-code">{mfaData.secret}</div>
            </div>
          </div>)}

        <form onSubmit={handleVerify} style={{ marginTop: '20px' }}>
          <div className="form-group">
            <label htmlFor="verificationCode">Verification Code</label>
            <input id="verificationCode" name="verificationCode" type="text" value={verificationCode} onChange={function (e) {
            setVerificationCode(e.target.value);
            setError('');
        }} required placeholder="Enter 6-digit code" maxLength={6} pattern="\d{6}"/>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          {countdown !== null && (<div className="success-message" style={{ marginTop: '8px', fontSize: '0.95em' }}>
              Redirecting to login in {countdown} second{countdown === 1 ? '' : 's'}...
            </div>)}

          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Verifying...' : isRebind ? 'Verify and Re-bind MFA' : 'Verify and Enable MFA'}
          </button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '0.85em', color: '#888', textAlign: 'left' }}>
          <p><strong>Setup Instructions:</strong></p>
          <ol style={{ marginTop: '8px', marginLeft: '20px' }}>
            <li>Install an authenticator app (Google Authenticator, Authy, etc.)</li>
            <li>Scan the QR code or enter the code manually</li>
            <li>Enter the 6-digit code from your app to verify</li>
          </ol>
        </div>
      </div>
    </div>);
}
