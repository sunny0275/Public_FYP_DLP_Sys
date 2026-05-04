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
exports.default = NotificationsPage;
var react_1 = require("react");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var authStore_1 = require("../../store/authStore");
function NotificationsPage() {
    var _this = this;
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _a = (0, react_1.useState)([]), alerts = _a[0], setAlerts = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    (0, react_1.useEffect)(function () {
        var cancelled = false;
        var load = function () { return __awaiter(_this, void 0, void 0, function () {
            var res, e_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        setLoading(true);
                        setError('');
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, api_1.apiClient.getRecentAlerts()];
                    case 2:
                        res = _c.sent();
                        if (!cancelled && res.success && res.data)
                            setAlerts(res.data);
                        return [3 /*break*/, 5];
                    case 3:
                        e_1 = _c.sent();
                        if (!cancelled)
                            setError(((_b = (_a = e_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load notifications');
                        return [3 /*break*/, 5];
                    case 4:
                        if (!cancelled)
                            setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        load();
        return function () { cancelled = true; };
    }, []);
    var getSeverityColor = function (severity) {
        switch (severity) {
            case 'HIGH': return '#f44336';
            case 'MEDIUM': return '#ff9800';
            default: return '#757575';
        }
    };
    var formatTime = function (t) {
        try {
            return new Date(t).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
        }
        catch (_a) {
            return t;
        }
    };
    return (<DashboardLayout_1.default>
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: '28px', fontWeight: '600' }}>Notifications</h1>
        <p style={{ margin: '0 0 20px', color: theme === 'dark' ? '#aaa' : '#666', fontSize: '14px' }}>
          Warning alerts, failures, and UEBA account actions. Admins see all; users see their own.
        </p>

        {error && (<div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>)}

        {loading ? (<div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading...</div>) : alerts.length === 0 ? (<div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No notifications</div>) : (<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {alerts.map(function (alert) { return (<li key={alert.id} style={{
                    padding: '16px',
                    marginBottom: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                    borderRadius: '8px',
                    border: "1px solid ".concat(theme === 'dark' ? '#444' : '#eee'),
                    borderLeft: "4px solid ".concat(getSeverityColor(alert.severity))
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '600', color: getSeverityColor(alert.severity), marginRight: '8px' }}>
                      {alert.alertType}
                    </span>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#999' : '#666' }}>
                      {formatTime(alert.alertTime)}
                    </span>
                    {alert.resourceType && (<span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>{alert.resourceType}</span>)}
                    {alert.description && (<div style={{ marginTop: '8px', fontSize: '14px', color: theme === 'dark' ? '#ddd' : '#333' }}>
                        {alert.description}
                      </div>)}
                  </div>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: getSeverityColor(alert.severity) + '33',
                    color: getSeverityColor(alert.severity)
                }}>
                    {alert.severity}
                  </span>
                </div>
              </li>); })}
          </ul>)}
      </div>
    </DashboardLayout_1.default>);
}
