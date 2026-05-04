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
exports.default = SecurityDashboardPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var authStore_1 = require("../../store/authStore");
var api_1 = require("../../api");
var DashboardSkeleton_1 = require("../../components/DashboardSkeleton");
function SecurityDashboardPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, authStore_1.useAuthStore)(), _user = _a.user, theme = _a.theme;
    var _b = (0, react_1.useState)([]), alerts = _b[0], setAlerts = _b[1];
    var _c = (0, react_1.useState)([]), incidents = _c[0], setIncidents = _c[1];
    var _d = (0, react_1.useState)([]), investigations = _d[0], setInvestigations = _d[1];
    var _e = (0, react_1.useState)(true), loading = _e[0], setLoading = _e[1];
    var _f = (0, react_1.useState)(''), error = _f[0], setError = _f[1];
    var _g = (0, react_1.useState)(null), auditLogPage = _g[0], setAuditLogPage = _g[1];
    var _h = (0, react_1.useState)(0), logPage = _h[0], setLogPage = _h[1];
    var _j = (0, react_1.useState)(false), auditLogLoading = _j[0], setAuditLogLoading = _j[1];
    var _k = (0, react_1.useState)(''), auditLogError = _k[0], setAuditLogError = _k[1];
    var LOG_PAGE_SIZE = 15;
    // Filters
    var _l = (0, react_1.useState)('all'), severityFilter = _l[0], setSeverityFilter = _l[1];
    var _m = (0, react_1.useState)(''), assetFilter = _m[0], setAssetFilter = _m[1];
    var _o = (0, react_1.useState)(''), policyFilter = _o[0], setPolicyFilter = _o[1];
    var _p = (0, react_1.useState)('all'), logSeverityFilter = _p[0], setLogSeverityFilter = _p[1];
    var _q = (0, react_1.useState)(''), logSearchTerm = _q[0], setLogSearchTerm = _q[1];
    var _r = (0, react_1.useState)(''), logUserIdFilter = _r[0], setLogUserIdFilter = _r[1];
    var _s = (0, react_1.useState)(''), logUserNameFilter = _s[0], setLogUserNameFilter = _s[1];
    var _t = (0, react_1.useState)(''), logStartTime = _t[0], setLogStartTime = _t[1];
    var _u = (0, react_1.useState)(''), logEndTime = _u[0], setLogEndTime = _u[1];
    (0, react_1.useEffect)(function () {
        loadSecurityData();
    }, [severityFilter]);
    var formatTimestampHK = function (timestamp) {
        if (!timestamp)
            return '—';
        return new Date(timestamp).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong' });
    };
    var logLatestAuditEntry = function (logs) {
        console.log('Audit log API response (latest first)', logs);
        if (!logs.length) {
            console.log('Audit log response empty');
            return;
        }
        var latest = logs[0];
        console.log('Latest audit entry (Time / User / Action / Result / IP)', {
            time: formatTimestampHK(latest.timestamp),
            user: latest.userName || latest.accountId || 'Unknown',
            action: latest.action,
            result: latest.result,
            ip: latest.ipAddress
        });
    };
    var loadAuditLogs = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var userIdInput, parsedUserId, userId, response, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setAuditLogLoading(true);
                    setAuditLogError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    userIdInput = logUserIdFilter.trim();
                    parsedUserId = userIdInput ? Number(userIdInput) : undefined;
                    userId = parsedUserId !== undefined && !Number.isNaN(parsedUserId) ? parsedUserId : undefined;
                    return [4 /*yield*/, api_1.apiClient.searchAuditLogs({
                            page: logPage,
                            size: LOG_PAGE_SIZE,
                            userId: userId,
                            userName: logUserNameFilter.trim() || undefined,
                            searchTerm: logSearchTerm.trim() || undefined,
                            severity: logSeverityFilter !== 'all' ? logSeverityFilter : undefined,
                            startTime: logStartTime || undefined,
                            endTime: logEndTime || undefined
                        })];
                case 2:
                    response = _c.sent();
                    setAuditLogPage(response.data);
                    logLatestAuditEntry(response.data.items || []);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setAuditLogError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load audit logs');
                    return [3 /*break*/, 5];
                case 4:
                    setAuditLogLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [logPage, logSeverityFilter, logSearchTerm, logUserIdFilter, logUserNameFilter, logStartTime, logEndTime]);
    (0, react_1.useEffect)(function () {
        loadAuditLogs();
    }, [loadAuditLogs]);
    var loadSecurityData = function () { return __awaiter(_this, void 0, void 0, function () {
        var severityParam, _a, alertsResult, incidentsResult, investigationsResult, failedSections;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    severityParam = severityFilter !== 'all' ? severityFilter : undefined;
                    return [4 /*yield*/, Promise.allSettled([
                            api_1.apiClient.getDLPAlerts(severityParam),
                            api_1.apiClient.getEDRIncidents(),
                            api_1.apiClient.getInvestigations()
                        ])];
                case 1:
                    _a = _b.sent(), alertsResult = _a[0], incidentsResult = _a[1], investigationsResult = _a[2];
                    failedSections = [];
                    if (alertsResult.status === 'fulfilled') {
                        setAlerts(alertsResult.value.data || []);
                    }
                    else {
                        failedSections.push('DLP alerts');
                        setAlerts([]);
                        console.warn('Failed to load DLP alerts', alertsResult.reason);
                    }
                    if (incidentsResult.status === 'fulfilled') {
                        setIncidents(incidentsResult.value.data || []);
                    }
                    else {
                        failedSections.push('EDR incidents');
                        setIncidents([]);
                        console.warn('Failed to load EDR incidents', incidentsResult.reason);
                    }
                    if (investigationsResult.status === 'fulfilled') {
                        setInvestigations(investigationsResult.value.data || []);
                    }
                    else {
                        failedSections.push('Investigations');
                        setInvestigations([]);
                        console.warn('Failed to load investigations', investigationsResult.reason);
                    }
                    if (failedSections.length > 0) {
                        setError("Some sections failed to load: ".concat(failedSections.join(', ')));
                    }
                    else {
                        setError('');
                    }
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var handleEscalate = function (_incidentId) {
        navigate('/edr');
    };
    var handleClearLogs = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!window.confirm('Clear all activity logs? This action cannot be undone.')) {
                        return [2 /*return*/];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 5, 6, 7]);
                    setLoading(true);
                    setError('');
                    return [4 /*yield*/, api_1.apiClient.clearAuditLogs()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, loadSecurityData()];
                case 3:
                    _c.sent();
                    setLogPage(0);
                    return [4 /*yield*/, loadAuditLogs()];
                case 4:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 5:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to clear activity logs');
                    return [3 /*break*/, 7];
                case 6:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var severityColorMap = {
        HIGH: '#ff6b6b',
        MEDIUM: '#ffa500',
        LOW: '#4caf50'
    };
    var renderPaginationControls = function () {
        var _a, _b, _c;
        var currentPage = (_a = auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.currentPage) !== null && _a !== void 0 ? _a : logPage;
        var totalPages = Math.max((_b = auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.totalPages) !== null && _b !== void 0 ? _b : 1, 1);
        var totalElements = (_c = auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.totalElements) !== null && _c !== void 0 ? _c : 0;
        var itemsInPage = (auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.items) || [];
        var startIndex = totalElements === 0 ? 0 : currentPage * LOG_PAGE_SIZE + 1;
        var endIndex = totalElements === 0 ? 0 : Math.min(totalElements, startIndex + itemsInPage.length - 1);
        return (<div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
            }}>
        <div style={{ fontSize: '0.85em', color: '#888' }}>
          {totalElements === 0 ? 'No audit logs found' : "Showing ".concat(startIndex, " - ").concat(endIndex, " of ").concat(totalElements, " entries")}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={function () { return setLogPage(function (prev) { return Math.max(prev - 1, 0); }); }} disabled={currentPage <= 0 || auditLogLoading} style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: '#fff',
                cursor: currentPage <= 0 || auditLogLoading ? 'not-allowed' : 'pointer'
            }}>
            ← Prev
          </button>
          <span style={{ fontSize: '0.85em', color: '#555' }}>
            Page {currentPage + 1} of {totalPages}
          </span>
          <button onClick={function () { return setLogPage(function (prev) { return prev + 1; }); }} disabled={auditLogLoading || currentPage >= totalPages - 1} style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: '#fff',
                cursor: auditLogLoading || currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer'
            }}>
            Next →
          </button>
        </div>
      </div>);
    };
    var handleExportLogs = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, blob, url, a, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.exportLogs('24h')
                        // Create download link
                    ];
                case 1:
                    response = _c.sent();
                    blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                    url = window.URL.createObjectURL(blob);
                    a = document.createElement('a');
                    a.href = url;
                    a.download = "audit-logs-".concat(new Date().toISOString(), ".json");
                    a.click();
                    window.URL.revokeObjectURL(url);
                    return [3 /*break*/, 3];
                case 2:
                    err_3 = _c.sent();
                    alert(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to export logs');
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var getSeverityColor = function (severity) {
        switch (severity) {
            case 'CRITICAL': return '#ff0000';
            case 'HIGH': return '#ff6b6b';
            case 'MEDIUM': return '#ffa500';
            case 'LOW': return '#4caf50';
            default: return '#888';
        }
    };
    var getStatusColor = function (status) {
        switch (status) {
            case 'OPEN': return '#ff6b6b';
            case 'INVESTIGATING':
            case 'IN_PROGRESS': return '#ffa500';
            case 'RESOLVED':
            case 'CLOSED': return '#4caf50';
            case 'FALSE_POSITIVE': return '#888';
            default: return '#888';
        }
    };
    var logsToRender = (auditLogPage === null || auditLogPage === void 0 ? void 0 : auditLogPage.items) || [];
    // Filter incidents
    var filteredIncidents = incidents.filter(function (incident) {
        if (assetFilter && !incident.affectedAsset.toLowerCase().includes(assetFilter.toLowerCase())) {
            return false;
        }
        return true;
    });
    // Filter alerts
    var filteredAlerts = alerts.filter(function (alert) {
        if (policyFilter && alert.policyViolated !== policyFilter) {
            return false;
        }
        return true;
    });
    if (loading) {
        return <DashboardSkeleton_1.default variant="security"/>;
    }
    return (<div className="dashboard">
      {error && (<div className="error-message" style={{ marginBottom: '12px' }}>
          {error}
        </div>)}
      <div className="dashboard-header">
        <div>
          <h1>Security Dashboard</h1>
          <p style={{ color: '#888', marginTop: '8px' }}>
            Threat Detection & Response
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={severityFilter} onChange={function (e) { return setSeverityFilter(e.target.value); }} style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}>
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <button onClick={handleExportLogs} style={{ padding: '8px 16px' }}>
            📥 Export Logs
          </button>
        </div>
      </div>

      {/* DLP Alerts Timeline */}
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>DLP Alerts Timeline ({filteredAlerts.length})</h3>
          <input type="text" placeholder="Filter by policy..." value={policyFilter} onChange={function (e) { return setPolicyFilter(e.target.value); }} style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000',
            width: '200px'
        }}/>
        </div>

        {filteredAlerts.length > 0 ? (<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredAlerts.slice(0, 15).map(function (alert) { return (<div key={alert.id} style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                    borderRadius: '6px',
                    borderLeft: "4px solid ".concat(getSeverityColor(alert.severity))
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: getSeverityColor(alert.severity) }}>
                      {alert.alertType}
                    </div>
                    <div style={{ fontSize: '0.9em', marginTop: '4px' }}>
                      {alert.description}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#888', marginTop: '6px' }}>
                      {alert.userName} • {new Date(alert.timestamp).toLocaleString()}
                      {alert.policyViolated && " \u2022 Policy: ".concat(alert.policyViolated)}
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75em',
                    fontWeight: '600',
                    background: getSeverityColor(alert.severity),
                    color: 'white'
                }}>
                    {alert.severity}
                  </span>
                </div>
              </div>); })}
          </div>) : (<div className="empty-state">No DLP alerts</div>)}
      </div>

      <div className="dashboard-grid">
        {/* EDR Incidents Heatmap */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>EDR Incidents ({filteredIncidents.length})</h3>
            <input type="text" placeholder="Filter by asset..." value={assetFilter} onChange={function (e) { return setAssetFilter(e.target.value); }} style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000',
            width: '150px'
        }}/>
          </div>

          {filteredIncidents.length > 0 ? (<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredIncidents.slice(0, 10).map(function (incident) { return (<div key={incident.id} style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                    borderRadius: '6px',
                    borderLeft: "4px solid ".concat(getSeverityColor(incident.severity))
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{incident.incidentType}</div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                        Asset: {incident.affectedAsset}
                      </div>
                      <div style={{ fontSize: '0.8em', color: '#888', marginTop: '2px' }}>
                        {new Date(incident.detectionTime).toLocaleString()}
                      </div>
                      <div style={{
                    display: 'inline-block',
                    marginTop: '6px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75em',
                    background: getStatusColor(incident.status) + '33',
                    color: getStatusColor(incident.status),
                    fontWeight: '600'
                }}>
                        {incident.status}
                      </div>
                    </div>
                    {incident.status === 'OPEN' && (<button onClick={function () { return handleEscalate(incident.id); }} style={{
                        padding: '6px 12px',
                        background: '#ff6b6b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85em',
                        marginLeft: '12px'
                    }} title="Escalate to full investigation">
                        ⚠ Escalate
                      </button>)}
                  </div>
                </div>); })}
            </div>) : (<div className="empty-state">No EDR incidents</div>)}
        </div>

        {/* Open Investigations */}
        <div className="dashboard-card">
          <h3>Open Investigations ({investigations.filter(function (i) { return i.status !== 'CLOSED'; }).length})</h3>
          {investigations.length > 0 ? (<ul className="card-list">
              {investigations
                .filter(function (inv) { return inv.status !== 'CLOSED'; })
                .slice(0, 10)
                .map(function (inv) { return (<li key={inv.id}>
                    <div style={{ fontWeight: '500', color: getSeverityColor(inv.priority) }}>
                      {inv.title}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                      Investigator: {inv.investigator}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#888', marginTop: '2px' }}>
                      {inv.relatedIncidents} related incidents • Started {new Date(inv.startedAt).toLocaleDateString()}
                    </div>
                  </li>); })}
            </ul>) : (<div className="empty-state">No open investigations</div>)}
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div className="dashboard-card">
        <h3>Recent Audit Logs</h3>
        {renderPaginationControls()}
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85em' }}>Severity</label>
            <select value={logSeverityFilter} onChange={function (e) {
            setLogSeverityFilter(e.target.value);
            setLogPage(0);
        }} style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc')
        }}>
              <option value="all">All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <input type="text" value={logSearchTerm} onChange={function (e) {
            setLogSearchTerm(e.target.value);
            setLogPage(0);
        }} placeholder="Search action, details, account, IP" style={{
            flex: '1 1 220px',
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc')
        }}/>
          <input type="text" value={logUserIdFilter} onChange={function (e) {
            setLogUserIdFilter(e.target.value);
            setLogPage(0);
        }} placeholder="User ID" style={{
            minWidth: '140px',
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc')
        }}/>
          <input type="text" value={logUserNameFilter} onChange={function (e) {
            setLogUserNameFilter(e.target.value);
            setLogPage(0);
        }} placeholder="User name" style={{
            minWidth: '180px',
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc')
        }}/>
          <button onClick={handleClearLogs} style={{
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer'
        }}>
            Clear Logs
          </button>
          <button onClick={function () {
            loadSecurityData();
            loadAuditLogs();
        }} style={{
            background: theme === 'dark' ? '#444' : '#f0f0f0',
            border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ccc'),
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer'
        }}>
            Refresh
          </button>
        </div>
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '12px'
        }}>
          <label style={{ fontSize: '0.85em' }}>From</label>
          <input type="datetime-local" value={logStartTime} onChange={function (e) {
            setLogStartTime(e.target.value);
            setLogPage(0);
        }} style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc')
        }}/>
          <label style={{ fontSize: '0.85em' }}>To</label>
          <input type="datetime-local" value={logEndTime} onChange={function (e) {
            setLogEndTime(e.target.value);
            setLogPage(0);
        }} style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc')
        }}/>
          {auditLogError && (<span style={{ color: '#d9534f', fontSize: '0.85em' }}>{auditLogError}</span>)}
        </div>
        {auditLogLoading && (<div style={{ marginBottom: '12px', fontSize: '0.85em', color: '#888' }}>
            Loading audit logs…
          </div>)}
        {logsToRender.length > 0 ? (<div style={{
                overflowX: 'auto',
                fontSize: '0.85em',
                fontFamily: 'monospace'
            }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                borderBottom: "2px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                textAlign: 'left'
            }}>
                  <th style={{ padding: '8px' }}>Timestamp</th>
                  <th style={{ padding: '8px' }}>User</th>
                  <th style={{ padding: '8px' }}>Severity</th>
                  <th style={{ padding: '8px' }}>Action</th>
                  <th style={{ padding: '8px' }}>Details</th>
                  <th style={{ padding: '8px' }}>Resource</th>
                  <th style={{ padding: '8px' }}>IP Address</th>
                  <th style={{ padding: '8px' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {logsToRender.map(function (log) { return (<tr key={log.id} style={{
                    borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee')
                }}>
                    <td style={{ padding: '8px' }}>{formatTimestampHK(log.timestamp)}</td>
                    <td style={{ padding: '8px' }}>
                      <div>{log.userName || log.accountId || '—'}</div>
                      {log.accountId && log.accountId !== log.userName && (<div style={{ fontSize: '0.7em', color: '#888' }}>{log.accountId}</div>)}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                    padding: '2px 10px',
                    borderRadius: '999px',
                    fontSize: '0.75em',
                    fontWeight: 600,
                    background: severityColorMap[log.severity] || '#888',
                    color: 'white'
                }}>
                        {log.severity}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div>{log.action}</div>
                      {log.details && (<div style={{ fontSize: '0.75em', color: '#888', marginTop: '4px' }}>
                          {log.details}
                        </div>)}
                    </td>
                    <td style={{ padding: '8px' }}>{log.details || '—'}</td>
                    <td style={{ padding: '8px' }}>{log.resource || '—'}</td>
                    <td style={{ padding: '8px' }}>{log.ipAddress || '—'}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                    color: log.result === 'SUCCESS' ? '#4caf50' : '#ff6b6b',
                    fontWeight: '600'
                }}>
                        {log.result}
                      </span>
                    </td>
                  </tr>); })}
              </tbody>
            </table>
          </div>) : (<div className="empty-state">
            {auditLogLoading ? 'Loading audit logs…' : 'No audit logs match the current filters'}
          </div>)}
        {renderPaginationControls()}
      </div>
    </div>);
}
