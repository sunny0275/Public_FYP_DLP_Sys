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
exports.default = DlpPolicyTab;
var react_1 = require("react");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
function DlpPolicyTab() {
    var _this = this;
    var _a, _b, _c;
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _d = (0, react_1.useState)(null), config = _d[0], setConfig = _d[1];
    var _e = (0, react_1.useState)(true), loading = _e[0], setLoading = _e[1];
    var _f = (0, react_1.useState)(false), saving = _f[0], setSaving = _f[1];
    var _g = (0, react_1.useState)(''), error = _g[0], setError = _g[1];
    var _h = (0, react_1.useState)(''), success = _h[0], setSuccess = _h[1];
    var _j = (0, react_1.useState)(''), reason = _j[0], setReason = _j[1];
    var _k = (0, react_1.useState)('classification'), activeSection = _k[0], setActiveSection = _k[1];
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
                    return [4 /*yield*/, api_1.apiClient.getDlpPolicies()];
                case 2:
                    res = _c.sent();
                    if (res.success && res.data) {
                        setConfig(res.data);
                    }
                    else {
                        setConfig({
                            classification: {
                                confidenceThreshold: 0.7,
                                autoReviewEnabled: true,
                                autoReviewThreshold: 0.6
                            },
                            sharing: {
                                batchExportLimit: 10
                            }
                        });
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load DLP policies');
                    setConfig({
                        classification: { confidenceThreshold: 0.7, autoReviewEnabled: true, autoReviewThreshold: 0.6 },
                        sharing: { batchExportLimit: 10 }
                    });
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
                    if (!config)
                        return [2 /*return*/];
                    setSaving(true);
                    setError('');
                    setSuccess('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.updateDlpPolicies(config, reason || 'DLP policy updated')];
                case 2:
                    _c.sent();
                    setSuccess('DLP policies updated successfully. Changes take effect immediately.');
                    setReason('');
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to update DLP policies');
                    return [3 /*break*/, 5];
                case 4:
                    setSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var updateClassification = function (field, value) {
        setConfig(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), { classification: __assign(__assign({}, ((prev === null || prev === void 0 ? void 0 : prev.classification) || {})), (_a = {}, _a[field] = value, _a)) }));
        });
    };
    var updateSharing = function (field, value) {
        setConfig(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), { sharing: __assign(__assign({}, ((prev === null || prev === void 0 ? void 0 : prev.sharing) || {})), (_a = {}, _a[field] = value, _a)) }));
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
    var labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' };
    if (loading) {
        return <div style={{ padding: '24px' }}>Loading DLP policies...</div>;
    }
    return (<div style={{ padding: '24px', maxWidth: '900px' }}>
      <h2 style={{ marginTop: 0, marginBottom: '20px' }}>DLP Policy Configuration</h2>
      <p style={{ color: theme === 'dark' ? '#aaa' : '#666', marginBottom: '20px', fontSize: '14px' }}>
        Configure document classification thresholds, access rules, and sharing policies. Changes take effect immediately.
      </p>

      {error && (<div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>)}
      {success && (<div style={{ padding: '12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', marginBottom: '16px' }}>
          {success}
        </div>)}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button type="button" onClick={function () { return setActiveSection('classification'); }} style={{
            padding: '8px 16px',
            background: activeSection === 'classification' ? '#2196f3' : (theme === 'dark' ? '#333' : '#f5f5f5'),
            color: activeSection === 'classification' ? '#fff' : (theme === 'dark' ? '#fff' : '#333'),
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500
        }}>
          Document Classification
        </button>
        <button type="button" onClick={function () { return setActiveSection('sharing'); }} style={{
            padding: '8px 16px',
            background: activeSection === 'sharing' ? '#2196f3' : (theme === 'dark' ? '#333' : '#f5f5f5'),
            color: activeSection === 'sharing' ? '#fff' : (theme === 'dark' ? '#fff' : '#333'),
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500
        }}>
          Sharing / Export
        </button>
      </div>

      {activeSection === 'classification' && (config === null || config === void 0 ? void 0 : config.classification) && (<div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Document Classification Policy</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={labelStyle}>LLM confidence threshold (0–1)</label>
              <input type="number" min="0" max="1" step="0.1" value={(_a = config.classification.confidenceThreshold) !== null && _a !== void 0 ? _a : 0.7} onChange={function (e) { return updateClassification('confidenceThreshold', parseFloat(e.target.value) || 0.7); }} style={inputStyle}/>
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#999' : '#666' }}>
                Below this threshold, classification may require manual review.
              </span>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!config.classification.autoReviewEnabled} onChange={function (e) { return updateClassification('autoReviewEnabled', e.target.checked); }}/>
                Enable automatic review when confidence is low
              </label>
            </div>
            <div>
              <label style={labelStyle}>Auto-review threshold (0–1)</label>
              <input type="number" min="0" max="1" step="0.1" value={(_b = config.classification.autoReviewThreshold) !== null && _b !== void 0 ? _b : 0.6} onChange={function (e) { return updateClassification('autoReviewThreshold', parseFloat(e.target.value) || 0.6); }} style={inputStyle}/>
            </div>
          </div>
        </div>)}

      {activeSection === 'sharing' && (config === null || config === void 0 ? void 0 : config.sharing) && (<div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Sharing / Export Policy</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Batch export limit (documents)</label>
              <input type="number" min="1" max="100" value={(_c = config.sharing.batchExportLimit) !== null && _c !== void 0 ? _c : 10} onChange={function (e) { return updateSharing('batchExportLimit', parseInt(e.target.value, 10) || 10); }} style={inputStyle}/>
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#999' : '#666' }}>
                Max documents for batch export without approval.
              </span>
            </div>
          </div>
        </div>)}

      <div style={cardStyle}>
        <label style={labelStyle}>Change reason (optional, for audit)</label>
        <input type="text" value={reason} onChange={function (e) { return setReason(e.target.value); }} placeholder="e.g., Align with new compliance requirements" style={inputStyle}/>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <button type="button" onClick={handleSave} disabled={saving} style={{
            padding: '10px 20px',
            background: saving ? '#999' : '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 600
        }}>
          {saving ? 'Saving...' : 'Save DLP Policies'}
        </button>
        <button type="button" onClick={loadPolicies} disabled={loading} style={{
            padding: '10px 20px',
            background: theme === 'dark' ? '#444' : '#f5f5f5',
            color: theme === 'dark' ? '#fff' : '#333',
            border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
            borderRadius: '6px',
            cursor: 'pointer'
        }}>
          Reload
        </button>
      </div>
    </div>);
}
