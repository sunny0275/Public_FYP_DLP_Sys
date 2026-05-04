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
exports.default = EDRConsolePage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var authStore_1 = require("../../store/authStore");
function EDRConsolePage() {
    var _this = this;
    var _a;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _b = (0, react_1.useState)([]), events = _b[0], setEvents = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(''), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(''), severityFilter = _e[0], setSeverityFilter = _e[1];
    var _f = (0, react_1.useState)(''), actionFilter = _f[0], setActionFilter = _f[1];
    var _g = (0, react_1.useState)(null), blockModal = _g[0], setBlockModal = _g[1];
    var _h = (0, react_1.useState)(null), isolateModal = _h[0], setIsolateModal = _h[1];
    var _j = (0, react_1.useState)(''), actionReason = _j[0], setActionReason = _j[1];
    var _k = (0, react_1.useState)(false), submitting = _k[0], setSubmitting = _k[1];
    (0, react_1.useEffect)(function () {
        loadEvents();
    }, [severityFilter, actionFilter]);
    var loadEvents = function () { return __awaiter(_this, void 0, void 0, function () {
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
                    return [4 /*yield*/, api_1.apiClient.getEDREvents(__assign(__assign({}, (severityFilter ? { severity: severityFilter } : {})), (actionFilter ? { action: actionFilter } : {})))];
                case 2:
                    res = _c.sent();
                    if (res.success && Array.isArray(res.data)) {
                        setEvents(res.data);
                    }
                    else {
                        setEvents([]);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load EDR events');
                    setEvents([]);
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleBlock = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!blockModal)
                        return [2 /*return*/];
                    setSubmitting(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.edrBlock({
                            hostId: blockModal.hostId,
                            userId: blockModal.userId,
                            reason: actionReason || 'Blocked from EDR console'
                        })];
                case 2:
                    _c.sent();
                    setBlockModal(null);
                    setActionReason('');
                    loadEvents();
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Block action failed');
                    return [3 /*break*/, 5];
                case 4:
                    setSubmitting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleIsolate = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!isolateModal)
                        return [2 /*return*/];
                    setSubmitting(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.edrIsolate({
                            hostId: isolateModal.hostId,
                            reason: actionReason || 'Isolated from EDR console'
                        })];
                case 2:
                    _c.sent();
                    setIsolateModal(null);
                    setActionReason('');
                    loadEvents();
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _c.sent();
                    setError(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Isolate action failed');
                    return [3 /*break*/, 5];
                case 4:
                    setSubmitting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var getSeverityColor = function (severity) {
        switch (severity) {
            case 'HIGH': return '#f44336';
            case 'MEDIUM': return '#ff9800';
            case 'LOW': return '#4caf50';
            default: return '#757575';
        }
    };
    var cardStyle = {
        background: theme === 'dark' ? '#2a2a2a' : '#fff',
        border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '16px'
    };
    return (<DashboardLayout_1.default>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>EDR Console</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={function () { return navigate('/edr/policies'); }} style={{
            padding: '8px 16px',
            background: theme === 'dark' ? '#444' : '#f5f5f5',
            color: theme === 'dark' ? '#fff' : '#333',
            border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
            borderRadius: '6px',
            cursor: 'pointer'
        }}>
              EDR Policies
            </button>
            <button type="button" onClick={loadEvents} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {error && (<div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '16px' }}>
            {error}
          </div>)}

        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Severity</label>
              <select value={severityFilter} onChange={function (e) { return setSeverityFilter(e.target.value); }} style={{
            padding: '6px 12px',
            border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
            borderRadius: '4px',
            background: theme === 'dark' ? '#333' : '#fff',
            color: theme === 'dark' ? '#fff' : '#333'
        }}>
                <option value="">All</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Action</label>
              <input type="text" value={actionFilter} onChange={function (e) { return setActionFilter(e.target.value); }} placeholder="Filter by action" style={{
            padding: '6px 12px',
            border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
            borderRadius: '4px',
            background: theme === 'dark' ? '#333' : '#fff',
            color: theme === 'dark' ? '#fff' : '#333'
        }}/>
            </div>
          </div>

          <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Events / Incidents</h3>
          {loading ? (<div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>Loading events...</div>) : events.length === 0 ? (<div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>No EDR events match the filters.</div>) : (<div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid ".concat(theme === 'dark' ? '#444' : '#ddd'), textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Time</th>
                    <th style={{ padding: '10px' }}>User</th>
                    <th style={{ padding: '10px' }}>Action</th>
                    <th style={{ padding: '10px' }}>Severity</th>
                    <th style={{ padding: '10px' }}>Summary</th>
                    <th style={{ padding: '10px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(function (evt, idx) { return (<tr key={evt.id || idx} style={{ borderBottom: "1px solid ".concat(theme === 'dark' ? '#444' : '#eee') }}>
                      <td style={{ padding: '10px' }}>{evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '—'}</td>
                      <td style={{ padding: '10px' }}>{evt.userName || evt.accountId || '—'}</td>
                      <td style={{ padding: '10px' }}>{evt.action || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: getSeverityColor(evt.severity || '') + '33',
                    color: getSeverityColor(evt.severity || '')
                }}>
                          {evt.severity || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{evt.summary || evt.details || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <button type="button" onClick={function () { return setBlockModal({ hostId: evt.hostId || undefined, userId: evt.userId }); }} style={{
                    padding: '4px 10px',
                    marginRight: '6px',
                    fontSize: '12px',
                    background: '#ff9800',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}>
                          Block
                        </button>
                        <button type="button" onClick={function () { var _a; return setIsolateModal({ hostId: evt.hostId || ((_a = evt.id) === null || _a === void 0 ? void 0 : _a.toString()) || 'unknown' }); }} style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    background: '#f44336',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}>
                          Isolate
                        </button>
                      </td>
                    </tr>); })}
                </tbody>
              </table>
            </div>)}
        </div>
      </div>

      {/* Block modal */}
      {blockModal && (<div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function () { return !submitting && setBlockModal(null); }}>
          <div style={{
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                padding: '24px',
                borderRadius: '8px',
                minWidth: '320px'
            }} onClick={function (e) { return e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>Block</h3>
            <p>HostId: {blockModal.hostId || '—'} | UserId: {(_a = blockModal.userId) !== null && _a !== void 0 ? _a : '—'}</p>
            <input type="text" value={actionReason} onChange={function (e) { return setActionReason(e.target.value); }} placeholder="Reason (optional)" style={{ width: '100%', padding: '8px', marginBottom: '16px' }}/>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={function () { return !submitting && setBlockModal(null); }} disabled={submitting}>Cancel</button>
              <button onClick={handleBlock} disabled={submitting} style={{ background: '#ff9800', color: '#fff' }}>
                {submitting ? 'Recording...' : 'Record block'}
              </button>
            </div>
          </div>
        </div>)}

      {/* Isolate modal */}
      {isolateModal && (<div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function () { return !submitting && setIsolateModal(null); }}>
          <div style={{
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                padding: '24px',
                borderRadius: '8px',
                minWidth: '320px'
            }} onClick={function (e) { return e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>Isolate host</h3>
            <p>HostId: {isolateModal.hostId}</p>
            <input type="text" value={actionReason} onChange={function (e) { return setActionReason(e.target.value); }} placeholder="Reason (optional)" style={{ width: '100%', padding: '8px', marginBottom: '16px' }}/>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={function () { return !submitting && setIsolateModal(null); }} disabled={submitting}>Cancel</button>
              <button onClick={handleIsolate} disabled={submitting} style={{ background: '#f44336', color: '#fff' }}>
                {submitting ? 'Recording...' : 'Record isolate'}
              </button>
            </div>
          </div>
        </div>)}
    </DashboardLayout_1.default>);
}
