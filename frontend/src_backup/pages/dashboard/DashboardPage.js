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
exports.default = DashboardPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
var DashboardSkeleton_1 = require("../../components/DashboardSkeleton");
function DashboardPage() {
    var _this = this;
    var _a;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var user = (0, authStore_1.useAuthStore)().user;
    var _b = (0, react_1.useState)(null), summary = _b[0], setSummary = _b[1];
    var _c = (0, react_1.useState)([]), recentDocs = _c[0], setRecentDocs = _c[1];
    var _d = (0, react_1.useState)([]), alerts = _d[0], setAlerts = _d[1];
    var _e = (0, react_1.useState)(null), pendingReviewCount = _e[0], setPendingReviewCount = _e[1];
    var _f = (0, react_1.useState)(true), loading = _f[0], setLoading = _f[1];
    var _g = (0, react_1.useState)(''), error = _g[0], setError = _g[1];
    var isReviewer = ((_a = user === null || user === void 0 ? void 0 : user.roles) === null || _a === void 0 ? void 0 : _a.some(function (r) { return r === 'REVIEWER' || r === 'ROLE_REVIEWER'; })) || false;
    (0, react_1.useEffect)(function () {
        var _a;
        // Admin should not stay on the Overview page; redirect defensively
        if ((_a = user === null || user === void 0 ? void 0 : user.roles) === null || _a === void 0 ? void 0 : _a.includes('ADMIN')) {
            navigate('/dashboard/admin', { replace: true });
            return;
        }
        loadDashboardData();
    }, []);
    var loadDashboardData = function () { return __awaiter(_this, void 0, void 0, function () {
        var promises, _a, summaryRes, docsRes, alertsRes, reviewCountRes, err_1;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    promises = [
                        api_1.apiClient.getUserSummary(),
                        api_1.apiClient.getRecentDocuments(),
                        api_1.apiClient.getRecentAlerts()
                    ];
                    // Load pending review count if user is REVIEWER
                    if (isReviewer) {
                        promises.push(api_1.apiClient.getPendingReviewCount());
                    }
                    return [4 /*yield*/, Promise.all(promises)];
                case 2:
                    _a = _d.sent(), summaryRes = _a[0], docsRes = _a[1], alertsRes = _a[2], reviewCountRes = _a[3];
                    setSummary(summaryRes.data);
                    setRecentDocs(docsRes.data);
                    setAlerts(alertsRes.data);
                    if (isReviewer && reviewCountRes) {
                        setPendingReviewCount(reviewCountRes.data);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _d.sent();
                    setError(((_c = (_b = err_1.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load dashboard data');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    if (loading) {
        return <DashboardSkeleton_1.default variant="default"/>;
    }
    if (error) {
        return (<div className="dashboard">
        <div className="error-message">{error}</div>
        <button onClick={loadDashboardData} className="primary" style={{ marginTop: '20px' }}>
          Retry
        </button>
      </div>);
    }
    return (<div className="dashboard">
      <h1>Home{user ? " \u2013 Welcome, ".concat(user.fullName) : ''}</h1>

      {summary && (<div className="dashboard-card" style={{ marginBottom: '24px' }}>
          <h3>Profile</h3>
          <div style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <p><strong>Account ID:</strong> {summary.accountId}</p>
            <p><strong>Email:</strong> {summary.email}</p>
            <p><strong>Department:</strong> {summary.department}</p>
            <p><strong>Position:</strong> {summary.position}</p>
          </div>
          {summary.passwordExpiringSoon && summary.daysUntilPasswordExpiry !== null && (<div className="info-message" style={{ marginTop: '10px' }}>
              Your password will expire in {summary.daysUntilPasswordExpiry} day(s)
            </div>)}
        </div>)}

      {/* Reviewer Alert Card */}
      {isReviewer && pendingReviewCount !== null && pendingReviewCount > 0 && (<div className="dashboard-card" style={{
                marginBottom: '24px',
                background: '#fff3cd',
                border: '2px solid #ffc107',
                cursor: 'pointer'
            }} onClick={function () { return navigate('/classification/review'); }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#856404' }}>⚠️ Classification Review Required</h3>
              <p style={{ margin: 0, color: '#856404', fontSize: '0.95em' }}>
                {pendingReviewCount} document{pendingReviewCount !== 1 ? 's' : ''} pending classification review
              </p>
            </div>
            <button style={{
                padding: '10px 20px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
            }} onClick={function (e) {
                e.stopPropagation();
                navigate('/classification/review');
            }}>
              Review Now →
            </button>
          </div>
        </div>)}

      {/* Main entry points */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '1.5em', color: '#333' }}>Quick actions</h2>
        <div className="dashboard-grid">
          {/* Classification Review (for REVIEWER role) - Show first for reviewers */}
          {isReviewer && (<div className="dashboard-card" style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid #e0e0e0'
            }} onClick={function () { return navigate('/classification/review'); }} onMouseEnter={function (e) {
                e.currentTarget.style.borderColor = '#ff9800';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,152,0,0.15)';
            }} onMouseLeave={function (e) {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>🔍</div>
              <h3>Classification Review</h3>
              <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
                Review and approve document classification levels
              </p>
              <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#ff9800', marginTop: '8px' }}>
                Pending: {pendingReviewCount !== null && pendingReviewCount !== void 0 ? pendingReviewCount : 0}
              </div>
            </div>)}

          {/* Documents - Hide for REVIEWER */}
          {!isReviewer && (<div className="dashboard-card" style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid #e0e0e0'
            }} onClick={function () { return navigate('/documents'); }} onMouseEnter={function (e) {
                e.currentTarget.style.borderColor = '#007bff';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,123,255,0.15)';
            }} onMouseLeave={function (e) {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>📁</div>
              <h3>Documents</h3>
              <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
                Browse, search, and filter documents you have access to
              </p>
              <ul style={{ paddingLeft: '18px', fontSize: '0.9em', color: '#888', textAlign: 'left' }}>
                <li>Full-text search and advanced filters</li>
                <li>Classification-aware access control</li>
                <li>Batch operations</li>
              </ul>
            </div>)}

          {/* Upload - Hide for REVIEWER */}
          {!isReviewer && (<div className="dashboard-card" style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid #e0e0e0'
            }} onClick={function () { return navigate('/upload'); }} onMouseEnter={function (e) {
                e.currentTarget.style.borderColor = '#28a745';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(40,167,69,0.15)';
            }} onMouseLeave={function (e) {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>📤</div>
              <h3>Upload</h3>
              <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
                Upload a new document securely. The system will run automatic classification.
              </p>
              <ul style={{ paddingLeft: '18px', fontSize: '0.9em', color: '#888', textAlign: 'left' }}>
                <li>File size and type validation</li>
                <li>Background automatic classification</li>
                <li>OCR text extraction</li>
              </ul>
            </div>)}

          {/* My shares - Hide for REVIEWER */}
          {!isReviewer && (<div className="dashboard-card" style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid #e0e0e0'
            }} onClick={function () { return navigate('/my-shares'); }} onMouseEnter={function (e) {
                e.currentTarget.style.borderColor = '#6f42c1';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(111,66,193,0.15)';
            }} onMouseLeave={function (e) {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>🔗</div>
              <h3>My shares</h3>
              <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
                Manage document links you have shared
              </p>
              <ul style={{ paddingLeft: '18px', fontSize: '0.9em', color: '#888', textAlign: 'left' }}>
                <li>View share status</li>
                <li>Manage permissions</li>
                <li>Revoke share links</li>
              </ul>
            </div>)}

          {/* Profile & security */}
          <div className="dashboard-card" style={{
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            border: '2px solid #e0e0e0'
        }} onClick={function () { return navigate('/me'); }} onMouseEnter={function (e) {
            e.currentTarget.style.borderColor = '#dc3545';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,53,69,0.15)';
        }} onMouseLeave={function (e) {
            e.currentTarget.style.borderColor = '#e0e0e0';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
        }}>
            <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>👤</div>
            <h3>Profile & security</h3>
            <p style={{ color: '#666', marginBottom: '12px', fontSize: '0.95em' }}>
              Manage your profile, MFA, and password settings
            </p>
            <ul style={{ paddingLeft: '18px', fontSize: '0.9em', color: '#888', textAlign: 'left' }}>
              <li>View roles and department</li>
              <li>Change password / manage MFA</li>
              <li>Update profile info</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick info */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '1.5em', color: '#333' }}>Quick info</h2>
        <div className="dashboard-grid">
          {/* Recent documents */}
          <div className="dashboard-card">
            <h3>Recent documents</h3>
            {recentDocs.length > 0 ? (<ul className="card-list">
                {recentDocs.slice(0, 10).map(function (doc) { return (<li key={doc.id} style={{ cursor: 'pointer' }} onClick={function () { return navigate("/documents/".concat(doc.id)); }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ fontWeight: '500' }}>{doc.documentName}</div>
                      <button onClick={function (e) {
                    e.stopPropagation();
                    navigate("/documents/".concat(doc.id, "/signatures"));
                }} style={{
                    padding: '4px 8px',
                    fontSize: '0.8em',
                    background: '#2196f3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }} title="View signature chain">
                        ✍️ Signatures
                      </button>
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#888' }}>
                      {doc.classificationLevel} - {doc.department}
                    </div>
                  </li>); })}
              </ul>) : (<div className="empty-state">No recent documents</div>)}
            {recentDocs.length > 10 && (<button onClick={function () { return navigate('/documents'); }} style={{
                marginTop: '12px',
                padding: '6px 12px',
                fontSize: '0.9em',
                background: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                View all →
              </button>)}
          </div>

          {/* Recent alerts */}
          <div className="dashboard-card">
            <h3>Recent alerts ({(summary === null || summary === void 0 ? void 0 : summary.alertCount) || 0})</h3>
            <div style={{ marginBottom: '10px', fontSize: '0.9em', color: '#888' }}>
              Warning alerts, failures, and UEBA account actions.
            </div>
            {alerts.length > 0 ? (<ul className="card-list">
                {alerts.slice(0, 5).map(function (alert) { return (<li key={alert.id}>
                    <div style={{ fontWeight: '500', color: alert.severity === 'HIGH' ? '#ff6b6b' : 'inherit' }}>
                      {alert.alertType}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#888' }}>
                      {alert.description}
                    </div>
                  </li>); })}
              </ul>) : (<div className="empty-state">No alerts</div>)}
          </div>
        </div>
      </div>
    </div>);
}
