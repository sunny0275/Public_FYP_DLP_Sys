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
exports.default = AuditLogPage;
var react_1 = require("react");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var authStore_1 = require("../../store/authStore");
function AuditLogPage() {
    var _this = this;
    var _a;
    var _b = (0, authStore_1.useAuthStore)(), theme = _b.theme, user = _b.user;
    var hasRole = function () {
        var roles = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            roles[_i] = arguments[_i];
        }
        return ((user === null || user === void 0 ? void 0 : user.roles) || []).some(function (r) {
            return roles.some(function (role) { return r === role || r === "ROLE_".concat(role); });
        });
    };
    var isAdmin = hasRole('ADMIN');
    var canManageLegacy = hasRole('ADMIN', 'REVIEWER');
    var _c = (0, react_1.useState)(null), auditLogPage = _c[0], setAuditLogPage = _c[1];
    var _d = (0, react_1.useState)(true), loading = _d[0], setLoading = _d[1];
    var _e = (0, react_1.useState)(''), error = _e[0], setError = _e[1];
    var _f = (0, react_1.useState)(null), selectedLog = _f[0], setSelectedLog = _f[1];
    var _g = (0, react_1.useState)(false), showDetailModal = _g[0], setShowDetailModal = _g[1];
    var _h = (0, react_1.useState)(false), exporting = _h[0], setExporting = _h[1];
    // Pagination
    var _j = (0, react_1.useState)(0), page = _j[0], setPage = _j[1];
    var pageSize = (0, react_1.useState)(20)[0];
    // Filters - default to show all logs (no filters)
    var _k = (0, react_1.useState)({ page: 0, size: 20 }), filters = _k[0], setFilters = _k[1];
    var _l = (0, react_1.useState)(false), showFilters = _l[0], setShowFilters = _l[1];
    // Legacy (unchained) audit logs
    var _m = (0, react_1.useState)(null), legacyCount = _m[0], setLegacyCount = _m[1];
    var _o = (0, react_1.useState)(false), legacyLoading = _o[0], setLegacyLoading = _o[1];
    var _p = (0, react_1.useState)(false), legacyActionLoading = _p[0], setLegacyActionLoading = _p[1];
    (0, react_1.useEffect)(function () {
        loadAuditLogs();
    }, [page, pageSize, filters]);
    var loadLegacyCount = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var res, _a;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    setLegacyLoading(true);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getLegacyAuditCount()];
                case 2:
                    res = _d.sent();
                    setLegacyCount((_c = (_b = res.data) === null || _b === void 0 ? void 0 : _b.legacyCount) !== null && _c !== void 0 ? _c : 0);
                    return [3 /*break*/, 5];
                case 3:
                    _a = _d.sent();
                    setLegacyCount(null);
                    return [3 /*break*/, 5];
                case 4:
                    setLegacyLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, []);
    (0, react_1.useEffect)(function () {
        if (canManageLegacy)
            loadLegacyCount();
    }, [loadLegacyCount, canManageLegacy]);
    var loadAuditLogs = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var params, response, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    params = __assign(__assign({}, filters), { page: page, size: pageSize });
                    return [4 /*yield*/, api_1.apiClient.searchAuditLogs(params)];
                case 2:
                    response = _c.sent();
                    if (response.success && response.data) {
                        setAuditLogPage(response.data);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load audit logs');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [page, pageSize, filters]);
    var handleFilterChange = function (key, value) {
        setFilters(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[key] = value, _a)));
        });
        setPage(0); // Reset to first page when filters change
    };
    var handleApplyFilters = function () {
        setPage(0);
        loadAuditLogs();
    };
    var handleResetFilters = function () {
        setFilters({ page: 0, size: 20 });
        setPage(0);
    };
    var handleExport = function () { return __awaiter(_this, void 0, void 0, function () {
        var blob, url, a, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setExporting(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.exportAuditLogs(__assign(__assign({}, filters), { format: 'csv', page: 0, size: 10000 // Export more records
                         }))];
                case 2:
                    blob = _c.sent();
                    url = window.URL.createObjectURL(blob);
                    a = document.createElement('a');
                    a.href = url;
                    a.download = "audit-logs-".concat(new Date().toISOString(), ".csv");
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    alert('Audit logs exported successfully');
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    alert('Failed to export audit logs: ' + (((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || err_2.message));
                    return [3 /*break*/, 5];
                case 4:
                    setExporting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var getResultColor = function (result) {
        switch (result) {
            case 'SUCCESS': return '#4caf50';
            case 'FAILURE': return '#f44336';
            case 'WARNING': return '#ff9800';
            case 'CRITICAL': return '#b71c1c';
            case 'DENIED': return '#d32f2f';
            default: return '#757575';
        }
    };
    var getCategoryColor = function (category) {
        switch (category) {
            case 'AUTH': return '#2196f3';
            case 'DOCUMENT': return '#9c27b0';
            case 'ADMIN': return '#ff5722';
            case 'SYSTEM': return '#607d8b';
            default: return '#757575';
        }
    };
    var getSeverity = function (result, action) {
        // Screen recording/screenshot attempts are always HIGH severity
        if (action && (action.includes('SCREENSHOT') ||
            action.includes('SCREEN_RECORD') ||
            action.includes('CLIPBOARD_IMAGE') ||
            action.includes('SCREEN_CAPTURE'))) {
            return 'HIGH';
        }
        // DENIED or FAILURE = HIGH severity
        if (result === 'FAILURE' || result === 'DENIED')
            return 'HIGH';
        if (result === 'WARNING')
            return 'MEDIUM';
        return 'LOW';
    };
    var getSeverityColor = function (severity) {
        switch (severity) {
            case 'HIGH': return '#f44336'; // red
            case 'MEDIUM': return '#ff9800'; // yellow/orange
            default: return '#4caf50'; // green
        }
    };
    var getChainStatusMeta = function (status) {
        switch (status) {
            case 'ANCHORED':
                return { label: 'Anchored', bg: '#4caf5033', color: '#2e7d32' };
            case 'HASHED':
                return { label: 'Hashed', bg: '#03a9f433', color: '#01579b' };
            case 'ANCHOR_FAILED':
                return { label: 'Anchor failed', bg: '#f4433633', color: '#b71c1c' };
            case 'NOT_CHAINED':
                return { label: 'Not chained', bg: '#ff980033', color: '#e65100' };
            default:
                return { label: 'Unknown', bg: '#9e9e9e33', color: '#616161' };
        }
    };
    var formatTimestamp = function (timestamp) {
        return new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };
    var totalElements = (auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.totalElements) || 0;
    var totalPages = (auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.totalPages) || 0;
    var currentPage = (_a = auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.currentPage) !== null && _a !== void 0 ? _a : page;
    var items = (auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.items) || [];
    var activeQuickFilter = filters.searchTerm === 'BLOCKCHAIN'
        ? 'BLOCKCHAIN'
        : (filters.action === 'UNAUTHORIZED_ACCESS'
            ? 'UNAUTHORIZED_ACCESS'
            : (filters.action === 'WINDOW_FOCUS_LOST' || filters.action === 'APP_SWITCH'
                ? filters.action
                : null));
    var applyQuickFilter = function (quick) {
        setFilters(function (prev) {
            if (quick === 'WINDOW_FOCUS_LOST' || quick === 'APP_SWITCH' || quick === 'UNAUTHORIZED_ACCESS') {
                return __assign(__assign({}, prev), { action: quick, searchTerm: undefined });
            }
            if (quick === 'BLOCKCHAIN') {
                return __assign(__assign({}, prev), { action: undefined, searchTerm: 'BLOCKCHAIN' });
            }
            return __assign(__assign({}, prev), { action: undefined, searchTerm: undefined });
        });
        setPage(0);
    };
    return (<DashboardLayout_1.default>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>Audit Logs</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleExport} disabled={exporting} style={{
            padding: '8px 16px',
            background: exporting ? '#ccc' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: exporting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
        }}>
              {exporting ? 'Exporting...' : 'Export Report'}
            </button>
            <button onClick={function () { return setShowFilters(!showFilters); }} style={{
            padding: '8px 16px',
            background: showFilters ? '#ff9800' : '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
        }}>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>

        {/* Quick filters: focus/device and blockchain */}
        <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: theme === 'dark' ? '#aaa' : '#666', marginRight: '8px' }}>Quick:</span>
          <button type="button" onClick={function () { return applyQuickFilter('WINDOW_FOCUS_LOST'); }} style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: "1px solid ".concat(activeQuickFilter === 'WINDOW_FOCUS_LOST' ? '#2196f3' : theme === 'dark' ? '#555' : '#ddd'),
            background: activeQuickFilter === 'WINDOW_FOCUS_LOST' ? '#2196f333' : 'transparent',
            color: theme === 'dark' ? '#eee' : '#333',
            cursor: 'pointer',
            fontSize: '13px'
        }}>
            Window focus lost
          </button>
          <button type="button" onClick={function () { return applyQuickFilter('APP_SWITCH'); }} style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: "1px solid ".concat(activeQuickFilter === 'APP_SWITCH' ? '#2196f3' : theme === 'dark' ? '#555' : '#ddd'),
            background: activeQuickFilter === 'APP_SWITCH' ? '#2196f333' : 'transparent',
            color: theme === 'dark' ? '#eee' : '#333',
            cursor: 'pointer',
            fontSize: '13px'
        }}>
            App switch
          </button>
          {isAdmin && (<button type="button" onClick={function () { return applyQuickFilter('BLOCKCHAIN'); }} style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: "1px solid ".concat(activeQuickFilter === 'BLOCKCHAIN' ? '#2196f3' : theme === 'dark' ? '#555' : '#ddd'),
                background: activeQuickFilter === 'BLOCKCHAIN' ? '#2196f333' : 'transparent',
                color: theme === 'dark' ? '#eee' : '#333',
                cursor: 'pointer',
                fontSize: '13px'
            }}>
              Blockchain
            </button>)}
          {isAdmin && (<button type="button" onClick={function () { return applyQuickFilter('UNAUTHORIZED_ACCESS'); }} style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: "1px solid ".concat(activeQuickFilter === 'UNAUTHORIZED_ACCESS' ? '#f44336' : theme === 'dark' ? '#555' : '#ddd'),
                background: activeQuickFilter === 'UNAUTHORIZED_ACCESS' ? '#f4433633' : 'transparent',
                color: activeQuickFilter === 'UNAUTHORIZED_ACCESS' ? '#f44336' : (theme === 'dark' ? '#eee' : '#333'),
                cursor: 'pointer',
                fontSize: '13px'
            }}>
              Unauthorized Access
            </button>)}
          <button type="button" onClick={function () { return applyQuickFilter(null); }} style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
            background: 'transparent',
            color: theme === 'dark' ? '#999' : '#666',
            cursor: 'pointer',
            fontSize: '13px'
        }}>
            Clear quick
          </button>
        </div>

        {/* Legacy (unchained) logs: mark as NOT_CHAINED or clear — only for audit roles */}
        {canManageLegacy && (legacyCount === null || legacyCount > 0) && (<div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: theme === 'dark' ? '#2a2a2a' : '#fff8e1',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ffcc02'),
                borderRadius: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '12px'
            }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              Legacy (unchained) logs: {legacyLoading ? '…' : (legacyCount !== null && legacyCount !== void 0 ? legacyCount : '—')}
            </span>
            <button type="button" disabled={legacyActionLoading || (legacyCount !== null && legacyCount === 0)} onClick={function () { return __awaiter(_this, void 0, void 0, function () {
                var res, e_1;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            setLegacyActionLoading(true);
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 3, 4, 5]);
                            return [4 /*yield*/, api_1.apiClient.markLegacyAsNotChained()];
                        case 2:
                            res = _e.sent();
                            alert("Marked ".concat((_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.markedCount) !== null && _b !== void 0 ? _b : 0, " legacy logs as \"Not chained\"."));
                            loadLegacyCount();
                            loadAuditLogs();
                            return [3 /*break*/, 5];
                        case 3:
                            e_1 = _e.sent();
                            alert(((_d = (_c = e_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to mark legacy logs');
                            return [3 /*break*/, 5];
                        case 4:
                            setLegacyActionLoading(false);
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            }); }} style={{ padding: '6px 12px', borderRadius: '6px', background: '#ff9800', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
              {legacyActionLoading ? '…' : 'Mark all as Not chained'}
            </button>
            <button type="button" disabled={legacyActionLoading || (legacyCount !== null && legacyCount === 0)} onClick={function () { return __awaiter(_this, void 0, void 0, function () {
                var res, e_2;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            if (!confirm("Delete ".concat(legacyCount !== null && legacyCount !== void 0 ? legacyCount : 0, " legacy (unchained) audit logs? This cannot be undone.")))
                                return [2 /*return*/];
                            setLegacyActionLoading(true);
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 3, 4, 5]);
                            return [4 /*yield*/, api_1.apiClient.clearLegacyAuditLogs()];
                        case 2:
                            res = _e.sent();
                            alert("Deleted ".concat((_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.deletedCount) !== null && _b !== void 0 ? _b : 0, " legacy logs."));
                            loadLegacyCount();
                            loadAuditLogs();
                            return [3 /*break*/, 5];
                        case 3:
                            e_2 = _e.sent();
                            alert(((_d = (_c = e_2.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to clear legacy logs');
                            return [3 /*break*/, 5];
                        case 4:
                            setLegacyActionLoading(false);
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            }); }} style={{ padding: '6px 12px', borderRadius: '6px', background: '#f44336', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
              {legacyActionLoading ? '…' : 'Clear legacy only'}
            </button>
          </div>)}

        {/* Filter Panel */}
        {showFilters && (<div style={{
                background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd')
            }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Username</label>
                <input type="text" value={filters.userName || ''} onChange={function (e) { return handleFilterChange('userName', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }} placeholder="Username"/>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Account ID</label>
                <input type="text" value={filters.accountId || ''} onChange={function (e) { return handleFilterChange('accountId', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }} placeholder="Account ID"/>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Document ID</label>
                <input type="number" value={filters.documentId || ''} onChange={function (e) { return handleFilterChange('documentId', e.target.value ? Number(e.target.value) : undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }} placeholder="Document ID"/>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Action Type</label>
                <input type="text" value={filters.action || ''} onChange={function (e) { return handleFilterChange('action', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }} placeholder="e.g. VIEW_DOCUMENT"/>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Category</label>
                <select value={filters.category || ''} onChange={function (e) { return handleFilterChange('category', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }}>
                  <option value="">All</option>
                  <option value="AUTH">AUTH</option>
                  <option value="DOCUMENT">DOCUMENT</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SYSTEM">SYSTEM</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Result</label>
                <select value={filters.result || ''} onChange={function (e) { return handleFilterChange('result', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }}>
                  <option value="">All</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILURE">FAILURE</option>
                  <option value="WARNING">WARNING</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="DENIED">DENIED</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Severity</label>
                <select value={filters.severity || ''} onChange={function (e) { return handleFilterChange('severity', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }}>
                  <option value="">All</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Start Time</label>
                <input type="datetime-local" value={filters.startTime || ''} onChange={function (e) { return handleFilterChange('startTime', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>End Time</label>
                <input type="datetime-local" value={filters.endTime || ''} onChange={function (e) { return handleFilterChange('endTime', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Search Keyword</label>
                <input type="text" value={filters.searchTerm || ''} onChange={function (e) { return handleFilterChange('searchTerm', e.target.value || undefined); }} style={{
                width: '100%',
                padding: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ddd'),
                borderRadius: '4px',
                background: theme === 'dark' ? '#333' : 'white',
                color: theme === 'dark' ? '#fff' : '#000'
            }} placeholder="Search action, details, etc."/>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleApplyFilters} style={{
                padding: '8px 16px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
            }}>
                Apply Filters
              </button>
              <button onClick={handleResetFilters} style={{
                padding: '8px 16px',
                background: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
            }}>
                Reset
              </button>
            </div>
          </div>)}

        {/* Error Message */}
        {error && (<div style={{
                padding: '12px',
                background: '#ffebee',
                color: '#c62828',
                borderRadius: '4px',
                marginBottom: '16px'
            }}>
            {error}
          </div>)}

        {/* Audit Logs Table */}
        <div style={{
            background: theme === 'dark' ? '#2a2a2a' : 'white',
            borderRadius: '8px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: theme === 'dark' ? '#333' : '#f5f5f5', borderBottom: "2px solid ".concat(theme === 'dark' ? '#555' : '#ddd') }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Time</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>User</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Action</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Category</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Severity</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Result</th>
                  {isAdmin && (<th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Chain Status</th>)}
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>IP Address</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (<tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      Loading...
                    </td>
                  </tr>) : items.length === 0 ? (<tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      No audit logs found
                    </td>
                  </tr>) : (items.map(function (log) { return (<tr key={log.id} style={{
                borderBottom: "1px solid ".concat(theme === 'dark' ? '#444' : '#eee'),
                cursor: 'pointer',
                transition: 'background 0.2s'
            }} onMouseEnter={function (e) { return e.currentTarget.style.background = theme === 'dark' ? '#333' : '#f9f9f9'; }} onMouseLeave={function (e) { return e.currentTarget.style.background = 'transparent'; }} onClick={function () {
                setSelectedLog(log);
                setShowDetailModal(true);
            }}>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{formatTimestamp(log.timestamp)}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        {log.userName || log.accountId || 'Unknown'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{log.action}</td>
                      <td style={{ padding: '12px' }}>
                        {log.category && (<span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: getCategoryColor(log.category) + '33',
                    color: getCategoryColor(log.category)
                }}>
                            {log.category}
                          </span>)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                background: getSeverityColor(getSeverity(log.result, log.action)) + '33',
                color: getSeverityColor(getSeverity(log.result, log.action))
            }}>
                          {getSeverity(log.result, log.action)}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
                background: getResultColor(log.result) + '33',
                color: getResultColor(log.result)
            }}>
                          {log.result}
                        </span>
                      </td>
                      {isAdmin && (<td style={{ padding: '12px' }}>
                          {(function () {
                    var chain = getChainStatusMeta(log.anchorStatus);
                    return (<span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                            background: chain.bg,
                            color: chain.color
                        }}>
                                {chain.label}
                              </span>);
                })()}
                        </td>)}
                      <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace' }}>
                        {log.ipAddress || '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={function (e) {
                e.stopPropagation();
                setSelectedLog(log);
                setShowDetailModal(true);
            }} style={{
                padding: '4px 12px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
            }}>
                          View Details
                        </button>
                      </td>
                    </tr>); }))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (<div style={{
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd')
            }}>
              <div style={{ fontSize: '14px', color: theme === 'dark' ? '#ccc' : '#666' }}>
                Showing {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={function () { return setPage(0); }} disabled={currentPage === 0 || loading} style={{
                padding: '6px 12px',
                background: currentPage === 0 ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px'
            }}>
                  First
                </button>
                <button onClick={function () { return setPage(function (p) { return Math.max(0, p - 1); }); }} disabled={currentPage === 0 || loading} style={{
                padding: '6px 12px',
                background: currentPage === 0 ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px'
            }}>
                  Previous
                </button>
                <span style={{ padding: '6px 12px', fontSize: '13px' }}>
                  Page {currentPage + 1} / {totalPages}
                </span>
                <button onClick={function () { return setPage(function (p) { return Math.min(totalPages - 1, p + 1); }); }} disabled={currentPage >= totalPages - 1 || loading} style={{
                padding: '6px 12px',
                background: currentPage >= totalPages - 1 ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px'
            }}>
                  Next
                </button>
                <button onClick={function () { return setPage(totalPages - 1); }} disabled={currentPage >= totalPages - 1 || loading} style={{
                padding: '6px 12px',
                background: currentPage >= totalPages - 1 ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px'
            }}>
                  Last
                </button>
              </div>
            </div>)}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedLog && (<div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function () { return setShowDetailModal(false); }}>
            <div style={{
                background: theme === 'dark' ? '#2a2a2a' : 'white',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto'
            }} onClick={function (e) { return e.stopPropagation(); }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Audit Log Details</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <strong>ID:</strong> {selectedLog.id}
                </div>
                <div>
                  <strong>Time:</strong> {formatTimestamp(selectedLog.timestamp)}
                </div>
                <div>
                  <strong>User ID:</strong> {selectedLog.userId || '—'}
                </div>
                <div>
                  <strong>Account ID:</strong> {selectedLog.accountId || '—'}
                </div>
                <div>
                  <strong>Username:</strong> {selectedLog.userName || '—'}
                </div>
                <div>
                  <strong>Action:</strong> {selectedLog.action}
                </div>
                <div>
                  <strong>Category:</strong> {selectedLog.category || '—'}
                </div>
                <div>
                  <strong>Result:</strong> {selectedLog.result}
                </div>
                <div>
                  <strong>IP Address:</strong> {selectedLog.ipAddress || '—'}
                </div>
                {isAdmin && (<div>
                    <strong>Immutable Hash:</strong>
                    <div style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: theme === 'dark' ? '#333' : '#f5f5f5',
                    borderRadius: '4px',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                }}>
                      {selectedLog.immutableHash || '—'}
                    </div>
                  </div>)}
                {isAdmin && (<div>
                    <strong>On-chain Anchor:</strong> {selectedLog.anchorStatus || '—'}
                  </div>)}
                {isAdmin && (<div>
                    <strong>Blockchain Tx Hash:</strong>
                    <div style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: theme === 'dark' ? '#333' : '#f5f5f5',
                    borderRadius: '4px',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                }}>
                      {selectedLog.blockchainTxHash || '—'}
                    </div>
                  </div>)}
                <div>
                  <strong>Details:</strong>
                  <div style={{
                marginTop: '8px',
                padding: '12px',
                background: theme === 'dark' ? '#333' : '#f5f5f5',
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '13px'
            }}>
                    {selectedLog.details || '—'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={function () { return setShowDetailModal(false); }} style={{
                padding: '8px 16px',
                background: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                  Close
                </button>
              </div>
            </div>
          </div>)}
      </div>
    </DashboardLayout_1.default>);
}
