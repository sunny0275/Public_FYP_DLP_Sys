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
exports.default = ForgotPasswordPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
function ForgotPasswordPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)(''), accountId = _a[0], setAccountId = _a[1];
    var _b = (0, react_1.useState)(''), email = _b[0], setEmail = _b[1];
    var _c = (0, react_1.useState)(false), submitted = _c[0], setSubmitted = _c[1];
    var _d = (0, react_1.useState)(''), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(false), loading = _e[0], setLoading = _e[1];
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    e.preventDefault();
                    setError('');
                    if (!accountId.trim() || !email.trim()) {
                        setError('Please provide both Account ID and Email');
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError('');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.forgotPassword(accountId.trim(), email.trim())];
                case 2:
                    _e.sent();
                    setSubmitted(true);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _e.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || 'Failed to submit request');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    if (submitted) {
        return (<div className="container">
        <div className="auth-form">
          <h2>Password Reset Request Submitted</h2>
          <div style={{
                padding: '20px',
                background: '#d4edda',
                border: '1px solid #c3e6cb',
                borderRadius: '8px',
                marginBottom: '20px',
                color: '#155724'
            }}>
            <h3 style={{ marginTop: 0 }}>✓ Request Received</h3>
            <p>
              Your password reset request has been submitted successfully.
            </p>
            <p>
              An administrator will review your request and contact you with a temporary password
              via your registered email address.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>What happens next:</strong>
              <ul style={{ marginTop: '10px' }}>
                <li>Admin reviews your identity verification</li>
                <li>Admin resets your password to a temporary value</li>
                <li>You'll receive the temporary password securely</li>
                <li>Use the temporary password to login and set a new password</li>
              </ul>
            </p>
          </div>
          <p style={{ color: '#888', fontSize: '14px' }}>
            This process typically takes 1-2 business days. If urgent, please contact your IT department directly.
          </p>
          <button onClick={function () { return navigate('/login'); }} className="primary">
            Return to Login
          </button>
        </div>
      </div>);
    }
    return (<div className="container">
      <div className="auth-form">
        <h2>Forgot Password</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Submit a password reset request. An administrator will review and contact you with a temporary password.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="accountId">Account ID</label>
            <input id="accountId" type="text" value={accountId} onChange={function (e) { return setAccountId(e.target.value); }} placeholder="Enter your account ID" required autoFocus/>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input id="email" type="email" value={email} onChange={function (e) { return setEmail(e.target.value); }} placeholder="Enter your registered email" required/>
            <small style={{ color: '#888', fontSize: '13px' }}>
              This must match the email address registered with your account
            </small>
          </div>

          <div style={{
            padding: '15px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '14px'
        }}>
            <strong>⚠️ Important:</strong>
            <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
              <li>Password reset requests are reviewed manually by administrators</li>
              <li>You'll be contacted via your registered email</li>
              <li>Processing time: 1-2 business days</li>
              <li>For urgent issues, contact IT support directly</li>
            </ul>
          </div>

          <button type="submit" className="primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Reset Request'}
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button type="button" onClick={function () { return navigate('/login'); }} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer' }}>
              ← Back to Login
            </button>
          </div>
        </form>

        <div style={{
            marginTop: '30px',
            padding: '15px',
            background: '#f8f9fa',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#666'
        }}>
          <strong>Security Notice:</strong> For your security, password resets require administrator
          approval. If you didn't request this reset, please contact your security team immediately.
        </div>
      </div>
    </div>);
}
