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
exports.default = AdminDashboardPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var authStore_1 = require("../../store/authStore");
var api_1 = require("../../api");
var DashboardSkeleton_1 = require("../../components/DashboardSkeleton");
function AdminDashboardPage() {
    var _this = this;
    var _a;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _b = (0, react_1.useState)(null), health = _b[0], setHealth = _b[1];
    var _c = (0, react_1.useState)([]), alerts = _c[0], setAlerts = _c[1];
    var _d = (0, react_1.useState)(null), userSummary = _d[0], setUserSummary = _d[1];
    var _e = (0, react_1.useState)([]), logs = _e[0], setLogs = _e[1];
    var _f = (0, react_1.useState)(true), loading = _f[0], setLoading = _f[1];
    var _g = (0, react_1.useState)(''), error = _g[0], setError = _g[1];
    var _h = (0, react_1.useState)([]), recoverableUsers = _h[0], setRecoverableUsers = _h[1];
    var _j = (0, react_1.useState)(null), llmHealth = _j[0], setLlmHealth = _j[1];
    var _k = (0, react_1.useState)(false), llmHealthLoading = _k[0], setLlmHealthLoading = _k[1];
    var _l = (0, react_1.useState)(''), llmHealthError = _l[0], setLlmHealthError = _l[1];
    // Filters
    var _m = (0, react_1.useState)('all'), logLevelFilter = _m[0], setLogLevelFilter = _m[1];
    (0, react_1.useEffect)(function () {
        loadAdminData();
        loadLlmHealth();
        var interval = setInterval(loadAdminData, 30000); // Refresh every 30s
        var llmInterval = setInterval(loadLlmHealth, 30000);
        return function () {
            clearInterval(interval);
            clearInterval(llmInterval);
        };
    }, []);
    var formatPercent = function (value) {
        var n = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(n))
            return { text: '0%', width: 0 };
        var clamped = Math.max(0, Math.min(100, n));
        var text = clamped % 1 === 0 ? "".concat(clamped.toFixed(0), "%") : "".concat(clamped.toFixed(1), "%");
        return { text: text, width: clamped };
    };
    var loadAdminData = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, healthRes, alertsRes, summaryRes, logsRes, usersRes, allUsers, now_1, THIRTY_DAYS_MS_1, recoverables, err_1;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (loading)
                        setLoading(true); // Only show loading on initial load
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, Promise.all([
                            api_1.apiClient.getSystemHealth(),
                            api_1.apiClient.getRecentAlerts(),
                            api_1.apiClient.getUserSummary2(),
                            api_1.apiClient.getSystemLogs(),
                            api_1.apiClient.getAllUsers()
                        ])];
                case 2:
                    _a = _d.sent(), healthRes = _a[0], alertsRes = _a[1], summaryRes = _a[2], logsRes = _a[3], usersRes = _a[4];
                    setHealth(healthRes.data);
                    setAlerts(alertsRes.data || []);
                    setUserSummary(summaryRes.data);
                    setLogs(logsRes.data || []);
                    allUsers = (usersRes.data || []);
                    now_1 = Date.now();
                    THIRTY_DAYS_MS_1 = 30 * 24 * 60 * 60 * 1000;
                    recoverables = allUsers.filter(function (u) {
                        if (!u.deletedAt)
                            return false;
                        var deletedTime = new Date(u.deletedAt).getTime();
                        return now_1 - deletedTime <= THIRTY_DAYS_MS_1;
                    });
                    setRecoverableUsers(recoverables);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _d.sent();
                    setError(((_c = (_b = err_1.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load admin dashboard data');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var loadLlmHealth = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_2;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setLlmHealthLoading(true);
                    setLlmHealthError('');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getLlmHealth()];
                case 2:
                    res = _e.sent();
                    setLlmHealth(res.data || null);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _e.sent();
                    setLlmHealth(((_b = (_a = err_2 === null || err_2 === void 0 ? void 0 : err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.data) || null);
                    setLlmHealthError(((_d = (_c = err_2.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to load LLM health');
                    return [3 /*break*/, 5];
                case 4:
                    setLlmHealthLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleExportLogs = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, blob, url, a, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.exportLogs('24h')];
                case 1:
                    response = _c.sent();
                    blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                    url = window.URL.createObjectURL(blob);
                    a = document.createElement('a');
                    a.href = url;
                    a.download = "system-logs-".concat(new Date().toISOString(), ".json");
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
    var getHealthColor = function (status) {
        switch (status) {
            case 'HEALTHY':
            case 'UP':
            case 'CONNECTED': return '#4caf50';
            case 'DEGRADED': return '#ffa500';
            case 'DOWN':
            case 'DISCONNECTED': return '#ff6b6b';
            default: return '#888';
        }
    };
    var getLogLevelColor = function (level) {
        switch (level) {
            case 'ERROR': return '#ff6b6b';
            case 'WARN': return '#ffa500';
            case 'INFO': return '#007bff';
            case 'DEBUG': return '#888';
            default: return '#888';
        }
    };
    var formatUptime = function (seconds) {
        var days = Math.floor(seconds / 86400);
        var hours = Math.floor((seconds % 86400) / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        return "".concat(days, "d ").concat(hours, "h ").concat(minutes, "m");
    };
    // Filter logs
    var filteredLogs = logLevelFilter === 'all'
        ? logs
        : logs.filter(function (log) { return log.level === logLevelFilter; });
    if (loading && !health) {
        return <DashboardSkeleton_1.default variant="admin"/>;
    }
    if (error && !health) {
        return (<div className="dashboard">
        <div className="error-message">{error}</div>
        <button onClick={loadAdminData} className="primary" style={{ marginTop: '20px' }}>
          Retry
        </button>
      </div>);
    }
    return (<div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p style={{ color: '#888', marginTop: '8px' }}>
            System Monitoring & User Management
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={function () { return navigate('/admin'); }} style={{ padding: '8px 16px', background: '#007bff' }}>
            Manage User
          </button>
          <button onClick={function () { return navigate('/admin/watermark-traceback'); }} style={{ padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '4px' }}>
            🔍 Watermark Traceback
          </button>
          <button onClick={function () { return navigate('/admin/recovery'); }} style={{ padding: '8px 16px', background: '#ff6b6b', color: 'white', border: 'none', borderRadius: '4px' }}>
            🗑 Recovery Accounts {recoverableUsers.length > 0 && "(".concat(recoverableUsers.length, ")")}
          </button>
          <button onClick={handleExportLogs} style={{ padding: '8px 16px' }}>
            📥 Export Logs
          </button>
        </div>
      </div>

      {/* Recovery Accounts button removed; functionality moved to dedicated page */}
      {/* Infrastructure Health */}
      {health && (<div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Infrastructure Health</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.85em',
                fontWeight: '600',
                background: getHealthColor(health.status),
                color: 'white'
            }}>
                {health.status}
              </span>
              <span style={{ fontSize: '0.8em', color: '#888' }}>
                Last checked: {new Date(health.lastChecked).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5em', fontWeight: '600' }}>{formatUptime(health.uptime)}</div>
              <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>Uptime</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5em', fontWeight: '600', color: health.cpuUsage > 80 ? '#ff6b6b' : '#4caf50' }}>
                {health.cpuUsage}%
              </div>
              <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>CPU Usage</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5em', fontWeight: '600', color: health.memoryUsage > 80 ? '#ff6b6b' : '#4caf50' }}>
                {health.memoryUsage}%
              </div>
              <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>Memory Usage</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5em', fontWeight: '600', color: health.diskUsage > 80 ? '#ff6b6b' : '#4caf50' }}>
                {health.diskUsage}%
              </div>
              <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>Disk Usage</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '1.5em',
                fontWeight: '600',
                color: getHealthColor(health.databaseStatus)
            }}>
                {health.databaseStatus}
              </div>
              <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>Database</div>
            </div>
          </div>

          {health.services && health.services.length > 0 && (<div style={{ marginTop: '20px' }}>
              <h4 style={{ marginBottom: '12px' }}>Services Status</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {health.services.map(function (service) { return (<div key={service.name} style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getHealthColor(service.status)
                    }}></div>
                    <span style={{ fontSize: '0.9em' }}>{service.name}</span>
                    {service.responseTime && (<span style={{ fontSize: '0.8em', color: '#888' }}>
                        ({service.responseTime}ms)
                      </span>)}
                  </div>); })}
              </div>
            </div>)}
        </div>)}

      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3>LLM Health (Vertex AI)</h3>
          <button onClick={loadLlmHealth} disabled={llmHealthLoading} style={{ padding: '6px 10px', background: llmHealthLoading ? '#999' : '#5e35b1' }}>
            {llmHealthLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {llmHealthError && (<div style={{ marginBottom: '10px', color: '#ff6b6b', fontSize: '0.9em' }}>
            {llmHealthError}
          </div>)}

        {llmHealth ? (<div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div><strong>Status:</strong> {llmHealth.status || 'UNKNOWN'}</div>
            <div><strong>Auth Mode:</strong> {llmHealth.authMode || 'N/A'}</div>
            <div><strong>LLM Enabled:</strong> {String(llmHealth.llmEnabled)}</div>
            <div><strong>API Key Configured:</strong> {String(llmHealth.apiKeyConfigured)}</div>
            <div><strong>Project Configured:</strong> {String(llmHealth.projectConfigured)}</div>
            <div><strong>Token OK:</strong> {String(llmHealth.tokenOk)}</div>
            <div><strong>Vertex Reachable:</strong> {String(llmHealth.vertexReachable)}</div>
            <div><strong>Vertex HTTP:</strong> {String((_a = llmHealth.vertexHttpStatus) !== null && _a !== void 0 ? _a : 'N/A')}</div>
            <div><strong>Project:</strong> {llmHealth.project || 'N/A'}</div>
            <div><strong>Location:</strong> {llmHealth.location || 'N/A'}</div>
            <div><strong>Model:</strong> {llmHealth.model || 'N/A'}</div>
            {llmHealth.message && (<div style={{ gridColumn: '1 / -1' }}><strong>Message:</strong> {llmHealth.message}</div>)}
            {llmHealth.error && (<div style={{ gridColumn: '1 / -1', color: '#ff6b6b' }}><strong>Error:</strong> {llmHealth.error}</div>)}
          </div>) : llmHealthLoading ? (<div className="empty-state">Loading LLM health data, please wait...</div>) : (<div className="empty-state">No LLM health data</div>)}
      </div>

      <div className="dashboard-grid">
        {/* Notifications */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Notifications ({Math.min(alerts.length, 5)})</h3>
            <button onClick={function () { return navigate('/notifications'); }} style={{ padding: '6px 10px' }}>
              View all
            </button>
          </div>
          <div style={{ marginBottom: '10px', fontSize: '0.9em', color: '#888' }}>
            Warning alerts, failures, and UEBA account actions. Admins see all; users see their own.
          </div>

          {alerts.length > 0 ? (<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {alerts.slice(0, 5).map(function (alert) { return (<div key={alert.id} style={{
                    padding: '10px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                    borderRadius: '6px',
                    borderLeft: "4px solid ".concat(alert.severity === 'HIGH' ? '#ff6b6b' : alert.severity === 'MEDIUM' ? '#ffa500' : '#757575')
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600' }}>{alert.alertType}</div>
                      <div style={{ fontSize: '0.8em', color: '#888', marginTop: '4px' }}>
                        {new Date(alert.alertTime).toLocaleString()}
                      </div>
                      {alert.description && (<div style={{ fontSize: '0.85em', color: theme === 'dark' ? '#ddd' : '#444', marginTop: '6px' }}>
                          {alert.description}
                        </div>)}
                    </div>
                    <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75em',
                    fontWeight: '600',
                    background: (alert.severity === 'HIGH' ? '#ff6b6b' : alert.severity === 'MEDIUM' ? '#ffa500' : '#757575') + '33',
                    color: alert.severity === 'HIGH' ? '#ff6b6b' : alert.severity === 'MEDIUM' ? '#ffa500' : '#757575'
                }}>
                      {alert.severity}
                    </span>
                  </div>
                  {(alert.resourceType || alert.resourceId) && (<div style={{ marginTop: '6px', fontSize: '0.75em', color: '#888' }}>
                      {alert.resourceType || 'RESOURCE'}{alert.resourceId ? ": ".concat(alert.resourceId) : ''}
                    </div>)}
                </div>); })}
            </div>) : (<div className="empty-state">No notifications</div>)}
        </div>

        {/* User Provisioning Summary */}
        {userSummary && (<div className="dashboard-card">
            <h3>User Provisioning Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8em', fontWeight: '600', color: '#007bff' }}>
                    {userSummary.totalUsers}
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>Total Users</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8em', fontWeight: '600', color: '#4caf50' }}>
                    {userSummary.activeUsers}
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>Active Users</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8em', fontWeight: '600', color: '#ff6b6b' }}>
                    {userSummary.lockedUsers}
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>Locked Users</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8em', fontWeight: '600', color: '#ffa500' }}>
                    {userSummary.newUsersLast7Days}
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>New (7d)</div>
                </div>
              </div>

              <div>
                <div style={{ marginBottom: '8px', fontSize: '0.9em', fontWeight: '500' }}>
                  MFA Adoption: {formatPercent(userSummary.mfaEnabledPercentage).text}
                </div>
                <div style={{
                height: '24px',
                background: theme === 'dark' ? '#333' : '#e0e0e0',
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                  <div style={{
                height: '100%',
                width: "".concat(formatPercent(userSummary.mfaEnabledPercentage).width, "%"),
                background: 'linear-gradient(90deg, #4caf50, #2e7d32)',
                transition: 'width 0.3s ease'
            }}></div>
                </div>
                <div style={{ fontSize: '0.8em', color: '#888', marginTop: '4px' }}>
                  {userSummary.mfaEnabledCount} / {userSummary.totalUsers} users
                </div>
              </div>

              {userSummary.usersByDepartment && userSummary.usersByDepartment.length > 0 && (<div>
                  <h4 style={{ marginBottom: '10px' }}>Users by Department</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {userSummary.usersByDepartment.map(function (dept) { return (<div key={dept.department} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em' }}>
                        <span>{dept.department}</span>
                        <span style={{ fontWeight: '600' }}>{dept.count}</span>
                      </div>); })}
                  </div>
                </div>)}

              {userSummary.usersByRole && userSummary.usersByRole.length > 0 && (<div>
                  <h4 style={{ marginBottom: '10px' }}>Users by Role</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {userSummary.usersByRole.map(function (role) { return (<div key={role.role} style={{
                        padding: '6px 12px',
                        borderRadius: '12px',
                        background: theme === 'dark' ? '#2a2a2a' : '#f0f0f0',
                        fontSize: '0.85em'
                    }}>
                        {role.role}: <strong>{role.count}</strong>
                      </div>); })}
                  </div>
                </div>)}

              {userSummary.uebaUsers && (<div>
                  <h4 style={{ marginBottom: '10px' }}>UEBA Focus (Score &lt; 100, low → high)</h4>
                  {userSummary.uebaUsers.length === 0 ? (<div style={{ fontSize: '0.9em', color: '#888' }}>No users below 100.</div>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {userSummary.uebaUsers.map(function (u) { return (<div key={u.userId} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: theme === 'dark' ? '#2a2a2a' : '#f7f7f7'
                        }}>
                          <div style={{ fontSize: '0.9em' }}>
                            <strong>{u.accountId}</strong> · {u.fullName} · {u.department || 'N/A'}
                          </div>
                          <div style={{ fontSize: '0.9em', fontWeight: 700, color: u.uebaScore <= 50 ? '#ff6b6b' : u.uebaScore <= 90 ? '#ffa500' : '#4caf50' }}>
                            {u.uebaScore}
                          </div>
                        </div>); })}
                    </div>)}
                </div>)}
            </div>
          </div>)}
      </div>

      {/* System Logs */}
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>System Logs</h3>
          <select value={logLevelFilter} onChange={function (e) { return setLogLevelFilter(e.target.value); }} style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}>
            <option value="all">All Levels</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
          </select>
        </div>

        {filteredLogs.length > 0 ? (<div style={{
                overflowX: 'auto',
                fontSize: '0.8em',
                fontFamily: 'monospace',
                maxHeight: '400px',
                overflowY: 'auto'
            }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: theme === 'dark' ? '#1a1a1a' : '#fff' }}>
                <tr style={{ borderBottom: "2px solid ".concat(theme === 'dark' ? '#444' : '#ddd'), textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Time</th>
                  <th style={{ padding: '8px' }}>Level</th>
                  <th style={{ padding: '8px' }}>Logger</th>
                  <th style={{ padding: '8px' }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 50).map(function (log) { return (<tr key={log.id} style={{ borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee') }}>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.9em',
                    fontWeight: '600',
                    background: getLogLevelColor(log.level) + '33',
                    color: getLogLevelColor(log.level)
                }}>
                        {log.level}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>{log.logger}</td>
                    <td style={{ padding: '8px' }}>
                      {log.message}
                      {log.exception && (<div style={{ fontSize: '0.9em', color: '#ff6b6b', marginTop: '4px' }}>
                          {log.exception}
                        </div>)}
                    </td>
                  </tr>); })}
              </tbody>
            </table>
          </div>) : (<div className="empty-state">No logs available</div>)}
      </div>
    </div>);
}
