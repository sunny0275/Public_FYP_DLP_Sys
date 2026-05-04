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
exports.default = EditUserPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
// Valid roles only: ADMIN, MANAGER, REVIEWER, EMPLOYEE
var AVAILABLE_ROLES = ['EMPLOYEE', 'REVIEWER', 'MANAGER', 'ADMIN'];
function EditUserPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var userId = (0, react_router_dom_1.useParams)().userId;
    var _a = (0, react_1.useState)(true), loading = _a[0], setLoading = _a[1];
    var _b = (0, react_1.useState)(false), saving = _b[0], setSaving = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)([]), departments = _d[0], setDepartments = _d[1];
    var _e = (0, react_1.useState)({
        email: '',
        fullName: '',
        department: '',
        roles: [],
        accountEnabled: true
    }), formData = _e[0], setFormData = _e[1];
    (0, react_1.useEffect)(function () {
        loadUser();
        loadDepartments();
    }, [userId]);
    var loadDepartments = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.getDepartments()];
                case 1:
                    response = _a.sent();
                    setDepartments(response.data || []);
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    console.error('Failed to load departments:', err_1);
                    // Fallback to default departments if API fails
                    setDepartments(['IT Department', 'Finance', 'HR']);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var loadUser = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, user, err_2;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!userId) {
                        setError('Invalid user ID');
                        setLoading(false);
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getUserById(parseInt(userId))];
                case 2:
                    response = _d.sent();
                    user = response.data;
                    setFormData({
                        email: user.email || '',
                        fullName: user.fullName || '',
                        department: user.department || '',
                        roles: user.roles || [],
                        accountEnabled: (_a = user.accountEnabled) !== null && _a !== void 0 ? _a : true
                    });
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _d.sent();
                    setError(((_c = (_b = err_2.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load user');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    e.preventDefault();
                    setError('');
                    setSaving(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.updateUser(parseInt(userId), formData)];
                case 2:
                    _c.sent();
                    navigate('/admin');
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _c.sent();
                    setError(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to update user');
                    return [3 /*break*/, 5];
                case 4:
                    setSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRoleChange = function (role) {
        setFormData(function (prev) { return (__assign(__assign({}, prev), { roles: [role] })); });
    };
    if (loading) {
        return (<div className="container">
        <h2>Loading user...</h2>
      </div>);
    }
    return (<div className="container">
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Edit User</h1>
        <button onClick={function () { return navigate('/admin'); }}>
          Back to Admin Panel
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} style={{
            maxWidth: '800px',
            padding: '20px',
            background: '#f8f9fa',
            border: '1px solid #ddd',
            borderRadius: '8px'
        }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label>Email *</label>
            <input type="email" value={formData.email} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { email: e.target.value })); }} required placeholder="e.g., john.doe@company.com"/>
          </div>

          <div>
            <label>Full Name *</label>
            <input type="text" value={formData.fullName} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { fullName: e.target.value })); }} required placeholder="e.g., John Doe"/>
          </div>

          <div>
            <label>Department *</label>
            <select value={formData.department} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { department: e.target.value })); }} required style={{
            padding: '8px',
            width: '100%',
            borderRadius: '4px',
            border: '1px solid #ddd'
        }}>
              <option value="">Select department</option>
              {departments.map(function (dept) { return (<option key={dept} value={dept}>{dept}</option>); })}
            </select>
          </div>

          <div>
            <label>Role *</label>
            <select value={formData.roles[0] || 'EMPLOYEE'} onChange={function (e) { return handleRoleChange(e.target.value); }} required style={{
            padding: '8px',
            width: '100%',
            borderRadius: '4px',
            border: '1px solid #ddd'
        }}>
              {AVAILABLE_ROLES.map(function (role) { return (<option key={role} value={role}>{role}</option>); })}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={formData.accountEnabled} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { accountEnabled: e.target.checked })); }} style={{ marginRight: '8px' }}/>
              Account Enabled
            </label>
            <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
              Disabled accounts cannot login
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button type="submit" className="primary" disabled={saving || formData.roles.length !== 1}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={function () { return navigate('/admin'); }} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>);
}
