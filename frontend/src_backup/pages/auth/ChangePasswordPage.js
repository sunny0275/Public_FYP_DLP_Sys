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
exports.default = ChangePasswordPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
var dashboardPaths_1 = require("../../utils/dashboardPaths");
var PasswordInput_1 = require("../../components/PasswordInput");
function ChangePasswordPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, authStore_1.useAuthStore)(), user = _a.user, updateUser = _a.updateUser;
    var _b = (0, react_1.useState)({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    }), formData = _b[0], setFormData = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(''), success = _d[0], setSuccess = _d[1];
    var _e = (0, react_1.useState)(false), loading = _e[0], setLoading = _e[1];
    var handleChange = function (e) {
        var _a;
        setFormData(__assign(__assign({}, formData), (_a = {}, _a[e.target.name] = e.target.value, _a)));
        setError('');
        setSuccess('');
    };
    var validatePassword = function (password) {
        var errors = [];
        if (password.length < 12) {
            errors.push('Password must be at least 12 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one digit');
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        return errors;
    };
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var validationErrors, needsMfaSetup_1, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    e.preventDefault();
                    setLoading(true);
                    setError('');
                    setSuccess('');
                    if (formData.newPassword !== formData.confirmPassword) {
                        setError('New passwords do not match');
                        setLoading(false);
                        return [2 /*return*/];
                    }
                    validationErrors = validatePassword(formData.newPassword);
                    if (validationErrors.length > 0) {
                        setError(validationErrors.join('. '));
                        setLoading(false);
                        return [2 /*return*/];
                    }
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.changePassword({
                            currentPassword: formData.currentPassword,
                            newPassword: formData.newPassword,
                            confirmPassword: formData.confirmPassword
                        })];
                case 2:
                    _e.sent();
                    needsMfaSetup_1 = !(user === null || user === void 0 ? void 0 : user.mfaEnabled);
                    updateUser({
                        firstLogin: false,
                        passwordChangeRequired: false,
                        mfaRequired: needsMfaSetup_1 ? true : user === null || user === void 0 ? void 0 : user.mfaRequired
                    });
                    setSuccess(needsMfaSetup_1 ? 'Password changed successfully! Redirecting to MFA setup...' : 'Password changed successfully! Redirecting...');
                    setTimeout(function () {
                        navigate(needsMfaSetup_1 ? '/mfa-setup' : ((0, dashboardPaths_1.getPreferredDashboardPath)(user) || '/dashboard'), { replace: true });
                    }, 2000);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _e.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || 'Password change failed');
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
        <h2>Change Password</h2>
        <p style={{ marginBottom: '20px', color: '#888' }}>
          Please change your password to continue
        </p>

        <form onSubmit={handleSubmit}>
          <PasswordInput_1.default id="currentPassword" name="currentPassword" value={formData.currentPassword} onChange={handleChange} required autoFocus placeholder="Enter current password" label="Current Password"/>

          <PasswordInput_1.default id="newPassword" name="newPassword" value={formData.newPassword} onChange={handleChange} required placeholder="Enter new password" label="New Password"/>

          <PasswordInput_1.default id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required placeholder="Confirm new password" label="Confirm New Password"/>

          <div className="info-message" style={{ textAlign: 'left', marginTop: '10px' }}>
            <strong>Password requirements:</strong>
            <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
              <li>At least 12 characters long</li>
              <li>At least one uppercase letter</li>
              <li>At least one lowercase letter</li>
              <li>At least one digit</li>
              <li>At least one special character</li>
            </ul>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>);
}
