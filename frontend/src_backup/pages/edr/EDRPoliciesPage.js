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
exports.default = EDRPoliciesPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var authStore_1 = require("../../store/authStore");
function EDRPoliciesPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _a = (0, react_1.useState)([]), policies = _a[0], setPolicies = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(null), editing = _d[0], setEditing = _d[1];
    var _e = (0, react_1.useState)({ name: '', description: '', rulesJson: '[]', status: 'DRAFT' }), form = _e[0], setForm = _e[1];
    var _f = (0, react_1.useState)(false), saving = _f[0], setSaving = _f[1];
    (0, react_1.useEffect)(function () {
        loadPolicies();
    }, []);
    var loadPolicies = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getEDRPolicies()];
                case 2:
                    res = _c.sent();
                    setPolicies(res.success && Array.isArray(res.data) ? res.data : []);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load EDR policies');
                    setPolicies([]);
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleSave = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!form.name.trim())
                        return [2 /*return*/];
                    setSaving(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.saveEDRPolicy({
                            id: editing === null || editing === void 0 ? void 0 : editing.id,
                            name: form.name.trim(),
                            description: form.description.trim() || undefined,
                            rulesJson: form.rulesJson.trim() || '[]',
                            status: form.status
                        })];
                case 2:
                    _c.sent();
                    setEditing(null);
                    setForm({ name: '', description: '', rulesJson: '[]', status: 'DRAFT' });
                    loadPolicies();
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to save policy');
                    return [3 /*break*/, 5];
                case 4:
                    setSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleDelete = function (id) { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Delete this EDR policy?'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.deleteEDRPolicy(id)];
                case 2:
                    _c.sent();
                    loadPolicies();
                    if ((editing === null || editing === void 0 ? void 0 : editing.id) === id)
                        setEditing(null);
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _c.sent();
                    setError(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to delete policy');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var startEdit = function (policy) {
        setEditing(policy);
        setForm({
            name: policy.name || '',
            description: policy.description || '',
            rulesJson: typeof policy.rulesJson === 'string' ? policy.rulesJson : JSON.stringify(policy.rulesJson || [], null, 2),
            status: policy.status || 'DRAFT'
        });
    };
    var cardStyle = {
        background: theme === 'dark' ? '#2a2a2a' : '#fff',
        border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '16px'
    };
    var inputStyle = {
        width: '100%',
        padding: '8px',
        border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
        borderRadius: '4px',
        background: theme === 'dark' ? '#333' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000'
    };
    return (<DashboardLayout_1.default>
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>EDR Policies</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={function () { return navigate('/edr'); }}>Back to EDR Console</button>
            <button onClick={function () { setEditing(null); setForm({ name: '', description: '', rulesJson: '[]', status: 'DRAFT' }); }} style={{ background: '#2196f3', color: '#fff' }}>
              New policy
            </button>
          </div>
        </div>

        {error && (<div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '16px' }}>
            {error}
          </div>)}

        {(editing || (!editing && form.name)) && (<div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>{editing ? 'Edit policy' : 'New policy'}</h3>
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Name *</label>
                <input type="text" value={form.name} onChange={function (e) { return setForm(function (f) { return (__assign(__assign({}, f), { name: e.target.value })); }); }} style={inputStyle} placeholder="Policy name"/>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Description</label>
                <input type="text" value={form.description} onChange={function (e) { return setForm(function (f) { return (__assign(__assign({}, f), { description: e.target.value })); }); }} style={inputStyle} placeholder="Optional description"/>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Status</label>
                <select value={form.status} onChange={function (e) { return setForm(function (f) { return (__assign(__assign({}, f), { status: e.target.value })); }); }} style={inputStyle}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Rules (JSON)</label>
                <textarea value={form.rulesJson} onChange={function (e) { return setForm(function (f) { return (__assign(__assign({}, f), { rulesJson: e.target.value })); }); }} rows={6} style={__assign(__assign({}, inputStyle), { fontFamily: 'monospace', fontSize: '13px' })} placeholder='[{"type":"CLIPBOARD","action":"ALERT"}]'/>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} style={{ background: '#4caf50', color: '#fff' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={function () { setEditing(null); setForm({ name: '', description: '', rulesJson: '[]', status: 'DRAFT' }); }}>
                Cancel
              </button>
            </div>
          </div>)}

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Policies</h3>
          {loading ? (<div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>Loading...</div>) : policies.length === 0 ? (<div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>No EDR policies. Create one above.</div>) : (<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {policies.map(function (p) { return (<li key={p.id} style={{
                    padding: '12px',
                    borderBottom: "1px solid ".concat(theme === 'dark' ? '#444' : '#eee'),
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                  <div>
                    <strong>{p.name}</strong>
                    <span style={{ marginLeft: '12px', fontSize: '12px', color: '#888' }}>{p.status}</span>
                    {p.description && <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{p.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={function () { return startEdit(p); }} style={{ padding: '4px 12px', fontSize: '13px' }}>Edit</button>
                    <button type="button" onClick={function () { return handleDelete(p.id); }} style={{ padding: '4px 12px', fontSize: '13px', background: '#f44336', color: '#fff' }}>Delete</button>
                  </div>
                </li>); })}
            </ul>)}
        </div>
      </div>
    </DashboardLayout_1.default>);
}
