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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UebaPoliciesPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var authStore_1 = require("../../store/authStore");
function UebaPoliciesPage() {
    var _this = this;
    var _a, _b, _c, _d, _e, _f;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _g = (0, react_1.useState)('rules'), tab = _g[0], setTab = _g[1];
    var _h = (0, react_1.useState)([]), rules = _h[0], setRules = _h[1];
    var _j = (0, react_1.useState)(0), totalElements = _j[0], setTotalElements = _j[1];
    var _k = (0, react_1.useState)(0), totalPages = _k[0], setTotalPages = _k[1];
    var _l = (0, react_1.useState)(0), page = _l[0], setPage = _l[1];
    var _m = (0, react_1.useState)(''), ruleTypeFilter = _m[0], setRuleTypeFilter = _m[1];
    var _o = (0, react_1.useState)(true), loading = _o[0], setLoading = _o[1];
    var _p = (0, react_1.useState)(''), error = _p[0], setError = _p[1];
    var _q = (0, react_1.useState)([]), thresholds = _q[0], setThresholds = _q[1];
    var _r = (0, react_1.useState)(false), policyLoading = _r[0], setPolicyLoading = _r[1];
    var _s = (0, react_1.useState)(false), policySaving = _s[0], setPolicySaving = _s[1];
    var _t = (0, react_1.useState)(null), editingRule = _t[0], setEditingRule = _t[1];
    var _u = (0, react_1.useState)({ name: '', ruleType: 'RISK_SCORING', priority: 100, enabled: true }), form = _u[0], setForm = _u[1];
    var _v = (0, react_1.useState)(false), saving = _v[0], setSaving = _v[1];
    var cardStyle = {
        background: theme === 'dark' ? '#2a2a2a' : '#fff',
        border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '16px'
    };
    var inputStyle = function (w) {
        if (w === void 0) { w = '100%'; }
        return ({
            width: w,
            padding: '8px',
            border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
            borderRadius: '4px',
            background: theme === 'dark' ? '#333' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        });
    };
    var loadRules = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, d, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getUebaRules(__assign({ page: page, size: 20 }, (ruleTypeFilter ? { ruleType: ruleTypeFilter } : {})))];
                case 2:
                    res = _e.sent();
                    d = res.data;
                    setRules(Array.isArray(d === null || d === void 0 ? void 0 : d.content) ? d.content : []);
                    setTotalElements((_a = d === null || d === void 0 ? void 0 : d.totalElements) !== null && _a !== void 0 ? _a : 0);
                    setTotalPages((_b = d === null || d === void 0 ? void 0 : d.totalPages) !== null && _b !== void 0 ? _b : 0);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _e.sent();
                    setError(((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to load rules');
                    setRules([]);
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var loadPolicy = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, data, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setPolicyLoading(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getUebaRiskAdaptivePolicy()];
                case 2:
                    res = _c.sent();
                    data = res.data;
                    setThresholds(Array.isArray(data === null || data === void 0 ? void 0 : data.thresholds) ? data.thresholds : []);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load risk-adaptive policy');
                    return [3 /*break*/, 5];
                case 4:
                    setPolicyLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        if (tab === 'rules')
            loadRules();
        else
            loadPolicy();
    }, [tab, page, ruleTypeFilter]);
    var handleSaveRule = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!((_a = form.name) === null || _a === void 0 ? void 0 : _a.trim()) || !form.ruleType)
                        return [2 /*return*/];
                    setSaving(true);
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, 7, 8]);
                    if (!(editingRule === null || editingRule === void 0 ? void 0 : editingRule.id)) return [3 /*break*/, 3];
                    return [4 /*yield*/, api_1.apiClient.updateUebaRule(editingRule.id, form)];
                case 2:
                    _d.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, api_1.apiClient.createUebaRule(form)];
                case 4:
                    _d.sent();
                    _d.label = 5;
                case 5:
                    setEditingRule(null);
                    setForm({ name: '', ruleType: 'RISK_SCORING', priority: 100, enabled: true });
                    loadRules();
                    return [3 /*break*/, 8];
                case 6:
                    err_3 = _d.sent();
                    setError(((_c = (_b = err_3.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to save rule');
                    return [3 /*break*/, 8];
                case 7:
                    setSaving(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var handleDeleteRule = function (id) { return __awaiter(_this, void 0, void 0, function () {
        var err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Delete this rule?'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.deleteUebaRule(id)];
                case 2:
                    _c.sent();
                    if ((editingRule === null || editingRule === void 0 ? void 0 : editingRule.id) === id)
                        setEditingRule(null);
                    loadRules();
                    return [3 /*break*/, 4];
                case 3:
                    err_4 = _c.sent();
                    setError(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to delete rule');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleToggleEnabled = function (id, enabled) { return __awaiter(_this, void 0, void 0, function () {
        var err_5;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.setUebaRuleEnabled(id, enabled)];
                case 1:
                    _c.sent();
                    loadRules();
                    return [3 /*break*/, 3];
                case 2:
                    err_5 = _c.sent();
                    setError(((_b = (_a = err_5.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to update rule');
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var handleSavePolicy = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_6;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setPolicySaving(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.setUebaRiskAdaptivePolicy(thresholds)];
                case 2:
                    _c.sent();
                    loadPolicy();
                    return [3 /*break*/, 5];
                case 3:
                    err_6 = _c.sent();
                    setError(((_b = (_a = err_6.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to save policy');
                    return [3 /*break*/, 5];
                case 4:
                    setPolicySaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var addBand = function () { return setThresholds(__spreadArray(__spreadArray([], thresholds, true), [{ min: 0, max: 100, action: 'NONE' }], false)); };
    var removeBand = function (i) { return setThresholds(thresholds.filter(function (_, idx) { return idx !== i; })); };
    var updateBand = function (i, field, value) {
        var _a;
        var next = __spreadArray([], thresholds, true);
        next[i] = __assign(__assign({}, next[i]), (_a = {}, _a[field] = value, _a));
        setThresholds(next);
    };
    return (<DashboardLayout_1.default>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0 }}>UEBA Rules & Policy</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={function () { return navigate('/ueba'); }}>Back to risk overview</button>
          <button onClick={function () { return setTab('rules'); }} style={{ fontWeight: tab === 'rules' ? 600 : 400 }}>
            Rules
          </button>
          <button onClick={function () { return setTab('risk-adaptive'); }} style={{ fontWeight: tab === 'risk-adaptive' ? 600 : 400 }}>
            Risk-adaptive policy
          </button>
        </div>
      </div>

      {error && (<div style={__assign(__assign({}, cardStyle), { borderColor: '#f44336', color: '#f44336' })}>{error}</div>)}

      {tab === 'rules' && (<>
          <div style={__assign(__assign({}, cardStyle), { display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' })}>
            <label>
              Rule type:
              <select value={ruleTypeFilter} onChange={function (e) { setRuleTypeFilter(e.target.value); setPage(0); }} style={__assign({ marginLeft: '8px' }, inputStyle('140px'))}>
                <option value="">All</option>
                <option value="RISK_SCORING">RISK_SCORING</option>
                <option value="ANOMALY_DETECTION">ANOMALY_DETECTION</option>
                <option value="RESPONSE">RESPONSE</option>
                <option value="FEATURE_WEIGHT">FEATURE_WEIGHT</option>
              </select>
            </label>
            <button onClick={function () { setEditingRule(null); setForm({ name: '', ruleType: 'RISK_SCORING', conditionJson: '{"feature":"audit_failures","operator":"GT","value":0}', weight: 10, priority: 100, enabled: true }); }} style={{ padding: '8px 16px' }}>
              Add rule
            </button>
          </div>

          {(editingRule || form.name || form.conditionJson) && (<div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>{editingRule ? 'Edit rule' : 'Add rule'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label>Name</label>
                  <input value={(_a = form.name) !== null && _a !== void 0 ? _a : ''} onChange={function (e) { return setForm(function (f) { return (__assign(__assign({}, f), { name: e.target.value })); }); }} style={inputStyle()} placeholder="Rule name"/>
                </div>
                <div>
                  <label>Type</label>
                  <select value={(_b = form.ruleType) !== null && _b !== void 0 ? _b : 'RISK_SCORING'} onChange={function (e) { return setForm(function (f) { return (__assign(__assign({}, f), { ruleType: e.target.value })); }); }} style={inputStyle()}>
                    <option value="RISK_SCORING">RISK_SCORING</option>
                    <option value="ANOMALY_DETECTION">ANOMALY_DETECTION</option>
                    <option value="RESPONSE">RESPONSE</option>
                    <option value="FEATURE_WEIGHT">FEATURE_WEIGHT</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>{'Condition JSON (e.g. {"feature":"audit_failures","operator":"GT","value":2})'}</label>
                  <input value={(_c = form.conditionJson) !== null && _c !== void 0 ? _c : ''} onChange={function (e) { return setForm(function (f) { return (__assign(__assign({}, f), { conditionJson: e.target.value })); }); }} style={inputStyle()} placeholder='{"feature":"audit_failures","operator":"GT","value":2}'/>
                </div>
                <div>
                  <label>Weight (scoring) or action (response)</label>
                  <input value={form.ruleType === 'RESPONSE' ? ((_d = form.actionOrWeight) !== null && _d !== void 0 ? _d : '') : ((_e = form.weight) !== null && _e !== void 0 ? _e : '')} onChange={function (e) {
                    var v = e.target.value;
                    if (form.ruleType === 'RESPONSE')
                        setForm(function (f) { return (__assign(__assign({}, f), { actionOrWeight: v })); });
                    else
                        setForm(function (f) { return (__assign(__assign({}, f), { weight: v === '' ? undefined : Number(v) })); });
                }} style={inputStyle()} placeholder="10 or STEP_UP_AUTH"/>
                </div>
                <div>
                  <label>Priority</label>
                  <input type="number" value={(_f = form.priority) !== null && _f !== void 0 ? _f : 100} onChange={function (e) { return setForm(function (f) { return (__assign(__assign({}, f), { priority: parseInt(e.target.value, 10) || 100 })); }); }} style={inputStyle()}/>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveRule} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={function () { setEditingRule(null); setForm({ name: '', ruleType: 'RISK_SCORING', priority: 100, enabled: true }); }}>Cancel</button>
              </div>
            </div>)}

          <div style={cardStyle}>
            {loading ? (<p>Loading…</p>) : (<>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid ".concat(theme === 'dark' ? '#444' : '#ddd') }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Condition / weight</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Priority</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Enabled</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map(function (r) {
                    var _a, _b;
                    return (<tr key={r.id} style={{ borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee') }}>
                        <td style={{ padding: '8px' }}>{r.name}</td>
                        <td style={{ padding: '8px' }}>{r.ruleType}</td>
                        <td style={{ padding: '8px', fontSize: '12px' }}>{r.conditionJson || '-'} / {(_b = (_a = r.weight) !== null && _a !== void 0 ? _a : r.actionOrWeight) !== null && _b !== void 0 ? _b : '-'}</td>
                        <td style={{ padding: '8px' }}>{r.priority}</td>
                        <td style={{ padding: '8px' }}>
                          <button onClick={function () { return handleToggleEnabled(r.id, !r.enabled); }} style={{ fontSize: '12px' }}>
                            {r.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <button onClick={function () { setEditingRule(r); setForm(__assign({}, r)); }}>Edit</button>
                          <button onClick={function () { return handleDeleteRule(r.id); }}>Delete</button>
                        </td>
                      </tr>);
                })}
                  </tbody>
                </table>
                {totalPages > 1 && (<div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button disabled={page === 0} onClick={function () { return setPage(function (p) { return p - 1; }); }}>Previous</button>
                    <span>Page {page + 1} / {totalPages}, {totalElements} total</span>
                    <button disabled={page >= totalPages - 1} onClick={function () { return setPage(function (p) { return p + 1; }); }}>Next</button>
                  </div>)}
              </>)}
          </div>
        </>)}

      {tab === 'risk-adaptive' && (<div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Risk band → action</h3>
          <p style={{ color: '#888', marginBottom: '16px' }}>Configure recommended actions by risk score range (e.g. STEP_UP_AUTH, ESCALATE_APPROVAL, RESTRICT_ACCESS, SUSPEND_ACCOUNT). Saving replaces all RESPONSE-type rules.</p>
          {policyLoading ? (<p>Loading…</p>) : (<>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid ".concat(theme === 'dark' ? '#444' : '#ddd') }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Min score</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Max score</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map(function (band, i) { return (<tr key={i} style={{ borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee') }}>
                      <td style={{ padding: '8px' }}>
                        <input type="number" min={0} max={100} value={band.min} onChange={function (e) { return updateBand(i, 'min', parseInt(e.target.value, 10) || 0); }} style={inputStyle('80px')}/>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" min={0} max={100} value={band.max} onChange={function (e) { return updateBand(i, 'max', parseInt(e.target.value, 10) || 100); }} style={inputStyle('80px')}/>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input value={band.action} onChange={function (e) { return updateBand(i, 'action', e.target.value); }} style={inputStyle('180px')} placeholder="STEP_UP_AUTH / ESCALATE_APPROVAL / NONE"/>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={function () { return removeBand(i); }}>Remove</button>
                      </td>
                    </tr>); })}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addBand}>Add band</button>
                <button onClick={handleSavePolicy} disabled={policySaving}>{policySaving ? 'Saving…' : 'Save policy'}</button>
              </div>
            </>)}
        </div>)}
    </DashboardLayout_1.default>);
}
