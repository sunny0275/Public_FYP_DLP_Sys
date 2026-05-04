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
exports.default = BlockedIpsPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
function BlockedIpsPage() {
    var _this = this;
    var theme = (0, authStore_1.useAuthStore)().theme;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)([]), blockedIps = _a[0], setBlockedIps = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(null), unblocking = _d[0], setUnblocking = _d[1];
    var _e = (0, react_1.useState)(false), showBlockForm = _e[0], setShowBlockForm = _e[1];
    var _f = (0, react_1.useState)(''), newBlockIp = _f[0], setNewBlockIp = _f[1];
    var _g = (0, react_1.useState)(''), newBlockReason = _g[0], setNewBlockReason = _g[1];
    var _h = (0, react_1.useState)(false), blocking = _h[0], setBlocking = _h[1];
    (0, react_1.useEffect)(function () {
        load();
        var interval = setInterval(load, 15000);
        return function () { return clearInterval(interval); };
    }, []);
    var load = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, ips, list, err_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getBlockedIps()];
                case 2:
                    res = _d.sent();
                    ips = (_a = res.data) === null || _a === void 0 ? void 0 : _a.blockedIps;
                    if (ips) {
                        list = Object.values(ips);
                        // Sort by blockedAt descending (newest first)
                        list.sort(function (a, b) {
                            var dateA = a.blockedAt ? new Date(a.blockedAt).getTime() : 0;
                            var dateB = b.blockedAt ? new Date(b.blockedAt).getTime() : 0;
                            return dateB - dateA;
                        });
                        setBlockedIps(list);
                    }
                    else {
                        setBlockedIps([]);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _d.sent();
                    setError(((_c = (_b = err_1.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load blocked IPs');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleUnblock = function (ipAddress) { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm("Unblock IP address ".concat(ipAddress, "?")))
                        return [2 /*return*/];
                    setUnblocking(ipAddress);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.unblockIp(ipAddress)];
                case 2:
                    _c.sent();
                    alert("IP ".concat(ipAddress, " has been unblocked"));
                    load();
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    alert(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to unblock IP');
                    return [3 /*break*/, 5];
                case 4:
                    setUnblocking(null);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleUnblockAll = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_3;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (blockedIps.length === 0) {
                        alert('No blocked IPs to unblock');
                        return [2 /*return*/];
                    }
                    if (!confirm("Unblock ALL ".concat(blockedIps.length, " IP address(es)?")))
                        return [2 /*return*/];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.unblockAllIps()];
                case 2:
                    res = _d.sent();
                    alert(((_a = res.data) === null || _a === void 0 ? void 0 : _a.message) || "Unblocked ".concat(blockedIps.length, " IP(s)"));
                    load();
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _d.sent();
                    alert(((_c = (_b = err_3.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to unblock IPs');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleBlockIp = function () { return __awaiter(_this, void 0, void 0, function () {
        var ipv4Regex, ipv6Regex, localhostRegex, err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!newBlockIp.trim()) {
                        alert('Please enter an IP address');
                        return [2 /*return*/];
                    }
                    ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
                    ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                    localhostRegex = /^localhost$/i;
                    if (!ipv4Regex.test(newBlockIp.trim()) && !ipv6Regex.test(newBlockIp.trim()) && !localhostRegex.test(newBlockIp.trim())) {
                        alert('Please enter a valid IP address (e.g., 192.168.1.1)');
                        return [2 /*return*/];
                    }
                    setBlocking(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.blockIp(newBlockIp.trim(), newBlockReason.trim() || 'Manual block by admin')];
                case 2:
                    _c.sent();
                    alert("IP ".concat(newBlockIp, " has been blocked"));
                    setNewBlockIp('');
                    setNewBlockReason('');
                    setShowBlockForm(false);
                    load();
                    return [3 /*break*/, 5];
                case 3:
                    err_4 = _c.sent();
                    alert(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to block IP');
                    return [3 /*break*/, 5];
                case 4:
                    setBlocking(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var cardStyle = function (isAlt) { return ({
        background: isAlt
            ? (theme === 'dark' ? '#1e1e1e' : '#fff')
            : (theme === 'dark' ? '#222' : '#f8f9fa'),
        borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee')
    }); };
    return (<div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {error && <div style={{ padding: '12px 16px', marginBottom: '16px', background: '#ffebee', color: '#c62828', borderRadius: '6px' }}>{error}</div>}

      <button onClick={function () { return navigate(-1); }} style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: theme === 'dark' ? '#333' : '#e0e0e0',
            color: theme === 'dark' ? '#fff' : '#333',
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '16px'
        }}>
        ← Back
      </button>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={load} disabled={loading} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: theme === 'dark' ? '#333' : '#e0e0e0', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button onClick={handleUnblockAll} disabled={loading || blockedIps.length === 0} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: blockedIps.length === 0 ? '#ccc' : '#dc3545', color: '#fff', cursor: blockedIps.length === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          Unblock All ({blockedIps.length})
        </button>
        <button onClick={function () { return setShowBlockForm(!showBlockForm); }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: showBlockForm ? '#6c757d' : '#28a745', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
          {showBlockForm ? 'Cancel' : '+ Block IP Manually'}
        </button>
      </div>

      {showBlockForm && (<div style={{
                padding: '16px',
                marginBottom: '16px',
                background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#dee2e6'),
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'flex-end'
            }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#888' }}>IP Address *</label>
            <input type="text" value={newBlockIp} onChange={function (e) { return setNewBlockIp(e.target.value); }} placeholder="e.g. 192.168.1.1" style={{ padding: '8px 12px', border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ccc'), borderRadius: '6px', background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', width: '180px', fontSize: '14px' }}/>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#888' }}>Reason (optional)</label>
            <input type="text" value={newBlockReason} onChange={function (e) { return setNewBlockReason(e.target.value); }} placeholder="Reason for blocking" style={{ padding: '8px 12px', border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ccc'), borderRadius: '6px', background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', width: '100%', fontSize: '14px' }}/>
          </div>
          <button onClick={handleBlockIp} disabled={blocking || !newBlockIp.trim()} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: blocking ? '#6c757d' : '#dc3545', color: '#fff', cursor: blocking ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600 }}>
            {blocking ? 'Blocking...' : 'Block IP'}
          </button>
        </div>)}

      {loading && blockedIps.length === 0 ? (<div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>Loading...</div>) : blockedIps.length === 0 ? (<div style={{ textAlign: 'center', padding: '32px', background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa', borderRadius: '8px', color: '#888' }}>
          No blocked IPs.
        </div>) : (<div style={{ overflowX: 'auto', borderRadius: '8px', border: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>IP Address</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>Level</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>Frozen Until</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedIps.length === 0 ? (<tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    No blocked IPs
                  </td>
                </tr>) : blockedIps.map(function (ip, index) { return (<tr key={ip.ipAddress} style={cardStyle(index % 2 === 1)}>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    <code style={{ padding: '2px 6px', background: theme === 'dark' ? '#333' : '#eee', borderRadius: '4px', fontFamily: 'monospace' }}>{ip.ipAddress}</code>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    <span style={{
                    padding: '4px 10px',
                    background: ip.blocked ? '#dc354520' : '#fd7e1420',
                    color: ip.blocked ? '#dc3545' : '#fd7e14',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                }}>
                      {ip.status || (ip.blocked ? 'PERMANENTLY BLOCKED' : 'FROZEN')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px', color: '#666' }}>
                    {ip.freezeLevelDescription}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    {ip.frozenUntil ? (<span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {ip.frozenUntil}
                      </span>) : ip.blockedAt ? (<span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {ip.blockedAt}
                      </span>) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button onClick={function () { return handleUnblock(ip.ipAddress); }} disabled={unblocking === ip.ipAddress} style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', background: unblocking === ip.ipAddress ? '#6c757d' : '#28a745', color: '#fff', cursor: unblocking === ip.ipAddress ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                      {unblocking === ip.ipAddress ? '...' : 'Unblock'}
                    </button>
                  </td>
                </tr>); })}
            </tbody>
          </table>
        </div>)}
    </div>);
}
