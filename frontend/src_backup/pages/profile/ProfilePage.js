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
exports.default = ProfilePage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
function ProfilePage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var user = (0, authStore_1.useAuthStore)().user;
    var updateUser = (0, authStore_1.useAuthStore)(function (state) { return state.updateUser; });
    var _a = (0, react_1.useState)(true), loading = _a[0], setLoading = _a[1];
    var _b = (0, react_1.useState)(false), saving = _b[0], setSaving = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(''), success = _d[0], setSuccess = _d[1];
    var _e = (0, react_1.useState)(false), isEditing = _e[0], setIsEditing = _e[1];
    var _f = (0, react_1.useState)({
        email: '',
        fullName: ''
    }), formData = _f[0], setFormData = _f[1];
    var _g = (0, react_1.useState)(null), profile = _g[0], setProfile = _g[1];
    (0, react_1.useEffect)(function () {
        loadProfile();
    }, []);
    var loadProfile = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getMyProfile()];
                case 2:
                    response = _e.sent();
                    setProfile(response.data);
                    setFormData({
                        email: response.data.email,
                        fullName: response.data.fullName
                    });
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _e.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || 'Failed to load profile');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleCancel = function () {
        setIsEditing(false);
        setError('');
        setSuccess('');
        if (profile) {
            setFormData({
                email: profile.email,
                fullName: profile.fullName
            });
        }
    };
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var response, err_2;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    e.preventDefault();
                    setError('');
                    setSuccess('');
                    setSaving(true);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.updateMyProfile(formData)
                        // Update profile state
                    ];
                case 2:
                    response = _e.sent();
                    // Update profile state
                    setProfile(response.data);
                    // Update auth store with new user info
                    updateUser({
                        email: response.data.email,
                        fullName: response.data.fullName
                    });
                    setSuccess('Profile updated successfully');
                    setIsEditing(false);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _e.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = err_2.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || 'Failed to update profile');
                    return [3 /*break*/, 5];
                case 4:
                    setSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    if (loading) {
        return (<div className="container">
        <h2>Loading profile...</h2>
      </div>);
    }
    if (!profile) {
        return (<div className="container">
        <div className="error-message">Failed to load profile</div>
      </div>);
    }
    return (<div className="container">
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My Profile</h1>
        <button onClick={function () {
            var roles = (user === null || user === void 0 ? void 0 : user.roles) || [];
            if (roles.includes('ADMIN')) {
                navigate('/dashboard/admin');
            }
            else {
                navigate('/home');
            }
        }}>
          Back to Dashboard
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div style={{ padding: '10px', marginBottom: '20px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px', color: '#155724' }}>{success}</div>}

      <div style={{
            background: '#fff',
            padding: '30px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            maxWidth: '600px'
        }}>
        <form onSubmit={handleSubmit}>
          {/* Editable Fields */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Email *
            </label>
            {isEditing ? (<input type="email" value={formData.email} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { email: e.target.value })); }} required placeholder="Enter your email"/>) : (<div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                {profile.email}
              </div>)}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Full Name *
            </label>
            {isEditing ? (<input type="text" value={formData.fullName} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { fullName: e.target.value })); }} required placeholder="Enter your full name"/>) : (<div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                {profile.fullName}
              </div>)}
          </div>

          {/* Read-Only Fields */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#6c757d' }}>
              Account ID (Read-Only)
            </label>
            <div style={{ padding: '10px', background: '#e9ecef', borderRadius: '4px', color: '#6c757d' }}>
              {profile.accountId}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#6c757d' }}>
              Department (Read-Only)
            </label>
            <div style={{ padding: '10px', background: '#e9ecef', borderRadius: '4px', color: '#6c757d' }}>
              {profile.department}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#6c757d' }}>
              Roles (Read-Only)
            </label>
            <div style={{ padding: '10px', background: '#e9ecef', borderRadius: '4px', color: '#6c757d' }}>
              {profile.roles.join(', ')}
            </div>
          </div>

          {/* Security Information */}
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
            <h3 style={{ marginBottom: '15px' }}>Security Information</h3>

            <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>MFA Status:</strong>
                <span style={{ marginLeft: '10px', color: profile.mfaEnabled ? '#28a745' : '#dc3545' }}>
                  {profile.mfaEnabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <button type="button" onClick={function () { return navigate('/mfa-setup'); }} style={{ fontSize: '14px' }}>
                {profile.mfaEnabled ? 'Re-bind MFA' : 'Setup MFA'}
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <strong>Account Status:</strong>
              <span style={{ marginLeft: '10px', color: profile.accountEnabled ? '#28a745' : '#dc3545' }}>
                {profile.accountLocked ? '🔒 Locked' : profile.accountEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <strong>Password Expires:</strong>
              <span style={{ marginLeft: '10px' }}>
                {new Date(profile.passwordExpiryDate).toLocaleDateString()}
              </span>
            </div>

            {profile.lastLoginAt && (<div style={{ marginBottom: '15px' }}>
                <strong>Last Login:</strong>
                <span style={{ marginLeft: '10px' }}>
                  {new Date(profile.lastLoginAt).toLocaleString()}
                </span>
              </div>)}

            <div style={{ marginTop: '15px' }}>
              <button type="button" onClick={function () { return navigate('/change-password'); }} style={{ width: '100%' }}>
                Change Password
              </button>
            </div>

            <div style={{ marginTop: '15px' }}>
              <button type="button" onClick={function () { return __awaiter(_this, void 0, void 0, function () {
            var blob, url, a, e_1;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, api_1.apiClient.getActivityReport()];
                    case 1:
                        blob = _e.sent();
                        url = window.URL.createObjectURL(blob);
                        a = document.createElement('a');
                        a.href = url;
                        a.download = "my-activity-report-".concat(new Date().toISOString().slice(0, 10), ".csv");
                        a.click();
                        window.URL.revokeObjectURL(url);
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _e.sent();
                        setError(((_b = (_a = e_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = e_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || 'Failed to download activity report');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }} style={{ width: '100%' }}>
                Download activity report (CSV)
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
            {isEditing ? (<>
                <button type="submit" className="primary" disabled={saving} style={{ marginRight: '10px' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
              </>) : (<button type="button" onClick={function () { return setIsEditing(true); }} className="primary" style={{ width: '100%' }}>
                Edit Profile
              </button>)}
          </div>
        </form>

        <div style={{ marginTop: '15px', fontSize: '0.9em', color: '#6c757d' }}>
          <strong>Note:</strong> Department, position, and roles can only be modified by administrators.
          To update these fields, please contact your system administrator.
        </div>
      </div>
    </div>);
}
