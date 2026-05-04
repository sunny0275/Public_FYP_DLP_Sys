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
exports.default = WatermarkTracebackPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
/** Backend short-code / payload-hash hits return accessLogs; general search returns items. */
function normalizeWatermarkSearchPayload(raw) {
    var _a, _b;
    if (!raw || typeof raw !== 'object') {
        return {
            items: [],
            totalElements: 0,
            totalPages: 0,
            currentPage: 0,
            pageSize: 0,
        };
    }
    var accessLogs = raw.accessLogs;
    if (raw.found === true && Array.isArray(accessLogs)) {
        var fingerprints = [];
        if (raw.fingerprint && typeof raw.fingerprint === 'object') {
            fingerprints.push(raw.fingerprint);
        }
        var docFps = raw.allDocumentFingerprints;
        if (Array.isArray(docFps)) {
            var _loop_1 = function (f) {
                if (f && typeof f === 'object' && !fingerprints.some(function (p) { return p.id === f.id; })) {
                    fingerprints.push(f);
                }
            };
            for (var _i = 0, docFps_1 = docFps; _i < docFps_1.length; _i++) {
                var f = docFps_1[_i];
                _loop_1(f);
            }
        }
        var label = typeof raw.shortCode === 'string'
            ? raw.shortCode
            : typeof raw.payloadHash === 'string'
                ? raw.payloadHash
                : '';
        return {
            items: accessLogs,
            totalElements: Number((_a = raw.totalAccessLogs) !== null && _a !== void 0 ? _a : accessLogs.length) || 0,
            totalPages: 1,
            currentPage: 0,
            pageSize: accessLogs.length,
            searchCriteria: typeof raw.searchCriteria === 'string' ? raw.searchCriteria : undefined,
            searchType: typeof raw.searchType === 'string' ? raw.searchType : undefined,
            resolvedUserId: raw.fingerprint && typeof raw.fingerprint === 'object' && 'userId' in raw.fingerprint
                ? ((_b = raw.fingerprint.userId) !== null && _b !== void 0 ? _b : null)
                : null,
            resolvedUserAccountId: typeof raw.resolvedUserAccountId === 'string' ? raw.resolvedUserAccountId : null,
            fingerprints: fingerprints.length > 0 ? fingerprints : undefined,
            shortCodeLookup: label
                ? { found: true, shortCode: label }
                : { found: true, shortCode: '(matched)' },
            auditLogsFallback: raw.auditLogsFallback === true,
            auditLogsFallbackReason: typeof raw.auditLogsFallbackReason === 'string' ? raw.auditLogsFallbackReason : undefined,
        };
    }
    var items = raw.items;
    return {
        items: Array.isArray(items) ? items : [],
        totalElements: typeof raw.totalElements === 'number' ? raw.totalElements : 0,
        totalPages: typeof raw.totalPages === 'number' ? raw.totalPages : 0,
        currentPage: typeof raw.currentPage === 'number' ? raw.currentPage : 0,
        pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 0,
        searchCriteria: typeof raw.searchCriteria === 'string' ? raw.searchCriteria : undefined,
        searchType: typeof raw.searchType === 'string' ? raw.searchType : undefined,
        resolvedUserId: typeof raw.resolvedUserId === 'number' ? raw.resolvedUserId : null,
        fingerprints: Array.isArray(raw.fingerprints) ? raw.fingerprints : undefined,
        shortCodeLookup: raw.shortCodeLookup,
    };
}
function normalizeShortCodeInput(value) {
    var s = value.trim();
    if (s.startsWith('#'))
        s = s.slice(1).trim();
    return s.toUpperCase();
}
var buildWatermarkDetails = function (fp, defaultIp) {
    var _a;
    if (defaultIp === void 0) { defaultIp = 'N/A'; }
    var accountId = fp.userAccountId || ((_a = fp.userId) === null || _a === void 0 ? void 0 : _a.toString()) || 'SYSTEM';
    var timestamp = fp.createdAt
        ? new Date(fp.createdAt).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).replace(/\//g, '-')
        : new Date().toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).replace(/\//g, '-');
    var shortCode = fp.shortCode || 'N/A';
    return "UID: ".concat(accountId, " | ").concat(timestamp, " | ").concat(defaultIp, " | #").concat(shortCode);
};
var datetimeLocalInputStyle = function (theme) { return ({
    flex: '1 1 200px',
    minWidth: 0,
    maxWidth: '100%',
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px',
    borderRadius: '4px',
    border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
    background: theme === 'dark' ? '#2a2a2a' : '#fff',
    color: theme === 'dark' ? '#fff' : '#000',
}); };
function WatermarkTracebackPage() {
    var _this = this;
    var _a, _b, _c;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    // Search form state
    var _d = (0, react_1.useState)(''), userAccountId = _d[0], setUserAccountId = _d[1];
    var _e = (0, react_1.useState)(''), ipAddress = _e[0], setIpAddress = _e[1];
    var _f = (0, react_1.useState)(''), startTime = _f[0], setStartTime = _f[1];
    var _g = (0, react_1.useState)(''), endTime = _g[0], setEndTime = _g[1];
    var _h = (0, react_1.useState)(''), shortCode = _h[0], setShortCode = _h[1];
    // Results state
    var _j = (0, react_1.useState)(false), loading = _j[0], setLoading = _j[1];
    var _k = (0, react_1.useState)(''), error = _k[0], setError = _k[1];
    var _l = (0, react_1.useState)(null), searchResult = _l[0], setSearchResult = _l[1];
    var _m = (0, react_1.useState)({}), expandedDetails = _m[0], setExpandedDetails = _m[1];
    var handleSearch = function () { return __awaiter(_this, void 0, void 0, function () {
        var params, res, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    setSearchResult(null);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    params = { page: 0, size: 50 };
                    if (userAccountId)
                        params.userAccountId = userAccountId.trim();
                    if (ipAddress)
                        params.ipAddress = ipAddress.trim();
                    if (shortCode)
                        params.shortCode = normalizeShortCodeInput(shortCode);
                    if (startTime)
                        params.startTime = startTime;
                    if (endTime)
                        params.endTime = endTime;
                    return [4 /*yield*/, api_1.apiClient.watermarkTracebackSearch(params)];
                case 2:
                    res = _e.sent();
                    setSearchResult(normalizeWatermarkSearchPayload(res.data));
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _e.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || 'Search failed');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleClear = function () {
        setUserAccountId('');
        setIpAddress('');
        setStartTime('');
        setEndTime('');
        setShortCode('');
        setSearchResult(null);
        setError('');
        setExpandedDetails({});
    };
    // Format details JSON for display
    var formatDetails = function (details) {
        if (!details)
            return { display: '-', isJson: false, jsonObj: null };
        try {
            var parsed = JSON.parse(details);
            return { display: JSON.stringify(parsed, null, 2), isJson: true, jsonObj: parsed };
        }
        catch (_a) {
            return { display: details, isJson: false, jsonObj: null };
        }
    };
    // Toggle details expansion
    var toggleDetails = function (id) {
        setExpandedDetails(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[id] = !prev[id], _a)));
        });
    };
    var getResultColor = function (result) {
        switch (result) {
            case 'SUCCESS': return '#4caf50';
            case 'FAILURE': return '#ff6b6b';
            case 'DENIED': return '#ffa500';
            default: return '#888';
        }
    };
    var formatTimestamp = function (ts) {
        return new Date(ts).toLocaleString();
    };
    return (<div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Watermark Traceback</h1>
          <p style={{ color: '#888', marginTop: '8px' }}>
            Search and trace document leaks using watermark metadata
          </p>
        </div>
        <button onClick={function () { return navigate(-1); }} style={{ padding: '8px 16px' }}>
          Back
        </button>
      </div>

      {/* Search Form */}
      <div className="dashboard-card">
        <h3 style={{ marginBottom: '8px' }}>Search Watermark Records</h3>
        <p style={{ color: '#888', marginBottom: '16px', fontSize: '0.9em' }}>
          Enter any combination of fields. Short Code and Payload Hash provide exact matches.
          User, Document, IP, and Time can narrow down results.
        </p>

        {error && (<div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '16px' }}>
            {error}
          </div>)}

        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '16px',
            minWidth: 0,
        }}>
          {/* Short Code - Highest Priority */}
          <div style={{ minWidth: 0 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', color: '#888' }}>
              Short Code (Doc Fingerprint)
            </label>
            <input type="text" value={shortCode} onChange={function (e) { return setShortCode(e.target.value); }} placeholder="e.g., ABC1234 or #ABC1234" style={{
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            padding: '10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000',
            fontFamily: 'monospace',
        }}/>
          </div>

          {/* User Account ID */}
          <div style={{ minWidth: 0 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', color: '#888' }}>
              User Account ID
            </label>
            <input type="text" value={userAccountId} onChange={function (e) { return setUserAccountId(e.target.value); }} placeholder="e.g., it1, admin" style={{
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            padding: '10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000',
        }}/>
          </div>

          {/* IP Address */}
          <div style={{ minWidth: 0 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', color: '#888' }}>
              IP Address
            </label>
            <input type="text" value={ipAddress} onChange={function (e) { return setIpAddress(e.target.value); }} placeholder="e.g., 192.168.1.100" style={{
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            padding: '10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000',
        }}/>
          </div>
        </div>

        {/* Time range on its own row so datetime-local controls do not overflow the card */}
        <div style={{ marginBottom: '16px', width: '100%', minWidth: 0, maxWidth: '100%' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em', color: '#888' }}>
            Created At (Time Range)
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            minWidth: 0,
        }}>
            <input type="datetime-local" value={startTime} onChange={function (e) { return setStartTime(e.target.value); }} style={datetimeLocalInputStyle(theme)}/>
            <span style={{ color: '#888', flex: '0 0 auto' }}>to</span>
            <input type="datetime-local" value={endTime} onChange={function (e) { return setEndTime(e.target.value); }} style={datetimeLocalInputStyle(theme)}/>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleSearch} disabled={loading} style={{
            padding: '10px 24px',
            background: loading ? '#999' : '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '600',
        }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button onClick={handleClear} style={{
            padding: '10px 24px',
            background: theme === 'dark' ? '#333' : '#e0e0e0',
            color: theme === 'dark' ? '#fff' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
        }}>
            Clear
          </button>
        </div>
      </div>
      {searchResult && (<div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Search Results</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {searchResult.searchType && (<span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.8em',
                    fontWeight: '600',
                    background: '#1976d222',
                    color: '#1976d2'
                }}>
                  {searchResult.searchType.replace('_', ' ')}
                </span>)}
              <span style={{ color: '#888', fontSize: '0.9em' }}>
                {searchResult.totalElements} audit log(s)
              </span>
            </div>
          </div>

          {/* Search Criteria Info */}
          {searchResult.searchCriteria && (<div style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    fontSize: '0.85em'
                }}>
              <strong>Search Criteria:</strong> {searchResult.searchCriteria}
              {searchResult.resolvedUserAccountId && (<div style={{ marginTop: '4px' }}>
                  <strong>Resolved User ID:</strong> {searchResult.resolvedUserAccountId}
                  {searchResult.resolvedUserId && (<span style={{ color: '#888', marginLeft: '8px' }}>(ID: {searchResult.resolvedUserId})</span>)}
                </div>)}
            </div>)}

          {/* Partial Match Warning */}
          {((_a = searchResult.shortCodeLookup) === null || _a === void 0 ? void 0 : _a.partialMatch) && (<div style={{
                    padding: '12px',
                    background: '#fff3e0',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    color: '#e65100'
                }}>
              <strong>Partial Match:</strong> {searchResult.shortCodeLookup.message}
            </div>)}

          {/* Short Code Lookup Result */}
          {searchResult.shortCodeLookup && (<div style={{
                    padding: '12px',
                    background: searchResult.shortCodeLookup.found ? '#e8f5e9' : '#ffebee',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    color: searchResult.shortCodeLookup.found ? '#2e7d32' : '#c62828'
                }}>
              {searchResult.shortCodeLookup.found ? (<strong>Short Code FOUND in database</strong>) : (<>
                  <strong>Short Code NOT FOUND:</strong> {searchResult.shortCodeLookup.shortCode}
                  <p style={{ marginTop: '4px', fontSize: '0.9em' }}>{searchResult.shortCodeLookup.message}</p>
                </>)}
            </div>)}

          {/* Fallback Search Indicator */}
          {searchResult.auditLogsFallback && (<div style={{
                    padding: '12px',
                    background: '#fff3e0',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    color: '#e65100'
                }}>
              <strong>Fallback Search Used:</strong>
              <p style={{ marginTop: '4px', fontSize: '0.9em' }}>{searchResult.auditLogsFallbackReason}</p>
            </div>)}

          {/* Watermark Fingerprints */}
          {searchResult.fingerprints && searchResult.fingerprints.length > 0 && (<div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Watermark Fingerprints ({searchResult.fingerprints.length})</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '1100px' }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Short Code</th>
                      <th>User</th>
                      <th>Document ID</th>
                      <th>Payload Hash</th>
                      <th>Watermark Details</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.fingerprints.map(function (fp) { return (<tr key={fp.id}>
                        <td>{fp.id}</td>
                        <td style={{ fontFamily: 'monospace', color: '#1976d2', fontWeight: 'bold' }}>{fp.shortCode || '-'}</td>
                        <td>
                          {fp.userAccountId ? (<span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{fp.userAccountId}</span>) : (<span style={{ color: '#888', fontStyle: 'italic' }}>System</span>)}
                        </td>
                        <td>
                          {fp.documentId ? (<span style={{ fontFamily: 'monospace' }}>#{fp.documentId}</span>) : '-'}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75em', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {fp.payloadHash ? (<span title={fp.payloadHash}>{fp.payloadHash.substring(0, 16)}...</span>) : '-'}
                        </td>
                        <td style={{
                        fontFamily: 'monospace',
                        fontSize: '0.72em',
                        color: '#333',
                        background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        maxWidth: '320px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }} title={buildWatermarkDetails(fp)}>
                          {buildWatermarkDetails(fp)}
                        </td>
                        <td>{fp.createdAt ? formatTimestamp(fp.createdAt) : '-'}</td>
                      </tr>); })}
                  </tbody>
                </table>
              </div>

              {/* Legend for system fingerprints */}
              <div style={{ marginTop: '8px', fontSize: '0.8em', color: '#888' }}>
                <strong>Note:</strong> Fingerprints with <span style={{ color: '#888', fontStyle: 'italic' }}>"System (null userId)"</span> are generated during document upload by system (no user context). The audit logs should still be found by document ID or payload hash matching.
              </div>
            </div>)}

          {/* Audit Logs */}
          {((_c = (_b = searchResult.items) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) > 0 ? (<div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Result</th>
                    <th>IP Address</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResult.items.map(function (log) { return (<tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatTimestamp(log.timestamp)}</td>
                      <td>
                        {log.accountId || log.userId || '-'}
                      </td>
                      <td>{log.action}</td>
                      <td>
                        <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8em',
                        fontWeight: '600',
                        background: getResultColor(log.result) + '22',
                        color: getResultColor(log.result)
                    }}>
                          {log.result}
                        </span>
                      </td>
                      <td>{log.ipAddress || '-'}</td>
                      <td style={{ maxWidth: '300px' }}>
                        {log.details ? (<div>
                            {(function () {
                            var formatted = formatDetails(log.details);
                            if (!formatted.isJson) {
                                return (<div style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>
                                    {log.details.length > 100 ? "".concat(log.details.substring(0, 100), "...") : log.details}
                                  </div>);
                            }
                            var isExpanded = expandedDetails[log.id];
                            var preview = formatted.display.substring(0, 80);
                            return (<div>
                                  <button onClick={function () { return toggleDetails(log.id); }} style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#1976d2',
                                    cursor: 'pointer',
                                    fontSize: '0.85em',
                                    padding: '2px 6px',
                                    textDecoration: 'underline'
                                }}>
                                    {isExpanded ? '▼ Hide' : '▶ Show'} JSON
                                  </button>
                                  {isExpanded && (<pre style={{
                                        margin: '8px 0 0 0',
                                        padding: '8px',
                                        background: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
                                        borderRadius: '4px',
                                        fontSize: '0.75em',
                                        maxHeight: '200px',
                                        overflow: 'auto',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all'
                                    }}>
                                      {formatted.display}
                                    </pre>)}
                                  {!isExpanded && (<div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                                      {preview}...
                                    </div>)}
                                </div>);
                        })()}
                          </div>) : '-'}
                      </td>
                    </tr>); })}
                </tbody>
              </table>
            </div>) : (<div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
              No audit logs found matching the search criteria.
            </div>)}
        </div>)}

    </div>);
}
